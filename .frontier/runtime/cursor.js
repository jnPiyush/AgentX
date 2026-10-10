'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ASSET_ROOT, MAX_JSON_BYTES, readAsset, mergeConfiguration, checkMcpDependencies, setupCursor } = require('./adapters/cursor/setup');
const { translateHookInput, translateHookResult } = require('./adapters/cursor/protocol');

function readHookInput() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => { process.stdin.destroy(); reject(new Error('Cursor hook input timed out.')); }, 2000);
    process.stdin.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) { clearTimeout(timer); process.stdin.destroy(); reject(new Error('Cursor hook input exceeds its limit.')); }
      else chunks.push(chunk);
    });
    process.stdin.once('error', error => { clearTimeout(timer); reject(error); });
    process.stdin.once('end', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
    });
  });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 18) throw new Error('Cursor integration requires Node.js 18 or later.');
  const args = process.argv.slice(2);
  if (args[0] !== '--workspace' || !path.isAbsolute(args[1] ?? '')) throw new Error('An absolute bound workspace is required.');
  const workspace = path.resolve(args[1]);
  const action = args[2] ?? 'status';
  if (action === 'read' && args.length === 4) { process.stdout.write(readAsset(args[3])); return; }
  if (action === 'setup' && (args.length === 3 || (args.length === 4 && args[3] === '--restore-mcp'))) {
    process.stdout.write(`${JSON.stringify(setupCursor(workspace, { restoreMcp: args[3] === '--restore-mcp' }))}\n`);
    return;
  }
  if (action === 'hook') {
    const event = args[3];
    try {
      if (args.length !== 4) throw new Error('A Cursor hook event is required.');
      const input = translateHookInput(event, await readHookInput(), workspace);
      if (event === 'preToolUse' && input.tool_name === 'cursor_read') {
        process.stdout.write('{"permission":"allow"}\n');
        return;
      }
      if (event === 'sessionStart' &&
          !fs.statSync(path.join(workspace, '.frontier', 'config.json'), { throwIfNoEntry: false })?.isFile()) {
        process.stdout.write(`${JSON.stringify({ additional_context: 'Frontier repository support is not initialized in this workspace. Run Frontier: Initialize Repository Support, then Frontier: Initialize Cursor. Repository discovery was not run.' })}\n`);
        return;
      }
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
        path.join(__dirname, 'frontier-cli.ps1'), 'policy-hook'], {
        cwd: workspace, env: { ...process.env, FRONTIER_WORKSPACE_ROOT: workspace },
        input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 65536,
      });
      process.stdout.write(`${JSON.stringify(translateHookResult(event, result))}\n`);
    } catch (error) {
      process.stderr.write(`[frontier-cursor] ${error.message}\n`);
      const response = event === 'preToolUse'
        ? { permission: 'deny', user_message: error.message, agent_message: error.message }
        : { additional_context: `Frontier context unavailable: ${error.message}. Run frontier context explicitly.` };
      process.stdout.write(`${JSON.stringify(response)}\n`);
      if (event === 'preToolUse') process.exitCode = 2;
    }
    return;
  }
  if (action === 'status' && args.length <= 3) {
    checkMcpDependencies();
    process.stdout.write(`${JSON.stringify({ mcpReady: true, workspace, assetRoot: ASSET_ROOT })}\n`);
    return;
  }
  if (action === 'runtime' && args.length === 3) {
    process.stdout.write(`${JSON.stringify({ integration: 'frontier-cursor', workspace, assetRoot: ASSET_ROOT })}\n`);
    return;
  }
  throw new Error('Usage: frontier cursor setup [--restore-mcp] | read <canonical-path> | status');
}

module.exports = { readAsset, mergeConfiguration, translateHookInput, translateHookResult, setupCursor };
if (require.main === module) main().catch(error => { process.stderr.write(`[frontier-cursor] ${error.message}\n`); process.exitCode = 1; });
