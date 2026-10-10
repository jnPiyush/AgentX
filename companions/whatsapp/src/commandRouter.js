const { runFrontier } = require('./frontierRunner');
const { classifyCommand } = require('./commandPolicy');
const {
    inspectArguments, parseRuntimeResult, responseArguments, samePendingRequest, formatPending,
} = require('./guidedInteraction');

function helpText(config = {}) {
    const capabilities = config.capabilities || {};
    return [
        'Frontier WhatsApp commands:',
        '',
        'Read-only (enabled by default):',
        '  ready                 - show priority work queue',
        '  state                 - show all agent states',
        '  status                - show quality loop status',
        '  deps <issue>          - check issue dependencies',
        '  workflow <agent>      - show workflow for an agent',
        '',
        'Capability-gated (confirmation required):',
        `  ship <issue>          - ${capabilities.ship ? 'enabled' : 'disabled'}`,
        `  run <agent> "<task>"  - ${capabilities.run ? 'enabled' : 'disabled'}`,
        `  ask "<question>"      - ${capabilities.run ? 'enabled' : 'disabled'}`,
        `  respond <session> <answer|approve|revise|cancel> [text] - ${capabilities.run ? 'enabled' : 'disabled'}`,
        `  loop start "<task>"   - ${capabilities.loopMutation ? 'enabled' : 'disabled'}`,
        `  raw <read-only args>  - ${capabilities.raw ? 'enabled' : 'disabled'}`,
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

async function executePlan(plan, config, runner = runFrontier) {
    if (!plan || !plan.ok) return plan || { ok: false, text: 'Invalid command plan.' };
    const invoke = args => config.runner && typeof config.runner.run === 'function'
        ? config.runner.run(args) : runner(args, config);
    if (!plan.guided && !plan.response) return invoke(plan.args);
    try {
        let args = plan.args;
        const expected = plan.response
            ? { sessionId: plan.response.sessionId, agent: plan.pendingInteraction?.agent }
            : { agent: plan.args[2] };
        if (plan.response) {
            if (!plan.pendingInteraction || plan.pendingInteraction.sessionId !== plan.response.sessionId) {
                throw new Error('No owned pending session is attached to this response.');
            }
            const current = parseRuntimeResult(await invoke(inspectArguments(plan.response.sessionId)), { ...expected, inspection: true });
            if (!current.pendingInteraction) {
                return { ok: false, sessionId: plan.response.sessionId, text: 'This native session no longer has pending input. No response was submitted.' };
            }
            if (!samePendingRequest(plan.pendingInteraction, current.pendingInteraction)) {
                return { ...current, staleInput: true, text: `The native request changed. No response was submitted.\n${formatPending(current.pendingInteraction)}` };
            }
            args = responseArguments(current.pendingInteraction, plan.response.decision, plan.response.text);
        }
        const result = parseRuntimeResult(await invoke(args), expected);
        const text = result.pendingInteraction ? formatPending(result.pendingInteraction)
            : result.cancelled ? 'Task cancelled. Native session history was preserved.'
                : result.ok ? (result.finalText || `Frontier session ${result.sessionId} finished; local review gates still apply.`)
                    : `Frontier session ${result.sessionId} did not finish. Inspect the local runtime before continuing.`;
        return { ...result, text: result.pendingInteraction ? text : text.slice(0, config.maxOutputChars || 6000) };
    } catch (error) {
        console.error('[Frontier WhatsApp] Guided runtime response rejected:', error.message);
        return { ok: false, text: error.message };
    }
}

async function routeCommand(body, config, runner = runFrontier) {
    return executePlan(planCommand(body, config), config, runner);
}

module.exports = { executePlan, helpText, planCommand, routeCommand, tokenize };
