// ---------------------------------------------------------------------------
// AgentX -- MCP Server: Types
// ---------------------------------------------------------------------------
//
// Phase 3 type definitions for the AgentX MCP Server.
//
// The MCP server exposes AgentX capabilities via the Model Context Protocol
// (stdio or SSE transport), enabling programmatic access from any
// MCP-compatible client (Claude Desktop, Copilot, custom scripts).
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.2 and 5.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MCP server configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the AgentX MCP server.
 */
export interface AgentXMcpConfig {
  /** Transport type. Default: 'stdio' */
  readonly transport: 'stdio' | 'sse';
  /** SSE port (only used when transport = 'sse'). Default: 3100 */
  readonly port?: number;
  /** Optional auth token for SSE mode. */
  readonly authToken?: string;
  /** Whether MCP tools are enabled. Default: true */
  readonly enableTools: boolean;
  /** Whether MCP resources are enabled. Default: true */
  readonly enableResources: boolean;
}

// ---------------------------------------------------------------------------
// Ready queue item
// ---------------------------------------------------------------------------

/**
 * A single item in the AgentX ready queue.
 * Returned by the `agentx://ready-queue` resource.
 */
export interface ReadyQueueItem {
  /** Issue number. */
  readonly issueNumber: number;
  /** Issue title. */
  readonly title: string;
  /** Issue type label (e.g., 'type:story'). */
  readonly type: string;
  /** Priority label (e.g., 'p0'). */
  readonly priority: string;
  /** Current status. */
  readonly status: string;
  /** Assigned agent (null if unassigned). */
  readonly assignedAgent: string | null;
  /** Issue numbers this item is blocked by. */
  readonly blockedBy: number[];
  /** ISO-8601 creation time. */
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Agent state item
// ---------------------------------------------------------------------------

/**
 * State of a single agent.
 * Returned by the `agentx://agent-states` resource.
 */
export interface AgentStateItem {
  /** Agent name (e.g., 'engineer'). */
  readonly agent: string;
  /** Current state. */
  readonly state: 'idle' | 'working' | 'blocked' | 'error';
  /** Issue number the agent is working on (null if idle). */
  readonly issueNumber: number | null;
  /** ISO-8601 timestamp of when this state was entered. */
  readonly since: string;
  /** Last action performed (null if no action yet). */
  readonly lastAction: string | null;
}

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

export const VALID_AGENTS = [
  'engineer', 'reviewer', 'architect', 'pm', 'ux',
  'devops', 'data-scientist', 'tester', 'powerbi-analyst',
] as const;
export type ValidAgent = typeof VALID_AGENTS[number];

export const VALID_STATES = ['idle', 'working', 'blocked', 'error'] as const;
export type ValidState = typeof VALID_STATES[number];

export const VALID_ISSUE_TYPES = [
  'epic', 'feature', 'story', 'bug', 'spike',
  'docs', 'devops', 'testing', 'powerbi',
] as const;
export type ValidIssueType = typeof VALID_ISSUE_TYPES[number];

export const VALID_PRIORITIES = ['p0', 'p1', 'p2', 'p3'] as const;
export type ValidPriority = typeof VALID_PRIORITIES[number];

export const VALID_WORKFLOW_TYPES = [
  'story', 'feature', 'bug', 'devops', 'docs', 'testing',
] as const;
export type ValidWorkflowType = typeof VALID_WORKFLOW_TYPES[number];

export const VALID_SEARCH_STORES = [
  'observations', 'outcomes', 'sessions', 'knowledge', 'all',
] as const;
export type ValidSearchStore = typeof VALID_SEARCH_STORES[number];

// ---------------------------------------------------------------------------
// Tool input types
// ---------------------------------------------------------------------------

export interface SetAgentStateInput {
  readonly agent: ValidAgent;
  readonly state: ValidState;
  readonly issueNumber?: number;
}

export interface CreateIssueInput {
  readonly title: string;
  readonly type: ValidIssueType;
  readonly priority?: ValidPriority;
  readonly description?: string;
  readonly labels?: string[];
}

export interface TriggerWorkflowInput {
  readonly issueNumber: number;
  readonly workflowType: ValidWorkflowType;
}

export interface MemorySearchInput {
  readonly query: string;
  readonly store?: ValidSearchStore;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MCP_SERVER_NAME = 'agentx';
export const MCP_SERVER_VERSION = '7.4.0';
export const DEFAULT_SSE_PORT = 3100;
