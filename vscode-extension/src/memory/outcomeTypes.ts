// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Outcome Types
// ---------------------------------------------------------------------------
//
// Phase 1 type definitions for the Outcome Tracker subsystem.
// Tracks pass/fail/partial results from agent work sessions with lessons
// learned that feed back into future prompts.
//
// Storage layout:
//   .agentx/memory/outcomes/
//     outcome-manifest.json        -- lightweight index (OutcomeIndex[])
//     outcome-{agent}-{issue}-{ts}.json -- full OutcomeRecord
//
// See SPEC-AgentX.md (Cognitive Foundation Specification) Section 3.1 for data model.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Core data shapes
// ---------------------------------------------------------------------------

/** Possible result of an agent work session. */
export type OutcomeResult = 'pass' | 'fail' | 'partial';

/**
 * A single outcome record persisted to disk.
 *
 * ID format: out-{agent}-{issueNumber}-{timestamp}
 * Example:   out-engineer-42-1709553600000
 *
 * Created at the end of a self-review loop when the agent completes work.
 */
export interface OutcomeRecord {
  /** Unique identifier. Format: out-{agent}-{issue}-{timestamp}. */
  readonly id: string;
  /** Agent role that produced this outcome (e.g., 'engineer', 'architect'). */
  readonly agent: string;
  /** GitHub issue number (or local issue ID). */
  readonly issueNumber: number;
  /** Whether the work passed, failed, or partially succeeded. */
  readonly result: OutcomeResult;
  /** Brief summary of what was done (<200 chars). */
  readonly actionSummary: string;
  /** Root cause analysis if result is not 'pass' (null otherwise). */
  readonly rootCause: string | null;
  /** Lesson learned from this outcome (<300 chars). */
  readonly lesson: string;
  /** Number of self-review iterations performed. */
  readonly iterationCount: number;
  /** ISO-8601 timestamp of when the outcome was recorded. */
  readonly timestamp: string;
  /** Session ID from the agentic loop that produced this outcome. */
  readonly sessionId: string;
  /** Labels from the issue (e.g., ['type:story', 'priority:p1']). */
  readonly labels: readonly string[];
}

// ---------------------------------------------------------------------------
// Index & manifest
// ---------------------------------------------------------------------------

/**
 * Lightweight index entry stored in outcome-manifest.json.
 * Contains everything needed to filter and rank without loading the full record.
 */
export interface OutcomeIndex {
  readonly id: string;
  readonly agent: string;
  readonly issueNumber: number;
  readonly result: OutcomeResult;
  /** Brief action summary for display. */
  readonly actionSummary: string;
  readonly timestamp: string;
  readonly labels: readonly string[];
}

/**
 * Shape of the outcome-manifest.json file.
 */
export interface OutcomeManifest {
  readonly version: 1;
  updatedAt: string;
  entries: OutcomeIndex[];
}

// ---------------------------------------------------------------------------
// Query & statistics
// ---------------------------------------------------------------------------

/** Filter criteria for querying outcomes. */
export interface OutcomeQuery {
  /** Filter by agent role. */
  readonly agent?: string;
  /** Filter by issue number. */
  readonly issueNumber?: number;
  /** Filter by result type. */
  readonly result?: OutcomeResult;
  /** Filter by labels (any match). */
  readonly labels?: readonly string[];
  /** Maximum number of results (default: 20). */
  readonly limit?: number;
}

/** Aggregate statistics about the outcome store. */
export interface OutcomeStats {
  readonly totalOutcomes: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly partialCount: number;
  readonly avgIterationCount: number;
  readonly byAgent: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/**
 * Backend-agnostic interface for the outcome store.
 *
 * Implementations:
 *   - OutcomeTracker (Phase 1): JSON file-based, per-record files + manifest
 */
export interface IOutcomeTracker {
  /**
   * Record a new outcome. Fire-and-forget: callers should not await.
   * Writes the full record to an individual file and updates the manifest.
   */
  record(outcome: OutcomeRecord): Promise<void>;

  /**
   * Query outcomes by filter criteria. Returns matching index entries,
   * sorted newest-first.
   */
  query(filter: OutcomeQuery): Promise<OutcomeIndex[]>;

  /**
   * Full-text search across outcome summaries and lessons.
   * Case-insensitive substring match (AND logic for multiple terms).
   *
   * @param query - Search string (whitespace-separated terms).
   * @param limit - Max results to return (default: 20).
   */
  search(query: string, limit?: number): Promise<OutcomeIndex[]>;

  /**
   * Load a single outcome record by ID.
   * Returns null if not found.
   */
  getById(id: string): Promise<OutcomeRecord | null>;

  /**
   * Format relevant lessons as a prompt fragment for injection into
   * the system prompt. Filters by agent and optionally by labels.
   *
   * @param agent - Agent role to filter by.
   * @param labels - Optional label filters.
   * @returns A formatted prompt string, or empty string if no lessons found.
   */
  formatLessonsForPrompt(agent: string, labels?: readonly string[]): Promise<string>;

  /**
   * Return aggregate statistics about the outcome store.
   */
  getStats(): Promise<OutcomeStats>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max outcomes retained per issue before oldest are pruned. */
export const MAX_OUTCOMES_PER_ISSUE = 100;

/** Max token length for a lesson string (approx chars / 4). */
export const MAX_LESSON_TOKENS = 500;

/** Max characters for actionSummary field. */
export const MAX_ACTION_SUMMARY_CHARS = 200;

/** Max characters for lesson field. */
export const MAX_LESSON_CHARS = 300;

/** Directory name under .agentx/memory/ for outcome files. */
export const OUTCOMES_DIR = 'outcomes';

/** Manifest file name. */
export const OUTCOME_MANIFEST_FILE = 'outcome-manifest.json';

/** In-memory manifest cache TTL (ms). */
export const OUTCOME_MANIFEST_CACHE_TTL_MS = 30_000;
