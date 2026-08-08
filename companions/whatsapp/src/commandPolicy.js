const crypto = require('crypto');

const READ_ONLY_COMMANDS = new Set(['ready', 'state', 'status', 'deps', 'workflow']);
const CAPABILITY_BY_COMMAND = Object.freeze({
  ship: 'ship',
  run: 'run',
  ask: 'run',
  loop: 'loopMutation',
  raw: 'raw',
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
        'Confirmation required for a mutating command.',
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
    const args = cmd === 'status' ? ['loop', 'status'] : [cmd, ...rest];
    return { ok: true, args, risk: 'read', capability: null };
  }

  if (cmd === 'loop' && ((rest[0] || '').toLowerCase() === 'status' || !rest[0])) {
    return { ok: true, args: ['loop', 'status'], risk: 'read', capability: null };
  }

  if (cmd === 'loop' && ['iterate', 'complete'].includes((rest[0] || '').toLowerCase())) {
    return {
      ok: false,
      text: 'Remote loop iterate/complete is disabled because AgentX requires fresh local evidence. Run it on the desktop.',
    };
  }

  let args;
  if (cmd === 'ship') {
    if (!rest[0]) return { ok: false, text: 'Usage: ship <issue>' };
    args = ['ship', '-Issue', rest[0]];
  } else if (cmd === 'run') {
    const agent = rest[0];
    const task = rest.slice(1).join(' ');
    if (!agent || !task) return { ok: false, text: 'Usage: run <agent> "<task>"' };
    args = ['run', agent, task];
  } else if (cmd === 'ask') {
    const task = rest.join(' ');
    if (!task) return { ok: false, text: 'Usage: ask "<question>"' };
    args = ['run', config.defaultAgent, task];
  } else if (cmd === 'loop' && (rest[0] || '').toLowerCase() === 'start') {
    args = ['loop', 'start', '-p', rest.slice(1).join(' ') || 'WhatsApp-initiated task'];
  } else if (cmd === 'raw') {
    if (!rest.length) return { ok: false, text: 'Usage: raw <agentx args>' };
    args = rest;
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

  return { ok: true, args, risk: 'mutate', capability };
}

module.exports = {
  ConfirmationStore,
  classifyCommand,
  describeArgs,
  isReadOnlyPlan,
};
