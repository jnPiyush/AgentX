#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  const cwd = __dirname;
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-mcp-smoke-'));
  const env = {
    ...process.env,
    FRONTIER_REPO_ROOT: path.resolve(cwd, '..', '..'),
    FRONTIER_WORKSPACE_ROOT: workspace,
  };
  if (process.platform === 'win32') {
    env.PATH = `C:\\Program Files\\PowerShell\\7;${env.PATH ?? ''}`;
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(cwd, 'index.js')],
    cwd,
    env,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'frontier-mcp-smoke', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    if (!tools.tools.some((tool) => tool.name === 'frontier_loop_status')) {
      throw new Error('frontier_loop_status was not advertised');
    }
    if (tools.tools.some((tool) => tool.name.startsWith('agentx_'))) {
      throw new Error('legacy Frontier tools must not be advertised');
    }
    if (tools.tools.length < 10) {
      throw new Error(`expected at least 10 tools, received ${tools.tools.length}`);
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

    process.stdout.write(`[PASS] MCP stdio smoke: tools=${tools.tools.length}; loop status exit=0\n`);
  } finally {
    await client.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[FAIL] MCP stdio smoke: ${error.stack || error.message}\n`);
  process.exit(1);
});
