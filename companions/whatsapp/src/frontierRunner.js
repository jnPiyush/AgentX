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

function terminateProcessTree(child, hooks = {}) {
  if (!child) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let escalation;
    let settled = false;
    let childClosed = false;
    let treeTerminated = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(escalation);
      child.removeListener('close', closed);
      if (error) reject(error); else resolve();
    };
    const finishStopped = () => { if (childClosed && treeTerminated) finish(); };
    const closed = () => { childClosed = true; finishStopped(); };
    const deadline = setTimeout(() => finish(new Error(`Child ${child.pid} did not close after termination.`)), hooks.killTimeoutMs || 7000);
    child.once('close', closed);
    const signal = (name) => {
      try {
        (hooks.kill || process.kill)(-child.pid, name);
      } catch (groupError) {
        if (groupError.code !== 'ESRCH') throw new Error(`Process group ${child.pid} rejected ${name}: ${groupError.message}`);
      }
    };
    try {
      if ((hooks.platform || process.platform) === 'win32') {
        if (!Number.isInteger(child.pid) || child.pid <= 0) throw new Error('Cannot taskkill a child without a valid PID.');
        const result = (hooks.spawnSync || spawnSync)('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true, timeout: 5000, maxBuffer: 16384, encoding: 'utf8',
        });
        if (result.error || result.status !== 0) {
          throw new Error(`taskkill failed for child ${child.pid}: ${result.error?.message || result.stderr || `exit ${result.status}`}`);
        }
        treeTerminated = true;
        finishStopped();
      } else {
        signal('SIGTERM');
        escalation = setTimeout(() => {
          try {
            signal('SIGKILL');
            treeTerminated = true;
            finishStopped();
          } catch (error) { finish(error); }
        }, hooks.killGraceMs || 2000);
      }
    } catch (error) {
      finish(error);
    }
  });
}

function runFrontierProcess(args, config, hooks = {}) {
  return new Promise((resolve) => {
    if (hooks.signal?.aborted) return resolve({ ok: false, text: 'Runner is shutting down.' });
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
    let failure = '';
    let terminationError = '';
    let settled = false;
    let childClosed = false;
    let treeTerminated = false;
    let timer;
    let teardownTimer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(teardownTimer);
      hooks.signal?.removeEventListener('abort', cancel);
      resolve(result);
    };
    const failureResult = () => ({ ok: false, text: `${failure}\n${terminationError}\n${output.trim()}`.trim() });
    const finishStopped = () => {
      if (childClosed && treeTerminated) {
        hooks.onChildDone?.(child);
        finish(failureResult());
      }
    };
    const terminate = (reason) => {
      if (failure || settled) return;
      failure = reason;
      clearTimeout(timer);
      teardownTimer = setTimeout(() => {
        hooks.onTerminationFailure?.(child);
        finish({ ...failureResult(), text: `${failureResult().text}\n[FAIL] Child termination was not confirmed; runner blocked.`, terminationConfirmed: false });
      }, hooks.terminationTimeoutMs || 8000);
      try {
        Promise.resolve((hooks.terminate || terminateProcessTree)(child)).then(() => {
          treeTerminated = true;
          finishStopped();
        }).catch(error => {
          terminationError = `[FAIL] Termination error: ${error.message}`;
        });
      } catch (error) {
        terminationError = `[FAIL] Termination error: ${error.message}`;
      }
    };
    const cancel = () => terminate('Runner is shutting down.');
    const capture = (chunk, prefix = '') => {
      if (failure || settled) return;
      const next = `${prefix}${chunk.toString()}`;
      const remaining = config.maxOutputChars - output.length;
      if (next.length > remaining) {
        output += next.slice(0, Math.max(0, remaining));
        terminate(`[FAIL] Output exceeded ${config.maxOutputChars} characters.`);
      } else {
        output += next;
      }
    };

    timer = setTimeout(() => {
      terminate(`Timed out after ${config.commandTimeoutMs / 1000}s.`);
    }, config.commandTimeoutMs);

    child.stdout.on('data', (chunk) => capture(chunk));
    child.stderr.on('data', (chunk) => capture(chunk, output ? '\n[stderr]\n' : '[stderr]\n'));
    child.on('close', (code) => {
      childClosed = true;
      if (failure) { finishStopped(); return; }
      hooks.onChildDone?.(child);
      const text = output.trim();
      const semanticFailure = FAILURE_PATTERN.test(`\n${text}`);
      finish({ ok: code === 0 && !semanticFailure, text: text || `(exit ${code})`, exitCode: code });
    });
    child.on('error', (error) => terminate(`Spawn error: ${error.message}`));
    hooks.signal?.addEventListener('abort', cancel, { once: true });
    if (hooks.signal?.aborted) cancel();
  });
}

function createFrontierRunner(config, hooks = {}) {
  let queue = Promise.resolve();
  let queued = 0;
  const children = new Set();
  const shutdown = new AbortController();
  let stopped = false;
  let blocked = false;

  const run = (args) => {
    if (blocked) return Promise.resolve({ ok: false, text: 'Runner blocked: child termination was not confirmed.' });
    if (stopped) return Promise.resolve({ ok: false, text: 'Runner is shutting down.' });
    if (queued >= config.maxQueueDepth) return Promise.resolve({ ok: false, text: 'Command queue is full. Try again later.' });
    queued += 1;
    const task = queue.then(() => {
      if (blocked) return { ok: false, text: 'Runner blocked: child termination was not confirmed.' };
      if (stopped) return { ok: false, text: 'Runner is shutting down.' };
      return runFrontierProcess(args, config, {
        ...hooks,
        signal: shutdown.signal,
        onChild: (child) => children.add(child),
        onChildDone: (child) => children.delete(child),
        onTerminationFailure: () => { blocked = true; },
      });
    });
    queue = task.catch(() => {}).finally(() => { queued -= 1; });
    return task;
  };

  const stop = async () => {
    stopped = true;
    shutdown.abort();
    await queue.catch(() => {});
    if (children.size) throw new Error('Child termination was not confirmed; runner remains blocked.');
  };

  return { run, stop, get queued() { return queued; } };
}

async function runFrontier(args, config) {
  const runner = createFrontierRunner(config);
  try { return await runner.run(args); } finally { await runner.stop(); }
}

module.exports = { childEnvironment, createFrontierRunner, runFrontier, runFrontierProcess, terminateProcessTree };
