const { runAgentX } = require('./agentxRunner');
const { classifyCommand } = require('./commandPolicy');

function helpText(config = {}) {
    const capabilities = config.capabilities || {};
    return [
        'AgentX WhatsApp commands:',
        '',
        'Read-only (enabled by default):',
        '  ready                 - show priority work queue',
        '  state                 - show all agent states',
        '  status                - show quality loop status',
        '  deps <issue>          - check issue dependencies',
        '  workflow <agent>      - show workflow for an agent',
        '',
        'Mutating (capability + confirmation required):',
        `  ship <issue>          - ${capabilities.ship ? 'enabled' : 'disabled'}`,
        `  run <agent> "<task>"  - ${capabilities.run ? 'enabled' : 'disabled'}`,
        `  ask "<question>"      - ${capabilities.run ? 'enabled' : 'disabled'}`,
        `  loop start "<task>"   - ${capabilities.loopMutation ? 'enabled' : 'disabled'}`,
        `  raw <args...>         - ${capabilities.raw ? 'enabled' : 'disabled'}`,
        '  confirm <nonce>       - execute one pending mutation',
        '',
        'Remote loop iterate/complete is disabled because evidence must be local.',
        '  help | menu | ?       - show this help'
    ].join('\n');
}

function tokenize(input) {
    const out = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(input)) !== null) {
        out.push(m[1] !== undefined ? m[1] : m[2]);
    }
    return out;
}

function planCommand(body, config) {
    const plan = classifyCommand(tokenize(body), config);
    if (!plan.ok && /^Unknown command:/.test(plan.text || '')) {
        return { ...plan, text: `${plan.text}\n\n${helpText(config)}` };
    }
    return plan;
}

async function executePlan(plan, config, runner = runAgentX) {
    if (!plan || !plan.ok) return plan || { ok: false, text: 'Invalid command plan.' };
    if (config.runner && typeof config.runner.run === 'function') {
        return config.runner.run(plan.args);
    }
    return runner(plan.args, config);
}

async function routeCommand(body, config, runner = runAgentX) {
    return executePlan(planCommand(body, config), config, runner);
}

module.exports = { executePlan, helpText, planCommand, routeCommand, tokenize };
