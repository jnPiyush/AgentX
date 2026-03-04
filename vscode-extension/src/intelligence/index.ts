// ---------------------------------------------------------------------------
// AgentX -- Intelligence Pipeline Barrel Export
// ---------------------------------------------------------------------------

export { BackgroundEngine, SILENT_DISPATCHER } from './backgroundEngine';
export type { INotificationDispatcher } from './backgroundEngine';
export { StaleIssueDetector, DependencyMonitor, PatternAnalyzer } from './detectors';
export type {
  BackgroundEngineConfig,
  DetectorResult,
  PatternAlert,
  StaleIssueThresholds,
  IDetector,
  IBackgroundEngine,
} from './backgroundTypes';
export {
  DEFAULT_SCAN_INTERVAL_MS,
  DEFAULT_IN_PROGRESS_HOURS,
  DEFAULT_IN_REVIEW_HOURS,
  DEFAULT_BACKLOG_DAYS,
  DEFAULT_PATTERN_MIN_COUNT,
} from './backgroundTypes';
