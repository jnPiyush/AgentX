// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Health Types
// ---------------------------------------------------------------------------
//
// Phase 1 type definitions for the Memory Health subsystem.
// Provides diagnostic scanning and repair of the memory store directories.
//
// See SPEC-AgentX.md (Cognitive Foundation Specification) Section 3.3 for data model.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Health report
// ---------------------------------------------------------------------------

/** Per-subsystem health detail. */
export interface SubsystemHealth {
  /** Total records found. */
  readonly total: number;
  /** Number of stale records (older than threshold). */
  readonly stale: number;
  /** Number of orphaned files (not in manifest). */
  readonly orphaned: number;
  /** Number of corrupt files (invalid JSON / schema). */
  readonly corrupt: number;
  /** Number of missing files (in manifest but not on disk). */
  readonly missing: number;
}

/**
 * Complete health report for the memory store.
 * Returned by IMemoryHealth.scan().
 */
export interface HealthReport {
  /** ISO-8601 timestamp when the scan started. */
  readonly scanTime: string;
  /** Duration of the scan in milliseconds. */
  readonly durationMs: number;
  /** Health of the observations subsystem. */
  readonly observations: SubsystemHealth;
  /** Health of the outcomes subsystem. */
  readonly outcomes: SubsystemHealth;
  /** Health of the sessions subsystem. */
  readonly sessions: SubsystemHealth;
  /** Total disk size in bytes across all memory directories. */
  readonly diskSizeBytes: number;
  /** Overall health status -- true if no issues found. */
  readonly healthy: boolean;
  /** List of human-readable issue descriptions. */
  readonly issues: readonly string[];
}

/** Result of a repair operation. */
export interface RepairResult {
  /** ISO-8601 timestamp when the repair started. */
  readonly repairTime: string;
  /** Duration of the repair in milliseconds. */
  readonly durationMs: number;
  /** Actions taken during repair. */
  readonly actions: readonly string[];
  /** Whether the store is healthy after repair. */
  readonly healthyAfterRepair: boolean;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/**
 * Backend-agnostic interface for memory health diagnostics.
 *
 * Implementations:
 *   - MemoryHealth (Phase 1): Scans file system for anomalies and auto-repairs
 */
export interface IMemoryHealth {
  /**
   * Scan all memory directories and return a health report.
   * Does NOT modify any files.
   *
   * Target: <2 seconds for 5K observations.
   */
  scan(): Promise<HealthReport>;

  /**
   * Repair detected issues:
   *   - Rebuild manifests from disk files
   *   - Quarantine corrupt files to .archive/
   *   - Remove stale entries (>90 days) if configured
   */
  repair(): Promise<RepairResult>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stale threshold in days -- records older than this are flagged. */
export const STALE_THRESHOLD_DAYS = 90;

/** Archive directory name for quarantined files. */
export const ARCHIVE_DIR = '.archive';
