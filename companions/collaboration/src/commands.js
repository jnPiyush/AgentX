const HELP = 'Commands: status; status <job>; run <agent> <instruction>; instruct <job> <instruction>; confirm <code>. Instructions require confirmation and run sequentially.';

export function parseCommand(text, agents) {
    if (typeof text !== 'string' || text.length > 4000) throw new Error('Message must be at most 4000 characters.');
    const input = text.trim().replace(/^\/frontier(?:\s+|$)/i, '');
    if (/^(help|menu|\?)?$/i.test(input)) return { kind: 'help' };
    if (/^status$/i.test(input)) return { kind: 'status' };
    const status = /^status ([a-f0-9]{16})$/i.exec(input);
    if (status) return { kind: 'status', jobId: status[1].toLowerCase() };
    const confirm = /^confirm ([a-f0-9]{24})$/i.exec(input);
    if (confirm) return { kind: 'confirm', nonce: confirm[1].toLowerCase() };
    const run = /^run ([a-z][a-z0-9-]{0,63})\s+([\s\S]+)$/i.exec(input);
    if (run) {
        const agent = run[1].toLowerCase();
        if (!agents.includes(agent)) throw new Error('Agent is not enabled for remote execution.');
        return { kind: 'run', agent, instruction: instructionText(run[2]) };
    }
    const followUp = /^instruct ([a-f0-9]{16})\s+([\s\S]+)$/i.exec(input);
    if (followUp) return { kind: 'instruct', jobId: followUp[1].toLowerCase(), instruction: instructionText(followUp[2]) };
    throw new Error(HELP);
}

function instructionText(text) {
    const value = text.trim();
    if (!value || value.startsWith('-') || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
        throw new Error('Instruction is empty or contains unsupported control characters or a leading CLI flag.');
    }
    return value;
}

export { HELP };