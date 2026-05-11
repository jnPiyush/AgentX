const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('routeCommand routes common WhatsApp commands to the AgentX CLI', async () => {
  const runnerPath = path.resolve(__dirname, '..', 'src', 'agentxRunner.js');
  const routerPath = path.resolve(__dirname, '..', 'src', 'commandRouter.js');

  const runner = freshRequire(runnerPath);
  const calls = [];
  runner.runAgentX = async (args, config) => {
    calls.push({ args, config });
    return { ok: true, text: 'ok' };
  };

  const { routeCommand } = freshRequire(routerPath);
  const config = { defaultAgent: 'engineer' };

  await routeCommand('ready', config);
  await routeCommand('loop start "Fix login bug"', config);
  await routeCommand('run engineer "Add /health endpoint"', config);
  await routeCommand('ask "what should I work on next?"', config);

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['ready'],
    ['loop', 'start', '-p', 'Fix login bug'],
    ['run', 'engineer', 'Add /health endpoint'],
    ['run', 'engineer', 'what should I work on next?'],
  ]);
});

test('routeCommand returns usage guidance for unsupported or incomplete commands', async () => {
  const runnerPath = path.resolve(__dirname, '..', 'src', 'agentxRunner.js');
  const routerPath = path.resolve(__dirname, '..', 'src', 'commandRouter.js');

  const runner = freshRequire(runnerPath);
  runner.runAgentX = async () => {
    throw new Error('runAgentX should not be called for invalid commands');
  };

  const { routeCommand, helpText } = freshRequire(routerPath);

  const deps = await routeCommand('deps', {});
  assert.equal(deps.ok, false);
  assert.match(deps.text, /Usage: deps <issue>/);

  const unknown = await routeCommand('bogus', {});
  assert.equal(unknown.ok, false);
  assert.match(unknown.text, /Unknown command: bogus/);
  assert.match(unknown.text, new RegExp(helpText().split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('loadConfig prefers environment overrides for allowlist and repo path', () => {
  const configPath = path.resolve(__dirname, '..', 'config.json');
  const hadConfig = fs.existsSync(configPath);
  const originalConfig = hadConfig ? fs.readFileSync(configPath, 'utf8') : undefined;
  const originalAllowed = process.env.AGENTX_WA_ALLOWED;
  const originalRepo = process.env.AGENTX_REPO;

  try {
    if (hadConfig) {
      fs.rmSync(configPath, { force: true });
    }
    process.env.AGENTX_WA_ALLOWED = '14155550100, 14155550101';
    process.env.AGENTX_REPO = 'C:/temp/agentx-test-root';

    const { loadConfig } = freshRequire(path.resolve(__dirname, '..', 'src', 'config.js'));
    const config = loadConfig();

    assert.deepEqual(config.allowedNumbers, ['14155550100', '14155550101']);
    assert.equal(config.repoPath, 'C:/temp/agentx-test-root');
  } finally {
    if (originalAllowed === undefined) {
      delete process.env.AGENTX_WA_ALLOWED;
    } else {
      process.env.AGENTX_WA_ALLOWED = originalAllowed;
    }
    if (originalRepo === undefined) {
      delete process.env.AGENTX_REPO;
    } else {
      process.env.AGENTX_REPO = originalRepo;
    }

    if (hadConfig && originalConfig !== undefined) {
      fs.writeFileSync(configPath, originalConfig, 'utf8');
    } else {
      fs.rmSync(configPath, { force: true });
    }
  }
});

test('runAgentX fails cleanly when the local CLI path is missing', async () => {
  const { runAgentX } = freshRequire(path.resolve(__dirname, '..', 'src', 'agentxRunner.js'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-runner-'));

  try {
    const result = await runAgentX(['ready'], {
      repoPath: tempRoot,
      cliRelativePath: '.agentx/agentx.ps1',
      commandTimeoutMs: 1000,
      maxOutputChars: 1000,
    });

    assert.equal(result.ok, false);
    assert.match(result.text, /CLI not found/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('transcribeVoiceNote rejects voice-note execution when no OpenAI key is configured', async () => {
  const { transcribeVoiceNote } = freshRequire(path.resolve(__dirname, '..', 'src', 'transcribe.js'));

  const result = await transcribeVoiceNote(
    { data: Buffer.from('voice').toString('base64'), mimetype: 'audio/ogg' },
    { openaiApiKey: '' },
  );

  assert.equal(result.ok, false);
  assert.match(result.text, /Voice notes disabled/);
});

test('startLoopWatcher pushes WhatsApp notifications for loop state transitions', async () => {
  const { startLoopWatcher } = freshRequire(path.resolve(__dirname, '..', 'src', 'loopWatcher.js'));
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-wa-loop-'));
  const stateDir = path.join(repoRoot, '.agentx', 'state');
  const statePath = path.join(stateDir, 'loop-state.json');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    status: 'idle',
    active: false,
    iteration: 0,
    maxIterations: 20,
    history: [],
    prompt: 'initial',
  }), 'utf8');

  const messages = [];
  const client = {
    sendMessage: async (jid, text) => {
      messages.push({ jid, text });
    },
  };

  const watcher = startLoopWatcher({
    config: {
      repoPath: repoRoot,
      allowedNumbers: ['14155550123'],
      notifications: {
        enabled: true,
        targets: ['14155550123'],
        events: ['started', 'iteration', 'complete', 'status'],
      },
    },
    client,
  });

  try {
    fs.writeFileSync(statePath, JSON.stringify({
      status: 'running',
      active: true,
      iteration: 1,
      maxIterations: 20,
      history: [{ summary: 'Initial review pass' }],
      prompt: 'Test prompt',
    }), 'utf8');
    await wait(1200);

    fs.writeFileSync(statePath, JSON.stringify({
      status: 'complete',
      active: true,
      iteration: 1,
      maxIterations: 20,
      history: [{ summary: 'Initial review pass' }],
      prompt: 'Test prompt',
    }), 'utf8');
    await wait(1200);
  } finally {
    if (watcher && typeof watcher.stop === 'function') {
      watcher.stop();
    }
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }

  assert.ok(messages.some((entry) => entry.jid === '14155550123@c.us'));
  assert.ok(messages.some((entry) => entry.text.includes('Loop STARTED')));
  assert.ok(messages.some((entry) => entry.text.includes('Iteration 1')));
  assert.ok(messages.some((entry) => entry.text.includes('LOOP COMPLETE')));
});