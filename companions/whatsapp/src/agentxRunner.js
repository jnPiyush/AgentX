const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FAILURE_PATTERN = /(^|\n)\s*\[FAIL\]|(^|\n)\s*ERROR:/i;
const CHILD_ENV_KEYS = [
  'ALLUSERSPROFILE', 'APPDATA', 'COMSPEC', 'HOME', 'HOMEDRIVE', 'HOMEPATH',
  'LANG', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS', 'OS', 'PATH', 'PATHEXT',
  'PROCESSOR_ARCHITECTURE', 'PROGRAMDATA', 'PROGRAMFILES', 'PSMODULEPATH',
  'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'WINDIR',
];

function resolvePwsh() {
  return process.env.AGENTX_PWSH || 'pwsh';
}

function childEnvironment() {
  const env = {};
  for (const key of CHILD_ENV_KEYS) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.AGENTX_NONINTERACTIVE = '1';
  return env;
}

function terminateProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
    return;
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch (_) {
    try { child.kill('SIGTERM'); } catch (error) {
      console.warn(`[AgentX WhatsApp] Could not terminate child ${child.pid}: ${error.message}`);
    }
  }
  const killer = setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (_) {
      try { child.kill('SIGKILL'); } catch (error) {
        console.warn(`[AgentX WhatsApp] Could not force-kill child ${child.pid}: ${error.message}`);
      }
    }
  }, 2000);
  killer.unref();
}

function runAgentXProcess(args, config, hooks = {}) {
  return new Promise((resolve) => {
    const cli = path.resolve(config.repoPath, config.cliRelativePath);
    if (!cli.startsWith(`${path.resolve(config.repoPath)}${path.sep}`) || !fs.existsSync(cli)) {
      return resolve({ ok: false, text: `CLI not found inside repoPath: ${cli}` });
    }

    const child = (hooks.spawn || spawn)(resolvePwsh(), ['-NoProfile', '-NonInteractive', '-File', cli, ...args], {
      cwd: config.repoPath,
      env: childEnvironment(),
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    hooks.onChild && hooks.onChild(child);

    let output = '';
    let timedOut = false;
    let outputExceeded = false;
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      hooks.onChildDone && hooks.onChildDone(child);
      resolve(result);
    };
    const capture = (chunk, prefix = '') => {
      if (outputExceeded) return;
      const next = `${prefix}${chunk.toString()}`;
      const remaining = config.maxOutputChars - output.length;
      if (next.length > remaining) {
        output += next.slice(0, Math.max(0, remaining));
        outputExceeded = true;
        (hooks.terminate || terminateProcessTree)(child);
        finish({ ok: false, text: `${output.trim()}\n[FAIL] Output exceeded ${config.maxOutputChars} characters.`.trim() });
      } else {
        output += next;
      }
    };

    timer = setTimeout(() => {
      timedOut = true;
      (hooks.terminate || terminateProcessTree)(child);
      finish({ ok: false, text: `Timed out after ${config.commandTimeoutMs / 1000}s.\n${output.trim()}`.trim() });
    }, config.commandTimeoutMs);

    child.stdout.on('data', (chunk) => capture(chunk));
    child.stderr.on('data', (chunk) => capture(chunk, output ? '\n[stderr]\n' : '[stderr]\n'));
    child.on('close', (code) => {
      const text = output.trim();
      if (timedOut) return finish({ ok: false, text: `Timed out after ${config.commandTimeoutMs / 1000}s.\n${text}`.trim() });
      if (outputExceeded) return finish({ ok: false, text: `${text}\n[FAIL] Output exceeded ${config.maxOutputChars} characters.`.trim() });
      const semanticFailure = FAILURE_PATTERN.test(`\n${text}`);
      finish({ ok: code === 0 && !semanticFailure, text: text || `(exit ${code})`, exitCode: code });
    });
    child.on('error', (error) => finish({ ok: false, text: `Spawn error: ${error.message}` }));
  });
}

function createAgentXRunner(config, hooks = {}) {
  let queue = Promise.resolve();
  let queued = 0;
  const children = new Set();
  let stopped = false;

  const run = (args) => {
    if (stopped) return Promise.resolve({ ok: false, text: 'Runner is shutting down.' });
    if (queued >= config.maxQueueDepth) return Promise.resolve({ ok: false, text: 'Command queue is full. Try again later.' });
    queued += 1;
    const task = queue.then(() => {
      if (stopped) return { ok: false, text: 'Runner is shutting down.' };
      return runAgentXProcess(args, config, {
        ...hooks,
        onChild: (child) => children.add(child),
        onChildDone: (child) => children.delete(child),
      });
    });
    queue = task.catch(() => {}).finally(() => { queued -= 1; });
    return task;
  };

  const stop = async () => {
    stopped = true;
    for (const child of children) (hooks.terminate || terminateProcessTree)(child);
    await queue.catch(() => {});
  };

  return { run, stop, get queued() { return queued; } };
}

async function runAgentX(args, config) {
  const runner = createAgentXRunner(config);
  try { return await runner.run(args); } finally { await runner.stop(); }
}

module.exports = { childEnvironment, createAgentXRunner, runAgentX, runAgentXProcess, terminateProcessTree };
