'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RESOLVE_TIMEOUT_MS = 120000;

function resolveRuntime(workspace, run = spawnSync) {
  const result = run('pwsh', ['-NoProfile', '-NonInteractive', '-File',
    path.join(workspace, '.frontier', 'runtime', 'frontier.ps1'), 'cursor', 'runtime'], {
    cwd: workspace, encoding: 'utf8', timeout: RESOLVE_TIMEOUT_MS, maxBuffer: 65536, windowsHide: true,
  });
  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error('Cursor runtime resolution exceeded 120 seconds. Restart the Frontier MCP server in Cursor and retry after startup settles; run frontier cursor status for diagnostics. No automatic retry was attempted.');
  }
  if (result.error || result.status !== 0) {
    throw new Error(`Cursor runtime resolution failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  let selected;
  try { selected = JSON.parse(result.stdout); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error('Cursor runtime resolution returned invalid JSON. Re-run Frontier: Initialize Cursor.');
  }
  const normalize = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
  if (!selected || selected.integration !== 'frontier-cursor' || typeof selected.workspace !== 'string' ||
      typeof selected.assetRoot !== 'string' || !path.isAbsolute(selected.assetRoot) ||
      normalize(selected.workspace) !== normalize(workspace)) {
    throw new Error('Cursor launcher returned an invalid or different workspace binding.');
  }
  return selected;
}

async function main() {
  if (process.platform === 'win32') {
    const extensions = (process.env.PATHEXT ?? '').split(';').filter(Boolean);
    for (const required of ['.EXE', '.CMD']) {
      if (!extensions.some(value => value.toUpperCase() === required)) extensions.push(required);
    }
    process.env.PATHEXT = extensions.join(';');
  }
  const workspace = path.resolve(__dirname, '..', '..');
  const selected = resolveRuntime(workspace);
  process.env.FRONTIER_REPO_ROOT = workspace;
  process.env.FRONTIER_WORKSPACE_ROOT = workspace;
  await require(path.join(selected.assetRoot, '.frontier', 'runtime', 'mcp-server', 'index.js')).main();
}

module.exports = { resolveRuntime, RESOLVE_TIMEOUT_MS };
if (require.main === module) main().catch(error => {
  process.stderr.write(`[frontier-cursor-mcp] ${error.message}\n`);
  process.exitCode = 1;
});
