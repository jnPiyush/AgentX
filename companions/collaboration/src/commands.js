const HELP = 'Commands: status; status <job>; inspect <job>; run <agent> <instruction>; instruct <job> <instruction>; respond <job> <answer|approve|revise|cancel> [text]; confirm <code>. Inspection is read-only; instructions and responses require confirmation and run sequentially.';

export function parseCommand(text, agents) {
    if (typeof text !== 'string' || text.length > 4000) throw new Error('Message must be at most 4000 characters.');
    const input = text.trim().replace(/^\/frontier(?:\s+|$)/i, '');
    if (/^(help|menu|\?)?$/i.test(input)) return { kind: 'help' };
    if (/^status$/i.test(input)) return { kind: 'status' };
    const status = /^status ([a-f0-9]{16})$/i.exec(input);
    if (status) return { kind: 'status', jobId: status[1].toLowerCase() };
    const inspect = /^inspect ([a-f0-9]{16})$/i.exec(input);
    if (inspect) return { kind: 'inspect', jobId: inspect[1].toLowerCase() };
    const confirm = /^confirm ([a-f0-9]{24})$/i.exec(input);
    if (confirm) return { kind: 'confirm', nonce: confirm[1].toLowerCase() };
    const respond = /^respond ([a-f0-9]{16}) (answer|approve|revise|cancel)(?:\s+([\s\S]+))?$/i.exec(input);
    if (respond) {
        const decision = respond[2].toLowerCase();
        const text = (respond[3] || '').trim();
        if (['answer', 'revise'].includes(decision)) instructionText(text, true);
        else if (text) throw new Error('Approval and cancellation cannot include edits.');
        return { kind: 'respond', jobId: respond[1].toLowerCase(), decision, text };
    }
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

function instructionText(text, allowLeadingFlag = false) {
    const value = text.trim();
    if (!value || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
        throw new Error('Text is empty or contains unsupported control characters.');
    }
    if (!allowLeadingFlag && value.startsWith('-')) throw new Error('Instruction cannot start with a CLI flag.');
    return value;
}

export { HELP };