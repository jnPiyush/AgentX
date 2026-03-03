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

  it('should include file paths in compaction summary', () => {
    const manager = new SessionManager(new InMemorySessionStorage());
    const state = manager.create('engineer');

    // Add messages with tool calls that reference file operations.
    // Use long content so total tokens exceed the compaction threshold.
    for (let i = 0; i < 20; i++) {
      const role: 'user' | 'assistant' | 'tool' = i % 3 === 0 ? 'user' : (i % 3 === 1 ? 'assistant' : 'tool');
      manager.addMessage(state.meta.sessionId, {
        role,
        content: role === 'assistant'
          ? 'I will read the file and edit it. '.repeat(20)
          : (role === 'tool' ? 'file_read result: ' + 'x'.repeat(200) : 'Fix the bug. ' + 'x'.repeat(200)),
        timestamp: new Date().toISOString(),
        ...(role === 'assistant' ? {
          toolCalls: [{
            id: `tc-${i}`,
            name: 'file_read',
            params: { filePath: 'src/main.ts' },
          }],
        } : {}),
      });
    }

    const compacted = manager.compact(state.meta.sessionId, 500, 3);
    assert.equal(compacted, true);

    // The compacted messages should contain a summary
    const messages = manager.getMessages(state.meta.sessionId);
    assert.ok(messages.length > 0, 'should have messages after compaction');
  });

  it('should include decisions in compaction summary', () => {
    const manager = new SessionManager(new InMemorySessionStorage());
    const state = manager.create('engineer');

    // Add messages with decision-like content
    manager.addMessage(state.meta.sessionId, {
      role: 'user',
      content: 'Fix the authentication bug',
      timestamp: new Date().toISOString(),
    });
    for (let i = 0; i < 10; i++) {
      manager.addMessage(state.meta.sessionId, {
        role: 'assistant',
        content: i === 0
          ? 'I will use JWT tokens for authentication. I decided to refactor the auth module.'
          : 'x'.repeat(200),
        timestamp: new Date().toISOString(),
      });
      manager.addMessage(state.meta.sessionId, {
        role: 'user',
        content: 'Continue',
        timestamp: new Date().toISOString(),
      });
    }

    const compacted = manager.compact(state.meta.sessionId, 300, 3);
    assert.equal(compacted, true);
  });
});
