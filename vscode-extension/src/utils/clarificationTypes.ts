// ---------------------------------------------------------------------------
// AgentX -- Clarification Protocol: Shared Types
// ---------------------------------------------------------------------------
//
// Shared type definitions for the agent-to-agent clarification protocol.
// Imported by clarificationRouter, clarificationMonitor, clarificationRenderer,
// and the AgenticLoop integration.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type ClarificationStatus =
  | 'pending'
  | 'answered'
  | 'resolved'
  | 'stale'
  | 'escalated'
  | 'abandoned';

export type ThreadEntryType = 'question' | 'answer' | 'resolution' | 'escalation';

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

/** A single message in a clarification conversation. */
export interface ThreadEntry {
  readonly round: number;
  readonly from: string;
  readonly type: ThreadEntryType;
  readonly body: string;
  readonly timestamp: string;
}

/** A complete clarification request with full conversation history. */
export interface ClarificationRecord {
  /** CLR-{issue}-{seq:03d} */
  readonly id: string;
  /** Issue this clarification belongs to (duplicated for context when outside ledger). */
  readonly issueNumber: number;
  readonly from: string;
  readonly to: string;
  readonly topic: string;
  readonly blocking: boolean;
  status: ClarificationStatus;
  /** Current round number (starts at 1 on first question). */
  round: number;
  readonly maxRounds: number;
  readonly created: string;
  /** ISO-8601 timestamp of SLA expiry. */
  readonly staleAfter: string;
  resolvedAt: string | null;
  thread: ThreadEntry[];
}

/** Per-issue container for all clarification records. */
export interface ClarificationLedger {
  readonly issueNumber: number;
  clarifications: ClarificationRecord[];
}

// ---------------------------------------------------------------------------
// API input/output types
// ---------------------------------------------------------------------------

/** Options for requesting a clarification. */
export interface ClarificationRequestOptions {
  issueNumber: number;
  fromAgent: string;
  toAgent: string;
  topic: string;
  question: string;
  blocking: boolean;
  /** Max Q&A rounds before auto-escalation (default: 5 blocking, 6 non-blocking). */
  maxRounds?: number;
  /** Minutes before SLA expiry (default: 30). */
  slaMinutes?: number;
}

/** Result of a completed clarification exchange. */
export interface ClarificationResult {
  clarificationId: string;
  answer: string;
  status: ClarificationStatus;
  round: number;
}

/** Monitor report from a single scan. */
export interface MonitorReport {
  stale: ClarificationRecord[];
  stuck: ClarificationRecord[];
  /** Pairs of mutually-blocking clarifications. */
  deadlocked: Array<readonly [ClarificationRecord, ClarificationRecord]>;
}

// ---------------------------------------------------------------------------
// Agent status extension
// ---------------------------------------------------------------------------

/** Extended agent status entry that includes clarification fields. */
export interface AgentClarificationStatus {
  status: string;
  issue: number | null;
  lastActivity: string;
  /** ID of the active clarification (when status is clarifying or blocked-clarification). */
  clarificationId?: string | null;
  /** Agent this agent is waiting on (when blocked-clarification). */
  waitingOn?: string | null;
  /** Agent this agent is answering (when clarifying). */
  respondingTo?: string | null;
}

// ---------------------------------------------------------------------------
// Workflow TOML clarification config (parsed)
// ---------------------------------------------------------------------------

/** Clarification-related fields parsed from a workflow TOML step. */
export interface TomlClarifyConfig {
  /** Agent names this step can send clarification requests to. Empty = disabled. */
  canClarify: string[];
  clarifyMaxRounds: number;
  clarifySlaMinutes: number;
  clarifyBlockingAllowed: boolean;
}

export const DEFAULT_TOML_CLARIFY_CONFIG: TomlClarifyConfig = {
  canClarify: [],
  clarifyMaxRounds: 5,
  clarifySlaMinutes: 30,
  clarifyBlockingAllowed: true,
};
