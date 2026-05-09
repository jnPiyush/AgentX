// Maps natural-ish WhatsApp messages to agentx CLI subcommands.
// Keep mappings explicit so the user always knows what will run.

const { runAgentX } = require('./agentxRunner');

function helpText() {
    return [
        'AgentX WhatsApp commands:',
        '',
        '  ready                 - show priority work queue',
        '  state                 - show all agent states',
        '  status                - show quality loop status',
        '  deps <issue>          - check issue dependencies',
        '  workflow <agent>      - show workflow for an agent',
        '  ship <issue>          - autonomous ship of an issue',
        '  loop start "<task>"   - start a quality loop',
        '  loop iterate "<msg>"  - record an iteration',
        '  loop complete "<msg>" - mark loop complete',
        '  run <agent> "<task>"  - run a specialist agent',
        '  ask "<question>"      - run default agent on a question',
        '  raw <args...>         - pass raw args to agentx CLI',
        '  help | menu | ?       - show this help'
    ].join('\n');
}

// Tokenize respecting double quotes
function tokenize(input) {
    const out = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(input)) !== null) {
        out.push(m[1] !== undefined ? m[1] : m[2]);
    }
    return out;
}

async function routeCommand(body, config) {
    const tokens = tokenize(body);
    if (tokens.length === 0) return { ok: false, text: 'Empty command. Send "help".' };

    const cmd = tokens[0].toLowerCase();
    const rest = tokens.slice(1);

    switch (cmd) {
        case 'ready':
            return runAgentX(['ready'], config);
        case 'state':
            return runAgentX(['state'], config);
        case 'status':
            return runAgentX(['loop', 'status'], config);
        case 'deps':
            if (!rest[0]) return { ok: false, text: 'Usage: deps <issue>' };
            return runAgentX(['deps', rest[0]], config);
        case 'workflow':
            if (!rest[0]) return { ok: false, text: 'Usage: workflow <agent>' };
            return runAgentX(['workflow', rest[0]], config);
        case 'ship':
            if (!rest[0]) return { ok: false, text: 'Usage: ship <issue>' };
            return runAgentX(['ship', '-Issue', rest[0]], config);
        case 'loop': {
            const sub = (rest[0] || '').toLowerCase();
            const msg = rest.slice(1).join(' ');
            if (sub === 'start') return runAgentX(['loop', 'start', '-p', msg || 'WhatsApp-initiated task'], config);
            if (sub === 'iterate') return runAgentX(['loop', 'iterate', '-s', msg || 'iteration'], config);
            if (sub === 'complete') return runAgentX(['loop', 'complete', '-s', msg || 'complete'], config);
            if (sub === 'status' || !sub) return runAgentX(['loop', 'status'], config);
            return { ok: false, text: 'Usage: loop start|iterate|complete|status "<msg>"' };
        }
        case 'run': {
            const agent = rest[0];
            const task = rest.slice(1).join(' ');
            if (!agent || !task) return { ok: false, text: 'Usage: run <agent> "<task>"' };
            return runAgentX(['run', agent, task], config);
        }
        case 'ask': {
            const task = rest.join(' ');
            if (!task) return { ok: false, text: 'Usage: ask "<question>"' };
            return runAgentX(['run', config.defaultAgent, task], config);
        }
        case 'raw':
            if (rest.length === 0) return { ok: false, text: 'Usage: raw <agentx args>' };
            return runAgentX(rest, config);
        default:
            return { ok: false, text: `Unknown command: ${cmd}\n\n${helpText()}` };
    }
}

module.exports = { routeCommand, helpText };
