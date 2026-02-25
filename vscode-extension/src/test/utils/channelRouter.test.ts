import { strict as assert } from 'assert';
import {
  ChannelRouter,
  VsCodeChatChannel,
  CliChannel,
  GitHubIssueChannel,
} from '../../utils/channelRouter';
import type { ChannelMessage, ChannelResponse } from '../../utils/channelRouter';
import { AgentEventBus } from '../../utils/eventBus';

describe('ChannelRouter', () => {

  let router: ChannelRouter;
  let bus: AgentEventBus;

  beforeEach(() => {
    bus = new AgentEventBus();
    router = new ChannelRouter(bus);
  });

  afterEach(() => {
    router.stopAll();
    bus.dispose();
  });

  it('should register and list channels', () => {
    router.register(new VsCodeChatChannel());
    router.register(new CliChannel());

    const ids = router.getChannelIds();
    assert.ok(ids.includes('vsc'));
    assert.ok(ids.includes('cli'));
    assert.equal(ids.length, 2);
  });

  it('should get channel by ID', () => {
    const vsc = new VsCodeChatChannel();
    router.register(vsc);

    const found = router.getChannel('vsc');
    assert.equal(found, vsc);
    assert.equal(router.getChannel('nonexistent'), undefined);
  });

  it('should route messages based on prefix', async () => {
    router.register(new VsCodeChatChannel());
    router.register(new CliChannel());

    // Should not throw even though send is a no-op for these channels
    await router.send('vsc:main', { content: 'hello' });
    await router.send('cli:terminal', { content: 'hello' });
  });

  it('should emit channel-message events on send', async () => {
    const events: unknown[] = [];
    bus.on('channel-message', (e) => events.push(e));

    router.register(new VsCodeChatChannel());
    await router.send('vsc:main', { content: 'test' });

    assert.equal(events.length, 1);
  });

  it('should forward inbound messages from channels', () => {
    const received: ChannelMessage[] = [];
    router.onMessage((msg) => received.push(msg));

    const vsc = new VsCodeChatChannel();
    router.register(vsc);

    vsc.receiveMessage({
      id: '1',
      channelId: 'vsc',
      sender: 'user',
      content: 'hello agent',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].content, 'hello agent');
  });

  it('should emit inbound channel-message events', () => {
    const events: unknown[] = [];
    bus.on('channel-message', (e) => events.push(e));

    const vsc = new VsCodeChatChannel();
    router.register(vsc);

    vsc.receiveMessage({
      id: '1',
      channelId: 'vsc',
      sender: 'user',
      content: 'hello',
      timestamp: Date.now(),
    });

    assert.equal(events.length, 1);
  });

  it('should unregister a channel', () => {
    router.register(new VsCodeChatChannel());
    assert.ok(router.getChannelIds().includes('vsc'));

    router.unregister('vsc');
    assert.ok(!router.getChannelIds().includes('vsc'));
  });

  it('should fall back to first channel when no prefix', async () => {
    router.register(new VsCodeChatChannel());
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
    const ch = new VsCodeChatChannel();
    assert.equal(ch.id, 'vsc');
    assert.equal(ch.name, 'VS Code Chat');
    assert.equal(ch.isActive(), true);

    await ch.start();
    assert.equal(ch.isActive(), true);

    ch.stop();
    assert.equal(ch.isActive(), false);
  });
});

describe('CliChannel', () => {

  it('should report active state', async () => {
    const ch = new CliChannel();
    assert.equal(ch.id, 'cli');
    assert.equal(ch.name, 'CLI Terminal');
    assert.equal(ch.isActive(), true);

    ch.stop();
    assert.equal(ch.isActive(), false);
  });
});

describe('GitHubIssueChannel', () => {

  it('should report inactive since not yet implemented', async () => {
    const ch = new GitHubIssueChannel();
    assert.equal(ch.id, 'gh');
    assert.equal(ch.isActive(), false);

    await ch.start();
    assert.equal(ch.isActive(), false); // Still inactive -- stub
  });
});
