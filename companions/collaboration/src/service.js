import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { HELP, parseCommand } from './commands.js';
import guided from '../../whatsapp/src/guidedInteraction.js';

const TERMINAL = new Set(['succeeded', 'failed', 'interrupted', 'cancelled', 'completed_elsewhere']);
const DAY = 86400000;

function pendingFor(job) {
    const pending = guided.validatePending(job.pendingInteraction);
    if (typeof job.id !== 'string' || !/^[a-f0-9]{16}$/.test(job.id)
        || ![job.scope, job.actor].every(value => typeof value === 'string' && value.length > 0 && value.length <= 512)
        || typeof job.nativeSessionId !== 'string' || pending.sessionId !== job.nativeSessionId || pending.agent !== job.agent) {
        throw new Error('Stored pending input does not match the job session and agent.');
    }
    return pending;
}

function responseMatches(job, response) {
    const pending = pendingFor(job);
    guided.responseArguments(response.pendingInteraction, response.decision, response.text);
    return guided.samePendingRequest(pending, response.pendingInteraction);
}

function ownedJob(state, id, scope, actor) {
    const job = state.jobs.find(candidate => candidate.id === id && candidate.scope === scope && candidate.actor === actor);
    if (!job) throw new Error('Job not found in this conversation.');
    return job;
}

function interruptedState(job) {
    return {
        status: job.inspectOnly ? 'needs_attention' : 'interrupted',
        phase: job.inspectOnly
            ? 'Native inspection was interrupted; lifecycle remains unresolved. Reconcile on the desktop and inspect again.'
            : 'Service stopped or restarted; inspect the local workspace before submitting another instruction.',
        resume: undefined, inspectOnly: undefined,
    };
}

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
                this.halt('collaboration storage_lock_compromised');
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
                if (job.pendingInteraction != null || job.status === 'awaiting_input') pendingFor(job);
                if (!['awaiting_input', 'needs_attention'].includes(job.status) && !TERMINAL.has(job.status)) {
                    Object.assign(job, interruptedState(job));
                    job.updatedAt = this.now();
                }
                delete job.resume;
                delete job.inspectOnly;
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

    halt(message) {
        this.stopping = true;
        this.log(message);
        try {
            Promise.resolve(this.onFatal()).catch(() => this.log('collaboration fatal_shutdown_failed'));
        } catch {
            this.log('collaboration fatal_shutdown_failed');
        }
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
                this.halt('collaboration storage_failure execution_stopped');
            }).finally(() => { this.pending = null; });
        }
        return reply;
    }

    applyMessage(state, { scope, actor, deliveryId, destination, text }) {
        this.prune(state);
        const deliveryKey = JSON.stringify([scope, actor, deliveryId]);
        const delivered = state.deliveries[deliveryKey];
        if (delivered && delivered.kind !== 'status') {
            const job = state.jobs.find(candidate => candidate.id === delivered.jobId && candidate.scope === scope && candidate.actor === actor);
            return job ? formatProgress(job) : delivered.reply || 'The original job is no longer retained. Submit a new request.';
        }
        if (Object.keys(state.deliveries).length >= 10000) throw new Error('Delivery capacity reached.');
        const command = parseCommand(text, this.agents);
        let reply;
        let jobId;
        if (command.kind === 'help') reply = HELP;
        else if (command.kind === 'status') {
            const jobs = state.jobs.filter(job => job.scope === scope && job.actor === actor && (!command.jobId || job.id === command.jobId));
            reply = jobs.slice(-5).map(job => formatProgress(job, Boolean(command.jobId))).join('\n\n') || 'No jobs in this conversation.';
        } else if (command.kind === 'inspect') {
            const job = ownedJob(state, command.jobId, scope, actor);
            if (!job.nativeSessionId || ['queued', 'running'].includes(job.status)) {
                throw new Error('Native inspection requires an existing idle job.');
            }
            Object.assign(job, { status: 'queued', inspectOnly: true, resume: undefined,
                phase: 'Read-only native inspection queued.', updatedAt: this.now() });
            for (const [key, entry] of Object.entries(state.confirmations)) {
                if (entry.kind === 'respond' && entry.jobId === job.id) delete state.confirmations[key];
            }
            jobId = job.id;
            reply = formatProgress(job);
        } else if (!this.enabled) reply = 'Remote execution is disabled by the workspace operator.';
        else if (command.kind === 'confirm') {
            const key = JSON.stringify([scope, actor, command.nonce]);
            const confirmation = state.confirmations[key];
            if (!confirmation) reply = 'Confirmation expired, already used, or belongs to another sender/conversation.';
            else {
                if (!['run', 'instruct', 'respond'].includes(confirmation.kind)) throw new Error('Invalid confirmation kind.');
                if (!this.agents.includes(confirmation.agent)) throw new Error('Agent is no longer enabled.');
                delete state.confirmations[key];
                if (confirmation.kind === 'respond') {
                    const job = ownedJob(state, confirmation.jobId, scope, actor);
                    jobId = job.id;
                    if (job.status !== 'awaiting_input') {
                        reply = `Job no longer awaits this input. No response was queued.\n${formatProgress(job)}`;
                    } else if (!responseMatches(job, confirmation)) {
                        reply = `Pending input changed. Request a new response confirmation.\n${formatProgress(job)}`;
                    } else {
                        Object.assign(job, {
                            status: 'queued', phase: 'Confirmed response waiting for the workspace runner.',
                            destination, updatedAt: this.now(),
                            resume: {
                                pendingInteraction: structuredClone(confirmation.pendingInteraction),
                                decision: confirmation.decision, text: confirmation.text,
                            },
                        });
                        for (const [otherKey, entry] of Object.entries(state.confirmations)) {
                            if (entry.kind === 'respond' && entry.jobId === job.id) delete state.confirmations[otherKey];
                        }
                        reply = formatProgress(job);
                    }
                } else {
                    guided.startArguments(confirmation.agent, confirmation.instruction);
                    if (state.jobs.length >= this.maxJobs) throw new Error('Job capacity reached.');
                    if (confirmation.parentId && !TERMINAL.has(ownedJob(state, confirmation.parentId, scope, actor).status)) {
                        throw new Error('Prior job is still active. Wait for it or respond to its pending input.');
                    }
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
            }
        } else if (command.kind === 'respond') {
            const job = ownedJob(state, command.jobId, scope, actor);
            if (job.status !== 'awaiting_input') throw new Error('Job is not awaiting input. Use status to check its lifecycle.');
            const pendingInteraction = pendingFor(job);
            guided.responseArguments(pendingInteraction, command.decision, command.text);
            for (const [key, entry] of Object.entries(state.confirmations)) {
                if (entry.kind === 'respond' && entry.jobId === job.id) delete state.confirmations[key];
            }
            if (Object.keys(state.confirmations).length >= 100) throw new Error('Confirmation capacity reached.');
            const nonce = randomBytes(12).toString('hex');
            state.confirmations[JSON.stringify([scope, actor, nonce])] = {
                kind: 'respond', jobId: job.id, agent: job.agent,
                pendingInteraction: structuredClone(pendingInteraction),
                decision: command.decision, text: command.text, expiresAt: this.now() + 120000,
            };
            reply = `Confirm ${command.decision} for job ${job.id} by replying "confirm ${nonce}" within 120 seconds. This response applies only to the displayed pending input.`;
        } else {
            if (Object.keys(state.confirmations).length >= 100) throw new Error('Confirmation capacity reached.');
            const parent = command.kind === 'instruct'
                ? ownedJob(state, command.jobId, scope, actor)
                : undefined;
            if (parent && !TERMINAL.has(parent.status)) throw new Error('Prior job is still active. Wait for it or respond to its pending input.');
            const instruction = parent
                ? `Continue work in this workspace. Prior instructions:\n${parent.instruction}\n\nNew instruction:\n${command.instruction}`
                : command.instruction;
            if (instruction.length > 12000) throw new Error('Follow-up context limit reached. Start a new run.');
            const nonce = randomBytes(12).toString('hex');
            const agent = parent?.agent || command.agent;
            state.confirmations[JSON.stringify([scope, actor, nonce])] = {
                kind: command.kind, agent, instruction, parentId: parent?.id, expiresAt: this.now() + 120000,
            };
            reply = `Confirm ${agent} execution by replying "confirm ${nonce}" within 120 seconds. This starts a guided turn; it does not approve a plan.`;
        }
        state.deliveries[deliveryKey] = {
            at: this.now(), jobId, kind: command.kind,
            ...(command.kind === 'status' || jobId ? {} : { reply }),
        };
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
            let staleInput = false;
            try {
                if (job.inspectOnly) {
                    if (job.inspectOnly !== true || job.resume || typeof job.nativeSessionId !== 'string'
                        || !guided.SESSION.test(job.nativeSessionId)) throw new Error('Invalid queued native inspection.');
                } else if (!this.agents.includes(job.agent)) {
                    throw new Error('Agent is no longer enabled.');
                } else if (job.resume) {
                    staleInput = !responseMatches(job, job.resume);
                } else if (job.nativeSessionId || job.pendingInteraction) {
                    throw new Error('Existing native sessions require a confirmed response.');
                }
                if (!job.inspectOnly && job.parentId && !TERMINAL.has(ownedJob(this.state, job.parentId, job.scope, job.actor).status)) {
                    throw new Error('Prior job is still active.');
                }
            } catch {
                this.log(`collaboration invalid_queued_input job=${job.id}`);
                this.update(job.id, {
                    status: job.inspectOnly ? 'needs_attention' : 'failed',
                    phase: 'Queued input is invalid. Check the local companion state.',
                    pendingInteraction: undefined, resume: undefined, inspectOnly: undefined, updatedAt: this.now(),
                });
                await this.notify(this.state.jobs.find(candidate => candidate.id === job.id));
                continue;
            }
            if (staleInput) {
                this.update(job.id, {
                    status: 'awaiting_input', phase: 'Pending input changed before execution. Confirm a new response.',
                    resume: undefined, updatedAt: this.now(),
                });
                await this.notify(this.state.jobs.find(candidate => candidate.id === job.id));
                continue;
            }
            this.update(job.id, { status: 'running',
                phase: job.inspectOnly ? 'Read-only native inspection started.' : 'Agent execution started.', updatedAt: this.now() });
            job = this.state.jobs.find(candidate => candidate.id === job.id);
            await this.notify(job);
            if (this.stopping) {
                this.update(job.id, {
                    ...interruptedState(job), updatedAt: this.now(),
                });
                break;
            }
            let status;
            let phase;
            let pendingInteraction;
            let nativeSessionId = job.nativeSessionId;
            try {
                const result = await this.run(job, phase => {
                    if (this.stopping) return;
                    try { this.update(job.id, { phase, updatedAt: this.now() }); }
                    catch {
                        this.halt(`collaboration progress_storage_failed job=${job.id}`);
                    }
                });
                if (result.terminationConfirmed === false) this.halt(`collaboration termination_unconfirmed job=${job.id}`);
                if (result.sessionId !== undefined) {
                    if (typeof result.sessionId !== 'string' || !guided.SESSION.test(result.sessionId)
                        || (nativeSessionId && result.sessionId !== nativeSessionId)
                        || this.state.jobs.some(other => other.id !== job.id && other.nativeSessionId === result.sessionId)) {
                        throw new Error('Runtime result belongs to another native session.');
                    }
                    nativeSessionId = result.sessionId;
                }
                if (result.pendingInteraction != null) {
                    pendingFor({ ...job, nativeSessionId, pendingInteraction: result.pendingInteraction });
                    if (result.cancelled) throw new Error('Cancelled sessions cannot await input.');
                }
                if (this.stopping) {
                    ({ status, phase } = interruptedState(job));
                } else if (result.pendingInteraction) {
                    pendingInteraction = structuredClone(result.pendingInteraction);
                    status = 'awaiting_input';
                    phase = result.staleInput
                        ? 'Native input changed; no response was submitted. Review the current request.'
                        : 'Native session is paused for your response.';
                } else if (result.cancelled) {
                    status = 'cancelled';
                    phase = result.inspection
                        ? 'Native session cancelled outside this response. No response was submitted.'
                        : 'Native session cancelled. No further work was queued.';
                } else if (result.inspection) {
                    status = result.phase === 'completed' ? 'completed_elsewhere' : 'needs_attention';
                    phase = result.phase === 'completed'
                        ? 'Native metadata reports completion elsewhere; this companion submitted no response. Local review gates still apply.'
                        : 'Native session has no pending input and is not confirmed complete. Use the desktop to reconcile it, then inspect this job again. No response was submitted.';
                } else {
                    status = result.ok ? 'succeeded' : 'failed';
                    phase = result.ok
                        ? 'Agent turn finished; local review gates still apply.'
                        : 'Agent turn failed. Check the local runtime.';
                }
            } catch {
                status = this.stopping ? interruptedState(job).status : nativeSessionId ? 'needs_attention' : 'failed';
                phase = 'Runtime result unavailable or invalid. No completion was inferred; inspect the local runtime.';
                this.log(`collaboration runtime_failed job=${job.id}`);
            }
            this.update(job.id, { status, phase, nativeSessionId, pendingInteraction,
                resume: undefined, inspectOnly: undefined, updatedAt: this.now() });
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
                Object.assign(job, interruptedState(job));
                job.updatedAt = this.now();
            }
        }
        try { if (!this.lockCompromised) this.save(); } finally { this.unlock(); }
    }
}

export function formatProgress(job, includePending = true) {
    const pending = job.status === 'awaiting_input'
        ? includePending ? `\n\n${guided.formatPending(pendingFor(job), job.id)}` : `\nPending input: use status ${job.id}`
        : '';
    return `Frontier job ${job.id}\nAgent: ${job.agent}\nStatus: ${job.status}\n${job.phase}${job.deliveryFailed ? '\nA progress notification failed; this is the latest saved status.' : ''}${pending}`;
}