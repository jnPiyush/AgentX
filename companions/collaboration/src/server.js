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

export async function start(config = loadConfig(), { runtime: injectedRuntime, teams: injectedTeams } = {}) {
    const runtime = injectedRuntime || createRuntime(config);
    let teams;
    let github;
    let server;
    let timer;
    const service = new CollaborationService({
        ...config, run: runtime.run,
        publish: (destination, text) => (destination.provider === 'teams' ? teams : github).publish(destination, text),
        onFatal: () => {
            runtime.stop();
            clearInterval(timer);
            if (server) { server.close(); server.closeAllConnections(); }
        },
    });
    try {
        teams = injectedTeams || (config.teams ? createTeams(config.teams, service) : undefined);
        github = config.github ? createGitHub(config.github, service) : undefined;
        const app = createHttpApp({ teams, github });
        server = await new Promise((resolve, reject) => {
            const listener = app.listen(config.port, config.host);
            listener.once('listening', () => resolve(listener));
            listener.once('error', reject);
        });
        server.requestTimeout = 15000;
        server.headersTimeout = 10000;
        let publishing;
        timer = setInterval(() => {
            if (publishing) return;
            publishing = service.publishRunning().catch(() => {
                console.error('Progress persistence failed.');
            }).finally(() => { publishing = undefined; });
        }, config.progressMs);
        console.log(`Frontier collaboration listening on http://${config.host}:${server.address().port}`);
        return {
            server, service,
            async close() {
                clearInterval(timer);
                service.stopping = true;
                const closed = new Promise(resolve => server.close(resolve));
                const deadline = setTimeout(() => server.closeAllConnections(), config.shutdownTimeoutMs || 10000);
                runtime.stop();
                try {
                    await publishing;
                    await service.close();
                    await closed;
                } finally { clearTimeout(deadline); }
            },
        };
    } catch (error) {
        clearInterval(timer);
        runtime.stop();
        await service.close();
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    start().then(handle => {
        let closing = false;
        const close = async () => {
            if (closing) return;
            closing = true;
            await handle.close();
        };
        process.once('SIGINT', close);
        process.once('SIGTERM', close);
    }).catch(() => {
        console.error('Startup failed. Check required configuration, app credentials and the collaboration lock.');
        process.exitCode = 1;
    });
}