// ---------------------------------------------------------------------------
// AgentX -- Clarification Router
// ---------------------------------------------------------------------------
//
// Implements the Hub-Routed Clarification Protocol. Agent X mediates all
// clarification traffic; agents never communicate directly.
//
// Routing flow:
//   requestClarification -> validate scope (TOML can_clarify) ->
//   lock ledger -> write request -> invoke target via runSubagent ->
//   lock ledger -> write answer -> stream to renderer ->
//   repeat up to maxRounds -> auto-escalate
// ---------------------------------------------------------------------------

import * as path from 'path';
import * as fs from 'fs';
import {
  ClarificationLedger,
  ClarificationRecord,
  ClarificationRequestOptions,
  ClarificationResult,
  ClarificationStatus,
  ThreadEntry,
} from './clarificationTypes';
import { FileLockManager, readJsonSafe, writeJsonLocked } from './fileLock';
import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ClarificationRouterConfig {
  /** Root directory of the AgentX workspace. */
  workspaceRoot: string;
  /** EventBus for lifecycle events (optional). */
  eventBus?: AgentEventBus;
  /** Agent priority order for deadlock resolution (highest priority first). */
  agentPriority?: string[];
  /** Callback invoked to route a question to the target agent. */
  runSubagent?: (agentName: string, prompt: string) => Promise<string>;
}

export const AGENT_PRIORITY_DEFAULT = [
  'product-manager',
  'architect',
  'ux-designer',
  'engineer',
  'reviewer',
  'devops-engineer',
];

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ClarificationError extends Error {
  constructor(
    message: string,
    public readonly code: 'SCOPE_VIOLATION' | 'LOCK_TIMEOUT' | 'MAX_ROUNDS_EXCEEDED' | 'NOT_FOUND' | 'AGENT_ERROR',
  ) {
    super(message);
    this.name = 'ClarificationError';
  }
}

// ---------------------------------------------------------------------------
// ClarificationRouter
// ---------------------------------------------------------------------------

/**
 * Routes clarification requests between agents through Agent X (hub).
 *
 * The router is responsible for:
 *  - Scope validation (can_clarify TOML check)
 *  - Ledger read/write with file locking
 *  - Invoking the target agent via runSubagent
 *  - Round management and auto-escalation
 *  - Emitting EventBus lifecycle events
 */
export class ClarificationRouter {
  private readonly lockManager: FileLockManager;
  private readonly clarificationsDir: string;
  private readonly agentPriority: string[];
  private readonly runSubagentFn: ((agentName: string, prompt: string) => Promise<string>) | undefined;
  private readonly eventBus: AgentEventBus | undefined;

  constructor(private readonly config: ClarificationRouterConfig) {
    this.lockManager = new FileLockManager();
    this.clarificationsDir = path.join(config.workspaceRoot, '.agentx', 'state', 'clarifications');
    this.agentPriority = config.agentPriority ?? AGENT_PRIORITY_DEFAULT;
    this.runSubagentFn = config.runSubagent;
    this.eventBus = config.eventBus;
  }

  // ---------------------------------------------------------------------------
  // Ledger helpers
  // ---------------------------------------------------------------------------

  private ledgerPath(issueNumber: number): string {
    return path.join(this.clarificationsDir, `issue-${issueNumber}.json`);
  }

  private readLedger(issueNumber: number): ClarificationLedger {
    const ledger = readJsonSafe<ClarificationLedger>(this.ledgerPath(issueNumber));
    if (ledger) { return ledger; }
    return { issueNumber, clarifications: [] };
  }

  private async writeLedgerLocked<T>(
    issueNumber: number,
    agent: string,
    fn: (ledger: ClarificationLedger) => T,
  ): Promise<T> {
    const lp = this.ledgerPath(issueNumber);
    return this.lockManager.withSafeLock(lp, agent, async () => {
      const ledger = this.readLedger(issueNumber);
      const result = fn(ledger);
      writeJsonLocked(lp, ledger);
      return result;
    });
  }

  // ---------------------------------------------------------------------------
  // ID generation
  // ---------------------------------------------------------------------------

  private nextClarificationId(ledger: ClarificationLedger): string {
    const seq = ledger.clarifications.length + 1;
    return `CLR-${ledger.issueNumber}-${String(seq).padStart(3, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // SLA calculation
  // ---------------------------------------------------------------------------

  private staleAfter(slaMinutes: number): string {
    return new Date(Date.now() + slaMinutes * 60 * 1000).toISOString();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Request clarification from a target agent.
   *
   * If `runSubagent` is configured, this method handles the full round-trip
   * synchronously (request -> target agent invocation -> answer -> return).
   * Otherwise it writes the request to the ledger and returns, leaving the
   * caller to poll or wait for an answer.
   *
   * @throws ClarificationError on scope violation, lock timeout, or max rounds
   */
  async requestClarification(
    options: ClarificationRequestOptions,
    canClarifyList: string[],
  ): Promise<ClarificationResult> {
    const { issueNumber, fromAgent, toAgent, topic, question, blocking } = options;
    const maxRounds = options.maxRounds ?? (blocking ? 5 : 6);
    const slaMinutes = options.slaMinutes ?? 30;

    // Scope validation
    if (!canClarifyList.includes(toAgent)) {
      throw new ClarificationError(
        `Agent '${fromAgent}' cannot clarify with '${toAgent}'. Allowed: [${canClarifyList.join(', ')}]`,
        'SCOPE_VIOLATION',
      );
    }

    // Write request to ledger
    const record = await this.writeLedgerLocked(issueNumber, fromAgent, (ledger) => {
      const id = this.nextClarificationId(ledger);
      const now = new Date().toISOString();
      const rec: ClarificationRecord = {
        id,
        issueNumber,
        from: fromAgent,
        to: toAgent,
        topic,
        blocking,
        status: 'pending',
        round: 0,
        maxRounds,
        created: now,
        staleAfter: this.staleAfter(slaMinutes),
        resolvedAt: null,
        thread: [],
      };
      ledger.clarifications.push(rec);
      return rec;
    });

    // Emit event
    this.eventBus?.emit('clarification-requested', {
      clarificationId: record.id,
      issueNumber,
      fromAgent,
      toAgent,
      topic,
      blocking,
      timestamp: Date.now(),
    });

    // Route to target agent
    return this.conductRound(issueNumber, record.id, fromAgent, toAgent, question, canClarifyList);
  }

  /**
   * Conduct a single Q&A round: write question, invoke target, write answer.
   */
  private async conductRound(
    issueNumber: number,
    clarificationId: string,
    fromAgent: string,
    toAgent: string,
    question: string,
    canClarifyList: string[],
  ): Promise<ClarificationResult> {
    const ledgerPath = this.ledgerPath(issueNumber);

    // Write question to ledger
    const roundNum = await this.lockManager.withSafeLock(ledgerPath, fromAgent, async () => {
      const ledger = this.readLedger(issueNumber);
      const rec = this.findRecord(ledger, clarificationId);
      if (!rec) { throw new ClarificationError(`Clarification ${clarificationId} not found`, 'NOT_FOUND'); }

      // Check round limit
      if (rec.round >= rec.maxRounds) {
        await this.escalateRecord(issueNumber, clarificationId, fromAgent,
          `Maximum rounds (${rec.maxRounds}) reached without resolution.`);
        throw new ClarificationError(
          `CLR ${clarificationId} reached max rounds (${rec.maxRounds}). Auto-escalated.`,
          'MAX_ROUNDS_EXCEEDED',
        );
      }

      rec.round++;
      const entry: ThreadEntry = {
        round: rec.round,
        from: fromAgent,
        type: 'question',
        body: question,
        timestamp: new Date().toISOString(),
      };
      rec.thread.push(entry);
      writeJsonLocked(ledgerPath, ledger);
      return rec.round;
    });

    // Invoke target agent
    let answer: string;
    try {
      if (this.runSubagentFn) {
        const context = this.buildContextPrompt(issueNumber, clarificationId, toAgent, question);
        answer = await this.runSubagentFn(toAgent, context);
      } else {
        // Test/stub mode: return placeholder
        answer = `[ClarificationRouter] runSubagent not configured. Question for ${toAgent}: ${question}`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.escalateRecord(issueNumber, clarificationId, fromAgent,
        `Target agent '${toAgent}' failed: ${msg}`);
      throw new ClarificationError(`AGENT_ERROR invoking '${toAgent}': ${msg}`, 'AGENT_ERROR');
    }

    // Write answer to ledger
    const status = await this.lockManager.withSafeLock(ledgerPath, toAgent, async () => {
      const ledger = this.readLedger(issueNumber);
      const rec = this.findRecord(ledger, clarificationId);
      if (!rec) { return 'escalated' as ClarificationStatus; }

      const entry: ThreadEntry = {
        round: roundNum,
        from: toAgent,
        type: 'answer',
        body: answer,
        timestamp: new Date().toISOString(),
      };
      rec.thread.push(entry);
      rec.status = 'answered';
      writeJsonLocked(ledgerPath, ledger);
      return rec.status;
    });

    // Emit answered event
    this.eventBus?.emit('clarification-answered', {
      clarificationId,
      issueNumber,
      fromAgent,
      toAgent,
      topic: this.getRecordTopic(issueNumber, clarificationId),
      blocking: this.isBlocking(issueNumber, clarificationId),
      timestamp: Date.now(),
    });

    return { clarificationId, answer, status, round: roundNum };
  }

  /**
   * Mark a clarification as resolved by the requesting agent.
   */
  async resolveClarification(
    issueNumber: number,
    clarificationId: string,
    resolutionBody: string,
    fromAgent: string,
  ): Promise<void> {
    const lp = this.ledgerPath(issueNumber);
    await this.lockManager.withSafeLock(lp, fromAgent, async () => {
      const ledger = this.readLedger(issueNumber);
      const rec = this.findRecord(ledger, clarificationId);
      if (!rec) { throw new ClarificationError(`Clarification ${clarificationId} not found`, 'NOT_FOUND'); }

      rec.status = 'resolved';
      rec.resolvedAt = new Date().toISOString();
      rec.thread.push({
        round: rec.round,
        from: fromAgent,
        type: 'resolution',
        body: resolutionBody,
        timestamp: new Date().toISOString(),
      });
      writeJsonLocked(lp, ledger);
    });

    this.eventBus?.emit('clarification-resolved', {
      clarificationId,
      issueNumber,
      fromAgent,
      toAgent: this.getRecordTo(issueNumber, clarificationId),
      topic: this.getRecordTopic(issueNumber, clarificationId),
      blocking: this.isBlocking(issueNumber, clarificationId),
      timestamp: Date.now(),
    });
  }

  /**
   * Escalate a clarification (auto or manual).
   */
  async escalateRecord(
    issueNumber: number,
    clarificationId: string,
    agent: string,
    summary: string,
  ): Promise<void> {
    const lp = this.ledgerPath(issueNumber);
    await this.lockManager.withSafeLock(lp, agent, async () => {
      const ledger = this.readLedger(issueNumber);
      const rec = this.findRecord(ledger, clarificationId);
      if (!rec) { return; }

      rec.status = 'escalated';
      rec.thread.push({
        round: rec.round,
        from: 'agent-x',
        type: 'escalation',
        body: summary,
        timestamp: new Date().toISOString(),
      });
      writeJsonLocked(lp, ledger);
    });

    this.eventBus?.emit('clarification-escalated', {
      clarificationId,
      issueNumber,
      fromAgent: agent,
      toAgent: this.getRecordTo(issueNumber, clarificationId),
      topic: this.getRecordTopic(issueNumber, clarificationId),
      blocking: this.isBlocking(issueNumber, clarificationId),
      timestamp: Date.now(),
    });
  }

  /**
   * Get all clarification records across all known issue ledger files.
   */
  getAllRecords(): ClarificationRecord[] {
    if (!fs.existsSync(this.clarificationsDir)) { return []; }
    const files = fs.readdirSync(this.clarificationsDir)
      .filter(f => f.match(/^issue-\d+\.json$/) && !f.endsWith('.lock'));

    const records: ClarificationRecord[] = [];
    for (const file of files) {
      try {
        const ledger = readJsonSafe<ClarificationLedger>(
          path.join(this.clarificationsDir, file)
        );
        if (ledger?.clarifications) {
          // Ensure issueNumber is set on each record (back-compat for older files)
          const withIssueNum = ledger.clarifications.map(r =>
            r.issueNumber !== undefined ? r : { ...r, issueNumber: ledger.issueNumber }
          );
          records.push(...withIssueNum);
        }
      } catch { /* skip unreadable files */ }
    }
    return records;
  }

  /**
   * Get clarification records for a specific issue.
   */
  getRecords(issueNumber: number): ClarificationRecord[] {
    return this.readLedger(issueNumber).clarifications;
  }

  /**
   * Get active (non-resolved, non-abandoned) clarification records.
   */
  getActiveRecords(): ClarificationRecord[] {
    return this.getAllRecords().filter(r =>
      r.status !== 'resolved' && r.status !== 'abandoned'
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private findRecord(
    ledger: ClarificationLedger,
    clarificationId: string,
  ): ClarificationRecord | undefined {
    return ledger.clarifications.find(r => r.id === clarificationId);
  }

  private buildContextPrompt(
    issueNumber: number,
    clarificationId: string,
    _toAgent: string,
    question: string,
  ): string {
    return [
      `You are answering a clarification request for issue #${issueNumber}.`,
      `Clarification ID: ${clarificationId}`,
      ``,
      `Question:`,
      question,
      ``,
      `Provide a clear, actionable answer. Be specific and direct.`,
      `If the question refers to a document (PRD, ADR, Spec), read it first.`,
    ].join('\n');
  }

  private getRecordTopic(issueNumber: number, id: string): string {
    const ledger = this.readLedger(issueNumber);
    return this.findRecord(ledger, id)?.topic ?? '';
  }

  private getRecordTo(issueNumber: number, id: string): string {
    const ledger = this.readLedger(issueNumber);
    return this.findRecord(ledger, id)?.to ?? '';
  }

  private isBlocking(issueNumber: number, id: string): boolean {
    const ledger = this.readLedger(issueNumber);
    return this.findRecord(ledger, id)?.blocking ?? false;
  }

  /**
   * Priority rank for deadlock resolution (lower = higher priority).
   */
  agentRank(agentName: string): number {
    const idx = this.agentPriority.indexOf(agentName);
    return idx === -1 ? 999 : idx;
  }
}
