import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentXMcpServer } from '../../mcp/mcpServer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;
let memoryDir: string;

function makeRequest(method: string, params?: Record<string, unknown>, id: number = 1) {
  return { jsonrpc: '2.0' as const, id, method, params: params ?? {} };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-mcp-test-'));
  agentxDir = path.join(tmpDir, '.agentx');
  memoryDir = path.join(agentxDir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentXMcpServer', () => {
  it('should be constructable', () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    assert.ok(server);
  });

  it('should respond to initialize', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    }));

    assert.strictEqual(response.jsonrpc, '2.0');
    assert.ok(response.result, 'Should have result');
    const result = response.result as Record<string, unknown>;
    assert.ok(result['capabilities'], 'Should declare capabilities');
    assert.ok(result['serverInfo'], 'Should declare serverInfo');
  });

  it('should list tools', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('tools/list'));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const tools = result['tools'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(tools), 'Tools should be an array');
    assert.ok(tools.length > 0, 'Should have tools');

    const toolNames = tools.map((t) => t['name']);
    assert.ok(toolNames.includes('set_agent_state'));
    assert.ok(toolNames.includes('create_issue'));
    assert.ok(toolNames.includes('trigger_workflow'));
    assert.ok(toolNames.includes('memory_search'));
  });

  it('should list resources', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('resources/list'));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const resources = result['resources'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(resources), 'Resources should be an array');
    assert.ok(resources.length > 0, 'Should have resources');
  });

  it('should respond to ping', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('ping'));
    assert.ok(response.result, 'Should have result for ping');
  });

  it('should return method not found for unknown methods', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('nonexistent/method'));
    assert.ok(response.error, 'Should have error');
    assert.strictEqual(response.error!.code, -32601, 'Should be method not found');
  });

  it('should handle tool call for set_agent_state', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('tools/call', {
      name: 'set_agent_state',
      arguments: { agent: 'engineer', state: 'working', issueNumber: 42 },
    }));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const content = result['content'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(content), 'Tool result should have content array');
  });

  it('should handle resource read for health', async () => {
    const server = new AgentXMcpServer(agentxDir, memoryDir);
    const response = await server.handleRequest(makeRequest('resources/read', {
      uri: 'agentx://health',
    }));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const contents = result['contents'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(contents), 'Should have contents');
  });
});
