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

// Phase 1 -- Cognitive Foundation: Outcome Tracker
export { OutcomeTracker } from './outcomeTracker';
export type {
  OutcomeRecord,
  OutcomeIndex,
  OutcomeManifest,
  OutcomeQuery,
  OutcomeStats,
  OutcomeResult,
  IOutcomeTracker,
} from './outcomeTypes';

// Phase 1 -- Cognitive Foundation: Session Recorder
export { SessionRecorder } from './sessionRecorder';
export type {
  SessionRecord,
  SessionIndex,
  SessionManifest,
  ISessionRecorder,
} from './sessionTypes';

// Phase 1 -- Cognitive Foundation: Memory Health
export { MemoryHealth } from './memoryHealth';
export type {
  HealthReport,
  RepairResult,
  SubsystemHealth,
  IMemoryHealth,
} from './healthTypes';

// Phase 3 -- Proactive Intelligence: Synapse Network
export { SynapseNetwork } from './synapseNetwork';
export type {
  SynapseLink,
  SynapseManifest,
  ISynapseNetwork,
} from './synapseTypes';
export {
  SIMILARITY_THRESHOLD,
  MAX_LINKS_PER_OBSERVATION,
  MAX_CROSS_ISSUE_CONTEXT_TOKENS,
  SYNAPSE_MANIFEST_FILE,
} from './synapseTypes';

// Phase 3 -- Proactive Intelligence: Global Knowledge Store
export { GlobalKnowledgeStore } from './globalKnowledgeStore';
export type {
  KnowledgeCategory,
  KnowledgeEntry,
  KnowledgeIndex,
  GlobalKnowledgeManifest,
  KnowledgeStats,
  IGlobalKnowledgeStore,
} from './globalKnowledgeTypes';
export {
  GLOBAL_KNOWLEDGE_DIR_NAME,
  PROMOTION_RECALL_THRESHOLD,
  DEDUP_SIMILARITY_THRESHOLD,
  MAX_GLOBAL_STORE_BYTES,
  PRUNE_UNUSED_AFTER_DAYS,
} from './globalKnowledgeTypes';
