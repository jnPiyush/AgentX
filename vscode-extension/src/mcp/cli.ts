#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AgentX MCP Server -- CLI Entry Point
// ---------------------------------------------------------------------------
//
// Launches the AgentX MCP server over stdio (JSON-RPC 2.0).
// Compatible with Claude Desktop, VS Code Copilot, and any MCP client.
//
// Usage:
//   node out/mcp/cli.js [--agentx-dir <path>] [--memory-dir <path>]
//
// Defaults:
//   --agentx-dir  .agentx/      (relative to cwd)
//   --memory-dir  .agentx/memory (relative to cwd)
// ---------------------------------------------------------------------------

import * as path from 'path';
import * as fs from 'fs';
import { AgentXMcpServer } from './mcpServer';

function parseArgs(): { agentxDir: string; memoryDir: string } {
  const args = process.argv.slice(2);
  let agentxDir: string | undefined;
  let memoryDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agentx-dir' && args[i + 1]) {
      agentxDir = args[++i];
    } else if (args[i] === '--memory-dir' && args[i + 1]) {
      memoryDir = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      process.stderr.write(
        'AgentX MCP Server\n\n' +
        'Usage: node out/mcp/cli.js [options]\n\n' +
        'Options:\n' +
        '  --agentx-dir <path>  AgentX state directory (default: .agentx)\n' +
        '  --memory-dir <path>  Memory storage directory (default: .agentx/memory)\n' +
        '  --help, -h           Show this help\n',
      );
      process.exit(0);
    }
  }

  const resolvedAgentx = path.resolve(agentxDir ?? '.agentx');
  const resolvedMemory = path.resolve(memoryDir ?? path.join(resolvedAgentx, 'memory'));

  return { agentxDir: resolvedAgentx, memoryDir: resolvedMemory };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main(): void {
  const { agentxDir, memoryDir } = parseArgs();

  ensureDir(agentxDir);
  ensureDir(memoryDir);

  process.stderr.write(`[AgentX MCP] Starting server...\n`);
  process.stderr.write(`[AgentX MCP] agentx-dir: ${agentxDir}\n`);
  process.stderr.write(`[AgentX MCP] memory-dir: ${memoryDir}\n`);
  process.stderr.write(`[AgentX MCP] Transport: stdio (JSON-RPC 2.0)\n`);
  process.stderr.write(`[AgentX MCP] Ready for requests.\n`);

  const server = new AgentXMcpServer(agentxDir, memoryDir);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    process.stderr.write('[AgentX MCP] Shutting down...\n');
    server.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
  });
}

main();
