import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CollaborationService } from '../src/service.js';

function fixture(options = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-collaboration-'));
    const executed = [];
    const notifications = [];
    const service = new CollaborationService({
        directory, agents: ['engineer'], enabled: true,
        run: async job => { executed.push(job); return { ok: true }; },
        publish: async (target, text) => { notifications.push({ target, text }); }, ...options,
    });
    let sequence = 0;
    const message = (text, fields = {}) => service.handle({
        scope: 'teams:tenant:conversation', actor: 'alice', deliveryId: String(++sequence),
        destination: { provider: 'teams', conversation: 'conversation' }, text, ...fields,
    });
    const confirm = text => message(`confirm ${text.match(/confirm ([a-f0-9]{24})/)[1]}`);
    return { service, directory, message, confirm, executed, notifications,
        cleanup: async () => { await service.close(); fs.rmSync(directory, { recursive: true, force: true }); },
    };
}

test('confirms execution once, persists progress and hides local instruction/output', async () => {
    const fixtureState = fixture();
    try {
        const reply = fixtureState.message('run engineer private task', { deliveryId: 'one' });
        assert.equal(fixtureState.message('run engineer private task', { deliveryId: 'one' }), reply);
        assert.equal(fixtureState.executed.length, 0);
        const accepted = fixtureState.confirm(reply);
        assert.match(accepted, /queued/);
        assert.doesNotMatch(accepted, /private task/);
        fixtureState.confirm(reply);
        await fixtureState.service.idle();
        assert.equal(fixtureState.executed.length, 1);
        assert.match(fixtureState.message('status'), /succeeded/);
        assert.equal(fixtureState.notifications.length, 2);
    } finally { await fixtureState.cleanup(); }
});

test('isolates confirmations and jobs by sender and conversation', async () => {
    const current = fixture();
    try {
        const nonce = current.message('run engineer Fix').match(/confirm ([a-f0-9]{24})/)[1];
        assert.match(current.message(`confirm ${nonce}`, { actor: 'bob' }), /another sender/);
        assert.match(current.message(`confirm ${nonce}`, { scope: 'other' }), /another sender/);
        current.message(`confirm ${nonce}`);
        await current.service.idle();
        const job = current.executed[0];
        assert.match(current.message(`status ${job.id}`, { scope: 'other' }), /No jobs/);
        assert.throws(() => current.message(`instruct ${job.id} change`, { scope: 'other' }), /not found/);
    } finally { await current.cleanup(); }
});

test('queues follow-up instructions after the active turn', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const calls = [];
    const current = fixture({ run: async job => { calls.push(job); if (calls.length === 1) await gate; return { ok: true }; } });
    try {
        current.confirm(current.message('run engineer Original task'));
        await new Promise(resolve => setImmediate(resolve));
        const parent = calls[0];
        current.confirm(current.message(`instruct ${parent.id} Keep compatibility`));
        assert.equal(calls.length, 1);
        release();
        await current.service.idle();
        assert.equal(calls.length, 2);
        assert.equal(calls[1].parentId, parent.id);
        assert.match(calls[1].instruction, /Original task[\s\S]+Keep compatibility/);
    } finally { release(); await current.cleanup(); }
});

test('expires confirmations and defaults to execution disabled', async () => {
    let clock = 1;
    const current = fixture({ now: () => clock });
    try {
        const reply = current.message('run engineer Fix');
        clock += 120001;
        assert.match(current.confirm(reply), /expired/);
        current.service.enabled = false;
        assert.match(current.message('run engineer Fix'), /disabled/);
        assert.match(current.message('help'), /Commands/);
    } finally { await current.cleanup(); }
});

test('records runtime failure and notification failure without exposing errors', async () => {
    const current = fixture({ run: async () => { throw new Error('sensitive'); }, publish: async () => { throw new Error('token'); } });
    try {
        current.confirm(current.message('run engineer Fix'));
        await current.service.idle();
        const status = current.message('status');
        assert.match(status, /failed/);
        assert.doesNotMatch(status, /sensitive|token/);
    } finally { await current.cleanup(); }
});

test('restart preserves replay protection and marks unfinished jobs interrupted', async () => {
    const current = fixture();
    current.confirm(current.message('run engineer Fix'));
    await current.service.idle();
    await current.service.close();
    const file = path.join(current.directory, 'jobs.json');
    const saved = JSON.parse(fs.readFileSync(file));
    saved.jobs[0].status = 'running';
    fs.writeFileSync(file, JSON.stringify(saved));
    const restarted = new CollaborationService({ directory: current.directory, agents: ['engineer'], run: assert.fail, publish: assert.fail });
    try {
        assert.equal(restarted.state.jobs[0].status, 'interrupted');
        assert.throws(() => new CollaborationService({ directory: current.directory }), /already being held/);
    } finally { await restarted.close(); fs.rmSync(current.directory, { recursive: true }); }
});

test('another actor in the same conversation cannot inspect or instruct a job', async () => {
    const current = fixture();
    try {
        current.confirm(current.message('run engineer Private task'));
        await current.service.idle();
        const jobId = current.executed[0].id;
        assert.match(current.message('status', { actor: 'bob' }), /No jobs/);
        assert.match(current.message(`status ${jobId}`, { actor: 'bob' }), /No jobs/);
        assert.throws(() => current.message(`instruct ${jobId} Redirect`, { actor: 'bob' }), /not found/);
    } finally { await current.cleanup(); }
});

test('replayed confirmation renders current status without repeating execution', async () => {
    const current = fixture();
    try {
        const nonce = current.message('run engineer Fix').match(/confirm ([a-f0-9]{24})/)[1];
        const fields = { deliveryId: 'confirmation' };
        assert.match(current.message(`confirm ${nonce}`, fields), /queued/);
        await current.service.idle();
        assert.match(current.message(`confirm ${nonce}`, fields), /succeeded/);
        assert.equal(current.executed.length, 1);
    } finally { await current.cleanup(); }
});

test('failed disk commit does not consume confirmation or leave a phantom job', async () => {
    let diskFull = false;
    const current = fixture({ write: (...args) => { if (diskFull) throw new Error('ENOSPC'); return fs.writeFileSync(...args); } });
    try {
        const reply = current.message('run engineer Fix');
        diskFull = true;
        assert.throws(() => current.confirm(reply), /ENOSPC/);
        assert.equal(current.service.state.jobs.length, 0);
        assert.equal(Object.keys(current.service.state.confirmations).length, 1);
        diskFull = false;
        current.confirm(reply);
        await current.service.idle();
        assert.equal(current.executed.length, 1);
    } finally { diskFull = false; await current.cleanup(); }
});

test('notification timeouts do not block jobs or shutdown indefinitely', async () => {
    const current = fixture({ publish: () => new Promise(() => {}), publicationTimeoutMs: 10, log: () => {} });
    try {
        current.confirm(current.message('run engineer Fix'));
        await current.service.idle();
        assert.equal(current.service.state.jobs[0].status, 'succeeded');
        assert.equal(current.service.state.jobs[0].deliveryFailed, true);
        await current.service.publishRunning();
    } finally { await current.cleanup(); }
});

test('stale heartbeat lock is reclaimed and unfinished work is not replayed', async () => {
    const current = fixture();
    await current.service.close();
    const lockDirectory = `${current.directory}.lock`;
    fs.mkdirSync(lockDirectory);
    const old = new Date(Date.now() - 60000);
    fs.utimesSync(lockDirectory, old, old);
    const restarted = new CollaborationService({ directory: current.directory, agents: ['engineer'], run: assert.fail, publish: assert.fail });
    await restarted.close();
    fs.rmSync(current.directory, { recursive: true });
});

test('rejects invalid identities, capacity overflow and oversized follow-up context', async () => {
    const current = fixture({ maxJobs: 1 });
    try {
        assert.throws(() => current.message('status', { actor: '' }), /identity/);
        current.confirm(current.message('run engineer Fix'));
        await current.service.idle();
        assert.throws(() => current.confirm(current.message('run engineer Another')), /capacity/);
        const parent = current.service.state.jobs[0];
        parent.instruction = 'x'.repeat(12000);
        assert.throws(() => current.message(`instruct ${parent.id} More`), /context limit/);
        current.service.stopping = true;
        assert.throws(() => current.message('status'), /stopping/);
    } finally { await current.cleanup(); }
});

test('lock compromise stops the active runtime and never releases another owner lock', async () => {
    let compromise;
    let releaseRun;
    let stopped = false;
    let released = false;
    const current = fixture({
        acquireLock: (_directory, options) => { compromise = options.onCompromised; return () => { released = true; }; },
        run: () => new Promise(resolve => { releaseRun = resolve; }),
        onFatal: () => { stopped = true; releaseRun({ ok: false }); }, log: () => {},
    });
    try {
        current.confirm(current.message('run engineer Fix'));
        await new Promise(resolve => setImmediate(resolve));
        compromise();
        assert.equal(stopped, true);
        assert.throws(() => current.message('status'), /stopping/);
        await current.service.idle();
    } finally { await current.cleanup(); }
    assert.equal(released, false);
});