// ---------------------------------------------------------------------------
// AgentX -- Background Intelligence Engine
// ---------------------------------------------------------------------------
//
// Replaces simple cron-based scheduling with intelligent, multi-detector
// background scanning. Aggregates results from stale-issue, dependency,
// pattern, and memory-health detectors and dispatches findings to the
// VS Code notification system and the AgentX event bus.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 4.1.
// ---------------------------------------------------------------------------

import {
  type BackgroundEngineConfig,
  type DetectorResult,
  type IBackgroundEngine,
  type IDetector,
  DEFAULT_SCAN_INTERVAL_MS,
  DEFAULT_IN_PROGRESS_HOURS,
  DEFAULT_IN_REVIEW_HOURS,
  DEFAULT_BACKLOG_DAYS,
  DEFAULT_PATTERN_MIN_COUNT,
} from './backgroundTypes';
import { StaleIssueDetector } from './detectors/staleIssueDetector';
import { DependencyMonitor } from './detectors/dependencyMonitor';
import { PatternAnalyzer } from './detectors/patternAnalyzer';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

function buildDefaultConfig(
  overrides?: Partial<BackgroundEngineConfig>,
): BackgroundEngineConfig {
  return {
    enabled: overrides?.enabled ?? true,
    scanIntervalMs: overrides?.scanIntervalMs ?? DEFAULT_SCAN_INTERVAL_MS,
    staleThresholds: {
      inProgressHours: overrides?.staleThresholds?.inProgressHours ?? DEFAULT_IN_PROGRESS_HOURS,
      inReviewHours: overrides?.staleThresholds?.inReviewHours ?? DEFAULT_IN_REVIEW_HOURS,
      backlogDays: overrides?.staleThresholds?.backlogDays ?? DEFAULT_BACKLOG_DAYS,
    },
    patternMinCount: overrides?.patternMinCount ?? DEFAULT_PATTERN_MIN_COUNT,
    healthScanEnabled: overrides?.healthScanEnabled ?? true,
  };
}

// ---------------------------------------------------------------------------
// Notification dispatcher (VS Code-agnostic for testability)
// ---------------------------------------------------------------------------

/**
 * Abstraction for dispatching detector results to the UI.
 * In production, this wraps `vscode.window.showInformationMessage` etc.
 */
export interface INotificationDispatcher {
  info(message: string, actionLabel?: string, actionCommand?: string): void;
  warning(message: string, actionLabel?: string, actionCommand?: string): void;
  error(message: string, actionLabel?: string, actionCommand?: string): void;
}

/**
 * Silent no-op dispatcher used when no VS Code window is available.
 */
export const SILENT_DISPATCHER: INotificationDispatcher = {
  info: () => { /* noop */ },
  warning: () => { /* noop */ },
  error: () => { /* noop */ },
};

// ---------------------------------------------------------------------------
// BackgroundEngine
// ---------------------------------------------------------------------------

/**
 * Central coordinator for all background intelligence detectors.
 *
 * Usage:
 * ```ts
 * const engine = new BackgroundEngine(agentxDir, memoryDir, dispatcher);
 * engine.start();
 * // ... later
 * engine.stop();
 * ```
 */
export class BackgroundEngine implements IBackgroundEngine {
  private config: BackgroundEngineConfig;
  private detectors: IDetector[] = [];
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private running = false;

  private readonly agentxDir: string;
  private readonly memoryDir: string;
  private readonly dispatcher: INotificationDispatcher;

  /** Optional callback invoked after each scan cycle (for testing). */
  onScanComplete?: (results: DetectorResult[]) => void;

  constructor(
    agentxDir: string,
    memoryDir: string,
    dispatcher?: INotificationDispatcher,
    config?: Partial<BackgroundEngineConfig>,
  ) {
    this.agentxDir = agentxDir;
    this.memoryDir = memoryDir;
    this.dispatcher = dispatcher ?? SILENT_DISPATCHER;
    this.config = buildDefaultConfig(config);
  }

  // -----------------------------------------------------------------------
  // IBackgroundEngine
  // -----------------------------------------------------------------------

  start(config?: Partial<BackgroundEngineConfig>): void {
    if (this.running) { return; }

    if (config) {
      this.config = buildDefaultConfig({ ...this.config, ...config });
    }

    if (!this.config.enabled) { return; }

    // Build detector pipeline
    this.detectors = this.buildDetectors();

    this.running = true;
    this.intervalHandle = setInterval(async () => {
      try {
        await this.runNow();
      } catch {
        // Engine must never crash -- errors are swallowed silently
      }
    }, this.config.scanIntervalMs);

    // Run the first scan immediately (non-blocking)
    void this.runNow();
  }

  stop(): void {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.running = false;
    this.detectors = [];
  }

  async runNow(): Promise<DetectorResult[]> {
    const allResults: DetectorResult[] = [];

    for (const detector of this.detectors) {
      try {
        const results = await detector.detect();
        allResults.push(...results);
      } catch {
        // Individual detector failures are silently swallowed
      }
    }

    // Dispatch notifications
    for (const result of allResults) {
      this.dispatch(result);
    }

    // Optional callback for tests
    this.onScanComplete?.(allResults);

    return allResults;
  }

  getConfig(): BackgroundEngineConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<BackgroundEngineConfig>): void {
    const wasRunning = this.running;
    if (wasRunning) { this.stop(); }
    this.config = buildDefaultConfig({ ...this.config, ...config });
    if (wasRunning && this.config.enabled) { this.start(); }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Builds the detector pipeline based on current configuration.
   */
  private buildDetectors(): IDetector[] {
    const detectors: IDetector[] = [
      new StaleIssueDetector(this.agentxDir, this.config.staleThresholds),
      new DependencyMonitor(this.agentxDir),
      new PatternAnalyzer(this.memoryDir, this.config.patternMinCount),
    ];

    return detectors;
  }

  /**
   * Dispatches a detector result to the appropriate notification channel.
   */
  private dispatch(result: DetectorResult): void {
    switch (result.severity) {
      case 'critical':
        this.dispatcher.error(result.message, result.actionLabel, result.actionCommand);
        break;
      case 'warning':
        this.dispatcher.warning(result.message, result.actionLabel, result.actionCommand);
        break;
      case 'info':
        this.dispatcher.info(result.message, result.actionLabel, result.actionCommand);
        break;
    }
  }
}
