"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const channelRouter_1 = require("../../utils/channelRouter");
const eventBus_1 = require("../../utils/eventBus");
describe('ChannelRouter', () => {
    let router;
    let bus;
    beforeEach(() => {
        bus = new eventBus_1.AgentEventBus();
        router = new channelRouter_1.ChannelRouter(bus);
    });
    afterEach(() => {
        router.stopAll();
        bus.dispose();
    });
    it('should register and list channels', () => {
        router.register(new channelRouter_1.VsCodeChatChannel());
        router.register(new channelRouter_1.CliChannel());
        const ids = router.getChannelIds();
        assert_1.strict.ok(ids.includes('vsc'));
        assert_1.strict.ok(ids.includes('cli'));
        assert_1.strict.equal(ids.length, 2);
    });
    it('should get channel by ID', () => {
        const vsc = new channelRouter_1.VsCodeChatChannel();
        router.register(vsc);
        const found = router.getChannel('vsc');
        assert_1.strict.equal(found, vsc);
        assert_1.strict.equal(router.getChannel('nonexistent'), undefined);
    });
    it('should route messages based on prefix', async () => {
        router.register(new channelRouter_1.VsCodeChatChannel());
        router.register(new channelRouter_1.CliChannel());
        // Should not throw even though send is a no-op for these channels
        await router.send('vsc:main', { content: 'hello' });
        await router.send('cli:terminal', { content: 'hello' });
    });
    it('should emit channel-message events on send', async () => {
        const events = [];
        bus.on('channel-message', (e) => events.push(e));
        router.register(new channelRouter_1.VsCodeChatChannel());
        await router.send('vsc:main', { content: 'test' });
        assert_1.strict.equal(events.length, 1);
    });
    it('should forward inbound messages from channels', () => {
        const received = [];
        router.onMessage((msg) => received.push(msg));
        const vsc = new channelRouter_1.VsCodeChatChannel();
        router.register(vsc);
        vsc.receiveMessage({
            id: '1',
            channelId: 'vsc',
            sender: 'user',
            content: 'hello agent',
            timestamp: Date.now(),
        });
        assert_1.strict.equal(received.length, 1);
        assert_1.strict.equal(received[0].content, 'hello agent');
    });
    it('should emit inbound channel-message events', () => {
        const events = [];
        bus.on('channel-message', (e) => events.push(e));
        const vsc = new channelRouter_1.VsCodeChatChannel();
        router.register(vsc);
        vsc.receiveMessage({
            id: '1',
            channelId: 'vsc',
            sender: 'user',
            content: 'hello',
            timestamp: Date.now(),
        });
        assert_1.strict.equal(events.length, 1);
    });
    it('should unregister a channel', () => {
        router.register(new channelRouter_1.VsCodeChatChannel());
        assert_1.strict.ok(router.getChannelIds().includes('vsc'));
        router.unregister('vsc');
        assert_1.strict.ok(!router.getChannelIds().includes('vsc'));
    });
    it('should fall back to first channel when no prefix', async () => {
        router.register(new channelRouter_1.VsCodeChatChannel());
        // groupId without colon should resolve to 'vsc' (default) or first
        await router.send('main', { content: 'test' });
        // Just confirm no errors thrown
    });
    it('should handle send to unknown channel gracefully', async () => {
        // No console.warn assertion, just ensure no crash
        await router.send('unknown:group', { content: 'test' });
    });
});
describe('VsCodeChatChannel', () => {
    it('should report active state', async () => {
        const ch = new channelRouter_1.VsCodeChatChannel();
        assert_1.strict.equal(ch.id, 'vsc');
        assert_1.strict.equal(ch.name, 'VS Code Chat');
        assert_1.strict.equal(ch.isActive(), true);
        await ch.start();
        assert_1.strict.equal(ch.isActive(), true);
        ch.stop();
        assert_1.strict.equal(ch.isActive(), false);
    });
});
describe('CliChannel', () => {
    it('should report active state', async () => {
        const ch = new channelRouter_1.CliChannel();
        assert_1.strict.equal(ch.id, 'cli');
        assert_1.strict.equal(ch.name, 'CLI Terminal');
        assert_1.strict.equal(ch.isActive(), true);
        ch.stop();
        assert_1.strict.equal(ch.isActive(), false);
    });
});
describe('GitHubIssueChannel', () => {
    it('should report inactive since not yet implemented', async () => {
        const ch = new channelRouter_1.GitHubIssueChannel();
        assert_1.strict.equal(ch.id, 'gh');
        assert_1.strict.equal(ch.isActive(), false);
        await ch.start();
        assert_1.strict.equal(ch.isActive(), false); // Still inactive -- stub
    });
});
//# sourceMappingURL=channelRouter.test.js.map