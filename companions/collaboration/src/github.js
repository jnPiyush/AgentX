import { App } from '@octokit/app';
import { Webhooks } from '@octokit/webhooks';

export function createGitHub(config, service, injectedApp) {
    const app = injectedApp || new App({ appId: config.appId, privateKey: config.privateKey });
    const verifier = new Webhooks({ secret: config.webhookSecret });
    const [owner, repo] = config.repository.split('/');
    const octokit = () => app.getInstallationOctokit(config.installationId);
    const request = async (route, parameters) => (await octokit()).request(route, {
        owner, repo, ...parameters, request: { timeout: 8000 },
    });
    return {
        async receive(payload) {
            if (payload.action !== 'created' || payload.comment?.user?.type !== 'User'
                || !/^\/frontier(?:\s|$)/i.test(payload.comment.body || '')) return;
            if (payload.repository?.full_name?.toLowerCase() !== config.repository
                || payload.installation?.id !== config.installationId
                || !config.users.includes(String(payload.sender?.id))
                || payload.comment.user.id !== payload.sender.id) throw new Error('Forbidden');
            if (!Number.isSafeInteger(payload.issue?.number) || payload.issue.number <= 0
                || !Number.isSafeInteger(payload.comment.id) || payload.comment.id <= 0) throw new Error('Invalid event');
            const age = Date.now() - Date.parse(payload.comment.created_at);
            if (!Number.isFinite(age) || age < -300000 || age > 86400000) throw new Error('Expired event');
            const permission = await request('GET /repos/{owner}/{repo}/collaborators/{username}/permission', { username: payload.sender.login });
            if (!['admin', 'maintain', 'write'].includes(permission.data.permission)) throw new Error('Forbidden');
            const destination = { provider: 'github', issue: payload.issue.number };
            let reply;
            try {
                reply = service.handle({
                    scope: `github:${config.installationId}:${config.repository}:${payload.issue.number}`,
                    actor: String(payload.sender.id), deliveryId: String(payload.comment.id),
                    destination, text: payload.comment.body,
                });
            } catch {
                reply = 'Command rejected. Use /frontier help; confirm the agent, job ID and service capacity.';
            }
            await this.publish(destination, reply);
        },
        async publish(destination, text) {
            await request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
                issue_number: destination.issue, body: text,
            });
        },
        async webhook(req, res) {
            const signature = req.get('x-hub-signature-256');
            if (!Buffer.isBuffer(req.body) || !/^sha256=[a-f0-9]{64}$/i.test(signature || '')) return res.sendStatus(401);
            const body = req.body.toString('utf8');
            if (!await verifier.verify(body, signature)) return res.sendStatus(401);
            if (req.get('x-github-event') !== 'issue_comment') return res.sendStatus(202);
            let payload;
            try { payload = JSON.parse(body); } catch { return res.sendStatus(400); }
            try {
                await this.receive(payload);
                return res.sendStatus(202);
            } catch (error) {
                return res.sendStatus(error.message === 'Forbidden' ? 403 : error.message === 'Invalid event' || error.message === 'Expired event' ? 400 : 503);
            }
        },
    };
}