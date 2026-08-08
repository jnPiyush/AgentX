const fs = require('fs');
const path = require('path');

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function summarize(state) {
  if (!state) return '(no state)';
  return [
    `status=${state.status}`,
    `active=${state.active}`,
    `iter=${state.iteration}/${state.maxIterations}`,
    state.role ? `role=${state.role}` : null,
    state.issueNumber ? `issue=#${state.issueNumber}` : null,
  ].filter(Boolean).join(' | ');
}

function diffEvents(previous, current) {
  const events = [];
  if (!previous && current) return [{ kind: 'init', text: `[AgentX] Loop state initialized\n${summarize(current)}` }];
  if (!current) return events;
  if (previous.status !== current.status) {
    events.push({ kind: 'status', text: `[AgentX] Loop status: ${previous.status} -> ${current.status}\n${summarize(current)}\nPrompt: ${current.prompt || '(none)'}` });
  }
  if (previous.active !== current.active && current.active === true) {
    events.push({ kind: 'started', text: `[AgentX] Loop STARTED\n${summarize(current)}\nPrompt: ${current.prompt || '(none)'}` });
  }
  if (previous.iteration !== current.iteration && current.iteration > previous.iteration) {
    const last = current.history && current.history.length ? current.history[current.history.length - 1] : null;
    events.push({ kind: 'iteration', text: `[AgentX] Iteration ${current.iteration}\n${last && last.summary ? last.summary.slice(0, 400) : ''}` });
  }
  if (current.status === 'complete' && previous.status !== 'complete') {
    events.push({ kind: 'complete', text: `[AgentX] LOOP COMPLETE\n${summarize(current)}` });
  }
  return events;
}

function startLoopWatcher({ config, client, fsImpl = fs }) {
  if (!config.notifications || !config.notifications.enabled) return null;
  const targets = config.notifications.targets || [];
  if (!targets.length) return null;

  const file = path.resolve(config.repoPath, '.agentx', 'state', 'loop-state.json');
  const include = new Set(config.notifications.events);
  let last = readJsonSafe(file);
  let stopped = false;
  let watcher = null;
  let poll = null;
  let debounce = null;
  let retry = null;
  let lastEventKeys = new Set();
  let emissionQueue = Promise.resolve();

  const sendEvents = async (current) => {
    const events = diffEvents(last, current);
    last = current;
    const nextKeys = new Set();
    for (const event of events) {
      const key = `${event.kind}:${current.lastIterationAt || current.updatedAt || current.iteration || ''}:${event.text}`;
      nextKeys.add(key);
      if (!include.has(event.kind) || lastEventKeys.has(key)) continue;
      for (const number of targets) {
        try { await client.sendMessage(`${number}@c.us`, event.text); } catch (error) {
          console.warn(`[AgentX WhatsApp] Push failed: ${error.message}`);
        }
      }
    }
    lastEventKeys = nextKeys;
  };

  const readAndEmit = () => {
    if (stopped) return;
    const current = readJsonSafe(file);
    if (!current) {
      clearTimeout(retry);
      retry = setTimeout(readAndEmit, 200);
      return;
    }
    emissionQueue = emissionQueue.then(() => sendEvents(current)).catch((error) => {
      console.warn(`[AgentX WhatsApp] Loop event processing failed: ${error.message}`);
    });
  };

  const schedule = () => {
    clearTimeout(debounce);
    debounce = setTimeout(readAndEmit, config.notifications.debounceMs);
  };

  const startPolling = () => {
    if (!poll) poll = setInterval(readAndEmit, config.notifications.pollMs);
  };

  try {
    watcher = fsImpl.watch(path.dirname(file), { persistent: false }, (_event, filename) => {
      if (!filename || filename === 'loop-state.json') schedule();
    });
    watcher.on && watcher.on('error', (error) => {
      console.warn(`[AgentX WhatsApp] Loop watcher error; switching to polling: ${error.message}`);
      watcher.close();
      watcher = null;
      startPolling();
    });
  } catch (error) {
    console.warn(`[AgentX WhatsApp] fs.watch unavailable; polling: ${error.message}`);
    startPolling();
  }

  return {
    stop() {
      stopped = true;
      clearTimeout(debounce);
      clearTimeout(retry);
      if (watcher) watcher.close();
      if (poll) clearInterval(poll);
      return emissionQueue;
    },
  };
}

module.exports = { diffEvents, readJsonSafe, startLoopWatcher, summarize };
