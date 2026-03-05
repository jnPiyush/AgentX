import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentXMcpServer, type McpWritable } from '../../mcp/mcpServer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;
let memoryDir: string;

/** Piped stdout/stderr that captures output instead of polluting terminal. */
function createPipedWriter(): McpWritable & { output: string[] } {
  const captured: string[] = [];
  return {
    output: captured,
    write(data: string): boolean {
      captured.push(data);
      return true;
    },
  };
}

function makeServer(): AgentXMcpServer {
  return new AgentXMcpServer(agentxDir, memoryDir, undefined, {
    stdout: createPipedWriter(),
    stderr: createPipedWriter(),
  });
}

function makeRequest(method: string, params?: Record<string, unknown>, id: number = 1) {
  return { jsonrpc: '2.0' as const, id, method, params: params ?? {} };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentXMcpServer', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-mcp-test-'));
    agentxDir = path.join(tmpDir, '.agentx');
    memoryDir = path.join(agentxDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('should be constructable', () => {
    const server = makeServer();
    assert.ok(server);
  });

  it('should respond to initialize', async () => {
    const server = makeServer();
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
    const server = makeServer();
    const response = await server.handleRequest(makeRequest('tools/list'));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const tools = result['tools'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(tools), 'Tools should be an array');
    assert.ok(tools.length > 0, 'Should have tools');

    const toolNames = tools.map((t) => t['name']);
    assert.ok(toolNames.includes('set-agent-state'));
    assert.ok(toolNames.includes('create-issue'));
    assert.ok(toolNames.includes('trigger-workflow'));
    assert.ok(toolNames.includes('memory-search'));
  });

  it('should list resources', async () => {
    const server = makeServer();
    const response = await server.handleRequest(makeRequest('resources/list'));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const resources = result['resources'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(resources), 'Resources should be an array');
    assert.ok(resources.length > 0, 'Should have resources');
  });

  it('should respond to ping', async () => {
    const server = makeServer();
    const response = await server.handleRequest(makeRequest('ping'));
    assert.ok(response.result, 'Should have result for ping');
  });

  it('should return method not found for unknown methods', async () => {
    const server = makeServer();
    const response = await server.handleRequest(makeRequest('nonexistent/method'));
    assert.ok(response.error, 'Should have error');
    assert.strictEqual(response.error!.code, -32601, 'Should be method not found');
  });

  it('should handle tool call for set-agent-state', async () => {
    const server = makeServer();
    const response = await server.handleRequest(makeRequest('tools/call', {
      name: 'set-agent-state',
      arguments: { agent: 'engineer', state: 'working', issueNumber: 42 },
    }));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const content = result['content'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(content), 'Tool result should have content array');
  });

  it('should handle resource read for health', async () => {
    const server = makeServer();
    const response = await server.handleRequest(makeRequest('resources/read', {
      uri: 'agentx://health',
    }));

    assert.ok(response.result);
    const result = response.result as Record<string, unknown>;
    const contents = result['contents'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(contents), 'Should have contents');
  });
});
