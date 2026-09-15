import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGitHub } from '../src/github.js';
import { CloudAdapter } from '@microsoft/agents-hosting';
import { createTeams, allowedServiceUrl, isAllowedActivity, DeadlineCloudAdapter } from '../src/teams.js';
import { createHttpApp, start } from '../src/server.js';

const teamsConfig = {
    tenantId: '00000000-0000-0000-0000-000000000001', clientId: '00000000-0000-0000-0000-000000000002',
    clientSecret: 'fixture-value', users: ['00000000-0000-0000-0000-000000000003'], conversations: ['conversation'],
};
const githubConfig = { repository: 'owner/repo', installationId: 42, users: ['7'], webhookSecret: 'fixture-'.repeat(5) };

function githubEvent() {
    return {
        action: 'created', installation: { id: 42 }, repository: { full_name: 'owner/repo' },
        sender: { id: 7, login: 'alice' }, issue: { number: 8 },
        comment: { id: 99, created_at: new Date().toISOString(), user: { id: 7, type: 'User' }, body: '/frontier status' },
    };
}

test('GitHub App verifies raw-body signatures and current collaborator permission over HTTP', async () => {
    const messages = [];
    const calls = [];
    let permission = 'write';
    const github = createGitHub(githubConfig, { handle: message => { messages.push(message); return 'Progress'; } }, {
        async getInstallationOctokit(id) {
            assert.equal(id, 42);
            return { request: async (route, args) => { calls.push({ route, args }); return { data: { permission } }; } };
        },
    });
    const server = createHttpApp({ github }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/github/webhooks`;
    const send = async (payload, valid = true) => {
        const body = JSON.stringify(payload);
        return fetch(url, { method: 'POST', headers: {
            'content-type': 'application/json', 'x-github-event': 'issue_comment',
            'x-hub-signature-256': `sha256=${createHmac('sha256', valid ? githubConfig.webhookSecret : 'invalid').update(body).digest('hex')}`,
        }, body });
    };
    try {
        assert.equal((await send(githubEvent(), false)).status, 401);
        assert.equal(messages.length, 0);
        assert.equal((await send(githubEvent())).status, 202);
        assert.equal(messages[0].scope, 'github:42:owner/repo:8');
        assert.equal(calls[1].args.issue_number, 8);
        permission = 'read';
        assert.equal((await send(githubEvent())).status, 403);
        permission = 'write';
        const wrongInstall = githubEvent(); wrongInstall.installation.id = 43;
        assert.equal((await send(wrongInstall)).status, 403);
        const oldEvent = githubEvent(); oldEvent.comment.created_at = '2020-01-01';
        assert.equal((await send(oldEvent)).status, 400);
        const botEvent = githubEvent(); botEvent.comment.user.type = 'Bot';
        assert.equal((await send(botEvent)).status, 202);
        assert.equal(messages.length, 1);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Teams rejects unauthorized activity and sends progress to the captured conversation', async () => {
    const messages = [];
    const replies = [];
    let continued;
    const adapter = {
        async continueConversation(id, reference, callback) {
            continued = { id, reference }; await callback({ sendActivity: async text => replies.push(text) });
        },
    };
    const teams = createTeams(teamsConfig, { handle: message => { messages.push(message); return 'Queued'; } }, adapter);
    const activity = {
        channelId: 'msteams', type: 'message', id: 'message', text: '<at>Frontier</at> status',
        timestamp: new Date().toISOString(), channelData: { tenant: { id: teamsConfig.tenantId } },
        from: { aadObjectId: teamsConfig.users[0] }, conversation: { id: 'conversation' },
        recipient: { id: 'bot' }, serviceUrl: 'https://smba.trafficmanager.net/amer/',
        entities: [{ type: 'mention', mentioned: { id: 'bot' }, text: '<at>Frontier</at>' }],
        getConversationReference() { return { serviceUrl: this.serviceUrl, conversation: this.conversation }; },
    };
    assert.equal(isAllowedActivity(activity, teamsConfig), true);
    for (const url of ['http://smba.trafficmanager.net/', 'https://evil.example/', 'https://smba.trafficmanager.net.evil.example/', 'https://user@smba.trafficmanager.net/', 'https://smba.trafficmanager.net:444/']) {
        assert.equal(allowedServiceUrl(url), false);
    }
    await teams.turn({ activity: { ...activity, from: { aadObjectId: 'other' } }, sendActivity: assert.fail });
    assert.equal(messages.length, 0);
    await teams.turn({ activity, sendActivity: async text => replies.push(text) });
    assert.equal(messages[0].text.trim(), 'status');
    await teams.publish(messages[0].destination, 'Running');
    assert.equal(continued.reference.conversation.id, 'conversation');
    assert.equal(replies.at(-1), 'Running');
    await assert.rejects(teams.publish({ reference: { serviceUrl: 'https://evil.example/' } }, 'text'));
});

test('real Teams authentication middleware rejects missing JWT before processing activity', async () => {
    const teams = createTeams(teamsConfig, { handle: assert.fail }, { process: assert.fail });
    const server = createHttpApp({ teams }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/messages`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        });
        assert.equal(response.status, 401);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('health traffic cannot exhaust provider rate limits; webhook bodies are bounded', async () => {
    const server = createHttpApp({ github: { webhook: (_req, res) => res.sendStatus(202) } }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
        for (let count = 0; count < 125; count++) {
            const response = await fetch(`${url}/healthz`);
            assert.equal(response.status, 200);
            await response.text();
        }
        const response = await fetch(`${url}/api/github/webhooks`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        });
        assert.equal(response.status, 202);
        await response.text();
        const oversized = await fetch(`${url}/api/github/webhooks`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(300000),
        });
        assert.equal(oversized.status, 413);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('actual service starts with Teams configured, exposes health, and releases storage on shutdown', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-server-'));
    const config = { directory, agents: ['engineer'], host: '127.0.0.1', port: 0, progressMs: 20, teams: teamsConfig };
    const handle = await start(config);
    try {
        const response = await fetch(`http://127.0.0.1:${handle.server.address().port}/healthz`);
        assert.deepEqual(await response.json(), { status: 'ok' });
    } finally {
        await handle.close();
        assert.equal(fs.existsSync(`${directory}.lock`), false);
        fs.rmSync(directory, { recursive: true });
    }
});

test('server bind failure releases the collaboration lock', async () => {
    const existing = createHttpApp({}).listen(0, '127.0.0.1');
    await new Promise(resolve => existing.once('listening', resolve));
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-bind-'));
    try {
        await assert.rejects(start({ directory, agents: [], host: '127.0.0.1', port: existing.address().port, progressMs: 20 }), /EADDRINUSE/);
        assert.equal(fs.existsSync(`${directory}.lock`), false);
    } finally { await new Promise(resolve => existing.close(resolve)); fs.rmSync(directory, { recursive: true }); }
});

test('shutdown destroys a stalled inbound provider connection within its deadline', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-shutdown-'));
    let entered;
    const processing = new Promise(resolve => { entered = resolve; });
    const handle = await start({ directory, agents: [], host: '127.0.0.1', port: 0, progressMs: 1000, shutdownTimeoutMs: 25 }, {
        teams: {
            authorize: (_req, _res, next) => next(),
            messages: () => { entered(); return new Promise(() => {}); },
        },
    });
    const request = fetch(`http://127.0.0.1:${handle.server.address().port}/api/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }).catch(() => undefined);
    try {
        await processing;
        await handle.close();
        assert.equal(fs.existsSync(`${directory}.lock`), false);
        await request;
    } finally { fs.rmSync(directory, { recursive: true }); }
});

test('Teams connector uses abortable transport deadlines while preserving caller cancellation', async () => {
    const requests = [];
    const connector = { httpClient: { request: async options => { requests.push(options); return {}; } } };
    const original = mock.method(CloudAdapter.prototype, 'createConnectorClientWithIdentity', async () => connector);
    try {
        const adapter = new DeadlineCloudAdapter({ ...teamsConfig, validateIssuer: true });
        const result = await adapter.createConnectorClientWithIdentity({}, {});
        await result.httpClient.request({ method: 'post', url: '/v3/conversations' });
        assert.equal(requests[0].timeout, 8000);
        assert.ok(requests[0].signal instanceof AbortSignal);
        const controller = new AbortController();
        await result.httpClient.request({ method: 'post', url: '/v3/conversations', signal: controller.signal });
        controller.abort();
        assert.equal(requests[1].signal.aborted, true);
    } finally { original.mock.restore(); }
});

test('shutdown during the initial notification never starts an agent after runtime stop', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-stop-race-'));
    let releaseNotification;
    let notifyEntered;
    const entered = new Promise(resolve => { notifyEntered = resolve; });
    const notification = new Promise(resolve => { releaseNotification = resolve; });
    let runs = 0;
    let stopped = false;
    const handle = await start({ directory, agents: ['engineer'], enabled: true, host: '127.0.0.1', port: 0, progressMs: 60000 }, {
        teams: {
            authorize: (_req, _res, next) => next(), messages: (_req, res) => res.sendStatus(200),
            publish: () => { notifyEntered(); return notification; },
        },
        runtime: { run: async () => { runs++; return { ok: true }; }, stop: () => { stopped = true; } },
    });
    try {
        const message = { scope: 'teams:tenant:conversation', actor: 'alice', destination: { provider: 'teams' } };
        const confirmation = handle.service.handle({ ...message, deliveryId: 'one', text: 'run engineer Fix' });
        const nonce = confirmation.match(/confirm ([a-f0-9]{24})/)[1];
        handle.service.handle({ ...message, deliveryId: 'two', text: `confirm ${nonce}` });
        await entered;
        const closing = handle.close();
        assert.equal(stopped, true);
        releaseNotification();
        await closing;
        assert.equal(runs, 0);
        assert.equal(handle.service.state.jobs[0].status, 'interrupted');
    } finally { releaseNotification(); fs.rmSync(directory, { recursive: true }); }
});