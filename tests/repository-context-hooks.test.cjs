const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildEntry, requestRepositoryContext } = require('../.github/hooks/scripts/signal-capture');

function makeWorkspace(initialized) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier hook fixture '));
  if (initialized) {
    fs.mkdirSync(path.join(root, '.frontier'));
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{"mode":"local"}');
  }
  return root;
}

test('context bootstrap uses the bundled CLI and the actual workspace without shell interpolation', (t) => {
  const workspace = makeWorkspace(true);
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const payload = { sessionId: 'fixture-session', source: 'startup', initialPrompt: 'Find "imports"; keep this as data' };
  let invocation;
  const response = requestRepositoryContext(payload, (...args) => {
    invocation = args;
    return { status: 0, stdout: '{"additionalContext":"bounded source pointers"}' };
  }, workspace);
  assert.equal(invocation[0], 'pwsh');
  assert.ok(invocation[1].includes(path.resolve(__dirname, '..', '.frontier', 'runtime', 'frontier-cli.ps1')));
  assert.deepEqual(invocation[1].slice(-2), ['context', '--hook']);
  assert.equal(invocation[2].cwd, workspace);
  assert.equal(invocation[2].env.FRONTIER_WORKSPACE_ROOT, workspace);
  assert.deepEqual(JSON.parse(invocation[2].input), payload);
  assert.equal(invocation[2].shell, undefined);
  assert.equal(invocation[2].timeout, 8000);
  assert.equal(response.additionalContext, 'bounded source pointers');
});

test('context bootstrap never indexes a folder where Frontier is not initialized', (t) => {
  const workspace = makeWorkspace(false);
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  let called = false;
  const response = requestRepositoryContext({ sessionId: 'plugin-only' }, () => { called = true; return { status: 0, stdout: '{}' }; }, workspace);
  assert.equal(response, null);
  assert.equal(called, false);
  assert.equal(fs.existsSync(path.join(workspace, '.frontier', 'state')), false);
});

test('Local hook envelopes pass through while telemetry remains metadata-only', (t) => {
  const workspace = makeWorkspace(true);
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const payload = { hook_event_name: 'SessionStart', session_id: 'fixture', prompt: 'private prompt text' };
  const output = { continue: true, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'source data' } };
  assert.deepEqual(requestRepositoryContext(payload, () => ({ status: 0, stdout: JSON.stringify(output) }), workspace), output);
  const entry = buildEntry(payload);
  assert.equal(entry.marker, 'start');
  assert.equal(entry.sessionId, 'fixture');
  assert.equal(JSON.stringify(entry).includes('private prompt text'), false);
});

test('context bootstrap surfaces command, timeout and malformed-response failures', (t) => {
  const workspace = makeWorkspace(true);
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  assert.throws(() => requestRepositoryContext({}, () => ({ status: 1, stdout: '' }), workspace), /exited 1/);
  assert.throws(() => requestRepositoryContext({}, () => ({ error: { code: 'ETIMEDOUT' } }), workspace), /ETIMEDOUT/);
  for (const stdout of ['not JSON', 'null', '[]']) {
    assert.throws(() => requestRepositoryContext({}, () => ({ status: 0, stdout }), workspace));
  }
});
