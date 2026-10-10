'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const MAX_INPUT_BYTES = 1024 * 1024;
const READ_ONLY_TOOLS = new Set([
  'read_file', 'file_search', 'grep_search', 'semantic_search', 'list_dir',
  'view_image', 'get_errors', 'get_terminal_output', 'terminal_last_command',
  'terminal_selection', 'vscode_listCodeUsages',
]);
const pathKey = value => process.platform === 'win32'
  ? path.resolve(value).replace(/[A-Z]/g, letter => letter.toLowerCase()) : path.resolve(value);

function readInput(input) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.removeListener('data', receive);
      input.removeListener('end', end);
      input.removeListener('error', finish);
      input.pause();
      if (error) { reject(error); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('Hook input is not valid JSON.')); }
    };
    const receive = chunk => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_INPUT_BYTES) { finish(new Error('Hook input exceeds 1 MiB.')); return; }
      chunks.push(bytes);
    };
    const end = () => finish();
    const timer = setTimeout(() => finish(new Error('Hook input timed out.')), 2000);
    input.on('data', receive);
    input.once('end', end);
    input.once('error', finish);
  });
}

function resolveEnvironment(workspace, env) {
  const result = { ...env, FRONTIER_WORKSPACE_ROOT: workspace };
  if (!env.FRONTIER_HOOK_PROFILES) return result;
  for (const key of Object.keys(result)) {
    if (/^FRONTIER_(STATE_(ROOT|WORKSPACE|AUTHORITY)|GRAPH_ENABLED)$/i.test(key)) delete result[key];
  }
  const profiles = JSON.parse(env.FRONTIER_HOOK_PROFILES);
  if (!Array.isArray(profiles)) throw new Error('Invalid hook workspace bindings.');
  const profile = profiles.find(item => typeof item?.workspaceRoot === 'string'
    && pathKey(item.workspaceRoot) === pathKey(workspace));
  if (!profile || typeof profile.stateRoot !== 'string' || !path.isAbsolute(profile.stateRoot)
    || typeof profile.authority !== 'string') {
    throw new Error('Hook workspace is not bound to this Frontier extension host.');
  }
  result.FRONTIER_GRAPH_ENABLED = profile.graphEnabled === false ? '0' : '1';
  for (let current = profile.stateRoot; ; current = path.dirname(current)) {
    const entry = fs.lstatSync(current, { throwIfNoEntry: false });
    if (entry?.isSymbolicLink()) throw new Error('Hook state binding must not contain links.');
    if (path.dirname(current) === current) break;
  }
  const bindingPath = path.join(profile.stateRoot, 'workspace-binding.json');
  if (!fs.existsSync(profile.stateRoot)) return result;
  if (!fs.existsSync(bindingPath)) throw new Error('Hook private state is incomplete; restore its binding.');
  const stat = fs.lstatSync(bindingPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 1 || stat.size > 16384) {
    throw new Error('Invalid hook state binding file.');
  }
  const binding = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
  const identity = createHash('sha256')
    .update(`frontier-workspace-v1\n${profile.authority}\n${pathKey(workspace).replace(/\\/g, '/')}`)
    .digest('hex');
  if (binding?.schemaVersion !== 1 || binding.identity !== identity
    || binding.authority !== profile.authority || typeof binding.workspaceRoot !== 'string'
    || pathKey(binding.workspaceRoot) !== pathKey(workspace)
    || typeof binding.stateRoot !== 'string' || pathKey(binding.stateRoot) !== pathKey(profile.stateRoot)) {
    throw new Error('Hook state binding does not match its workspace profile.');
  }
  if (binding.mode === 'private') {
    result.FRONTIER_STATE_ROOT = profile.stateRoot;
    result.FRONTIER_STATE_WORKSPACE = workspace;
    result.FRONTIER_STATE_AUTHORITY = profile.authority;
  } else if (binding.mode !== 'repository') {
    throw new Error('Unsupported hook workspace state mode.');
  } else if (!fs.statSync(path.join(workspace, '.frontier', 'config.json'), { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Repository Frontier configuration was removed; restore it before continuing.');
  }
  return result;
}

function executeHook(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Hook input must be an object.');
  }
  const event = payload.hook_event_name;
  if (!['SessionStart', 'PreToolUse', 'Stop', 'SubagentStop'].includes(event)) {
    throw new Error('Unsupported Frontier hook event.');
  }
  if (event === 'PreToolUse') {
    if (typeof payload.tool_name !== 'string' || !payload.tool_name) {
      throw new Error('PreToolUse requires a tool name.');
    }
    if (READ_ONLY_TOOLS.has(payload.tool_name)) return { status: 0, stdout: '', stderr: '' };
  }
  const workspace = fs.realpathSync.native(options.cwd ?? process.cwd());
  const env = resolveEnvironment(workspace, options.env ?? process.env);
  const cli = path.join(__dirname, 'frontier-cli.ps1');
  if (!fs.statSync(cli, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Frontier hook runtime is missing; update or reinstall Frontier.');
  }
  const normalized = event === 'SubagentStop' ? { ...payload, hook_event_name: 'Stop' } : payload;
  return (options.spawnSync ?? spawnSync)('pwsh', ['-NoProfile', '-NonInteractive', '-File', cli, 'policy-hook'], {
    cwd: workspace, env: { ...env, FRONTIER_NONINTERACTIVE: '1' },
    input: JSON.stringify(normalized), encoding: 'utf8', windowsHide: true,
    timeout: 10000, maxBuffer: 65536,
  });
}

async function main(expectedEvent = process.argv[2]) {
  let payload;
  try {
    payload = await readInput(process.stdin);
    if (expectedEvent && payload?.hook_event_name !== expectedEvent
      && !(expectedEvent === 'Stop' && payload?.hook_event_name === 'SubagentStop')) {
      throw new Error('Hook event does not match its registered handler.');
    }
    const result = executeHook(payload);
    if (result.error || !Number.isInteger(result.status)) throw new Error(result.error?.message ?? 'Hook child did not exit.');
    if (![0, 2].includes(result.status)) throw new Error(`Hook policy exited ${result.status}.`);
    if (result.status === 0 && result.stdout?.trim()) {
      const response = JSON.parse(result.stdout);
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        throw new Error('Hook policy returned an invalid response.');
      }
    }
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.status;
  } catch (error) {
    const message = `Frontier hook unavailable: ${error.message}. Use Frontier workspace/loop tools to inspect or initialize the binding.`;
    const blocking = !['SessionStart', 'Stop', 'SubagentStop'].includes(expectedEvent ?? payload?.hook_event_name);
    process.stderr.write(`[frontier-hook] ${message}\n`);
    process.stdout.write(JSON.stringify(blocking
      ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } }
      : { systemMessage: message }) + '\n');
    process.exitCode = blocking ? 2 : 0;
  }
}

module.exports = { executeHook, readInput, resolveEnvironment, main };
if (require.main === module) void main();