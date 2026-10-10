const crypto = require('crypto');
const { SESSION, AGENT, startArguments } = require('./guidedInteraction');

const READ_ONLY_COMMANDS = new Set(['ready', 'state', 'status', 'deps', 'workflow']);
const CAPABILITY_BY_COMMAND = Object.freeze({
  ship: 'ship',
  run: 'run',
  ask: 'run',
  loop: 'loopMutation',
  raw: 'raw',
  respond: 'run',
});

function createNonce() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function describeArgs(args) {
  return args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ');
}

function isReadOnlyPlan(plan) {
  return plan && plan.ok && plan.risk === 'read';
}

class ConfirmationStore {
  constructor({ ttlMs = 120000, maxPending = 20, now = () => Date.now(), nonceFactory = createNonce } = {}) {
    this.ttlMs = ttlMs;
    this.maxPending = maxPending;
    this.now = now;
    this.nonceFactory = nonceFactory;
    this.pending = new Map();
  }

  request(sender, plan) {
    this.prune();
    if (this.pending.size >= this.maxPending) {
      return { ok: false, text: 'Too many pending confirmations. Try again later.' };
    }

    let nonce = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.nonceFactory();
      if (!this.pending.has(`${sender}:${candidate}`)) { nonce = candidate; break; }
    }
    if (!nonce) return { ok: false, text: 'Could not allocate a confirmation nonce. Try again.' };
    this.pending.set(`${sender}:${nonce}`, {
      sender,
      nonce,
      plan,
      expiresAt: this.now() + this.ttlMs,
    });
    return {
      ok: true,
      nonce,
      text: [
        'Confirmation required for this capability-gated command.',
        `Command: ${describeArgs(plan.args)}`,
        `Reply: confirm ${nonce}`,
        `Expires in ${Math.ceil(this.ttlMs / 1000)} seconds.`,
      ].join('\n'),
    };
  }

  consume(sender, nonce) {
    this.prune();
    const key = `${sender}:${String(nonce || '').toUpperCase()}`;
    const entry = this.pending.get(key);
    if (!entry) return null;
    this.pending.delete(key);
    return entry.plan;
  }

  prune() {
    const now = this.now();
    for (const [key, entry] of this.pending.entries()) {
      if (entry.expiresAt <= now) this.pending.delete(key);
    }
  }

  clear() {
    this.pending.clear();
  }
}

function classifyCommand(tokens, config) {
  if (!tokens.length) return { ok: false, text: 'Empty command. Send "help".' };

  const cmd = tokens[0].toLowerCase();
  const rest = tokens.slice(1);
  if (READ_ONLY_COMMANDS.has(cmd)) {
    const takesArgument = cmd === 'deps' || cmd === 'workflow';
    if (takesArgument && rest.length !== 1) {
      return { ok: false, text: `Usage: ${cmd} <${cmd === 'deps' ? 'issue' : 'agent'}>` };
    }
    if (!takesArgument && rest.length) return { ok: false, text: `Usage: ${cmd}` };
    if (cmd === 'deps' && !/^[1-9][0-9]{0,9}$/.test(rest[0])) return { ok: false, text: 'Usage: deps <issue>' };
    if (cmd === 'workflow' && !AGENT.test(rest[0])) return { ok: false, text: 'Usage: workflow <agent>' };
    const args = cmd === 'status' ? ['loop', 'status'] : [cmd, ...rest];
    return { ok: true, args, risk: 'read', capability: null };
  }

  if (cmd === 'loop' && ((rest[0] || '').toLowerCase() === 'status' || !rest[0])) {
    if (rest.length > 1) return { ok: false, text: 'Usage: loop status' };
    return { ok: true, args: ['loop', 'status'], risk: 'read', capability: null };
  }

  if (cmd === 'loop' && ['iterate', 'complete'].includes((rest[0] || '').toLowerCase())) {
    return {
      ok: false,
      text: 'Remote loop iterate/complete is disabled because Frontier requires fresh local evidence. Run it on the desktop.',
    };
  }

  let args;
  if (cmd === 'ship') {
    if (rest.length !== 1 || !/^[1-9][0-9]{0,9}$/.test(rest[0])) return { ok: false, text: 'Usage: ship <issue>' };
    args = ['ship', '-Issue', rest[0]];
  } else if (cmd === 'run') {
    const agent = rest[0];
    const task = rest.slice(1).join(' ');
    if (!agent || !task) return { ok: false, text: 'Usage: run <agent> "<task>"' };
    try { args = startArguments(agent, task); } catch (error) { return { ok: false, text: error.message }; }
  } else if (cmd === 'ask') {
    const task = rest.join(' ');
    if (!task) return { ok: false, text: 'Usage: ask "<question>"' };
    try { args = startArguments(config.defaultAgent, task); } catch (error) { return { ok: false, text: error.message }; }
  } else if (cmd === 'respond') {
    if (!SESSION.test(rest[0] || '') || !['answer', 'approve', 'revise', 'cancel'].includes(rest[1])) {
      return { ok: false, text: 'Usage: respond <session> <answer|approve|revise|cancel> [text]' };
    }
    const text = rest.slice(2).join(' ');
    if ((['answer', 'revise'].includes(rest[1]) && !text.trim()) || (['approve', 'cancel'].includes(rest[1]) && text)) {
      return { ok: false, text: 'Answers and revisions require text; approval and cancellation must not include edits.' };
    }
    args = ['respond', ...rest];
  } else if (cmd === 'loop' && (rest[0] || '').toLowerCase() === 'start') {
    const task = rest.slice(1).join(' ') || 'WhatsApp-initiated task';
    if (task.startsWith('-')) return { ok: false, text: 'Loop task text cannot be a CLI flag.' };
    args = ['loop', 'start', '-p', task];
  } else if (cmd === 'raw') {
    if (!rest.length) return { ok: false, text: 'Usage: raw <Frontier args>' };
    const name = rest[0].toLowerCase();
    if (['version', 'help'].includes(name) && rest.length === 1) {
      args = [name];
    } else if (READ_ONLY_COMMANDS.has(name) || (name === 'loop' && rest[1]?.toLowerCase() === 'status')) {
      const read = classifyCommand(rest, config);
      if (!read.ok || read.risk !== 'read') return { ok: false, text: 'Raw supports only validated read-only commands.' };
      args = read.args;
    } else {
      return { ok: false, text: 'Raw supports only read-only ready/state/status/deps/workflow, loop status, version and help. Use owned run/respond commands for execution.' };
    }
  } else {
    return { ok: false, text: `Unknown command: ${cmd}` };
  }

  const capability = CAPABILITY_BY_COMMAND[cmd];
  const capabilities = config.capabilities || {};
  if (!capability || !capabilities[capability]) {
    return {
      ok: false,
      text: `Command '${cmd}' is disabled. Enable capability '${capability || cmd}' in config.example.json-derived configuration.`,
    };
  }

  return {
    ok: true, args, risk: 'mutate', capability,
    ...(cmd === 'run' || cmd === 'ask' ? { guided: true } : {}),
    ...(cmd === 'respond' ? { response: { sessionId: rest[0], decision: rest[1], text: rest.slice(2).join(' ') } } : {}),
  };
}

module.exports = {
  ConfirmationStore,
  classifyCommand,
  describeArgs,
  isReadOnlyPlan,
};
