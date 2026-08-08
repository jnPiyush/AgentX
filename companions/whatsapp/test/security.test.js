const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ConfirmationStore, classifyCommand } = require('../src/commandPolicy');
const { createMessageHandler, shouldProcessMessage } = require('../src/messageHandler');
const { createBot } = require('../src/bot');
const { loadConfig } = require('../src/config');
const { childEnvironment, createAgentXRunner, runAgentXProcess } = require('../src/agentxRunner');
const { startLoopWatcher } = require('../src/loopWatcher');
const { transcribeVoiceNote } = require('../src/transcribe');

function baseConfig(overrides = {}) {
  return {
    allowedNumbers: ['14155550123'],
    repoPath: path.resolve(__dirname, '..', '..', '..'),
    cliRelativePath: '.agentx/agentx.ps1',
    defaultAgent: 'engineer',
    commandTimeoutMs: 2000,
    maxOutputChars: 1000,
    maxInputChars: 2000,
    maxQueueDepth: 2,
    confirmationTtlMs: 1000,
    capabilities: { ship: false, run: false, loopMutation: false, raw: false },
    browser: { headless: true },
    openaiApiKey: '',
    whisperModel: 'whisper-1',
    whisperLanguage: '',
    voiceAutoExecuteReadOnly: false,
    voiceMaxBytes: 1024,
    voiceTimeoutMs: 100,
    logMessageContent: false,
    notifications: { enabled: false, targets: [], events: [], debounceMs: 20, pollMs: 20 },
    ...overrides,
  };
}

function fakeMessage(body, overrides = {}) {
  const replies = [];
  return {
    id: { _serialized: overrides.id || `id-${Math.random()}` },
    from: '14155550123@c.us',
    to: '14155550123@c.us',
    fromMe: true,
    deviceType: 'android',
    body,
    hasMedia: false,
    isStatus: false,
    reply: async (text) => replies.push(text),
    replies,
    ...overrides,
  };
}

test('self-chat native message is accepted and web reply is ignored', () => {
  assert.equal(shouldProcessMessage(fakeMessage('ready')), true);
  assert.equal(shouldProcessMessage(fakeMessage('ready', { deviceType: 'web' })), false);
  assert.equal(shouldProcessMessage(fakeMessage('ready', { from: '1@c.us', to: '2@c.us' })), false);
});

test('ID-less messages are rejected before command execution', async () => {
  const calls = [];
  const handler = createMessageHandler(baseConfig(), {
    executePlan: async (plan) => { calls.push(plan.args); return { ok: true, text: 'ok' }; },
  });
  const message = fakeMessage('ready', { id: undefined });
  message.id = undefined;
  await handler(message);
  assert.equal(calls.length, 0);
  assert.equal(message.replies.length, 0);
});

test('default command policy is read-only and disables evidence-less loop mutation', () => {
  const config = baseConfig();
  assert.deepEqual(classifyCommand(['ready'], config).args, ['ready']);
  assert.equal(classifyCommand(['ship', '42'], config).ok, false);
  assert.match(classifyCommand(['loop', 'iterate', 'done'], config).text, /evidence/i);
  assert.equal(classifyCommand(['raw', 'config', 'show'], config).ok, false);
  assert.equal(classifyCommand(['ready', 'extra'], config).ok, false);
  assert.equal(classifyCommand(['deps', '42', 'extra'], config).ok, false);
});

test('mutating plans require a single-use, sender-bound, expiring nonce', () => {
  let now = 1;
  const store = new ConfirmationStore({ ttlMs: 10, now: () => now, nonceFactory: () => 'ABC123' });
  const plan = { ok: true, args: ['ship', '-Issue', '42'], risk: 'mutate' };
  assert.equal(store.request('14155550123', plan).nonce, 'ABC123');
  assert.equal(store.consume('14155550000', 'ABC123'), null);
  assert.deepEqual(store.consume('14155550123', 'ABC123'), plan);
  assert.equal(store.consume('14155550123', 'ABC123'), null);
  store.request('14155550123', plan);
  now = 20;
  assert.equal(store.consume('14155550123', 'ABC123'), null);
});

test('confirmation store retries nonce collisions without overwriting pending commands', () => {
  const values = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
  const store = new ConfirmationStore({ nonceFactory: () => values.shift() || 'BBBBBB' });
  const first = { ok: true, args: ['ship', '-Issue', '1'], risk: 'mutate' };
  const second = { ok: true, args: ['ship', '-Issue', '2'], risk: 'mutate' };
  assert.equal(store.request('1', first).nonce, 'AAAAAA');
  assert.equal(store.request('1', second).nonce, 'BBBBBB');
  assert.deepEqual(store.consume('1', 'AAAAAA'), first);
  assert.deepEqual(store.consume('1', 'BBBBBB'), second);
});

test('message handler executes self-chat message once and confirms mutation once', async () => {
  const calls = [];
  const config = baseConfig({ capabilities: { ship: true, run: false, loopMutation: false, raw: false } });
  const confirmations = new ConfirmationStore({ nonceFactory: () => 'ABC123' });
  const handler = createMessageHandler(config, {
    confirmations,
    executePlan: async (plan) => { calls.push(plan.args); return { ok: true, text: 'ok' }; },
  });
  const ready = fakeMessage('ready', { id: 'same' });
  await handler(ready);
  await handler(ready);
  assert.deepEqual(calls, [['ready']]);

  const ship = fakeMessage('ship 42', { id: 'ship' });
  await handler(ship);
  assert.match(ship.replies.join('\n'), /confirm ABC123/);
  await handler(fakeMessage('confirm ABC123', { id: 'confirm' }));
  await handler(fakeMessage('confirm ABC123', { id: 'confirm-again' }));
  assert.deepEqual(calls, [['ready'], ['ship', '-Issue', '42']]);
});

test('voice input cannot authorize mutations and read-only auto-execution is opt-in', async () => {
  const calls = [];
  const config = baseConfig({
    capabilities: { ship: true, run: false, loopMutation: false, raw: false },
    voiceAutoExecuteReadOnly: true,
  });
  const handler = createMessageHandler(config, {
    transcribe: async () => ({ ok: true, text: 'ship 42' }),
    executePlan: async (plan) => { calls.push(plan.args); return { ok: true, text: 'ok' }; },
  });
  const voice = fakeMessage('', {
    id: 'voice',
    hasMedia: true,
    type: 'ptt',
    downloadMedia: async () => ({ data: 'YQ==', mimetype: 'audio/ogg' }),
  });
  await handler(voice);
  assert.equal(calls.length, 0);
  assert.match(voice.replies.join('\n'), /Transcript:/);
});

test('configuration fails closed for secret files, bad targets, bad capabilities, and traversal', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-config-'));
  fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
  fs.writeFileSync(path.join(root, '.agentx', 'agentx.ps1'), '', 'utf8');
  const configPath = path.join(root, 'config.json');
  const write = (value) => fs.writeFileSync(configPath, JSON.stringify(value), 'utf8');
  try {
    for (const invalid of [[], 'bad', 42]) {
      write(invalid);
      assert.throws(() => loadConfig({ configPath, env: { AGENTX_WA_ALLOWED: '14155550123', AGENTX_REPO: root } }), /JSON object/);
    }
    write({ repoPath: root, allowedNumbers: ['14155550123'], openaiApiKey: 'secret' });
    assert.throws(() => loadConfig({ configPath, env: {} }), /OPENAI_API_KEY/);
    write({ repoPath: root, allowedNumbers: [] });
    assert.throws(() => loadConfig({ configPath, env: {} }), /At least one/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], browser: 'bad' });
    assert.throws(() => loadConfig({ configPath, env: {} }), /browser must be a JSON object/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], unknownSetting: true });
    assert.throws(() => loadConfig({ configPath, env: {} }), /not supported/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], browser: { headless: 'false' } });
    assert.throws(() => loadConfig({ configPath, env: {} }), /browser.headless must be a boolean/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], defaultAgent: {} });
    assert.throws(() => loadConfig({ configPath, env: {} }), /defaultAgent must be a non-empty string/);
    write({ repoPath: root, allowedNumbers: '14155550123' });
    assert.throws(() => loadConfig({ configPath, env: {} }), /allowedNumbers must be an array/);
    write({ repoPath: root, allowedNumbers: [14155550123] });
    assert.throws(() => loadConfig({ configPath, env: {} }), /entries must be strings/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], maxQueueDepth: '5' });
    assert.throws(() => loadConfig({ configPath, env: {} }), /maxQueueDepth must be an integer/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], notifications: { targets: ['14155550999'] } });
    assert.throws(() => loadConfig({ configPath, env: {} }), /subset/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], capabilities: { raw: 'yes' } });
    assert.throws(() => loadConfig({ configPath, env: {} }), /known boolean/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], cliRelativePath: '../x' });
    assert.throws(() => loadConfig({ configPath, env: {} }), /parent traversal/);
    write({ repoPath: root, allowedNumbers: ['14155550123'], browser: { executablePath: path.join(root, 'missing-browser') } });
    assert.throws(() => loadConfig({ configPath, env: {} }), /browser\.executablePath/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('child environment removes transcription and other secret variables', () => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GITHUB_PAT: process.env.GITHUB_PAT,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };
  process.env.OPENAI_API_KEY = ['test', 'value'].join('-');
  process.env.GITHUB_PAT = 'secret';
  process.env.AWS_ACCESS_KEY_ID = 'secret';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = 'secret';
  try {
    const env = childEnvironment();
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal(env.GITHUB_PAT, undefined);
    assert.equal(env.AWS_ACCESS_KEY_ID, undefined);
    assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
    assert.equal(env.AGENTX_NONINTERACTIVE, '1');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('runner treats CLI FAIL output as failure and enforces output cap', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-runner-'));
  const cli = path.join(root, 'fake.ps1');
  try {
    fs.writeFileSync(cli, "Write-Output '[FAIL] rejected'", 'utf8');
    const config = baseConfig({ repoPath: root, cliRelativePath: 'fake.ps1', maxOutputChars: 1000 });
    const failed = await runAgentXProcess([], config);
    assert.equal(failed.ok, false);
    fs.writeFileSync(cli, "Write-Output ('x' * 2000)", 'utf8');
    const capped = await runAgentXProcess([], { ...config, maxOutputChars: 100 });
    assert.equal(capped.ok, false);
    assert.match(capped.text, /Output exceeded/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runner serializes commands and rejects queue overflow', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-queue-'));
  fs.writeFileSync(path.join(root, 'fake.ps1'), '', 'utf8');
  const config = baseConfig({ repoPath: root, cliRelativePath: 'fake.ps1', maxQueueDepth: 1 });
  const fake = new EventEmitter();
  fake.stdout = new EventEmitter();
  fake.stderr = new EventEmitter();
  fake.pid = 999999;
  fake.killed = false;
  const runner = createAgentXRunner(config, { spawn: () => fake });
  const first = runner.run(['ready']);
  const second = await runner.run(['state']);
  assert.equal(second.ok, false);
  fake.emit('close', 0);
  await first;
  await runner.stop();
  fs.rmSync(root, { recursive: true, force: true });
});

test('runner shutdown cancels queued jobs and timeout settles without close', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-stop-'));
  fs.writeFileSync(path.join(root, 'fake.ps1'), '', 'utf8');
  const children = [];
  const spawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 999998 + children.length;
    child.killed = false;
    children.push(child);
    return child;
  };
  const config = baseConfig({ repoPath: root, cliRelativePath: 'fake.ps1', maxQueueDepth: 3, commandTimeoutMs: 20 });
  const runner = createAgentXRunner(config, { spawn, terminate: () => {} });
  const first = runner.run(['ready']);
  const queued = runner.run(['state']);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const stopping = runner.stop();
  const firstResult = await first;
  const queuedResult = await queued;
  await stopping;
  assert.match(firstResult.text, /Timed out|shutting down/);
  assert.match(queuedResult.text, /shutting down/);
  assert.equal(children.length, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('transcription validates MIME, size, timeout, and success', async () => {
  const config = baseConfig({ openaiApiKey: 'secret', voiceMaxBytes: 10, voiceTimeoutMs: 10 });
  assert.match((await transcribeVoiceNote({ data: 'YQ==', mimetype: 'text/plain' }, config)).text, /Unsupported/);
  assert.match((await transcribeVoiceNote({ data: Buffer.alloc(20).toString('base64'), mimetype: 'audio/ogg' }, config)).text, /exceeds/);
  const success = await transcribeVoiceNote({ data: 'YQ==', mimetype: 'audio/ogg' }, config, {
    fetch: async () => ({ ok: true, json: async () => ({ text: 'ready' }) }),
  });
  assert.deepEqual(success, { ok: true, text: 'ready' });
  const timeout = await transcribeVoiceNote({ data: 'YQ==', mimetype: 'audio/ogg' }, config, {
    fetch: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });
  assert.match(timeout.text, /timed out/);
  let uploadedName = '';
  await transcribeVoiceNote({ data: 'YQ==', mimetype: 'audio/webm' }, config, {
    fetch: async (_url, options) => {
      uploadedName = options.body.get('file').name;
      return { ok: true, json: async () => ({ text: 'ready' }) };
    },
  });
  assert.equal(uploadedName, 'audio.webm');
});

test('voice transcription is rejected when transcript exceeds the input limit', async () => {
  const config = baseConfig({ voiceAutoExecuteReadOnly: true, maxInputChars: 5 });
  const message = fakeMessage('', {
    id: 'long-transcript',
    hasMedia: true,
    type: 'ptt',
    downloadMedia: async () => ({ data: 'YQ==', mimetype: 'audio/ogg' }),
  });
  const handler = createMessageHandler(config, {
    transcribe: async () => ({ ok: true, text: 'ready too long' }),
    executePlan: async () => { throw new Error('must not execute'); },
  });
  await handler(message);
  assert.match(message.replies.join('\n'), /Transcript exceeds/);
});

test('loop watcher preserves valid state across malformed writes', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-watch-'));
  const stateDir = path.join(repo, '.agentx', 'state');
  const state = path.join(stateDir, 'loop-state.json');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(state, JSON.stringify({ status: 'idle', active: false, iteration: 0, maxIterations: 5, history: [] }));
  const messages = [];
  const watcher = startLoopWatcher({
    config: baseConfig({ repoPath: repo, notifications: { enabled: true, targets: ['14155550123'], events: ['status', 'started', 'iteration'], debounceMs: 10, pollMs: 20 } }),
    client: { sendMessage: async (_jid, text) => messages.push(text) },
  });
  try {
    fs.writeFileSync(state, '{"status":');
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(state, JSON.stringify({ status: 'active', active: true, iteration: 1, maxIterations: 5, history: [{ summary: 'first' }] }));
    await new Promise((resolve) => setTimeout(resolve, 300));
  } finally {
    watcher.stop();
    fs.rmSync(repo, { recursive: true, force: true });
  }
  assert.ok(messages.some((text) => text.includes('Loop STARTED')));
  assert.ok(messages.some((text) => text.includes('Iteration 1')));
});

test('bot uses message_create, keeps Chromium sandbox enabled, and shuts down once', async () => {
  class FakeClient extends EventEmitter {
    constructor(options) { super(); this.options = options; this.destroyCount = 0; }
    async initialize() {}
    async destroy() { this.destroyCount += 1; }
  }
  class FakeAuth { constructor(options) { this.options = options; } }
  let runnerStops = 0;
  let watcherStops = 0;
  const bot = createBot({
    config: baseConfig(),
    ClientClass: FakeClient,
    AuthClass: FakeAuth,
    runnerFactory: () => ({ run: async () => ({ ok: true, text: 'ok' }), stop: async () => { runnerStops += 1; } }),
    watcherFactory: () => ({ stop: () => { watcherStops += 1; } }),
    handlerFactory: () => async () => {},
  });
  assert.equal(bot.client.listenerCount('message_create'), 1);
  assert.deepEqual(bot.client.options.puppeteer.args, undefined);
  bot.client.emit('ready');
  bot.client.emit('disconnected', 'test');
  await Promise.all([bot.shutdown(), bot.shutdown()]);
  assert.equal(runnerStops, 1);
  assert.equal(watcherStops, 1);
  assert.equal(bot.client.destroyCount, 1);
});
