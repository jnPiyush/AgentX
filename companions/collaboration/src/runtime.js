import { StringDecoder } from 'node:string_decoder';
import { stripVTControlCharacters } from 'node:util';
import runner from '../../whatsapp/src/frontierRunner.js';
import guided from '../../whatsapp/src/guidedInteraction.js';

export function createRuntime(config, implementation = runner) {
    const children = new Set();
    const pending = new Set();
    const shutdown = new AbortController();
    const runtimeConfig = {
        repoPath: config.repoPath, cliRelativePath: config.cliRelativePath,
        commandTimeoutMs: config.commandTimeoutMs, maxOutputChars: config.maxOutputChars,
        maxRuntimeOutputChars: config.maxRuntimeOutputChars,
        runtimeEnv: runner.validateRuntimeEnv(config.runtimeEnv),
    };
    let blocked = false;
    let unknownTermination = false;
    const blockedResult = () => ({ ok: false, terminationConfirmed: false, text: 'Runtime termination was not confirmed; execution is blocked.' });
    async function execute(args, expected, progress) {
        if (blocked) return blockedResult();
        if (shutdown.signal.aborted) throw new Error('Runtime is shutting down.');
        let buffer = '';
        const decoder = new StringDecoder('utf8');
        const result = await implementation.runFrontierProcess(args, runtimeConfig, {
            signal: shutdown.signal,
            onTerminationFailure() { blocked = true; },
            onChild(child) {
                children.add(child);
                child.stdout.on('data', chunk => {
                    buffer = (buffer + (typeof chunk === 'string' ? chunk : decoder.write(chunk))).slice(-8192);
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop();
                    for (const raw of lines) {
                        const line = stripVTControlCharacters(raw);
                        const iteration = /^\s*Iteration (\d{1,4})\/(\d{1,4})/.exec(line);
                        if (iteration) progress(`Agent iteration ${iteration[1]} of ${iteration[2]}.`);
                        else if (/^\s*\[SELF-REVIEW\] Iteration/.test(line)) progress('Agent self-review in progress.');
                        else if (/^\s*\[COMPACTION\]/.test(line)) progress('Agent context compaction in progress.');
                    }
                });
            },
            onChildDone(child) { children.delete(child); },
        });
        if (result.terminationConfirmed === false) {
            blocked = true;
            if (!children.size) unknownTermination = true;
        }
        return blocked ? blockedResult() : guided.parseRuntimeResult(result, expected);
    }
    return {
        async run(job, progress = () => {}) {
            if (blocked) return blockedResult();
            if (shutdown.signal.aborted) return { ok: false, text: 'Runtime is shutting down.' };
            const task = Promise.resolve().then(async () => {
                if (job.inspectOnly) {
                    return execute(guided.inspectArguments(job.nativeSessionId),
                        { sessionId: job.nativeSessionId, agent: job.agent, inspection: true }, progress);
                }
                if (!job.resume) {
                    if (job.nativeSessionId) throw new Error('An existing native session requires a confirmed response.');
                    return execute(guided.startArguments(job.agent, job.instruction), { agent: job.agent }, progress);
                }
                const { pendingInteraction, decision, text } = job.resume;
                guided.validatePending(pendingInteraction);
                if (pendingInteraction.sessionId !== job.nativeSessionId || pendingInteraction.agent !== job.agent) {
                    throw new Error('Response does not match the bound native session and agent.');
                }
                const args = guided.responseArguments(pendingInteraction, decision, text);
                const expected = { sessionId: job.nativeSessionId, agent: job.agent };
                const current = await execute(guided.inspectArguments(job.nativeSessionId), { ...expected, inspection: true }, progress);
                if (current.terminationConfirmed === false) return current;
                if (!guided.samePendingRequest(pendingInteraction, current.pendingInteraction)) {
                    return { ...current, staleInput: true };
                }
                return execute(args, expected, progress);
            });
            pending.add(task);
            try { return await task; } finally { pending.delete(task); }
        },
        async stop() {
            shutdown.abort();
            await Promise.allSettled([...pending]);
            if (children.size || unknownTermination) throw new Error('Child termination was not confirmed; runtime remains blocked.');
        },
    };
}