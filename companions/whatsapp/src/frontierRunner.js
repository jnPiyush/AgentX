const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');

const FAILURE_PATTERN = /(^|\n)\s*\[FAIL\]|(^|\n)\s*ERROR:/i;
const CHILD_ENV_KEYS = [
  'ALLUSERSPROFILE', 'APPDATA', 'COMSPEC', 'HOME', 'HOMEDRIVE', 'HOMEPATH',
  'LANG', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS', 'OS', 'PATH', 'PATHEXT',
  'PROCESSOR_ARCHITECTURE', 'PROGRAMDATA', 'PROGRAMFILES', 'PSMODULEPATH',
  'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'WINDIR',
];
const LLM_ENV_KEYS = new Set([
  'GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT', 'COPILOT_GITHUB_TOKEN',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'FRONTIER_LLM_PROVIDER',
  'FRONTIER_OPENAI_API_KEY', 'FRONTIER_OPENAI_BASE_URL', 'FRONTIER_OPENAI_MODEL',
  'FRONTIER_ANTHROPIC_API_KEY', 'FRONTIER_ANTHROPIC_BASE_URL', 'FRONTIER_ANTHROPIC_MODEL',
]);

function validateRuntimeEnv(names = []) {
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !LLM_ENV_KEYS.has(name))) {
    throw new Error('runtimeEnv may contain only supported LLM credential/provider variable names.');
  }
  return [...new Set(names)];
}

function containsCliPath(root, target) {
  const key = value => process.platform === 'win32'
    ? path.resolve(value).replace(/[A-Z]/g, letter => letter.toLowerCase()) : path.resolve(value);
  const parent = key(root);
  const child = key(target);
  return child !== parent && child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);
}

function resolvePwsh() {
  return process.env.FRONTIER_PWSH || 'pwsh';
}

function childEnvironment(names = [], source = process.env) {
  const env = {};
  for (const key of [...CHILD_ENV_KEYS, ...validateRuntimeEnv(names)]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  env.FRONTIER_NONINTERACTIVE = '1';
  env.FRONTIER_NONINTERACTIVE_HUMAN = '1';
  env.NO_COLOR = '1';
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
    let cli;
    let root;
    try {
      root = fs.realpathSync(config.repoPath);
      cli = fs.realpathSync(path.resolve(root, config.cliRelativePath));
      if (!containsCliPath(root, cli) || !fs.statSync(cli).isFile()) {
        throw new Error('CLI must resolve to a file inside repoPath.');
      }
    } catch (error) {
      return resolve({ ok: false, text: `CLI not found inside repoPath: ${error.message}`, exitCode: -1, stdout: '', stderr: '' });
    }
    const structured = args[0] === 'run' && args.includes('--json');
    const outputLimit = structured ? (config.maxRuntimeOutputChars ?? config.maxOutputChars) : config.maxOutputChars;
    let child;
    try {
      child = (hooks.spawn || spawn)(resolvePwsh(), ['-NoProfile', '-NonInteractive', '-File', cli, ...args], {
        cwd: root, env: { ...childEnvironment(config.runtimeEnv), FRONTIER_WORKSPACE_ROOT: root },
        windowsHide: true, detached: process.platform !== 'win32',
      });
    } catch (error) {
      return resolve({ ok: false, text: `Spawn error: ${error.message}`, exitCode: -1, stdout: '', stderr: '' });
    }
    hooks.onChild && hooks.onChild(child);

    let output = '';
    const streams = { stdout: '', stderr: '' };
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
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
    const failureResult = () => ({ ok: false, ...streams, text: `${failure}\n${terminationError}\n${output.trim()}`.trim() });
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
    const capture = (chunk, stream, decoded = false) => {
      if (failure || settled) return;
      const text = decoded || typeof chunk === 'string' ? chunk : decoders[stream].write(chunk);
      const prefix = stream === 'stderr' ? (output ? '\n[stderr]\n' : '[stderr]\n') : '';
      const next = `${prefix}${text}`;
      const remaining = outputLimit - output.length;
      if (next.length > remaining) {
        output += next.slice(0, Math.max(0, remaining));
        streams[stream] += text.slice(0, Math.max(0, remaining - prefix.length));
        terminate(`[FAIL] Output exceeded ${outputLimit} characters.`);
      } else {
        output += next;
        streams[stream] += text;
      }
    };

    timer = setTimeout(() => {
      terminate(`Timed out after ${config.commandTimeoutMs / 1000}s.`);
    }, config.commandTimeoutMs);

    child.stdout.on('data', (chunk) => capture(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => capture(chunk, 'stderr'));
    child.on('close', (code) => {
      childClosed = true;
      for (const stream of ['stdout', 'stderr']) {
        const tail = decoders[stream].end();
        if (tail) capture(tail, stream, true);
      }
      if (failure) { finishStopped(); return; }
      hooks.onChildDone?.(child);
      const text = output.trim();
      const semanticFailure = FAILURE_PATTERN.test(`\n${text}`);
      finish({ ok: code === 0 && !semanticFailure, ...streams, text: text || `(exit ${code})`, exitCode: code });
    });
    child.on('error', (error) => {
      if (!Number.isInteger(child.pid) || child.pid <= 0) {
        hooks.onChildDone?.(child);
        finish({ ok: false, ...streams, exitCode: -1, text: `Spawn error: ${error.message}` });
      } else { terminate(`Spawn error: ${error.message}`); }
    });
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

module.exports = { childEnvironment, validateRuntimeEnv, containsCliPath, createFrontierRunner, runFrontier, runFrontierProcess, terminateProcessTree };
