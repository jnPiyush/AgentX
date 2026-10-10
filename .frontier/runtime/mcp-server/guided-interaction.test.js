const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { ElicitRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { createServer, createCliRunner } = require('./index');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const pending = {
  sessionId: 'engineer-fixture', agent: 'engineer', inputId: 'a'.repeat(32),
  kind: 'plan', phase: 'awaiting_plan', planVersion: 1, digest: 'b'.repeat(64),
  plan: { goal: 'A bounded fixture change', scope: ['fixture.txt'], steps: [{ id: 's1', title: 'Inspect fixture' }] },
};

async function withClient(capabilities, responses, callback, inputHandler) {
  const calls = [];
  const server = createServer({
    run: async (args) => {
      calls.push(args);
      const response = responses.shift();
      assert.ok(response, 'unexpected extra CLI call');
      return response;
    },
    stop: async () => {},
  });
  const client = new Client({ name: 'guided-fixture', version: '1.0.0' }, { capabilities });
  if (inputHandler) client.setRequestHandler(ElicitRequestSchema, inputHandler);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await callback(client, calls);
  } finally {
    await client.close();
    await server.close();
  }
}

const pendingResult = () => ({
  exitCode: 2, stdout: JSON.stringify({ sessionId: pending.sessionId, pendingInteraction: pending }), stderr: '',
});

test('MCP returns durable pending input without treating an unsupported host as approval', async () => {
  await withClient({}, [pendingResult()], async (client, calls) => {
    const result = await client.callTool({
      name: 'frontier_run', arguments: { agent: 'engineer', prompt: 'Fixture task' },
    });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.status, 'awaiting_user_input');
    assert.deepEqual(result.structuredContent.pendingInteraction, pending);
    assert.equal(calls.length, 1);
    assert.ok(result.content[0].text.includes('no form elicitation'));
  });
});

for (const action of ['decline', 'cancel']) {
  test(`MCP ${action} leaves approval pending`, async () => {
    await withClient({ elicitation: { form: {} } }, [pendingResult()], async (client, calls) => {
      const result = await client.callTool({
        name: 'frontier_run', arguments: { agent: 'engineer', prompt: 'Fixture task' },
      });
      assert.equal(result.structuredContent.status, 'awaiting_user_input');
      assert.equal(calls.length, 1);
    }, async () => ({ action }));
  });
}

test('MCP binds a real host approval to the exact displayed input/version/hash', async () => {
  await withClient({ elicitation: { form: {} } }, [
    pendingResult(), { exitCode: 0, stdout: 'execution finished', stderr: '' },
  ], async (client, calls) => {
    const result = await client.callTool({
      name: 'frontier_run', arguments: { agent: 'engineer', prompt: 'Fixture task' },
    });
    assert.equal(result.isError, false);
    assert.deepEqual(calls[1], [
      'run', '--resume-session', pending.sessionId, '--input-id', pending.inputId,
      '--input-decision', 'approve', '--plan-version', '1', '--plan-digest', pending.digest, '--json',
    ]);
  }, async (request) => {
    assert.ok(request.params.message.includes(pending.digest));
    assert.ok(request.params.message.includes('A bounded fixture change'));
    return { action: 'accept', content: { decision: 'approve' } };
  });
});

test('form acceptance without an explicit approval decision does not execute', async () => {
  await withClient({ elicitation: { form: {} } }, [pendingResult()], async (client, calls) => {
    const result = await client.callTool({
      name: 'frontier_run', arguments: { agent: 'engineer', prompt: 'Fixture task' },
    });
    assert.equal(result.structuredContent.status, 'awaiting_user_input');
    assert.equal(calls.length, 1);
  }, async () => ({ action: 'accept', content: { decision: 'revise', feedback: '' } }));
});

test('MCP resume rejects model-supplied authorization before calling the CLI', async () => {
  await withClient({}, [], async (client, calls) => {
    for (const arguments_ of [
      { sessionId: pending.sessionId, approved: true },
      { sessionId: pending.sessionId, answer: 'approve' },
      { sessionId: '..\\outside' },
    ]) {
      const result = await client.callTool({ name: 'frontier_resume', arguments: arguments_ });
      assert.equal(result.isError, true);
    }
    assert.equal(calls.length, 0);
  });
});

test('MCP resumes from inspected state, not model parameters', async () => {
  await withClient({ elicitation: { form: {} } }, [
    { ...pendingResult(), exitCode: 0 }, { exitCode: 4, stdout: 'cancelled', stderr: '' },
  ], async (client, calls) => {
    const result = await client.callTool({
      name: 'frontier_resume', arguments: { sessionId: pending.sessionId },
    });
    assert.deepEqual(calls[0], ['run', '--session-info', pending.sessionId, '--json']);
    assert.equal(calls[1][calls[1].indexOf('--input-decision') + 1], 'cancel');
    assert.equal(result.structuredContent.status, 'cancelled');
  }, async () => ({ action: 'accept', content: { decision: 'cancel_task' } }));
});

test('HydraFusion is not launched without a host authorization channel', async () => {
  await withClient({}, [], async (client, calls) => {
    const result = await client.callTool({
      name: 'frontier_run',
      arguments: { agent: 'engineer', prompt: 'Candidate', engine: 'hydrafusion' },
    });
    assert.equal(result.structuredContent.status, 'authorization_required');
    assert.equal(result.structuredContent.sessionCreated, false);
    assert.ok(!('pendingInteraction' in result.structuredContent));
    assert.equal(calls.length, 0);
  });
});

test('CLI transport preserves split UTF-8 and streams completed milestone lines', async () => {
  const child = Object.assign(new EventEmitter(), {
    pid: 1234, stdout: new EventEmitter(), stderr: new EventEmitter(),
  });
  const runner = createCliRunner(process.cwd(), { spawn: () => child });
  const progress = [];
  try {
    const result = runner.run(['run'], undefined, line => progress.push(line));
    child.stdout.emit('data', Buffer.from('[MILE'));
    child.stdout.emit('data', Buffer.from('STONE] caf'));
    child.stdout.emit('data', Buffer.from([0xc3]));
    child.stdout.emit('data', Buffer.from([0xa9, 0x0a]));
    child.emit('close', 0);
    const output = await result;
    assert.equal(output.stdout, '[MILESTONE] caf\u00e9\n');
    assert.deepEqual(progress, ['[MILESTONE] caf\u00e9']);
  } finally { await runner.stop(); }
});

test('real direct CLI session-info reaches MCP elicitation and preserves declined input',
  { timeout: 60000 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-guided-mcp-'));
    const runtime = path.join(root, '.frontier', 'runtime');
    fs.mkdirSync(runtime, { recursive: true });
    for (const name of ['frontier-cli.ps1', 'agentic-runner.ps1', 'guided-interaction.ps1', 'workspace-sandbox.ps1']) {
      fs.copyFileSync(path.join(__dirname, '..', name), path.join(runtime, name));
    }
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{"mode":"local"}');
    const setup = path.join(root, 'setup.ps1');
    fs.writeFileSync(setup, [
      "$ErrorActionPreference='Stop'",
      ". (Join-Path $PSScriptRoot '.frontier/runtime/agentic-runner.ps1')",
      "$state=New-RunnerInteraction 'real-cli-input' $PSScriptRoot 'engineer' 'Fixture task' 'guided'",
      "$state.model='gpt-4o'; $state.provider='github-models'; $state.rolePolicy='0'*64",
      "Set-InteractionPlan $state @{goal='Fixture task';scope=@('fixture.txt');nonGoals=@();assumptions=@();steps=@(@{title='Inspect';verification='Read fixture'})}",
      "$meta=@{sessionId='real-cli-input';agentName='engineer';modelId='gpt-4o';issueNumber=0;interaction=$state}",
      "Save-Session 'real-cli-input' @(@{role='user';content='Fixture task'}) $meta $PSScriptRoot",
    ].join('\n'));
    const runner = createCliRunner(root);
    const server = createServer(runner);
    const client = new Client({ name: 'real-guided-cli', version: '1.0.0' },
      { capabilities: { elicitation: { form: {} } } });
    let requests = 0;
    client.setRequestHandler(ElicitRequestSchema, async request => {
      requests++;
      assert.ok(request.params.message.includes('Fixture task'));
      return { action: 'decline' };
    });
    const [transport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', setup],
        { encoding: 'utf8', timeout: 30000 });
      await server.connect(serverTransport);
      await client.connect(transport);
      const result = await client.callTool({
        name: 'frontier_resume', arguments: { sessionId: 'real-cli-input' },
      });
      assert.equal(result.isError, false);
      assert.equal(requests, 1);
      assert.equal(result.structuredContent.status, 'awaiting_user_input');
      const state = JSON.parse(fs.readFileSync(path.join(root, '.frontier', 'sessions',
        'real-cli-input.json'), 'utf8'));
      assert.equal(state.meta.interaction.phase, 'awaiting_plan');
      assert.equal(state.meta.interaction.approval, null);
    } finally {
      await client.close();
      await server.close();
      await runner.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
