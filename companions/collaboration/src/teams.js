import { CloudAdapter, authorizeJWT } from '@microsoft/agents-hosting';

export class DeadlineCloudAdapter extends CloudAdapter {
    async createConnectorClientWithIdentity(...args) {
        const connector = await super.createConnectorClientWithIdentity(...args);
        const request = connector.httpClient.request.bind(connector.httpClient);
        connector.httpClient.request = options => request({
            ...options, timeout: 8000,
            signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
        });
        return connector;
    }
}

export function allowedServiceUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
            && (url.hostname === 'smba.trafficmanager.net' || url.hostname === 'smba.infra.teams.microsoft.com');
    } catch { return false; }
}

export function isAllowedActivity(activity, config) {
    return activity?.channelId === 'msteams'
        && activity.channelData?.tenant?.id?.toLowerCase() === config.tenantId
        && config.users.includes(activity.from?.aadObjectId?.toLowerCase())
        && config.conversations.includes(activity.conversation?.id)
        && allowedServiceUrl(activity.serviceUrl);
}

export function createTeams(config, service, injectedAdapter) {
    const auth = {
        clientId: config.clientId, tenantId: config.tenantId, clientSecret: config.clientSecret,
        validateIssuer: true, issuers: ['https://api.botframework.com'],
    };
    const adapter = injectedAdapter || new DeadlineCloudAdapter(auth, undefined, undefined,
        { validateServiceUrl: true, emitStackTrace: false }, { enabled: true, isAllowed: allowedServiceUrl });
    adapter.onTurnError = async context => { await context.sendActivity('Command failed. Check the local companion service.'); };
    const authorize = authorizeJWT(auth);
    const turn = async context => {
        const activity = context.activity;
        if (!isAllowedActivity(activity, config) || activity.type !== 'message') return;
        if (!activity.id || typeof activity.text !== 'string' || activity.text.length > 4500) return;
        const age = Date.now() - Date.parse(activity.timestamp);
        if (!Number.isFinite(age) || age < -300000 || age > 86400000) return;
        let text = activity.text;
        for (const entity of activity.entities || []) {
            if (entity.type === 'mention' && entity.mentioned?.id === activity.recipient?.id && entity.text) text = text.replace(entity.text, '');
        }
        const reference = activity.getConversationReference();
        let reply;
        try {
            reply = service.handle({
                scope: `teams:${config.tenantId}:${activity.conversation.id}`,
                actor: activity.from.aadObjectId.toLowerCase(), deliveryId: activity.id,
                destination: { provider: 'teams', reference }, text,
            });
        } catch {
            reply = 'Command rejected. Send help; confirm the agent, job ID and service capacity.';
        }
        await context.sendActivity(reply);
    };
    return {
        authorize, turn,
        async messages(req, res) {
            if (!isAllowedActivity(req.body, config)) return res.sendStatus(403);
            return adapter.process(req, res, turn);
        },
        async publish(destination, text) {
            if (!allowedServiceUrl(destination.reference?.serviceUrl)
                || !config.conversations.includes(destination.reference?.conversation?.id)) throw new Error('Forbidden destination');
            await adapter.continueConversation(config.clientId, destination.reference, async context => {
                await context.sendActivity(text);
            });
        },
    };
}