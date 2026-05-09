// Watches .agentx/state/loop-state.json and pushes WhatsApp notifications
// when meaningful state transitions occur (start, complete, status change,
// stall, iteration milestones).

const fs = require('fs');
const path = require('path');

function readJsonSafe(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function summarize(state) {
    if (!state) return '(no state)';
    const parts = [
        `status=${state.status}`,
        `active=${state.active}`,
        `iter=${state.iteration}/${state.maxIterations}`,
        state.role ? `role=${state.role}` : null,
        state.issueNumber ? `issue=#${state.issueNumber}` : null
    ].filter(Boolean);
    return parts.join(' | ');
}

function diffEvents(prev, curr) {
    const events = [];
    if (!prev && curr) {
        events.push({ kind: 'init', text: `[AgentX] Loop state initialized\n${summarize(curr)}` });
        return events;
    }
    if (!curr) return events;

    if (prev.status !== curr.status) {
        events.push({ kind: 'status', text: `[AgentX] Loop status: ${prev.status} -> ${curr.status}\n${summarize(curr)}\nPrompt: ${curr.prompt || '(none)'}` });
    }
    if (prev.active !== curr.active && curr.active === true) {
        events.push({ kind: 'started', text: `[AgentX] Loop STARTED\n${summarize(curr)}\nPrompt: ${curr.prompt || '(none)'}` });
    }
    if (prev.iteration !== curr.iteration && curr.iteration > prev.iteration) {
        const last = (curr.history && curr.history.length) ? curr.history[curr.history.length - 1] : null;
        const summary = last && last.summary ? last.summary.slice(0, 400) : '';
        events.push({ kind: 'iteration', text: `[AgentX] Iteration ${curr.iteration}\n${summary}` });
    }
    if (curr.status === 'complete' && prev.status !== 'complete') {
        events.push({ kind: 'complete', text: `[AgentX] LOOP COMPLETE\n${summarize(curr)}` });
    }
    return events;
}

function startLoopWatcher({ config, client }) {
    if (!config.notifications || !config.notifications.enabled) {
        console.log('[AgentX WhatsApp] Push notifications disabled.');
        return null;
    }
    const targets = (config.notifications.targets || config.allowedNumbers || []);
    if (targets.length === 0) {
        console.warn('[AgentX WhatsApp] Notifications enabled but no targets.');
        return null;
    }
    const file = path.resolve(config.repoPath, '.agentx', 'state', 'loop-state.json');
    if (!fs.existsSync(file)) {
        console.warn(`[AgentX WhatsApp] Loop state not found at ${file}; watcher idle until file appears.`);
    }

    const include = new Set(config.notifications.events || ['started', 'iteration', 'complete', 'status']);
    let last = readJsonSafe(file);

    let debounce = null;
    const handler = () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            const curr = readJsonSafe(file);
            const events = diffEvents(last, curr);
            last = curr;
            for (const ev of events) {
                if (!include.has(ev.kind)) continue;
                for (const num of targets) {
                    const jid = `${num.replace(/\D/g, '')}@c.us`;
                    try {
                        await client.sendMessage(jid, ev.text);
                        console.log(`[AgentX WhatsApp] Pushed ${ev.kind} -> ${num}`);
                    } catch (err) {
                        console.warn(`[AgentX WhatsApp] Push failed to ${num}: ${err.message}`);
                    }
                }
            }
        }, 750);
    };

    let watcher = null;
    try {
        watcher = fs.watch(path.dirname(file), { persistent: false }, (evt, fname) => {
            if (fname === 'loop-state.json') handler();
        });
        console.log(`[AgentX WhatsApp] Watching loop state for ${targets.length} target(s).`);
    } catch (err) {
        console.warn('[AgentX WhatsApp] fs.watch failed, falling back to polling:', err.message);
        const interval = setInterval(handler, 5000);
        return { stop: () => clearInterval(interval) };
    }
    return { stop: () => watcher && watcher.close() };
}

module.exports = { startLoopWatcher };
