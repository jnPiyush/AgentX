const test = require('node:test');
const assert = require('node:assert/strict');
const { createMessageHandler, sendChunked } = require('../src/messageHandler');
const { ConfirmationStore } = require('../src/commandPolicy');

function plan(inputId = 'a'.repeat(32)) {
  return {
    sessionId: 'engineer-fixture', agent: 'engineer', inputId,
    kind: 'plan', phase: 'awaiting_plan', planVersion: 1, digest: 'b'.repeat(64),
    plan: {
      sessionId: 'engineer-fixture', agent: 'engineer', version: 1, mode: 'guided', engine: 'native',
      goal: 'Add a health endpoint', scope: ['src/server.js'], nonGoals: [], assumptions: [],
      steps: [{ id: 's1', title: 'Add endpoint', verification: 'Inspect response' }],
    },
  };
}

let sequence = 0;
function message(body, phone = '14155550123', overrides = {}) {
  const replies = [];
  return {
    id: { _serialized: `message-${++sequence}` }, from: `${phone}@c.us`, to: `${phone}@c.us`,
    fromMe: true, deviceType: 'android', body, hasMedia: false, replies,
    reply: async text => replies.push(text), ...overrides,
  };
}

function config(run) {
  return {
    allowedNumbers: ['14155550123', '14155550456'], maxInputChars: 2000, maxOutputChars: 6000,
    confirmationTtlMs: 120000, capabilities: { run: true }, runner: { run },
  };
}

test('WhatsApp confirmation, pending plan, stale response and current approval stay owner-bound', async () => {
  const calls = [];
  let current = plan();
  const handler = createMessageHandler(config(async args => {
    calls.push(args);
    const inspecting = args.includes('--session-info');
    const resuming = args.includes('--resume-session');
    return {
      ok: inspecting || resuming, exitCode: inspecting || resuming ? 0 : 2,
      stdout: JSON.stringify({
        sessionId: current.sessionId, pendingInteraction: resuming ? null : current,
        finalText: resuming ? 'Done' : '',
      }),
    };
  }), { confirmations: new ConfirmationStore({ nonceFactory: () => 'ABC123' }) });
  const requested = message('run engineer Add endpoint');
  await handler(requested);
  assert.equal(calls.length, 0);
  assert.match(requested.replies[0], /Confirmation required/);
  const confirmed = message('confirm ABC123');
  await handler(confirmed);
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].includes('--interaction'));
  assert.match(confirmed.replies.join('\n'), /Awaiting your input/);
  const other = message('respond engineer-fixture approve', '14155550456');
  await handler(other);
  assert.match(other.replies[0], /No pending session is owned/);
  assert.equal(calls.length, 1);
  await handler(message('respond engineer-fixture approve'));
  current = plan('c'.repeat(32));
  const stale = message('confirm ABC123');
  await handler(stale);
  assert.match(stale.replies.join('\n'), /request changed/);
  assert.equal(calls.filter(args => args.includes('--resume-session')).length, 0);
  await handler(message('respond engineer-fixture approve'));
  const approved = message('confirm ABC123');
  await handler(approved);
  const resume = calls.find(args => args.includes('--resume-session'));
  assert.equal(resume[resume.indexOf('--input-id') + 1], current.inputId);
  assert.equal(resume[resume.indexOf('--plan-digest') + 1], current.digest);
  assert.equal(approved.replies[0], 'Done');
  await handler(approved);
  assert.equal(calls.filter(args => args.includes('--resume-session')).length, 1);
});

test('revoked execution capability invalidates a pending confirmation', async () => {
  let calls = 0;
  const settings = config(async () => { calls++; return { ok: true, text: 'not expected' }; });
  const handler = createMessageHandler(settings, { confirmations: new ConfirmationStore({ nonceFactory: () => 'ABC123' }) });
  await handler(message('run engineer Task'));
  settings.capabilities.run = false;
  const reply = message('confirm ABC123');
  await handler(reply);
  assert.equal(calls, 0);
  assert.match(reply.replies[0], /no longer enabled/);
});

test('opaque WhatsApp LIDs require a trusted phone mapping and group identities never authorize', async () => {
  let calls = 0;
  const settings = config(async () => { calls++; return { ok: true, text: 'ready' }; });
  const unmapped = createMessageHandler(settings);
  await unmapped(message('ready', '14155550123', { fromMe: false, from: '14155550123@lid' }));
  assert.equal(calls, 0);
  const mapped = createMessageHandler(settings, {
    resolvePhoneNumber: async address => address === '99999@lid' ? '14155550123@c.us' : '',
  });
  await mapped(message('ready', '14155550123', { fromMe: false, from: '99999@lid' }));
  assert.equal(calls, 1);
  await mapped(message('ready', '14155550123', { fromMe: false, from: '14155550123@g.us' }));
  assert.equal(calls, 1);
});

test('raw commands cannot bypass guided response or local evidence policy', async () => {
  const { classifyCommand } = require('../src/commandPolicy');
  const settings = { capabilities: { raw: true, run: true }, defaultAgent: 'engineer' };
  for (const command of [
    ['raw', 'loop', 'complete'], ['raw', 'run', '--input-decision', 'approve'],
    ['raw', 'engine', 'accept'], ['run', '--engine', 'task'], ['deps', '--json'],
    ['raw', 'sprint', 'Task', '--autonomous'], ['raw', 'watch', '--execute', '--autonomous', '--once'],
    ['raw', 'config', 'set', 'anything', 'value'], ['raw', 'future-execution-command'],
  ]) assert.equal(classifyCommand(command, settings).ok, false, command.join(' '));
  assert.deepEqual(classifyCommand(['raw', 'version'], settings).args, ['version']);
  assert.deepEqual(classifyCommand(['raw', 'loop', 'status'], settings).args, ['loop', 'status']);
  assert.equal(classifyCommand(['raw', 'version', '--execute'], settings).ok, false);
});

test('raw capability alone cannot authorize autonomous execution aliases', async () => {
  let calls = 0;
  const settings = { ...config(async () => { calls++; return { ok: true, text: 'unexpected' }; }),
    capabilities: { raw: true, run: false } };
  const handler = createMessageHandler(settings, { confirmations: new ConfirmationStore({ nonceFactory: () => 'ABC123' }) });
  for (const body of ['raw sprint "Task" --autonomous', 'raw watch --execute --autonomous --once']) {
    const request = message(body);
    await handler(request);
    await handler(message('confirm ABC123'));
    assert.equal(calls, 0);
    assert.match(request.replies.join('\n'), /read-only/);
  }
});

test('long plan delivery preserves Unicode across message boundaries', async () => {
  const chunks = [];
  const value = 'x'.repeat(3499) + '\uD83D\uDE80' + 'tail';
  await sendChunked({ reply: async text => chunks.push(text) }, value);
  assert.equal(chunks.join(''), value);
  assert.equal(chunks[0].length, 3499);
});
