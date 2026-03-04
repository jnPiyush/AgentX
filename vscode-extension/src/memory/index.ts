// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Public API
// ---------------------------------------------------------------------------
//
// Phase 1 public surface. Import from here, not from individual files.
// ---------------------------------------------------------------------------

export {
  // Types
  type IObservationStore,
  type IssueObservationFile,
  type ManifestFile,
  type Observation,
  type ObservationCategory,
  type ObservationIndex,
  type StoreStats,
  // Constants
  MANIFEST_CACHE_TTL_MS,
  MAX_OBSERVATIONS_PER_CAPTURE,
  STALE_ARCHIVE_AFTER_DAYS,
} from './types';

export { JsonObservationStore } from './observationStore';
export { GitObservationStore } from './gitObservationStore';
export { ObservationExtractor } from './observationExtractor';

// Persistent Cross-Session Memory
export {
  PersistentStore,
  MemoryEntry,
  MemoryQuery,
  MemoryStats,
  PersistentStoreConfig,
} from './persistentStore';
