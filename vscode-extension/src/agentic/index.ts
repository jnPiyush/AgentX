// ---------------------------------------------------------------------------
// AgentX -- Agentic Module Barrel Export
// ---------------------------------------------------------------------------
//
// Single entry point for all agentic loop components:
//   - Tool Engine (registry, built-in tools, execution)
//   - Tool Loop Detection (hash-based cycle detection)
//   - Session State (persistence, compaction, lifecycle)
//   - Agentic Loop (LLM <-> Tool orchestration)
// ---------------------------------------------------------------------------

// Tool Engine
export {
  AgentToolDef,
  ToolParameterDef,
  ToolResult,
  ToolContext,
  ToolCallRequest,
  ToolRegistry,
  // Built-in tools
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  terminalExecTool,
  grepSearchTool,
  listDirTool,
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
  AgenticLoopError,
  LlmAdapter,
  LlmResponse,
  LlmToolCall,
  LoopProgressCallback,
  LoopSummary,
  LoopExitReason,
} from './agenticLoop';
