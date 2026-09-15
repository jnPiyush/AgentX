import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { generateKeyPairSync } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { createRuntime } from '../src/runtime.js';

test('configuration fails closed and keeps credentials separate from runner configuration', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-config-'));
    fs.mkdirSync(path.join(directory, '.agentx'));
    fs.writeFileSync(path.join(directory, '.agentx', 'frontier.ps1'), 'exit 0');
    const env = {
        FRONTIER_WORKSPACE_ROOT: directory, FRONTIER_CHANNELS: 'teams',
        FRONTIER_TEAMS_APP_ID: '00000000-0000-0000-0000-000000000001',
        FRONTIER_TEAMS_TENANT_ID: '00000000-0000-0000-0000-000000000002',
        FRONTIER_TEAMS_USERS: '00000000-0000-0000-0000-000000000003',
        FRONTIER_TEAMS_APP_SECRET: 'fixture-value', FRONTIER_TEAMS_CONVERSATIONS: 'conversation',
    };
    try {
        const config = loadConfig(env);
        assert.equal(config.enabled, false);
        assert.equal(config.directory, path.join(directory, '.frontier', 'state', 'collaboration'));
        assert.equal(config.port, 3978);
        assert.throws(() => loadConfig({ ...env, FRONTIER_TEAMS_USERS: '' }), /required/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_TEAMS_APP_ID: 'invalid' }), /UUID/);
        assert.throws(() => loadConfig({ ...env, PORT: 'NaN' }), /range/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_REMOTE_EXECUTION: 'yes' }), /true or false/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_REMOTE_AGENTS: '--help' }), /allowlist/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_CHANNELS: 'unknown' }), /Unsupported/);
    } finally { fs.rmSync(directory, { recursive: true }); }
});

test('runtime uses argument arrays and publishes only recognized progress metadata', async () => {
    const phases = [];
    const child = { stdout: new EventEmitter() };
    let terminated = false;
    const runtime = createRuntime({ repoPath: '/workspace' }, {
        async runFrontierProcess(args, config, hooks) {
            assert.deepEqual(args, ['run', 'engineer', 'Fix; shell syntax stays text']);
            hooks.onChild(child);
            child.stdout.emit('data', Buffer.from('private credential\n Iteration 1/3...\n[SELF-REVIEW] Iteration 1\n[COMPACTION] private content\n'));
            runtime.stop();
            hooks.onChildDone(child);
            return { ok: true };
        },
        terminateProcessTree(value) { assert.equal(value, child); terminated = true; },
    });
    await runtime.run({ agent: 'engineer', instruction: 'Fix; shell syntax stays text' }, phase => phases.push(phase));
    assert.equal(terminated, true);
    assert.deepEqual(phases, ['Agent iteration 1 of 3.', 'Agent self-review in progress.', 'Agent context compaction in progress.']);
});

test('GitHub configuration validates installation, repository, numeric users and RSA credentials', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-github-config-'));
    fs.mkdirSync(path.join(directory, '.agentx'));
    fs.writeFileSync(path.join(directory, '.agentx', 'frontier.ps1'), 'exit 0');
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyFile = path.join(directory, 'app.pem');
    fs.writeFileSync(privateKeyFile, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    const env = {
        FRONTIER_WORKSPACE_ROOT: directory, FRONTIER_CHANNELS: 'github',
        FRONTIER_GITHUB_APP_ID: '1', FRONTIER_GITHUB_INSTALLATION_ID: '42',
        FRONTIER_GITHUB_REPOSITORY: 'Owner/Repo', FRONTIER_GITHUB_USERS: '7,8',
        FRONTIER_GITHUB_PRIVATE_KEY_FILE: privateKeyFile,
        FRONTIER_GITHUB_WEBHOOK_SECRET: 'fixture-value-'.repeat(4),
    };
    try {
        assert.equal(loadConfig(env).github.repository, 'owner/repo');
        assert.throws(() => loadConfig({ ...env, FRONTIER_GITHUB_REPOSITORY: '../oops' }), /repository/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_GITHUB_USERS: 'login' }), /numeric/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_GITHUB_WEBHOOK_SECRET: 'short' }), /32/);
        assert.throws(() => loadConfig({ ...env, FRONTIER_GITHUB_INSTALLATION_ID: '0' }), /range/);
    } finally { fs.rmSync(directory, { recursive: true }); }
});

test('real PowerShell child reports progress and returns a nonzero exit as failure', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-runtime-'));
    fs.mkdirSync(path.join(directory, '.agentx'));
    fs.writeFileSync(path.join(directory, '.agentx', 'frontier.ps1'), 'Write-Output "Iteration 1/2..."\nWrite-Output "private-output"\nexit 2\n');
    const phases = [];
    const runtime = createRuntime({ repoPath: directory, cliRelativePath: '.agentx/frontier.ps1', maxOutputChars: 4000, commandTimeoutMs: 10000 });
    try {
        const result = await runtime.run({ agent: 'engineer', instruction: 'Fixture only' }, phase => phases.push(phase));
        assert.equal(result.ok, false);
        assert.equal(result.exitCode, 2);
        assert.deepEqual(phases, ['Agent iteration 1 of 2.']);
    } finally { runtime.stop(); fs.rmSync(directory, { recursive: true }); }
});