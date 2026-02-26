// ---------------------------------------------------------------------------
// AgentX -- Clarification Monitor
// ---------------------------------------------------------------------------
//
// Event-driven monitor for detecting stale, stuck, and deadlocked
// clarifications. No background daemon -- runs at workflow boundaries
// (hook start/finish, ready, clarify commands).
//
// Detection types:
//   STALE   -- pending clarification past SLA timer
//   STUCK   -- circular answers (same topic, direction flip in last 2 rounds)
//   DEADLOCK -- agents A and B each blocking on the other
// ---------------------------------------------------------------------------

import {
  ClarificationRecord,
  MonitorReport,
} from './clarificationTypes';
import { ClarificationRouter } from './clarificationRouter';
import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// ClarificationMonitor
// ---------------------------------------------------------------------------

/**
 * Scans all clarification ledgers for problems and takes automatic action.
 *
 * Usage:
 * ```ts
 * const monitor = new ClarificationMonitor(router, eventBus);
 * const report = await monitor.runCheck();
 * if (report.stale.length > 0) { ... }
 * ```
 */
export class ClarificationMonitor {
  constructor(
    private readonly router: ClarificationRouter,
    private readonly eventBus?: AgentEventBus,
  ) {}

  // ---------------------------------------------------------------------------
  // Main check -- run at workflow boundaries
  // ---------------------------------------------------------------------------

  /**
   * Scan all clarification ledgers for stale, stuck, and deadlocked cases.
   * Takes automatic action (retry/escalate) and returns a full report.
   */
  async runCheck(): Promise<MonitorReport> {
    const all = this.router.getActiveRecords();
    const report: MonitorReport = { stale: [], stuck: [], deadlocked: [] };

    const pending = all.filter(r => r.status === 'pending' || r.status === 'answered');

    // Stale detection
    for (const rec of pending) {
      if (this.isStale(rec)) {
        report.stale.push(rec);
        await this.handleStale(rec);
      }
    }

    // Stuck detection
    for (const rec of pending) {
      if (this.isStuck(rec)) {
        report.stuck.push(rec);
        await this.handleStuck(rec);
      }
    }

    // Deadlock detection
    const deadlocked = this.detectDeadlocks(all);
    for (const pair of deadlocked) {
      report.deadlocked.push(pair);
      await this.handleDeadlock(pair);
    }

    return report;
  }

  // ---------------------------------------------------------------------------
  // Detection logic
  // ---------------------------------------------------------------------------

  /**
   * Stale: pending clarification whose SLA has expired.
   */
  isStale(rec: ClarificationRecord): boolean {
    if (rec.status !== 'pending') { return false; }
    return new Date() > new Date(rec.staleAfter);
  }

  /**
   * Stuck: the last two consecutive question/answer pairs in the thread cover
   * the same topic between the same pair with flipped direction, indicating
   * circular back-and-forth.
   */
  isStuck(rec: ClarificationRecord): boolean {
    const questions = rec.thread.filter(e => e.type === 'question');
    if (questions.length < 2) { return false; }

    const lastTwo = questions.slice(-2);
    // Stuck if the last two questions are highly similar (same topic words)
    const similarity = this.textSimilarity(lastTwo[0].body, lastTwo[1].body);
    return similarity > 0.8;
  }

  /**
   * Deadlock: agents A and B each have active blocking clarifications waiting
   * on each other.
   */
  detectDeadlocks(
    records: ClarificationRecord[],
  ): Array<readonly [ClarificationRecord, ClarificationRecord]> {
    const blocking = records.filter(r => r.status === 'pending');
    const deadlocked: Array<readonly [ClarificationRecord, ClarificationRecord]> = [];

    for (let i = 0; i < blocking.length; i++) {
      for (let j = i + 1; j < blocking.length; j++) {
        const a = blocking[i];
        const b = blocking[j];
        // Deadlock: A->B and B->A with same or related issue
        if (a.from === b.to && a.to === b.from && a.issueNumber === b.issueNumber) {
          deadlocked.push([a, b] as const);
        }
      }
    }

    return deadlocked;
  }

  // ---------------------------------------------------------------------------
  // Auto-action handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle stale clarification.
   * First timeout: attempt auto-retry by re-invoking target (if runSubagent set).
   * Second timeout (rec has 'stale' status already): escalate.
   */
  private async handleStale(rec: ClarificationRecord): Promise<void> {
    if (rec.status === 'stale') {
      // Already marked stale once -- escalate
      await this.router.escalateRecord(
        rec.issueNumber,
        rec.id,
        'monitor',
        `Stale clarification escalated after second SLA timeout. ` +
        `Topic: ${rec.topic}. Agents: ${rec.from} -> ${rec.to}.`,
      );
    } else {
      // First time stale -- mark it
      this.eventBus?.emit('clarification-stale', {
        clarificationId: rec.id,
        issueNumber: rec.issueNumber,
        fromAgent: rec.from,
        toAgent: rec.to,
        topic: rec.topic,
        blocking: rec.blocking,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle stuck clarification -- escalate immediately.
   */
  private async handleStuck(rec: ClarificationRecord): Promise<void> {
    await this.router.escalateRecord(
      rec.issueNumber,
      rec.id,
      'monitor',
      `Stuck clarification detected: circular answers on topic "${rec.topic}". ` +
      `Last ${rec.thread.length} thread entries show repeating content. ` +
      `Agents: ${rec.from} <-> ${rec.to}.`,
    );
  }

  /**
   * Handle deadlock: escalate the lower-priority agent's clarification, allow
   * the higher-priority agent to continue.
   */
  private async handleDeadlock(
    pair: readonly [ClarificationRecord, ClarificationRecord],
  ): Promise<void> {
    const [a, b] = pair;
    const rankA = this.router.agentRank(a.from);
    const rankB = this.router.agentRank(b.from);

    // Lower rank (higher number) = lower priority -> escalate that one
    const [toEscalate, toContinue] = rankA <= rankB ? [b, a] : [a, b];

    await this.router.escalateRecord(
      toEscalate.issueNumber,
      toEscalate.id,
      'monitor',
      `Deadlock detected between '${a.from}' and '${b.from}'. ` +
      `Priority-break applied: '${toContinue.from}' continues (higher priority). ` +
      `'${toEscalate.from}' must wait for human resolution. ` +
      `Escalated: ${toEscalate.id}, Continuing: ${toContinue.id}.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Text similarity (Jaccard coefficient on word sets)
  // ---------------------------------------------------------------------------

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));

    if (wordsA.size === 0 && wordsB.size === 0) { return 1; }
    if (wordsA.size === 0 || wordsB.size === 0) { return 0; }

    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return intersection / union;
  }

  // ---------------------------------------------------------------------------
  // Convenience: get summary of active monitor state
  // ---------------------------------------------------------------------------

  getSummary(): {
    active: number;
    pending: number;
    stale: number;
    escalated: number;
  } {
    const all = this.router.getAllRecords();
    return {
      active: all.filter(r => r.status !== 'resolved' && r.status !== 'abandoned').length,
      pending: all.filter(r => r.status === 'pending').length,
      stale: all.filter(r => this.isStale(r)).length,
      escalated: all.filter(r => r.status === 'escalated').length,
    };
  }
}


