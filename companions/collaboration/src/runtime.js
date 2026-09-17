import runner from '../../whatsapp/src/frontierRunner.js';

export function createRuntime(config, implementation = runner) {
    const children = new Set();
    const pending = new Set();
    const shutdown = new AbortController();
    let blocked = false;
    return {
        async run(job, progress) {
            if (blocked || shutdown.signal.aborted) return { ok: false, text: 'Runtime is blocked or shutting down.' };
            let buffer = '';
            const task = Promise.resolve().then(() => implementation.runFrontierProcess(['run', job.agent, job.instruction], config, {
                signal: shutdown.signal,
                onTerminationFailure() { blocked = true; },
                onChild(child) {
                    children.add(child);
                    child.stdout.on('data', chunk => {
                        buffer = (buffer + chunk.toString()).slice(-8192);
                        const lines = buffer.split(/\r?\n/);
                        buffer = lines.pop();
                        for (const line of lines) {
                            const iteration = /^\s*Iteration (\d{1,4})\/(\d{1,4})/.exec(line);
                            if (iteration) progress(`Agent iteration ${iteration[1]} of ${iteration[2]}.`);
                            else if (/^\s*\[SELF-REVIEW\] Iteration/.test(line)) progress('Agent self-review in progress.');
                            else if (/^\s*\[COMPACTION\]/.test(line)) progress('Agent context compaction in progress.');
                        }
                    });
                },
                onChildDone(child) { children.delete(child); },
            }));
            pending.add(task);
            try { return await task; } finally { pending.delete(task); }
        },
        async stop() {
            shutdown.abort();
            await Promise.allSettled([...pending]);
            if (children.size) throw new Error('Child termination was not confirmed; runtime remains blocked.');
        },
    };
}