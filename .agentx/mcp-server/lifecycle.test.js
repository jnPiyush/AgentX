const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createCliRunner, createServer, discoverRepoRoot } = require('./index');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

function fixture(hooks = {}) {
  const children = [];
  const signals = [];
  const runner = createCliRunner('/fixture', {
    platform: 'linux',
    spawn: () => {
      const child = Object.assign(new EventEmitter(), { pid: 123, stdout: new EventEmitter(), stderr: new EventEmitter() });
      children.push(child);
      return child;
    },
    kill: (_pid, signal) => signals.push(signal),
    ...hooks,
  });
  return { runner, children, signals };
}

test('explicit invalid roots throw; absent canonical configuration preserves legacy discovery', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-mcp-root-'));
  fs.mkdirSync(path.join(root, '.agentx'));
  fs.writeFileSync(path.join(root, '.agentx', 'agentx-cli.ps1'), '');
  try {
    for (const value of ['', 'relative', path.join(root, 'missing')]) {
      assert.throws(() => discoverRepoRoot({ FRONTIER_REPO_ROOT: value, AGENTX_REPO_ROOT: root }, root), /FRONTIER_REPO_ROOT/);
    }
    for (const key of ['FRONTIER_REPO_ROOT', 'HVE_REPO_ROOT', 'AGENTX_REPO_ROOT']) {
      assert.equal(discoverRepoRoot({ [key]: root }, root), root);
    }
    assert.equal(discoverRepoRoot({}, path.join(root, '.agentx')), root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('cancellation waits for close and rejects simultaneous processes', async () => {
  const { runner, children, signals } = fixture();
  const controller = new AbortController();
  let settled = false;
  const result = runner.run(['ready'], controller.signal).then(value => { settled = true; return value; });
  controller.abort();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal((await runner.run(['ready'])).exitCode, -1);
  children[0].emit('close', null);
  assert.match((await result).stderr, /cancelled/);
  assert.equal(children.length, 1);
  await runner.stop();
});

test('pre-cancelled requests never spawn', async () => {
  const { runner, children } = fixture();
  const signal = AbortSignal.abort();
  assert.equal((await runner.run(['ready'], signal)).exitCode, -1);
  assert.equal(children.length, 0);
});

test('shell close cannot release a writer before POSIX group escalation', async () => {
  const { runner, children, signals } = fixture({ killGraceMs: 5 });
  const controller = new AbortController();
  const result = runner.run([], controller.signal);
  controller.abort();
  children[0].emit('close', null);
  const concurrent = runner.run([]);
  const launchedEarly = children.length > 1;
  if (launchedEarly) children[1].emit('close', 0);
  await concurrent;
  await result;
  await runner.stop();
  assert.equal(launchedEarly, false);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});

test('combined stdout and stderr are capped and excess output terminates the child', async () => {
  const { runner, children, signals } = fixture({ maxOutputBytes: 20 });
  const result = runner.run([]);
  children[0].stdout.emit('data', 'a'.repeat(15));
  children[0].stderr.emit('data', 'b'.repeat(15));
  children[0].stdout.emit('data', 'ignored'.repeat(100));
  assert.deepEqual(signals, ['SIGTERM']);
  children[0].emit('close', 0);
  const actual = await result;
  assert.equal(actual.stdout.length, 15);
  assert.match(actual.stderr, /^bbbbb\n\[output-limit\]/);
  assert.equal(actual.exitCode, -1);
});

test('timeout escalates and unconfirmed termination keeps new calls blocked', async () => {
  const { runner, children, signals } = fixture({ timeoutMs: 5, killGraceMs: 5, teardownMs: 40 });
  const result = await runner.run([]);
  assert.match(result.stderr, /timeout/);
  assert.equal(result.terminationConfirmed, false);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.match((await runner.run([])).stderr, /unconfirmed/);
  await assert.rejects(runner.stop(), /unconfirmed/);
  children[0].emit('close', null);
  await runner.stop();
});

test('Windows taskkill failures are explicit and teardown remains bounded', async () => {
  const { runner, children } = fixture({
    platform: 'win32', timeoutMs: 5, teardownMs: 20,
    spawnSync: () => ({ status: 1, stderr: 'Access denied' }),
  });
  const result = await runner.run([]);
  assert.match(result.stderr, /taskkill failed: Access denied/);
  assert.equal(result.terminationConfirmed, false);
  children[0].emit('close', null);
  await assert.rejects(runner.stop(), /unconfirmed/);
});

test('shutdown waits for close and rejects new calls', async () => {
  const { runner, children } = fixture();
  const request = runner.run([]);
  const stopping = runner.stop();
  assert.match((await runner.run([])).stderr, /shutting down/);
  children[0].emit('close', null);
  assert.match((await request).stderr, /cancelled/);
  await stopping;
});

test('spawn errors return failure without leaking active children', async () => {
  const { runner } = fixture({ spawn: () => { throw new Error('ENOENT'); } });
  assert.match((await runner.run([])).stderr, /spawn-error.*ENOENT/);
  await runner.stop();
});

test('SDK requests advertise exactly 19 tools, preserve aliases, and forward request cancellation', async () => {
  let cancelled;
  const cancellation = new Promise(resolve => { cancelled = resolve; });
  let started;
  const start = new Promise(resolve => { started = resolve; });
  const calls = [];
  const server = createServer({
    run: async (args, signal) => {
      calls.push(args);
      if (args[0] !== 'ready') return { exitCode: 0, stdout: 'fixture', stderr: '' };
      started();
      await new Promise(resolve => signal.addEventListener('abort', () => { cancelled(); resolve(); }, { once: true }));
      return { exitCode: -1, stdout: '', stderr: 'cancelled' };
    },
    stop: async () => {},
  });
  const client = new Client({ name: 'fixture', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const catalog = await client.listTools();
    assert.equal(catalog.tools.length, 19);
    assert.ok(catalog.tools.every(tool => tool.name.startsWith('frontier_')));
    for (const name of ['frontier_loop_status', 'agentx_loop_status']) {
      assert.equal((await client.callTool({ name, arguments: {} })).isError, false);
    }
    assert.deepEqual(calls, [['loop', 'status'], ['loop', 'status']]);
    const controller = new AbortController();
    const request = client.callTool({ name: 'frontier_ready', arguments: {} }, undefined, { signal: controller.signal });
    const rejected = assert.rejects(request);
    await start;
    controller.abort();
    await rejected;
    await cancellation;
  } finally { await client.close(); await server.close(); }
});