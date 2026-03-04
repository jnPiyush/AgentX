// ---------------------------------------------------------------------------
// AgentX -- Intelligence Pipeline: Background Engine Types
// ---------------------------------------------------------------------------
//
// Phase 3 type definitions for the Background Intelligence Engine.
//
// The background engine replaces simple cron-based scheduling with
// intelligent detection of stale issues, dependency resolution,
// failure patterns, and memory health.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.1 and 4.1.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stale issue thresholds
// ---------------------------------------------------------------------------

/**
 * Configurable thresholds for detecting stale issues.
 * All durations are in hours unless otherwise noted.
 */
export interface StaleIssueThresholds {
  /** Hours before In Progress is considered stale. Default: 24 */
  readonly inProgressHours: number;
  /** Hours before In Review is considered stale. Default: 48 */
  readonly inReviewHours: number;
  /** Days before Backlog items are considered stale. Default: 7 */
  readonly backlogDays: number;
}

// ---------------------------------------------------------------------------
// Detector result
// ---------------------------------------------------------------------------

/**
 * Result from a single detector run.
 * Dispatched to VS Code notifications and/or the event bus.
 */
export interface DetectorResult {
  /** Which detector produced this result. */
  readonly detector: 'stale' | 'dependency' | 'pattern' | 'health';
  /** Severity of the finding. */
  readonly severity: 'info' | 'warning' | 'critical';
  /** Human-readable message for notification display. */
  readonly message: string;
  /** Related issue number (if applicable). */
  readonly issueNumber?: number;
  /** Label for the notification action button. */
  readonly actionLabel?: string;
  /** VS Code command to execute when action button is clicked. */
  readonly actionCommand?: string;
}

// ---------------------------------------------------------------------------
// Pattern alert
// ---------------------------------------------------------------------------

/**
 * A recurring pattern detected across outcomes (failures or successes).
 */
export interface PatternAlert {
  /** Unique pattern ID: e.g. `failure-timeout` or `success-retry` */
  readonly patternId: string;
  /** Human-readable description of the pattern. */
  readonly description: string;
  /** Number of outcomes matching the pattern. */
  readonly occurrences: number;
  /** Issue numbers where the pattern appears. */
  readonly issueNumbers: number[];
  /** ISO timestamp of first occurrence. */
  readonly firstSeen: string;
  /** ISO timestamp of most recent occurrence. */
  readonly lastSeen: string;
}

// ---------------------------------------------------------------------------
// Background engine configuration
// ---------------------------------------------------------------------------

/**
 * Full configuration for the Background Intelligence Engine.
 */
export interface BackgroundEngineConfig {
  /** Whether the engine is enabled. Default: true */
  readonly enabled: boolean;
  /** Scan interval in milliseconds. Default: 300_000 (5 min) */
  readonly scanIntervalMs: number;
  /** Stale issue detection thresholds. */
  readonly staleThresholds: StaleIssueThresholds;
  /** Minimum outcome count to trigger a pattern alert. Default: 3 */
  readonly patternMinCount: number;
  /** Whether to include memory health scans. Default: true */
  readonly healthScanEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Detector interface
// ---------------------------------------------------------------------------

/**
 * Interface for individual background detectors.
 * Each detector runs independently and returns zero or more results.
 */
export interface IDetector {
  /** Human-readable name for logging. */
  readonly name: string;
  /** Execute the detector and return findings. */
  detect(): Promise<DetectorResult[]>;
}

// ---------------------------------------------------------------------------
// Background Engine interface
// ---------------------------------------------------------------------------

/**
 * IBackgroundEngine -- main interface for the Background Intelligence Engine.
 */
export interface IBackgroundEngine {
  /** Start the background engine. */
  start(config?: Partial<BackgroundEngineConfig>): void;
  /** Stop the background engine. */
  stop(): void;
  /** Run all detectors immediately (for testing/manual trigger). */
  runNow(): Promise<DetectorResult[]>;
  /** Get current configuration. */
  getConfig(): BackgroundEngineConfig;
  /** Update configuration at runtime. */
  updateConfig(config: Partial<BackgroundEngineConfig>): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_SCAN_INTERVAL_MS = 300_000; // 5 minutes
export const DEFAULT_IN_PROGRESS_HOURS = 24;
export const DEFAULT_IN_REVIEW_HOURS = 48;
export const DEFAULT_BACKLOG_DAYS = 7;
export const DEFAULT_PATTERN_MIN_COUNT = 3;
