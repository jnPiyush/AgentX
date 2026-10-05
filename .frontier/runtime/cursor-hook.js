'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolveRuntime } = require('./cursor-mcp.js');

const workspace = path.resolve(__dirname, '..', '..');
const cachePath = path.join(workspace, '.frontier', 'state', 'cursor-runtime.json');
const launcherPath = path.join(workspace, '.frontier', 'runtime', 'frontier.ps1');

function adapterPath(assetRoot) {
  return path.join(assetRoot, '.frontier', 'runtime', 'cursor.js');
}

// Resolving the runtime needs PowerShell; the cached binding keeps per-tool-call hooks on Node only.
function readCachedRuntime() {
  try {
    const cached = fs.statSync(cachePath);
    if (cached.size > 4096 || cached.mtimeMs < fs.statSync(launcherPath).mtimeMs) return undefined;
    const value = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (value?.integration === 'frontier-cursor' && typeof value.assetRoot === 'string' &&
        path.isAbsolute(value.assetRoot) && fs.statSync(adapterPath(value.assetRoot), { throwIfNoEntry: false })?.isFile()) {
      return value;
    }
  } catch { /* A missing or unreadable cache falls back to launcher resolution. */ }
  return undefined;
}

function writeCachedRuntime(selected) {
  const temporary = `${cachePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify({ integration: selected.integration, assetRoot: selected.assetRoot }));
    fs.renameSync(temporary, cachePath);
  } catch { /* Caching is an optimization; the next hook resolves again. */ }
  finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true }); }
}

function fail(event, message) {
  process.stderr.write(`[frontier-cursor] ${message}\n`);
  const response = event === 'preToolUse'
    ? { permission: 'deny', user_message: message, agent_message: message }
    : { additional_context: `Frontier context unavailable: ${message}. Run frontier context explicitly.` };
  process.stdout.write(`${JSON.stringify(response)}\n`);
  process.exitCode = event === 'preToolUse' ? 2 : 0;
}

function main() {
  const event = process.argv[2];
  if (process.argv.length !== 3 || !['sessionStart', 'preToolUse'].includes(event)) {
    fail('preToolUse', 'A supported Cursor hook event is required.');
    return;
  }
  if (process.platform === 'win32') {
    const extensions = (process.env.PATHEXT ?? '').split(';').filter(Boolean);
    for (const required of ['.EXE', '.CMD']) {
      if (!extensions.some(value => value.toUpperCase() === required)) extensions.push(required);
    }
    process.env.PATHEXT = extensions.join(';');
  }
  let selected = readCachedRuntime();
  try {
    if (!selected) {
      selected = resolveRuntime(workspace);
      writeCachedRuntime(selected);
    }
  } catch (error) {
    fail(event, error.message);
    return;
  }
  const result = spawnSync(process.execPath, [adapterPath(selected.assetRoot), '--workspace', workspace, 'hook', event], {
    cwd: workspace, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, FRONTIER_WORKSPACE_ROOT: workspace },
  });
  if (result.error) {
    fail(event, `Cursor hook adapter failed to start: ${result.error.message}`);
    return;
  }
  process.exitCode = result.status ?? 1;
}

module.exports = { readCachedRuntime };
if (require.main === module) main();
