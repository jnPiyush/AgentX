// ---------------------------------------------------------------------------
// AgentX -- Agentic Module Barrel Export
// ---------------------------------------------------------------------------
//
// Single entry point for all agentic loop components:
//   - Tool Engine (registry, built-in tools, execution)
//   - Tool Loop Detection (hash-based cycle detection)
//   - Session State (persistence, compaction, lifecycle)
//   - Agentic Loop (LLM <-> Tool orchestration)
//   - Sub-Agent Spawner (generalized sub-agent invocation)
//   - Self-Review Loop (same-role iterative review)
//   - Clarification Loop (inter-agent iterative Q&A)
//   - Boundary Hooks (file-path and constraint enforcement per agent)
// ---------------------------------------------------------------------------

// Tool Engine
export {
  AgentToolDef,
  ToolParameterDef,
  ToolResult,
  ToolContext,
  ToolCallRequest,
  ToolRegistry,
  ClarificationHandler,
  resolveToolCategories,
  // Built-in tools
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  terminalExecTool,
  grepSearchTool,
  listDirTool,
  requestClarificationTool,
  validateDoneTool,
} from './toolEngine';

// Tool Loop Detection
export {
  ToolLoopDetector,
  LoopSeverity,
  LoopDetectorKind,
  LoopDetectionResult,
  LoopDetectionConfig,
  ToolCallRecord,
  hashToolCall,
  hashToolResult,
} from './toolLoopDetection';

// Session State
export {
  SessionManager,
  SessionState,
  SessionMessage,
  SessionToolCall,
  SessionMeta,
  SessionStorage,
  FileSessionStorage,
  InMemorySessionStorage,
} from './sessionState';

// Agentic Loop
export {
  AgenticLoop,
  AgenticLoopConfig,
  AgenticLoopHooks,
  AgenticLoopError,
  DoneValidator,
  LlmAdapter,
  LlmResponse,
  LlmToolCall,
  ToolHookContext,
  ToolResultHookContext,
  CompactionHookContext,
  ClarificationHookContext,
  ClarificationResultHookContext,
  LoopProgressCallback,
  LoopSummary,
  LoopExitReason,
  ErrorHookAction,
  ErrorHookContext,
  ErrorHookResult,
} from './agenticLoop';

// Sub-Agent Spawner
export {
  SubAgentConfig,
  SubAgentResult,
  LlmAdapterFactory,
  AgentDefLike,
  AgentLoader,
  spawnSubAgent,
  spawnSubAgentWithHistory,
  ParallelStrategy,
  ConsolidationStrategy,
  ParallelSubAgentInvocation,
  ParallelSubAgentOptions,
  ParallelSubAgentResult,
  runParallelSubAgents,
} from './subAgentSpawner';

// Self-Review Loop
export {
  FindingImpact,
  ReviewFinding,
  ReviewResult,
  SelfReviewConfig,
  SelfReviewResult,
  SelfReviewProgress,
  runSelfReview,
  getDefaultSelfReviewConfig,
} from './selfReviewLoop';

// Clarification Loop
export {
  ClarificationLoopConfig,
  ClarificationLoopResult,
  ClarificationExchange,
  ClarificationProgress,
  ClarificationEvaluator,
  ClarificationEvaluation,
  runClarificationLoop,
  getDefaultClarificationConfig,
} from './clarificationLoop';

// Boundary Enforcement Hooks
export {
  BoundaryRules,
  BoundaryCheckResult,
  BoundaryViolationError,
  BoundaryViolationHandler,
  buildBoundaryHooks,
  composeBoundaryHooks,
  matchesBoundaryPattern,
  checkBoundary,
} from './boundaryHook';
// Progress Tracker
export {
  ProgressTracker,
  PlanStep,
  StepRecord,
  TaskLedger,
  ProgressLedger,
  RePlanContext,
} from './progressTracker';

// Parallel Tool Executor
export {
  ParallelToolExecutor,
  DependencyGraph,
  detectDependencies,
} from './parallelToolExecutor';

// Codebase Analysis
export {
  CodebaseStats,
  DependencyInfo,
  ArchitectureMap,
  analyzeCo,
  findDependencies,
  mapArchitecture,
} from './codebaseAnalysis';

// Prompting Modes (US-4.4)
export {
  BuiltInMode,
  PromptMode,
  ModeResolutionOptions,
  ModeResolutionResult,
  registerMode,
  unregisterMode,
  listModes,
  getMode,
  resolveMode,
  resetModeRegistry,
} from './promptingModes';

// Hook Priority (US-4.5)
export {
  PrioritizedHook,
  HookRegistrationOptions,
  HookChainResult,
  HookRegistry,
  DEFAULT_HOOK_PRIORITY,
} from './hookPriority';