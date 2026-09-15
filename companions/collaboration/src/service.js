import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { HELP, parseCommand } from './commands.js';

const TERMINAL = new Set(['succeeded', 'failed', 'interrupted']);
const DAY = 86400000;

export class CollaborationService {
    constructor({ directory, agents, enabled = false, run, publish, now = Date.now, maxJobs = 500,
        publicationTimeoutMs = 10000, write = fs.writeFileSync, log = console.error,
        onFatal = () => {}, acquireLock = lockfile.lockSync }) {
        this.directory = directory;
        this.agents = agents;
        this.enabled = enabled;
        this.run = run;
        this.publish = publish;
        this.now = now;
        this.maxJobs = maxJobs;
        this.publicationTimeoutMs = publicationTimeoutMs;
        this.write = write;
        this.log = log;
        this.onFatal = onFatal;
        this.lockCompromised = false;
        this.notifications = new Set();
        this.stopping = false;
        this.pending = null;
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        this.releaseLock = acquireLock(directory, {
            stale: 30000, update: 10000,
            onCompromised: () => {
                this.lockCompromised = true;
                this.stopping = true;
                this.log('collaboration storage_lock_compromised');
                this.onFatal();
            },
        });
        this.file = path.join(directory, 'jobs.json');
        try {
            this.state = fs.existsSync(this.file)
                ? JSON.parse(fs.readFileSync(this.file, 'utf8'))
                : { version: 1, jobs: [], deliveries: {}, confirmations: {} };
            if (this.state.version !== 1 || !Array.isArray(this.state.jobs)
                || !this.state.deliveries || !this.state.confirmations) throw new Error('Invalid collaboration state.');
            for (const job of this.state.jobs) {
                if (!TERMINAL.has(job.status)) {
                    job.status = 'interrupted';
                    job.phase = 'Service restarted; submit a new instruction to continue.';
                    job.updatedAt = this.now();
                }
            }
            this.state.confirmations = {};
            this.save();
        } catch (error) {
            this.unlock();
            throw error;
        }
    }

    save(next = this.state) {
        if (this.lockCompromised) throw new Error('Storage ownership lost.');
        const temporary = `${this.file}.${process.pid}.tmp`;
        this.write(temporary, JSON.stringify(next), { mode: 0o600 });
        fs.renameSync(temporary, this.file);
    }

    commit(change) {
        const next = structuredClone(this.state);
        const result = change(next);
        this.save(next);
        this.state = next;
        return result;
    }

    update(id, changes) {
        this.commit(next => Object.assign(next.jobs.find(job => job.id === id), changes));
    }

    prune(state) {
        for (const [key, entry] of Object.entries(state.deliveries)) {
            if (entry.at < this.now() - DAY) delete state.deliveries[key];
        }
        for (const [key, entry] of Object.entries(state.confirmations)) {
            if (entry.expiresAt <= this.now()) delete state.confirmations[key];
        }
        state.jobs = state.jobs.filter(job => !TERMINAL.has(job.status) || job.updatedAt > this.now() - 7 * DAY);
    }

    handle({ scope, actor, deliveryId, destination, text }) {
        if (this.stopping) throw new Error('Service is stopping.');
        if (![scope, actor, deliveryId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 512)) {
            throw new Error('Invalid authenticated message identity.');
        }
        const reply = this.commit(state => this.applyMessage(state, { scope, actor, deliveryId, destination, text }));
        if (!this.pending) {
            this.pending = Promise.resolve().then(() => this.drain()).catch(() => {
                this.stopping = true;
                this.log('collaboration storage_failure execution_stopped');
                this.onFatal();
            }).finally(() => { this.pending = null; });
        }
        return reply;
    }

    applyMessage(state, { scope, actor, deliveryId, destination, text }) {
        this.prune(state);
        const deliveryKey = JSON.stringify([scope, actor, deliveryId]);
        const delivered = state.deliveries[deliveryKey];
        if (delivered && delivered.kind !== 'status') {
            const job = state.jobs.find(candidate => candidate.id === delivered.jobId);
            return job ? formatProgress(job) : delivered.reply;
        }
        if (Object.keys(state.deliveries).length >= 10000) throw new Error('Delivery capacity reached.');
        const command = parseCommand(text, this.agents);
        let reply;
        let jobId;
        if (command.kind === 'help') reply = HELP;
        else if (command.kind === 'status') {
            const jobs = state.jobs.filter(job => job.scope === scope && job.actor === actor && (!command.jobId || job.id === command.jobId));
            reply = jobs.slice(-5).map(formatProgress).join('\n\n') || 'No jobs in this conversation.';
        } else if (!this.enabled) reply = 'Remote execution is disabled by the workspace operator.';
        else if (command.kind === 'confirm') {
            const key = JSON.stringify([scope, actor, command.nonce]);
            const confirmation = state.confirmations[key];
            if (!confirmation) reply = 'Confirmation expired, already used, or belongs to another sender/conversation.';
            else {
                if (!this.agents.includes(confirmation.agent)) throw new Error('Agent is no longer enabled.');
                if (state.jobs.length >= this.maxJobs) throw new Error('Job capacity reached.');
                delete state.confirmations[key];
                const job = {
                    id: randomBytes(8).toString('hex'), scope, actor,
                    agent: confirmation.agent, instruction: confirmation.instruction,
                    parentId: confirmation.parentId, destination,
                    status: 'queued', phase: 'Waiting for the workspace runner.',
                    createdAt: this.now(), updatedAt: this.now(), deliveryFailed: false,
                };
                state.jobs.push(job);
                jobId = job.id;
                reply = formatProgress(job);
            }
        } else {
            if (Object.keys(state.confirmations).length >= 100) throw new Error('Confirmation capacity reached.');
            const parent = command.kind === 'instruct'
                ? state.jobs.find(job => job.id === command.jobId && job.scope === scope && job.actor === actor)
                : undefined;
            if (command.kind === 'instruct' && !parent) throw new Error('Job not found in this conversation.');
            const instruction = parent
                ? `Continue work in this workspace. Prior instructions:\n${parent.instruction}\n\nNew instruction:\n${command.instruction}`
                : command.instruction;
            if (instruction.length > 12000) throw new Error('Follow-up context limit reached. Start a new run.');
            const nonce = randomBytes(12).toString('hex');
            const agent = parent?.agent || command.agent;
            state.confirmations[JSON.stringify([scope, actor, nonce])] = {
                agent, instruction, parentId: parent?.id, expiresAt: this.now() + 120000,
            };
            reply = `Confirm ${agent} execution by replying "confirm ${nonce}" within 120 seconds. Follow-ups execute as a new turn after queued work.`;
        }
        state.deliveries[deliveryKey] = { at: this.now(), reply, jobId, kind: command.kind };
        return reply;
    }

    async notify(job) {
        let timer;
        const sending = Promise.race([
            Promise.resolve().then(() => this.publish(job.destination, formatProgress(job))),
            new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Publication timeout')), this.publicationTimeoutMs); }),
        ]);
        this.notifications.add(sending);
        let deliveryFailed = false;
        try {
            await sending;
        } catch {
            deliveryFailed = true;
            this.log(`collaboration notification_failed job=${job.id}`);
        } finally {
            clearTimeout(timer);
            this.notifications.delete(sending);
        }
        this.update(job.id, { deliveryFailed });
    }

    async drain() {
        let job;
        while (!this.stopping && (job = this.state.jobs.find(candidate => candidate.status === 'queued'))) {
            this.update(job.id, { status: 'running', phase: 'Agent execution started.', updatedAt: this.now() });
            job = this.state.jobs.find(candidate => candidate.id === job.id);
            await this.notify(job);
            if (this.stopping) {
                this.update(job.id, {
                    status: 'interrupted', phase: 'Service stopped before execution.', updatedAt: this.now(),
                });
                break;
            }
            let status;
            let phase;
            try {
                const result = await this.run(job, phase => {
                    if (this.stopping) return;
                    try { this.update(job.id, { phase, updatedAt: this.now() }); }
                    catch {
                        this.stopping = true;
                        this.log(`collaboration progress_storage_failed job=${job.id}`);
                        this.onFatal();
                    }
                });
                status = this.stopping ? 'interrupted' : result.ok ? 'succeeded' : 'failed';
                phase = result.ok ? 'Agent turn finished; local review gates still apply.' : 'Agent turn failed. Check the local runtime.';
            } catch {
                status = 'failed';
                phase = 'Runtime unavailable. Check the local runtime.';
                this.log(`collaboration runtime_failed job=${job.id}`);
            }
            this.update(job.id, { status, phase, updatedAt: this.now() });
            await this.notify(this.state.jobs.find(candidate => candidate.id === job.id));
        }
    }

    async publishRunning() {
        if (this.stopping) return;
        const running = this.state.jobs.find(job => job.status === 'running');
        if (running) await this.notify(running);
    }

    async idle() { await this.pending; }

    unlock() {
        if (this.releaseLock && !this.lockCompromised) this.releaseLock();
        this.releaseLock = undefined;
    }

    async close() {
        this.stopping = true;
        await this.idle();
        await Promise.allSettled([...this.notifications]);
        for (const job of this.state.jobs) {
            if (job.status === 'queued') {
                job.status = 'interrupted';
                job.phase = 'Service stopped before execution.';
                job.updatedAt = this.now();
            }
        }
        try { if (!this.lockCompromised) this.save(); } finally { this.unlock(); }
    }
}

export function formatProgress(job) {
    return `Frontier job ${job.id}\nAgent: ${job.agent}\nStatus: ${job.status}\n${job.phase}${job.deliveryFailed ? '\nA progress notification failed; this is the latest saved status.' : ''}`;
}