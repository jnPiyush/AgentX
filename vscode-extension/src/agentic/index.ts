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
