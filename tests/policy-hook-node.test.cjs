'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PassThrough } = require('node:stream');
const { test } = require('node:test');
const { executeHook, readInput, resolveEnvironment } = require('../.frontier/runtime/policy-hook');

test('known read-only tools return without launching PowerShell or reading bindings', () => {
  for (const tool of ['read_file', 'grep_search', 'get_errors', 'get_terminal_output']) {
    const result = executeHook({ hook_event_name: 'PreToolUse', tool_name: tool }, {
      cwd: '/missing-workspace', env: { FRONTIER_HOOK_PROFILES: 'invalid' },
      spawnSync: () => { throw new Error('read-only tools must not launch'); },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

test('mutations and unknown tools delegate to bounded authoritative policy', () => {
  const workspace = fs.realpathSync.native(process.cwd());
  for (const tool of ['apply_patch', 'run_in_terminal', 'mcp_github_push_files', 'unknown']) {
    let calls = 0;
    const payload = { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command: 'write' } };
    const result = executeHook(payload, {
      cwd: workspace, env: {},
      spawnSync: (command, args, options) => {
        calls++;
        assert.equal(command, 'pwsh');
        assert.equal(args.at(-1), 'policy-hook');
        assert.ok(args.includes('-NonInteractive'));
        assert.equal(options.timeout, 10000);
        assert.equal(options.maxBuffer, 65536);
        assert.equal(options.env.FRONTIER_WORKSPACE_ROOT, workspace);
        assert.deepEqual(JSON.parse(options.input), payload);
        return { status: 2, stdout: '', stderr: 'policy denied' };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.status, 2);
  }
});

test('private state is bound to the correct workspace and authority', () => {
  const temporary = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-hook-')));
  try {
    const workspace = path.join(temporary, 'workspace');
    const stateRoot = path.join(temporary, 'private');
    fs.mkdirSync(workspace);
    fs.mkdirSync(stateRoot);
    const normalized = (process.platform === 'win32'
      ? workspace.replace(/[A-Z]/g, letter => letter.toLowerCase()) : workspace).replace(/\\/g, '/');
    const identity = createHash('sha256').update(`frontier-workspace-v1\n\n${normalized}`).digest('hex');
    const profile = { workspaceRoot: workspace, stateRoot, authority: '', graphEnabled: false };
    const filename = path.join(stateRoot, 'workspace-binding.json');
    fs.writeFileSync(filename, JSON.stringify({ ...profile, schemaVersion: 1, identity, mode: 'private' }));
    const env = { FRONTIER_HOOK_PROFILES: JSON.stringify([profile]), FRONTIER_STATE_ROOT: 'other' };
    const result = resolveEnvironment(workspace, env);
    assert.equal(result.FRONTIER_STATE_ROOT, stateRoot);
    assert.equal(result.FRONTIER_STATE_WORKSPACE, workspace);
    assert.equal(result.FRONTIER_STATE_AUTHORITY, '');
    assert.equal(result.FRONTIER_GRAPH_ENABLED, '0');
    assert.throws(() => resolveEnvironment(temporary, env), /not bound/);
    fs.writeFileSync(filename, JSON.stringify({ ...profile, schemaVersion: 1, identity: 'wrong', mode: 'repository' }));
    assert.throws(() => resolveEnvironment(workspace, env), /does not match/);
    fs.writeFileSync(filename, JSON.stringify({ ...profile, schemaVersion: 1, identity, mode: 'repository' }));
    assert.throws(() => resolveEnvironment(workspace, env), /configuration was removed/);
    fs.unlinkSync(filename);
    assert.throws(() => resolveEnvironment(workspace, env), /incomplete/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('portable hooks preserve explicit state binding and reject malformed events', () => {
  const env = { FRONTIER_STATE_ROOT: '/bound', FRONTIER_STATE_WORKSPACE: '/workspace' };
  assert.equal(resolveEnvironment('/workspace', env).FRONTIER_STATE_ROOT, '/bound');
  for (const payload of [null, [], {}, { hook_event_name: 'PreToolUse' }]) {
    assert.throws(() => executeHook(payload));
  }
});

test('stdin parsing is complete, bounded and rejects malformed JSON', async () => {
  const input = new PassThrough();
  const result = readInput(input);
  input.end('{"hook_event_name":"Stop"}');
  assert.deepEqual(await result, { hook_event_name: 'Stop' });
  const malformed = new PassThrough();
  const invalid = readInput(malformed);
  malformed.end('{');
  await assert.rejects(invalid, /not valid JSON/);
  const oversized = new PassThrough();
  const tooLarge = readInput(oversized);
  oversized.end(Buffer.alloc(1024 * 1024 + 1));
  await assert.rejects(tooLarge, /exceeds/);
  const stalled = new PassThrough();
  await assert.rejects(readInput(stalled), /timed out/);
  stalled.destroy();
});