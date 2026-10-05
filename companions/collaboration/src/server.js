import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { CollaborationService } from './service.js';
import { createRuntime } from './runtime.js';
import { createGitHub } from './github.js';
import { createTeams } from './teams.js';

export function createHttpApp({ github, teams }) {
    const app = express();
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
    const limit = () => rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });
    if (github) app.post('/api/github/webhooks', limit(), express.raw({ type: 'application/json', limit: '256kb' }), (req, res) => github.webhook(req, res));
    if (teams) app.post('/api/messages', limit(), express.json({ limit: '32kb' }), teams.authorize, (req, res) => teams.messages(req, res));
    app.use((error, _req, res, _next) => {
        if (!res.headersSent) res.sendStatus(error.status === 413 ? 413 : error.status === 400 ? 400 : 500);
    });
    return app;
}

async function withDeadline(promise, timeoutMs, message) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
        ]);
    } finally { clearTimeout(timer); }
}

export async function start(config = loadConfig(), { runtime: injectedRuntime, teams: injectedTeams, githubApp } = {}) {
    const runtime = injectedRuntime || createRuntime(config);
    const shutdownTimeoutMs = config.shutdownTimeoutMs || 10000;
    const log = config.log || console.error;
    let service;
    let teams;
    let github;
    let server;
    let timer;
    let publishing;
    let closing;
    const close = () => {
        if (closing) return closing;
        clearInterval(timer);
        if (service) service.stopping = true;
        const closed = new Promise((resolve, reject) => {
            if (!server) return resolve();
            server.close(error => {
                if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
                else resolve();
            });
        });
        const deadline = setTimeout(() => server?.closeAllConnections(), shutdownTimeoutMs);
        let stopped;
        try { stopped = Promise.resolve(runtime.stop()); }
        catch (error) { stopped = Promise.reject(error); }
        closing = Promise.allSettled([
            withDeadline(stopped, shutdownTimeoutMs, 'Runtime termination was not confirmed before the shutdown deadline.'),
            withDeadline(closed, shutdownTimeoutMs + 1000, 'HTTP listener did not close before the shutdown deadline.'),
        ]).then(async results => {
            const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
            if (errors.length) throw new AggregateError(errors, 'Shutdown failed; collaboration storage ownership was retained.');
            await withDeadline(Promise.all([publishing, service?.close()]),
                shutdownTimeoutMs + (service?.publicationTimeoutMs || 0), 'Collaboration shutdown did not finish before the deadline.');
        }).finally(() => {
            clearTimeout(deadline);
            server?.closeAllConnections();
        });
        return closing;
    };
    const onFatal = () => close().catch(() => log('collaboration shutdown_failed verify_runtime_and_storage'));
    try {
        service = new CollaborationService({
            ...config, run: runtime.run,
            publish: (destination, text) => (destination.provider === 'teams' ? teams : github).publish(destination, text),
            onFatal,
        });
        teams = injectedTeams || (config.teams ? createTeams(config.teams, service) : undefined);
        github = config.github ? createGitHub(config.github, service, githubApp) : undefined;
        const app = createHttpApp({ teams, github });
        server = app.listen(config.port, config.host);
        await new Promise((resolve, reject) => {
            const listening = () => { server.removeListener('error', failed); resolve(); };
            const failed = error => { server.removeListener('listening', listening); reject(error); };
            server.once('listening', listening);
            server.once('error', failed);
        });
        if (service.stopping) throw new Error('Service stopped during startup.');
        server.on('error', () => service.halt('collaboration listener_failed execution_stopped'));
        server.requestTimeout = 15000;
        server.headersTimeout = 10000;
        timer = setInterval(() => {
            if (publishing) return;
            publishing = service.publishRunning().catch(() => {
                service.halt('collaboration progress_publication_failed execution_stopped');
            }).finally(() => { publishing = undefined; });
        }, config.progressMs);
        console.log(`Frontier collaboration listening on http://${config.host}:${server.address().port}`);
        return { server, service, close };
    } catch (error) {
        try { await close(); }
        catch (shutdownError) { throw new AggregateError([error, shutdownError], 'Startup failed and shutdown did not complete. Check local storage ownership.'); }
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    start().then(handle => {
        let closing = false;
        const close = () => {
            if (closing) return;
            closing = true;
            handle.close().catch(() => {
                console.error('Shutdown failed. Runtime termination or storage release was not confirmed; inspect local processes before restarting.');
                process.exitCode = 1;
            });
        };
        process.once('SIGINT', close);
        process.once('SIGTERM', close);
    }).catch(() => {
        console.error('Startup failed. Check required configuration, app credentials and the collaboration lock.');
        process.exitCode = 1;
    });
}