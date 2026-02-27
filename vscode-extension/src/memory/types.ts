// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Core Types
// ---------------------------------------------------------------------------
//
// Phase 1 type definitions for the Persistent Agent Memory Pipeline.
//
// Schema note: recallCount, relevanceScore, and archived are intentionally
// omitted -- they are Phase 3 additions (relevance scoring + compaction).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Observation category
// ---------------------------------------------------------------------------

/**
 * Semantic category for an observation extracted from a compaction summary.
 * Drives filtering and display in VS Code commands.
 */
export type ObservationCategory =
  | 'decision'
  | 'code-change'
  | 'error'
  | 'key-fact'
  | 'compaction-summary';

// ---------------------------------------------------------------------------
// Core data shapes
// ---------------------------------------------------------------------------

/**
 * A single persistent observation persisted to disk.
 *
 * ID format: obs-{agent}-{issueNumber}-{timestamp}-{rand6}
 * Example:   obs-engineer-29-1709035200000-a1b2c3
 *
 * Phase 3 additions (not in v1): recallCount, relevanceScore, archived.
 */
export interface Observation {
  readonly id: string;
  readonly agent: string;
  readonly issueNumber: number;
  readonly category: ObservationCategory;
  /** Full observation text. May be multi-line. */
  readonly content: string;
  /** Compact one-liner suitable for manifest index (~50 tokens). */
  readonly summary: string;
  /** Estimated token count of `content` (using 4 chars/token heuristic). */
  readonly tokens: number;
  /** ISO-8601 timestamp of when the observation was captured. */
  readonly timestamp: string;
  /** Session ID from which this observation was extracted. */
  readonly sessionId: string;
}

/**
 * Lightweight index entry stored in manifest.json.
 * Contains everything needed to filter and rank without loading full content.
 */
export interface ObservationIndex {
  readonly id: string;
  readonly agent: string;
  readonly issueNumber: number;
  readonly category: ObservationCategory;
  /** Compact summary (~50 tokens). */
  readonly summary: string;
  /** Estimated token count of full content. */
  readonly tokens: number;
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Store statistics
// ---------------------------------------------------------------------------

/**
 * Aggregate statistics about the observation store.
 * Returned by IObservationStore.getStats().
 */
export interface StoreStats {
  readonly totalObservations: number;
  readonly totalTokens: number;
  readonly issueCount: number;
  readonly oldestTimestamp: string | null;
  readonly newestTimestamp: string | null;
  readonly byCategory: Record<ObservationCategory, number>;
  readonly byAgent: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/**
 * Backend-agnostic interface for the observation store.
 *
 * Phase 1 surface (8 methods). Phase 3 additions:
 *   searchByFilters(filters: SearchFilters): Promise<ObservationIndex[]>
 *   incrementRecallCount(id: string): Promise<void>
 *   compact(issueNumber: number): Promise<CompactionResult>
 */
export interface IObservationStore {
  /**
   * Persist one or more observations and update the manifest index.
   *
   * Observations with the same `issueNumber` are appended to the same
   * per-issue JSON file (`.agentx/memory/issue-{n}.json`).
   */
  store(observations: Observation[]): Promise<void>;

  /**
   * Load all observations for a specific issue.
   * Returns an empty array if no file exists for that issue.
   */
  getByIssue(issueNumber: number): Promise<Observation[]>;

  /**
   * Load a single observation by its ID.
   * Returns null if not found.
   */
  getById(id: string): Promise<Observation | null>;

  /**
   * Full-text search across manifest index summaries.
   * Case-insensitive substring match across all fields.
   *
   * @param query - Search string (whitespace-separated terms, all must match).
   * @param limit - Max results to return (default: 20).
   */
  search(query: string, limit?: number): Promise<ObservationIndex[]>;

  /**
   * List all manifest entries for a specific agent name.
   * Sorted newest-first.
   */
  listByAgent(agent: string): Promise<ObservationIndex[]>;

  /**
   * List all manifest entries for a specific category.
   * Sorted newest-first.
   */
  listByCategory(category: ObservationCategory): Promise<ObservationIndex[]>;

  /**
   * Remove a single observation by ID from both the issue file and manifest.
   * Returns true if found and removed, false if not found.
   */
  remove(id: string): Promise<boolean>;

  /**
   * Return aggregate statistics about the store.
   */
  getStats(): Promise<StoreStats>;
}

// ---------------------------------------------------------------------------
// File schemas
// ---------------------------------------------------------------------------

/**
 * Shape of the manifest.json file at `.agentx/memory/manifest.json`.
 */
export interface ManifestFile {
  readonly version: 1;
  updatedAt: string;
  entries: ObservationIndex[];
}

/**
 * Shape of a per-issue observation file at `.agentx/memory/issue-{n}.json`.
 */
export interface IssueObservationFile {
  readonly version: 1;
  readonly issueNumber: number;
  updatedAt: string;
  observations: Observation[];
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Max observations extracted per session end (prevents runaway captures). */
export const MAX_OBSERVATIONS_PER_CAPTURE = 50;

/** In-memory manifest cache TTL (ms). Avoids redundant disk reads. */
export const MANIFEST_CACHE_TTL_MS = 30_000;

/** Archive threshold (days). Used in Phase 3 compaction only. */
export const STALE_ARCHIVE_AFTER_DAYS = 90;
