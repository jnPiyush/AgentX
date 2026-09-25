#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { createCliRunner, createServer } = require('./index');

async function main() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-mcp-smoke-'));
  const runner = createCliRunner(workspace, {
    spawn: () => {
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
      setImmediate(() => {
        child.stdout.emit('data', 'No active loop. (mock fixture)');
        child.emit('close', 0);
      });
      return child;
    },
  });
  const server = createServer(runner);
  const [transport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: 'frontier-mcp-smoke', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await server.connect(serverTransport);
    await client.connect(transport);
    const tools = await client.listTools();
    if (!tools.tools.some((tool) => tool.name === 'frontier_loop_status')) {
      throw new Error('frontier_loop_status was not advertised');
    }
    if (tools.tools.some((tool) => tool.name.startsWith('agentx_'))) {
      throw new Error('legacy Frontier tools must not be advertised');
    }
    if (tools.tools.length !== 19) {
      throw new Error(`expected exactly 19 tools, received ${tools.tools.length}`);
    }

    const result = await client.callTool({ name: 'frontier_loop_status', arguments: {} });
    const text = Array.isArray(result.content)
      ? result.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n')
      : '';
    const hasValidStatus = text.includes('Iterative Loop Status') || text.includes('No active loop.');
    if (result.isError || !text.includes('exit: 0') || !hasValidStatus) {
      throw new Error(`loop status call failed: ${text || '(no text)'}`);
    }

    const legacyResult = await client.callTool({ name: 'agentx_loop_status', arguments: {} });
    if (legacyResult.isError) {
      throw new Error('legacy tool alias did not forward to frontier_loop_status');
    }

    process.stdout.write(`[PASS] MCP in-memory smoke: tools=${tools.tools.length}; mocked loop status exit=0; no runtime invoked\n`);
  } finally {
    await client.close();
    await runner.stop();
    await server.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[FAIL] MCP in-memory smoke: ${error.stack || error.message}\n`);
  process.exit(1);
});
