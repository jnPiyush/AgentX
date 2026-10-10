const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { childEnvironment, validateRuntimeEnv, containsCliPath, runFrontierProcess } = require('../src/frontierRunner');

test('CLI containment preserves boundaries without Unicode lowercase collisions', () => {
  assert.equal(containsCliPath(path.resolve('source'), path.resolve('source-other', 'cli.ps1')), false);
  assert.equal(containsCliPath(path.resolve('source'), path.resolve('source', 'cli.ps1')), true);
  assert.equal(containsCliPath(path.resolve('source'), path.resolve('source')), false);
  if (process.platform === 'win32') {
    assert.equal(containsCliPath('C:\\source\\\u0130', 'C:\\source\\i\u0307\\cli.ps1'), false);
    assert.equal(containsCliPath('C:\\SOURCE', 'c:\\source\\cli.ps1'), true);
  }
});

test('only explicitly selected provider variables reach children; channel and state credentials never do', () => {
  const source = {
    PATH: 'fixture-path', OPENAI_API_KEY: 'llm-fixture', FRONTIER_TEAMS_APP_SECRET: 'teams-fixture',
    FRONTIER_GITHUB_WEBHOOK_SECRET: 'github-fixture', FRONTIER_STATE_ROOT: 'another-profile',
  };
  const env = childEnvironment(['OPENAI_API_KEY'], source);
  assert.equal(env.OPENAI_API_KEY, 'llm-fixture');
  assert.equal(env.FRONTIER_TEAMS_APP_SECRET, undefined);
  assert.equal(env.FRONTIER_GITHUB_WEBHOOK_SECRET, undefined);
  assert.equal(env.FRONTIER_STATE_ROOT, undefined);
  assert.equal(env.FRONTIER_NONINTERACTIVE_HUMAN, '1');
  assert.throws(() => validateRuntimeEnv(['FRONTIER_TEAMS_APP_SECRET']));
  assert.throws(() => validateRuntimeEnv(['FRONTIER_SKIP_EVIDENCE_GATE']));
});

test('structured output preserves split UTF-8 and remains separate from stderr', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-wa-utf8-'));
  fs.writeFileSync(path.join(root, 'fixture.ps1'), '');
  const body = JSON.stringify({ sessionId: 'fixture', finalText: '\u2603' });
  const bytes = Buffer.from(body);
  const split = bytes.indexOf(0xe2) + 1;
  try {
    const result = await runFrontierProcess(['run', '--json'], {
      repoPath: root, cliRelativePath: 'fixture.ps1', maxOutputChars: 10,
      maxRuntimeOutputChars: 1000, commandTimeoutMs: 1000,
    }, { spawn: () => {
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
      setImmediate(() => {
        child.stdout.emit('data', bytes.subarray(0, split));
        child.stderr.emit('data', Buffer.from('diagnostic'));
        child.stdout.emit('data', bytes.subarray(split));
        child.emit('close', 0);
      });
      return child;
    } });
    assert.equal(result.stdout, body);
    assert.equal(result.stderr, 'diagnostic');
    assert.equal(result.ok, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('synchronous and no-process spawn failures are explicit without a fake termination attempt', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-wa-spawn-'));
  fs.writeFileSync(path.join(root, 'fixture.ps1'), '');
  const config = { repoPath: root, cliRelativePath: 'fixture.ps1', maxOutputChars: 1000, commandTimeoutMs: 1000 };
  try {
    const thrown = await runFrontierProcess(['ready'], config, { spawn: () => { throw new Error('unavailable'); } });
    assert.equal(thrown.ok, false);
    assert.match(thrown.text, /Spawn error/);
    let removed = false;
    const missing = await runFrontierProcess(['ready'], config, { spawn: () => {
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
      setImmediate(() => child.emit('error', new Error('ENOENT')));
      return child;
    }, onChildDone: () => { removed = true; }, terminate: assert.fail });
    assert.equal(missing.ok, false);
    assert.equal(removed, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
