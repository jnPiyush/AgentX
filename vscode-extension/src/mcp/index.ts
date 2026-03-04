// ---------------------------------------------------------------------------
// AgentX -- MCP Module Barrel Export
// ---------------------------------------------------------------------------

export { AgentXMcpServer } from './mcpServer';
export {
  handleSetAgentState,
  handleCreateIssue,
  handleTriggerWorkflow,
  handleMemorySearch,
} from './toolHandlers';
export type { ToolResult } from './toolHandlers';
export {
  handleReadyQueue,
  handleAgentStates,
  handleHealth,
  handleOutcomes,
  handleSessions,
  handleSynapseLinks,
  handleKnowledge,
} from './resourceHandlers';
export type { ResourceResult } from './resourceHandlers';
export type {
  AgentXMcpConfig,
  ReadyQueueItem,
  AgentStateItem,
  SetAgentStateInput,
  CreateIssueInput,
  TriggerWorkflowInput,
  MemorySearchInput,
} from './mcpTypes';
export {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  DEFAULT_SSE_PORT,
  VALID_AGENTS,
  VALID_STATES,
  VALID_ISSUE_TYPES,
  VALID_PRIORITIES,
  VALID_WORKFLOW_TYPES,
  VALID_SEARCH_STORES,
} from './mcpTypes';
