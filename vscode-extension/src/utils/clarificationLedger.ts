/**
 * Clarification and brainstorm ledger persistence.
 *
 * Writes per-issue JSON ledger files to `.agentx/state/clarifications/issue-{n}.json`
 * conforming to `.github/schemas/clarification-ledger.schema.json`.
 */
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordType = 'clarification' | 'brainstorm';
export type ClarificationStatus = 'pending' | 'answered' | 'resolved' | 'stale' | 'escalated' | 'abandoned';
export type ThreadEntryType = 'question' | 'answer' | 'resolution' | 'escalation';

export interface ThreadEntry {
  round: number;
  from: string;
  type: ThreadEntryType;
  body: string;
  timestamp: string;
}

export interface ClarificationRecord {
  id: string;
  from: string;
  to: string;
  topic: string;
  blocking: boolean;
  status: ClarificationStatus;
  round: number;
  maxRounds: number;
  created: string;
  staleAfter: string;
  resolvedAt: string | null;
  thread: ThreadEntry[];
  recordType?: RecordType;
}

export interface ClarificationLedger {
  issueNumber: number;
  clarifications: ClarificationRecord[];
}

export interface SaveRecordOptions {
  workspaceRoot: string;
  issueNumber: number;
  from: string;
  to: string;
  topic: string;
  thread: ThreadEntry[];
  resolved: boolean;
  escalatedToHuman: boolean;
  recordType?: RecordType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function staleIso(days = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function sanitizeAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function ledgerDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.agentx', 'state', 'clarifications');
}

function ledgerPath(workspaceRoot: string, issueNumber: number): string {
  return path.join(ledgerDir(workspaceRoot), `issue-${issueNumber}.json`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read an existing ledger for the given issue or return a new empty one.
 */
export function readLedger(workspaceRoot: string, issueNumber: number): ClarificationLedger {
  const fp = ledgerPath(workspaceRoot, issueNumber);
  if (fs.existsSync(fp)) {
    try {
      return JSON.parse(fs.readFileSync(fp, 'utf-8')) as ClarificationLedger;
    } catch {
      // Corrupted file -- start fresh
    }
  }
  return { issueNumber, clarifications: [] };
}

/**
 * Save a clarification or brainstorm record to the per-issue ledger.
 * Returns the generated record ID (e.g. `CLR-42-001`).
 */
export function saveClarificationRecord(opts: SaveRecordOptions): string {
  const issue = Math.max(0, opts.issueNumber);
  const dir = ledgerDir(opts.workspaceRoot);
  fs.mkdirSync(dir, { recursive: true });

  const ledger = readLedger(opts.workspaceRoot, issue);
  const seq = ledger.clarifications.length + 1;
  const id = `CLR-${issue}-${String(seq).padStart(3, '0')}`;

  const now = nowIso();
  const status: ClarificationStatus = opts.resolved
    ? 'resolved'
    : opts.escalatedToHuman
      ? 'escalated'
      : 'pending';

  const maxRound = opts.thread.reduce((m, e) => Math.max(m, e.round), 1);

  const record: ClarificationRecord = {
    id,
    from: sanitizeAgentName(opts.from),
    to: sanitizeAgentName(opts.to),
    topic: opts.topic,
    blocking: true,
    status,
    round: maxRound,
    maxRounds: 6,
    created: now,
    staleAfter: staleIso(),
    resolvedAt: opts.resolved ? now : null,
    thread: opts.thread,
    recordType: opts.recordType ?? 'clarification',
  };

  ledger.clarifications.push(record);
  fs.writeFileSync(
    ledgerPath(opts.workspaceRoot, issue),
    JSON.stringify(ledger, null, 2),
    'utf-8',
  );
  return id;
}

/**
 * Build a simple brainstorm record from a query and its rendered result.
 * This is a lightweight wrapper for brainstorm persistence from the chat surface.
 */
export function saveBrainstormRecord(
  workspaceRoot: string,
  issueNumber: number,
  query: string,
  resultSummary: string,
): string {
  const now = nowIso();
  const thread: ThreadEntry[] = [
    { round: 1, from: 'user', type: 'question', body: truncate(query, 2000), timestamp: now },
    { round: 1, from: 'agent-x', type: 'answer', body: truncate(resultSummary, 2000), timestamp: now },
    { round: 1, from: 'agent-x', type: 'resolution', body: 'Brainstorm session captured.', timestamp: now },
  ];

  return saveClarificationRecord({
    workspaceRoot,
    issueNumber,
    from: 'user',
    to: 'agent-x',
    topic: `Brainstorm: ${truncate(query, 200)}`,
    thread,
    resolved: true,
    escalatedToHuman: false,
    recordType: 'brainstorm',
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
