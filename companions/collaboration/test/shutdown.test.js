import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHttpApp, start } from '../src/server.js';

function config(prefix, options = {}) {
    return {
        directory: fs.mkdtempSync(path.join(os.tmpdir(), prefix)),
        agents: ['engineer'], host: '127.0.0.1', port: 0, progressMs: 60000, ...options,
    };
}

test('close is idempotent and retains the storage lock until asynchronous runtime stop succeeds', async () => {
    const settings = config('frontier-awaited-stop-');
    let release;
    const stopped = new Promise(resolve => { release = resolve; });
    let calls = 0;
    const handle = await start(settings, { runtime: { run: assert.fail, stop: () => { calls++; return stopped; } } });
    try {
        const first = handle.close();
        assert.equal(handle.close(), first);
        assert.equal(calls, 1);
        assert.equal(handle.service.stopping, true);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(fs.existsSync(`${settings.directory}.lock`), true);
        assert.throws(() => handle.service.handle({}), /stopping/);
        release();
        await first;
        assert.equal(fs.existsSync(`${settings.directory}.lock`), false);
        await handle.close();
        assert.equal(calls, 1);
    } finally {
        release();
        await handle.close();
        fs.rmSync(settings.directory, { recursive: true });
    }
});

test('asynchronous stop rejection is observable and never releases state or retries a failed close', async () => {
    const settings = config('frontier-failed-stop-');
    let calls = 0;
    const handle = await start(settings, { runtime: {
        run: assert.fail,
        stop: async () => { calls++; throw new Error('Fixture termination failure'); },
    } });
    try {
        const closing = handle.close();
        await assert.rejects(closing, error => {
            assert.ok(error instanceof AggregateError);
            assert.match(error.message, /storage ownership was retained/);
            assert.match(error.errors[0].message, /Fixture termination failure/);
            return true;
        });
        assert.equal(handle.close(), closing);
        await assert.rejects(handle.close(), /storage ownership was retained/);
        assert.equal(calls, 1);
        assert.equal(handle.server.listening, false);
        assert.equal(fs.existsSync(`${settings.directory}.lock`), true);
        assert.equal(typeof handle.service.releaseLock, 'function');
    } finally {
        // No child exists in this fixture; explicit test cleanup models operator recovery.
        await handle.service.close();
        fs.rmSync(settings.directory, { recursive: true });
    }
});

test('startup bind failure awaits stop and reports both errors without releasing unconfirmed storage', async () => {
    const occupied = createHttpApp({}).listen(0, '127.0.0.1');
    await new Promise(resolve => occupied.once('listening', resolve));
    let released = false;
    const settings = config('frontier-start-stop-failure-', {
        port: occupied.address().port,
        acquireLock: () => () => { released = true; },
    });
    let rejectStop;
    let entered;
    const stopping = new Promise(resolve => { entered = resolve; });
    const stopped = new Promise((_resolve, reject) => { rejectStop = reject; });
    let settled = false;
    const starting = start(settings, { runtime: { run: assert.fail, stop: () => { entered(); return stopped; } } });
    const rejected = assert.rejects(starting, error => {
        settled = true;
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors[0].code, 'EADDRINUSE');
        assert.match(error.errors[1].message, /storage ownership was retained/);
        return true;
    });
    try {
        await stopping;
        assert.equal(released, false);
        assert.equal(settled, false);
        rejectStop(new Error('Fixture startup stop failure'));
        await rejected;
        assert.equal(released, false);
    } finally {
        rejectStop(new Error('Fixture cleanup'));
        await rejected;
        await new Promise(resolve => occupied.close(resolve));
        fs.rmSync(settings.directory, { recursive: true });
    }
});

test('fatal lock compromise handles asynchronous stop failure without releasing another owner lock', async () => {
    let compromise;
    let released = false;
    const logs = [];
    const settings = config('frontier-fatal-stop-', {
        log: message => logs.push(message),
        acquireLock: (_directory, options) => {
            compromise = options.onCompromised;
            return () => { released = true; };
        },
    });
    let rejectStop;
    let calls = 0;
    const handle = await start(settings, { runtime: {
        run: assert.fail,
        stop: () => { calls++; return new Promise((_resolve, reject) => { rejectStop = reject; }); },
    } });
    try {
        compromise();
        assert.equal(handle.service.stopping, true);
        assert.equal(calls, 1);
        const rejected = assert.rejects(handle.close(), /storage ownership was retained/);
        rejectStop(new Error('private-fixture-stop-diagnostics'));
        await rejected;
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(released, false);
        assert.ok(logs.includes('collaboration storage_lock_compromised'));
        assert.ok(logs.includes('collaboration shutdown_failed verify_runtime_and_storage'));
        assert.ok(logs.every(message => !message.includes('private-fixture')));
    } finally {
        await handle.service.close();
        fs.rmSync(settings.directory, { recursive: true });
    }
});

test('an unresponsive runtime stop reaches a bounded failure and leaves storage owned', { timeout: 3000 }, async () => {
    const settings = config('frontier-stop-deadline-', { shutdownTimeoutMs: 20 });
    const handle = await start(settings, { runtime: { run: assert.fail, stop: () => new Promise(() => {}) } });
    try {
        await assert.rejects(handle.close(), error => {
            assert.match(error.errors[0].message, /termination was not confirmed/);
            return true;
        });
        assert.equal(handle.server.listening, false);
        assert.equal(fs.existsSync(`${settings.directory}.lock`), true);
    } finally {
        await handle.service.close();
        fs.rmSync(settings.directory, { recursive: true });
    }
});
