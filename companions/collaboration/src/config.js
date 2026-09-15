import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey } from 'node:crypto';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function loadConfig(env = process.env) {
    const required = name => {
        if (!env[name]?.trim()) throw new Error(`${name} is required.`);
        return env[name].trim();
    };
    const list = name => {
        const values = [...new Set(required(name).split(',').map(value => value.trim()).filter(Boolean))];
        if (!values.length) throw new Error(`${name} must not be empty.`);
        return values;
    };
    const integer = (name, fallback, minimum, maximum) => {
        const value = env[name] === undefined ? fallback : Number(env[name]);
        if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${name} is out of range.`);
        return value;
    };
    const uuid = name => {
        const value = required(name).toLowerCase();
        if (!UUID.test(value)) throw new Error(`${name} must be a UUID.`);
        return value;
    };
    const channels = list('FRONTIER_CHANNELS');
    if (channels.some(channel => !['teams', 'github'].includes(channel))) throw new Error('Unsupported FRONTIER_CHANNELS value.');
    const repoPath = fs.realpathSync(required('FRONTIER_WORKSPACE_ROOT'));
    const cliRelativePath = env.FRONTIER_CLI_PATH || '.agentx/frontier.ps1';
    const cliPath = fs.realpathSync(path.resolve(repoPath, cliRelativePath));
    const relative = path.relative(repoPath, cliPath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(cliPath).isFile()) throw new Error('CLI must be a file inside the workspace.');
    const agents = (env.FRONTIER_REMOTE_AGENTS || 'engineer,reviewer').split(',').map(value => value.trim());
    if (!agents.length || agents.some(agent => !/^[a-z][a-z0-9-]{0,63}$/.test(agent))) throw new Error('Invalid remote agent allowlist.');
    if (env.FRONTIER_REMOTE_EXECUTION && !['true', 'false'].includes(env.FRONTIER_REMOTE_EXECUTION)) throw new Error('FRONTIER_REMOTE_EXECUTION must be true or false.');
    const config = {
        channels, repoPath, cliRelativePath, agents,
        enabled: env.FRONTIER_REMOTE_EXECUTION === 'true',
        directory: path.join(repoPath, '.frontier', 'state', 'collaboration'),
        host: env.FRONTIER_BIND_HOST || '127.0.0.1',
        port: integer('PORT', 3978, 1, 65535),
        progressMs: integer('FRONTIER_PROGRESS_MS', 30000, 5000, 300000),
        commandTimeoutMs: integer('FRONTIER_RUN_TIMEOUT_MS', 900000, 1000, 3600000),
        maxOutputChars: 256000,
    };
    if (channels.includes('github')) {
        const repository = required('FRONTIER_GITHUB_REPOSITORY').toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/.test(repository)
            || ['.', '..'].includes(repository.split('/')[1])) throw new Error('Invalid GitHub repository.');
        const users = list('FRONTIER_GITHUB_USERS');
        if (users.some(user => !/^[1-9][0-9]*$/.test(user))) throw new Error('GitHub users must be numeric account IDs.');
        const privateKey = fs.readFileSync(required('FRONTIER_GITHUB_PRIVATE_KEY_FILE'), 'utf8');
        if (createPrivateKey(privateKey).asymmetricKeyType !== 'rsa') throw new Error('GitHub App requires an RSA private key.');
        const webhookSecret = required('FRONTIER_GITHUB_WEBHOOK_SECRET');
        if (webhookSecret.length < 32) throw new Error('GitHub webhook secret must be at least 32 characters.');
        config.github = {
            repository, users, privateKey, webhookSecret,
            appId: integer('FRONTIER_GITHUB_APP_ID', 0, 1, Number.MAX_SAFE_INTEGER),
            installationId: integer('FRONTIER_GITHUB_INSTALLATION_ID', 0, 1, Number.MAX_SAFE_INTEGER),
        };
    }
    if (channels.includes('teams')) {
        const users = list('FRONTIER_TEAMS_USERS').map(user => user.toLowerCase());
        if (users.some(user => !UUID.test(user))) throw new Error('Teams users must be Entra object IDs.');
        config.teams = {
            clientId: uuid('FRONTIER_TEAMS_APP_ID'),
            tenantId: uuid('FRONTIER_TEAMS_TENANT_ID'),
            clientSecret: required('FRONTIER_TEAMS_APP_SECRET'),
            users, conversations: list('FRONTIER_TEAMS_CONVERSATIONS'),
        };
    }
    return config;
}