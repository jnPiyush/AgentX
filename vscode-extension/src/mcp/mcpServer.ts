// ---------------------------------------------------------------------------
// AgentX -- MCP Server
// ---------------------------------------------------------------------------
//
// Lightweight Model Context Protocol server using JSON-RPC 2.0 over
// stdio or SSE. Zero external dependencies -- implements the MCP protocol
// directly for the AgentX VS Code extension.
//
// Protocol Reference: https://modelcontextprotocol.io/specification
//
// Tools:
//   set-agent-state  -- Update an agent's state
//   create-issue     -- Create a local issue
//   trigger-workflow  -- Trigger a workflow for an issue
//   memory-search    -- Search memory stores
//
// Resources:
//   agentx://ready-queue    -- Priority-sorted issue queue
//   agentx://agent-states   -- Current agent states
//   agentx://health         -- Memory subsystem health
//   agentx://outcomes       -- Recent outcome records
//   agentx://sessions       -- Recent session records
//   agentx://synapse-links  -- Cross-issue observation links
//   agentx://knowledge      -- Global knowledge entries
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.2 and 5.
// ---------------------------------------------------------------------------

import * as os from 'os';
import * as path from 'path';
import {
  type AgentXMcpConfig,
  type SetAgentStateInput,
  type CreateIssueInput,
  type TriggerWorkflowInput,
  type MemorySearchInput,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  DEFAULT_SSE_PORT,
} from './mcpTypes';
import {
  handleSetAgentState,
  handleCreateIssue,
  handleTriggerWorkflow,
  handleMemorySearch,
  type ToolResult,
} from './toolHandlers';
import {
  handleReadyQueue,
  handleAgentStates,
  handleHealth,
  handleOutcomes,
  handleSessions,
  handleSynapseLinks,
  handleKnowledge,
  type ResourceResult,
} from './resourceHandlers';

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id?: string | number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: string | number | null;
  readonly result?: unknown;
  readonly error?: { code: number; message: string; data?: unknown };
}

// ---------------------------------------------------------------------------
// Tool & Resource definitions (MCP schema)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'set-agent-state',
    description: 'Update the state of an AgentX agent (idle, working, blocked, error)',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent name (e.g. engineer, reviewer)' },
        state: { type: 'string', description: 'New state (idle, working, blocked, error)' },
        issueNumber: { type: 'number', description: 'Issue number (optional)' },
      },
      required: ['agent', 'state'],
    },
  },
  {
    name: 'create-issue',
    description: 'Create a new local issue in the AgentX issue tracker',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Issue title' },
        type: { type: 'string', description: 'Issue type (epic, feature, story, bug, spike, docs, devops, testing, powerbi)' },
        priority: { type: 'string', description: 'Priority (p0, p1, p2, p3)' },
        description: { type: 'string', description: 'Issue description' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Additional labels' },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'trigger-workflow',
    description: 'Trigger an AgentX workflow for a specific issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueNumber: { type: 'number', description: 'Target issue number' },
        workflowType: { type: 'string', description: 'Workflow type (story, feature, bug, devops, docs, testing)' },
      },
      required: ['issueNumber', 'workflowType'],
    },
  },
  {
    name: 'memory-search',
    description: 'Search AgentX memory stores (observations, outcomes, sessions, knowledge)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        store: { type: 'string', description: 'Store to search (observations, outcomes, sessions, knowledge, all)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
] as const;

const RESOURCE_DEFINITIONS = [
  { uri: 'agentx://ready-queue', name: 'Ready Queue', description: 'Priority-sorted list of unblocked issues', mimeType: 'application/json' },
  { uri: 'agentx://agent-states', name: 'Agent States', description: 'Current state of all AgentX agents', mimeType: 'application/json' },
  { uri: 'agentx://health', name: 'Health', description: 'Memory subsystem health report', mimeType: 'application/json' },
  { uri: 'agentx://outcomes', name: 'Outcomes', description: 'Recent outcome records', mimeType: 'application/json' },
  { uri: 'agentx://sessions', name: 'Sessions', description: 'Recent session records', mimeType: 'application/json' },
  { uri: 'agentx://synapse-links', name: 'Synapse Links', description: 'Cross-issue observation links', mimeType: 'application/json' },
  { uri: 'agentx://knowledge', name: 'Knowledge', description: 'Global knowledge entries', mimeType: 'application/json' },
] as const;

// ---------------------------------------------------------------------------
// AgentXMcpServer
// ---------------------------------------------------------------------------

/**
 * Lightweight MCP server for AgentX. Implements the Model Context Protocol
 * over JSON-RPC 2.0 using stdio transport. SSE transport is planned.
 *
 * Usage:
 * ```ts
 * const server = new AgentXMcpServer(agentxDir, memoryDir);
 * server.start(); // starts listening on stdin
 * ```
 */
export class AgentXMcpServer {
  private readonly agentxDir: string;
  private readonly memoryDir: string;
  private readonly knowledgeDir: string;
  private readonly config: AgentXMcpConfig;
  private running = false;
  private inputBuffer = '';

  constructor(
    agentxDir: string,
    memoryDir: string,
    config?: Partial<AgentXMcpConfig>,
  ) {
    this.agentxDir = agentxDir;
    this.memoryDir = memoryDir;
    this.knowledgeDir = path.join(os.homedir(), '.agentx', 'knowledge');
    this.config = {
      transport: config?.transport ?? 'stdio',
      port: config?.port ?? DEFAULT_SSE_PORT,
      authToken: config?.authToken,
      enableTools: config?.enableTools ?? true,
      enableResources: config?.enableResources ?? true,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  start(): void {
    if (this.running) { return; }
    this.running = true;

    if (this.config.transport === 'stdio') {
      this.startStdio();
    }
    // SSE transport would be added here for Phase 3+
  }

  stop(): void {
    this.running = false;
    if (this.config.transport === 'stdio') {
      process.stdin.removeAllListeners('data');
    }
  }

  /**
   * Process a single JSON-RPC request (for testing and direct integration).
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      return await this.dispatch(request);
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Internal error',
        },
      };
    }
  }

  // -----------------------------------------------------------------------
  // Stdio transport
  // -----------------------------------------------------------------------

  private startStdio(): void {
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      this.inputBuffer += chunk;
      this.processBuffer();
    });
  }

  private processBuffer(): void {
    // MCP uses newline-delimited JSON
    const lines = this.inputBuffer.split('\n');
    this.inputBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { continue; }

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;
        void this.handleRequest(request).then((response) => {
          if (request.id !== undefined) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        });
      } catch {
        // Silently ignore malformed JSON lines
      }
    }
  }

  // -----------------------------------------------------------------------
  // Request dispatch
  // -----------------------------------------------------------------------

  private async dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id);
      case 'tools/list':
        return this.handleToolsList(id);
      case 'tools/call':
        return this.handleToolsCall(id, params);
      case 'resources/list':
        return this.handleResourcesList(id);
      case 'resources/read':
        return this.handleResourcesRead(id, params);
      case 'ping':
        return { jsonrpc: '2.0', id: id ?? null, result: {} };
      default:
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  }

  // -----------------------------------------------------------------------
  // Protocol handlers
  // -----------------------------------------------------------------------

  private handleInitialize(id?: string | number): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: this.config.enableTools ? {} : undefined,
          resources: this.config.enableResources ? {} : undefined,
        },
        serverInfo: {
          name: MCP_SERVER_NAME,
          version: MCP_SERVER_VERSION,
        },
      },
    };
  }

  private handleToolsList(id?: string | number): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: { tools: TOOL_DEFINITIONS },
    };
  }

  private handleToolsCall(
    id?: string | number,
    params?: Record<string, unknown>,
  ): JsonRpcResponse {
    const toolName = params?.['name'] as string;
    const args = (params?.['arguments'] ?? {}) as Record<string, unknown>;

    let result: ToolResult;

    switch (toolName) {
      case 'set-agent-state':
        result = handleSetAgentState(args as unknown as SetAgentStateInput, this.agentxDir);
        break;
      case 'create-issue':
        result = handleCreateIssue(args as unknown as CreateIssueInput, this.agentxDir);
        break;
      case 'trigger-workflow':
        result = handleTriggerWorkflow(args as unknown as TriggerWorkflowInput, this.agentxDir);
        break;
      case 'memory-search':
        result = handleMemorySearch(args as unknown as MemorySearchInput, this.memoryDir);
        break;
      default:
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        };
    }

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: !result.success,
      },
    };
  }

  private handleResourcesList(id?: string | number): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: { resources: RESOURCE_DEFINITIONS },
    };
  }

  private handleResourcesRead(
    id?: string | number,
    params?: Record<string, unknown>,
  ): JsonRpcResponse {
    const uri = params?.['uri'] as string;
    let resource: ResourceResult;

    switch (uri) {
      case 'agentx://ready-queue':
        resource = handleReadyQueue(this.agentxDir);
        break;
      case 'agentx://agent-states':
        resource = handleAgentStates(this.agentxDir);
        break;
      case 'agentx://health':
        resource = handleHealth(this.memoryDir);
        break;
      case 'agentx://outcomes':
        resource = handleOutcomes(this.memoryDir);
        break;
      case 'agentx://sessions':
        resource = handleSessions(this.memoryDir);
        break;
      case 'agentx://synapse-links':
        resource = handleSynapseLinks(this.memoryDir);
        break;
      case 'agentx://knowledge':
        resource = handleKnowledge(this.knowledgeDir);
        break;
      default:
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32602, message: `Unknown resource: ${uri}` },
        };
    }

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        contents: [{
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: resource.text,
        }],
      },
    };
  }
}
