import runner from '../../whatsapp/src/frontierRunner.js';

export function createRuntime(config, implementation = runner) {
    const children = new Set();
    return {
        async run(job, progress) {
            let buffer = '';
            return implementation.runFrontierProcess(['run', job.agent, job.instruction], config, {
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
            });
        },
        stop() { for (const child of children) implementation.terminateProcessTree(child); },
    };
}