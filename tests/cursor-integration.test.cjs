'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const {
  readAsset, mergeConfiguration, translateHookInput, translateHookResult, setupCursor,
} = require('../.frontier/runtime/cursor.js');

const root = path.resolve(__dirname, '..');

test('the workspace cursor command resolves Node in a restricted MCP environment', () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) { if (key.toUpperCase() === 'PATHEXT') delete env[key]; }
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
    path.join(root, '.frontier', 'runtime', 'frontier.ps1'), 'cursor', 'read', 'AGENTS.md'], {
    cwd: root, env, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Frontier FDE Guidelines/);
});

test('every Cursor command resolves its canonical role through the runtime', () => {
  const commands = fs.readdirSync(path.join(root, '.cursor', 'commands'));
  assert.equal(commands.length, 18);
  for (const command of commands) {
    const content = fs.readFileSync(path.join(root, '.cursor', 'commands', command), 'utf8');
    const target = content.match(/cursor read ([^\s`]+\.agent\.md)/);
    assert.ok(target, command);
    assert.ok(readAsset(target[1], root).includes('---'), command);
  }
});

test('canonical reads reject traversal, absolute paths and unrelated workspace files', () => {
  assert.ok(readAsset('.github/AGENT-PROTOCOL.md', root).includes('Cross-Cutting Agent Protocol'));
  assert.ok(readAsset('scripts/score-code-quality.ps1', root).includes('WorkspaceRoot'));
  assert.ok(readAsset('packs/frontier-core/manifest.json', root).includes('version'));
  for (const target of ['../.env', '.github/agents/../../../../.env', '.frontier/state/loop-state.json', 'C:\\secrets.txt']) {
    assert.throws(() => readAsset(target, root), /canonical|outside|path/i);
  }
});

test('Cursor config merge preserves user entries and is idempotent', () => {
  const desiredMcp = { command: 'pwsh', args: ['frontier.ps1', 'cursor', 'mcp'] };
  const desiredHooks = { sessionStart: [{ command: 'frontier session' }], preToolUse: [{ command: 'frontier tool', failClosed: true }] };
  const originalMcp = { mcpServers: { user: { url: 'https://example.invalid/mcp' } }, extra: true };
  const originalHooks = { version: 1, hooks: { sessionStart: [{ command: 'user-hook' }], stop: [{ command: 'user-stop' }] } };
  const merged = mergeConfiguration(originalMcp, originalHooks, desiredMcp, desiredHooks);
  assert.deepEqual(merged.mcp.mcpServers.user, originalMcp.mcpServers.user);
  assert.equal(merged.mcp.extra, true);
  assert.deepEqual(merged.hooks.hooks.stop, originalHooks.hooks.stop);
  assert.equal(merged.hooks.hooks.sessionStart.length, 2);
  assert.deepEqual(mergeConfiguration(merged.mcp, merged.hooks, desiredMcp, desiredHooks), merged);
  assert.deepEqual(originalMcp.mcpServers, { user: { url: 'https://example.invalid/mcp' } });
  assert.throws(() => mergeConfiguration({ mcpServers: { frontier: { command: 'user-server' } } }, originalHooks, desiredMcp, desiredHooks), /conflict/i);
  assert.throws(() => mergeConfiguration({ mcpServers: [] }, originalHooks, desiredMcp, desiredHooks), /object/i);
  assert.throws(() => mergeConfiguration(originalMcp, {
    version: 1, hooks: { preToolUse: [{ command: 'frontier tool', failClosed: false }] },
  }, desiredMcp, desiredHooks), /conflict/i);
});

test('previous PowerShell registration and unchanged short hook defaults migrate', () => {
  const mcp = JSON.parse(fs.readFileSync(path.join(root, '.cursor', 'mcp.json'), 'utf8'));
  const hooks = JSON.parse(fs.readFileSync(path.join(root, '.cursor', 'hooks.json'), 'utf8'));
  const previousHooks = structuredClone(hooks);
  for (const entries of Object.values(previousHooks.hooks)) {
    for (const entry of entries) entry.timeout = 15;
  }
  const result = mergeConfiguration({
    mcpServers: {
      user: { command: 'user-server' },
      frontier: {
        command: 'pwsh',
        args: ['-NoProfile', '-NonInteractive', '-File', '${workspaceFolder}/.frontier/runtime/frontier.ps1', 'cursor', 'mcp'],
      },
    },
  }, previousHooks, mcp.mcpServers.frontier, hooks.hooks);
  assert.deepEqual(result.mcp.mcpServers.frontier, mcp.mcpServers.frontier);
  assert.equal(result.mcp.mcpServers.user.command, 'user-server');
  assert.deepEqual(result.hooks, hooks);
});

test('PowerShell hook launchers migrate to the Node launcher without running twice', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(root, '.cursor', 'hooks.json'), 'utf8'));
  const launcher = event => `pwsh -NoProfile -NonInteractive -File ".frontier/runtime/frontier.ps1" cursor hook ${event}`;
  for (const timeout of [15, 60]) {
    const previous = { version: 1, hooks: {
      sessionStart: [{ command: launcher('sessionStart'), timeout }, { command: 'user-hook' }],
      preToolUse: [{ command: launcher('preToolUse'), timeout, failClosed: true }],
    } };
    const merged = mergeConfiguration({}, previous, { command: 'node' }, hooks.hooks);
    assert.deepEqual(merged.hooks.hooks.sessionStart, [hooks.hooks.sessionStart[0], { command: 'user-hook' }]);
    assert.deepEqual(merged.hooks.hooks.preToolUse, hooks.hooks.preToolUse);
  }
  const customized = { version: 1, hooks: { preToolUse: [{ command: launcher('preToolUse'), timeout: 60, matcher: 'Write' }] } };
  const kept = mergeConfiguration({}, customized, { command: 'node' }, hooks.hooks);
  assert.equal(kept.hooks.hooks.preToolUse.length, 2);
});

test('native hooks translate edits, shell and session identity without changing roots', () => {
  const edit = translateHookInput('preToolUse', { tool_name: 'Write', tool_input: { file_path: 'src/app.ts' } });
  assert.equal(edit.tool_name, 'apply_patch');
  assert.equal(edit.tool_input.file_path, 'src/app.ts');
  assert.deepEqual(translateHookInput('preToolUse', {
    tool_name: 'Delete', tool_input: { files: ['.frontier/state/loop-state.json'] },
  }).tool_input.cursor_paths, [{ path: '.frontier/state/loop-state.json' }]);
  assert.deepEqual(translateHookInput('preToolUse', {
    tool_name: 'Edit', tool_input: { target_file: '.frontier/state/loop-state.json' },
  }).tool_input.cursor_paths, [{ path: '.frontier/state/loop-state.json' }]);
  assert.throws(() => translateHookInput('preToolUse', { tool_name: 'Write', tool_input: {} }), /recognized path/);
  const shell = translateHookInput('preToolUse', { tool_name: 'Shell', tool_input: { command: 'pwd' } });
  assert.equal(shell.tool_name, 'runCommands');
  assert.equal(shell.tool_input.command, 'pwd');
  assert.equal(translateHookInput('preToolUse', {
    tool_name: 'MCP:github_get_issue', tool_input: { issue: 1 },
  }).tool_name, 'MCP:github_get_issue');
  for (const method of ['create_or_update_file', 'push_files', 'delete_file']) {
    assert.equal(translateHookInput('preToolUse', {
      tool_name: `MCP:${method}`, tool_input: {},
    }).tool_name, `mcp_github_${method}`);
  }
  assert.equal(translateHookInput('preToolUse', {
    tool_name: 'Task', tool_input: { prompt: 'Read the requirements' },
  }).tool_name, 'cursor_read');
  const session = translateHookInput('sessionStart', { conversation_id: 'conversation-1' });
  assert.equal(session.hook_event_name, 'SessionStart');
  assert.equal(session.session_id, 'conversation-1');
  assert.throws(() => translateHookInput('preToolUse', { tool_name: 'Write', tool_input: 'invalid' }), /input/i);
  assert.throws(() => translateHookInput('preToolUse', {
    tool_name: 'Shell', tool_input: { command: 'pwd', working_directory: 'src' },
  }, root), /workspace root/);
  assert.throws(() => translateHookInput('sessionStart', { workspace_roots: [os.tmpdir()] }, root), /bound Frontier workspace/);
});

test('native hook outputs distinguish allow, deny, malformed data and primer context', () => {
  assert.deepEqual(translateHookResult('preToolUse', { status: 0, stdout: '', stderr: '' }), { permission: 'allow' });
  assert.equal(translateHookResult('preToolUse', { status: 2, stdout: '', stderr: 'Start a loop' }).permission, 'deny');
  assert.throws(() => translateHookResult('preToolUse', { status: 0, stdout: '{', stderr: '' }), /JSON/);
  assert.throws(() => translateHookResult('preToolUse', { status: null, error: new Error('timeout') }), /timeout/);
  const output = translateHookResult('sessionStart', {
    status: 0, stderr: '', stdout: JSON.stringify({ continue: true, hookSpecificOutput: { additionalContext: 'cached graph' } }),
  });
  assert.equal(output.additional_context, 'cached graph');
  assert.ok(!('hookSpecificOutput' in output));
});

test('setup preserves custom files and refuses missing dependencies before writing registration', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-'));
  try {
    fs.mkdirSync(path.join(workspace, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{}');
    const cursor = path.join(workspace, '.cursor');
    fs.mkdirSync(path.join(cursor, 'rules'), { recursive: true });
    fs.writeFileSync(path.join(cursor, 'rules', 'user.mdc'), 'user-owned');
    assert.throws(() => setupCursor(workspace, { assetRoot: root, checkDependencies: () => { throw new Error('dependency missing'); } }), /dependency missing/);
    assert.ok(!fs.existsSync(path.join(cursor, 'mcp.json')));
    const result = setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} });
    assert.equal(result.status, 'configured');
    assert.equal(fs.readFileSync(path.join(cursor, 'rules', 'user.mdc'), 'utf8'), 'user-owned');
    assert.ok(!fs.existsSync(path.join(workspace, '.github', 'agents')));
    const configuration = JSON.parse(fs.readFileSync(path.join(cursor, 'mcp.json'), 'utf8'));
    assert.ok(configuration.mcpServers.frontier.args.includes('${workspaceFolder}/.frontier/runtime/cursor-mcp.js'));
    const first = fs.readFileSync(path.join(cursor, 'hooks.json'), 'utf8');
    setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} });
    assert.equal(fs.readFileSync(path.join(cursor, 'hooks.json'), 'utf8'), first);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('setup upgrades only byte-equivalent legacy wrappers and preserves custom edits', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-upgrade-'));
  try {
    fs.mkdirSync(path.join(workspace, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{}');
    const commands = path.join(workspace, '.cursor', 'commands');
    fs.mkdirSync(commands, { recursive: true });
    const desired = fs.readFileSync(path.join(root, '.cursor', 'commands', 'engineer.md'), 'utf8');
    const legacy = desired.replace(
      'Run `pwsh -NoProfile -File .frontier/runtime/frontier.ps1 cursor read .github/agents/engineer.agent.md`',
      'Read `.github/agents/engineer.agent.md`',
    );
    fs.writeFileSync(path.join(commands, 'engineer.md'), legacy);
    fs.writeFileSync(path.join(commands, 'reviewer.md'), 'user custom reviewer');
    const result = setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} });
    assert.equal(fs.readFileSync(path.join(commands, 'engineer.md'), 'utf8'), desired);
    assert.equal(fs.readFileSync(path.join(commands, 'reviewer.md'), 'utf8'), 'user custom reviewer');
    assert.ok(result.preserved.includes('.cursor/commands/reviewer.md'));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('setup retires unmodified owned assets that are no longer shipped and preserves edited ones', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-retire-'));
  try {
    fs.mkdirSync(path.join(workspace, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{}');
    setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} });
    const commands = path.join(workspace, '.cursor', 'commands');
    const ownershipPath = path.join(workspace, '.frontier', 'cursor-assets.json');
    const ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'));
    const digest = text => require('node:crypto').createHash('sha256').update(text).digest('hex');
    fs.writeFileSync(path.join(commands, 'renamed-role.md'), 'old shipped command');
    fs.writeFileSync(path.join(commands, 'edited-role.md'), 'user edited command');
    ownership.files['.cursor/commands/renamed-role.md'] = digest('old shipped command');
    ownership.files['.cursor/commands/edited-role.md'] = digest('original shipped command');
    ownership.files['.frontier/config.json'] = digest('{}');
    fs.writeFileSync(ownershipPath, JSON.stringify(ownership));
    const result = setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} });
    assert.deepEqual(result.retired, ['.cursor/commands/renamed-role.md']);
    assert.ok(!fs.existsSync(path.join(commands, 'renamed-role.md')));
    assert.equal(fs.readFileSync(path.join(commands, 'edited-role.md'), 'utf8'), 'user edited command');
    assert.ok(result.preserved.includes('.cursor/commands/edited-role.md'));
    assert.ok(fs.existsSync(path.join(workspace, '.frontier', 'config.json')));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('the hook launcher dispatches Cursor reads without loading the full CLI', () => {
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
    path.join(root, '.frontier', 'runtime', 'frontier.ps1'), 'cursor', 'hook', 'preToolUse'], {
    cwd: root, encoding: 'utf8', timeout: 30000,
    input: JSON.stringify({ tool_name: 'Read', tool_input: { path: 'README.md' }, workspace_roots: [root] }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { permission: 'allow' });
});

test('setup does not migrate an unowned AgentX command into the Frontier role', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-no-agentx-'));
  try {
    fs.mkdirSync(path.join(workspace, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{}');
    const commands = path.join(workspace, '.cursor', 'commands');
    fs.mkdirSync(commands, { recursive: true });
    const desired = fs.readFileSync(path.join(root, '.cursor', 'commands', 'frontier.md'), 'utf8');
    const obsolete = desired.replace(
      'Run `pwsh -NoProfile -File .frontier/runtime/frontier.ps1 cursor read .github/agents/frontier.agent.md`',
      'Read `.github/agents/agent-x.agent.md`',
    );
    assert.notEqual(obsolete, desired);
    fs.writeFileSync(path.join(commands, 'frontier.md'), obsolete);
    const result = setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} });
    assert.ok(result.preserved.includes('.cursor/commands/frontier.md'));
    assert.equal(fs.readFileSync(path.join(commands, 'frontier.md'), 'utf8'), obsolete);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('standalone setup reads private templates, not user-owned shared Cursor config', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-standalone-'));
  try {
    const templates = path.join(workspace, '.frontier', 'runtime', 'cursor-assets');
    fs.mkdirSync(path.dirname(templates), { recursive: true });
    fs.cpSync(path.join(root, '.cursor'), templates, { recursive: true });
    fs.copyFileSync(path.join(root, '.frontier', 'runtime', 'cursor-mcp.js'),
      path.join(workspace, '.frontier', 'runtime', 'cursor-mcp.js'));
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{}');
    fs.mkdirSync(path.join(workspace, '.cursor'));
    fs.writeFileSync(path.join(workspace, '.cursor', 'mcp.json'), '{"mcpServers":{"user":{"command":"user-server"}}}');
    setupCursor(workspace, { assetRoot: workspace, checkDependencies: () => {} });
    const configured = JSON.parse(fs.readFileSync(path.join(workspace, '.cursor', 'mcp.json'), 'utf8'));
    assert.equal(configured.mcpServers.frontier.command, 'node');
    assert.equal(configured.mcpServers.user.command, 'user-server');
    assert.ok(fs.existsSync(path.join(workspace, '.cursor', 'hooks.json')));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('setup rejects linked configuration directories even when the target is absent', t => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-links-'));
  try {
    fs.mkdirSync(path.join(workspace, '.frontier'));
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{}');
    const absent = path.join(workspace, 'absent-target');
    try { fs.symlinkSync(absent, path.join(workspace, '.cursor'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (!['EPERM', 'ENOTSUP'].includes(error.code)) throw error;
      t.skip(`Host cannot create the required link: ${error.code}`);
      return;
    }
    assert.throws(() => setupCursor(workspace, { assetRoot: root, checkDependencies: () => {} }), /symbolic link/);
    assert.ok(!fs.existsSync(absent));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
