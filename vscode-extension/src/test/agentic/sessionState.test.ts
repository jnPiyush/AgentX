import { strict as assert } from 'assert';
import { InMemorySessionStorage, SessionManager } from '../../agentic';

describe('SessionManager', () => {
  it('should create and persist a session', () => {
    const manager = new SessionManager(new InMemorySessionStorage());
    const state = manager.create('engineer', 42);

    const added = manager.addMessage(state.meta.sessionId, {
      role: 'user',
      content: 'Fix bug',
      timestamp: new Date().toISOString(),
    });

    assert.equal(added, true);
    assert.equal(manager.save(state.meta.sessionId), true);

    const loaded = manager.load(state.meta.sessionId);
    assert.ok(loaded);
    assert.equal(loaded?.messages.length, 1);
    assert.equal(loaded?.meta.issueNumber, 42);
  });

  it('should compact when budget threshold is exceeded', () => {
    const manager = new SessionManager(new InMemorySessionStorage());
    const state = manager.create('engineer');

    for (let i = 0; i < 20; i++) {
      manager.addMessage(state.meta.sessionId, {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(200),
        timestamp: new Date().toISOString(),
      });
    }

    const compacted = manager.compact(state.meta.sessionId, 500, 5);
    assert.equal(compacted, true);

    const messages = manager.getMessages(state.meta.sessionId);
    assert.ok(messages.length <= 7, 'should keep system summary + recent messages');
  });
});
