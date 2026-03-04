// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Session Types
// ---------------------------------------------------------------------------
//
// Phase 1 type definitions for the Session Recorder subsystem.
// Captures episodic memory snapshots when context compaction occurs,
// preserving decisions, actions, and file changes for session resume.
//
// Storage layout:
//   .agentx/memory/sessions/
//     session-manifest.json             -- lightweight index (SessionIndex[])
//     session-{YYYYMMDD}-{6char}.json   -- full SessionRecord
//
// See SPEC-Phase1-Cognitive-Foundation.md Section 3.2 for data model.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Core data shapes
// ---------------------------------------------------------------------------

/**
 * A single session record persisted to disk.
 *
 * ID format: ses-{YYYYMMDD}-{6-char-random}
 * Example:   ses-20260304-a1b2c3
 *
 * Created when context compaction prunes messages from the conversation.
 */
export interface SessionRecord {
  /** Unique identifier. Format: ses-{YYYYMMDD}-{random6}. */
  readonly id: string;
  /** Agent role active during this session. */
  readonly agent: string;
  /** GitHub issue number (or null if no issue context). */
  readonly issueNumber: number | null;
  /** ISO-8601 timestamp of the oldest pruned message. */
  readonly startTime: string;
  /** ISO-8601 timestamp when the session was captured. */
  readonly endTime: string;
  /** Compaction summary text (<500 chars). */
  readonly summary: string;
  /** Key actions performed during the session. */
  readonly actions: readonly string[];
  /** Key decisions made during the session. */
  readonly decisions: readonly string[];
  /** Files modified during the session. */
  readonly filesChanged: readonly string[];
  /** Number of messages that were compacted. */
  readonly messageCount: number;
}

// ---------------------------------------------------------------------------
// Index & manifest
// ---------------------------------------------------------------------------

/**
 * Lightweight index entry stored in session-manifest.json.
 * Contains enough to display a session list without loading full records.
 */
export interface SessionIndex {
  readonly id: string;
  readonly agent: string;
  readonly issueNumber: number | null;
  readonly startTime: string;
  readonly endTime: string;
  /** First 80 chars of the summary for display. */
  readonly summaryPreview: string;
  readonly messageCount: number;
}

/**
 * Shape of the session-manifest.json file.
 */
export interface SessionManifest {
  readonly version: 1;
  updatedAt: string;
  entries: SessionIndex[];
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/**
 * Backend-agnostic interface for the session recorder.
 *
 * Implementations:
 *   - SessionRecorder (Phase 1): JSON file-based, per-session files + manifest
 */
export interface ISessionRecorder {
  /**
   * Capture a new session record. Writes the full record to disk and
   * updates the manifest. Wrapped in try/catch -- never throws.
   */
  capture(session: SessionRecord): Promise<void>;

  /**
   * List all session index entries, sorted newest-first.
   *
   * @param limit - Max results (default: 50).
   */
  list(limit?: number): Promise<SessionIndex[]>;

  /**
   * List sessions for a specific issue, sorted newest-first.
   */
  listByIssue(issueNumber: number): Promise<SessionIndex[]>;

  /**
   * Load a single session record by ID.
   * Returns null if not found.
   */
  getById(id: string): Promise<SessionRecord | null>;

  /**
   * Get the most recent session, optionally filtered by issue.
   * Used by the resume session command.
   */
  getMostRecent(issueNumber?: number): Promise<SessionRecord | null>;

  /**
   * Full-text search across session summaries, actions, and decisions.
   * Case-insensitive substring match (AND logic for multiple terms).
   *
   * @param query - Search string (whitespace-separated terms).
   * @param limit - Max results (default: 20).
   */
  search(query: string, limit?: number): Promise<SessionIndex[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max sessions retained before oldest are pruned on capture. */
export const MAX_SESSIONS_RETAINED = 200;

/** Max characters for the summary field. */
export const MAX_SESSION_SUMMARY_CHARS = 500;

/** Max characters for the summary preview in index entries. */
export const MAX_SUMMARY_PREVIEW_CHARS = 80;

/** Directory name under .agentx/memory/ for session files. */
export const SESSIONS_DIR = 'sessions';

/** Manifest file name. */
export const SESSION_MANIFEST_FILE = 'session-manifest.json';

/** In-memory manifest cache TTL (ms). */
export const SESSION_MANIFEST_CACHE_TTL_MS = 30_000;
