import { strict as assert } from 'assert';
import { AgentEventBus } from '../../utils/eventBus';
import type { AgentStartedEvent, ThinkingLogEvent, ToolInvokedEvent } from '../../utils/eventBus';

describe('AgentEventBus', () => {

  let bus: AgentEventBus;

  beforeEach(() => {
    bus = new AgentEventBus();
  });

  afterEach(() => {
    bus.dispose();
  });

  it('should emit and receive events with correct payload', () => {
    const received: AgentStartedEvent[] = [];
    bus.on('agent-started', (e) => received.push(e));

    const event: AgentStartedEvent = {
      agent: 'Engineer',
      issueNumber: 42,
      timestamp: Date.now(),
    };
    bus.emit('agent-started', event);

    assert.equal(received.length, 1);
    assert.equal(received[0].agent, 'Engineer');
    assert.equal(received[0].issueNumber, 42);
  });

  it('should support multiple listeners on the same event', () => {
    let count = 0;
    bus.on('agent-started', () => { count++; });
    bus.on('agent-started', () => { count++; });

    bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });

    assert.equal(count, 2);
  });

  it('should unsubscribe via returned function', () => {
    let count = 0;
    const unsub = bus.on('agent-started', () => { count++; });

    bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
    assert.equal(count, 1);

    unsub();
    bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
    assert.equal(count, 1, 'should not increment after unsubscribe');
  });

  it('should fire once() listener only once', () => {
    let count = 0;
    bus.once('tool-invoked', () => { count++; });

    const event: ToolInvokedEvent = {
      agent: 'Engineer',
      tool: 'read_file',
      status: 'done',
      timestamp: Date.now(),
    };

    bus.emit('tool-invoked', event);
    bus.emit('tool-invoked', event);

    assert.equal(count, 1);
  });

  it('should record event history', () => {
    bus.emit('agent-started', { agent: 'PM', timestamp: 1 });
    bus.emit('agent-started', { agent: 'Architect', timestamp: 2 });

    const history = bus.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].event, 'agent-started');
  });

  it('should limit history to maxHistory', () => {
    const smallBus = new AgentEventBus(3);
    for (let i = 0; i < 5; i++) {
      smallBus.emit('agent-started', { agent: `Agent${i}`, timestamp: i });
    }

    const history = smallBus.getHistory();
    assert.equal(history.length, 3);
    smallBus.dispose();
  });

  it('should return correct listenerCount', () => {
    assert.equal(bus.listenerCount('agent-started'), 0);
    const unsub = bus.on('agent-started', () => {});
    assert.equal(bus.listenerCount('agent-started'), 1);
    unsub();
    assert.equal(bus.listenerCount('agent-started'), 0);
  });

  it('should clear specific event listeners', () => {
    bus.on('agent-started', () => {});
    bus.on('agent-error', () => {});

    bus.clear('agent-started');
    assert.equal(bus.listenerCount('agent-started'), 0);
    assert.equal(bus.listenerCount('agent-error'), 1);
  });

  it('should clear all listeners when no event specified', () => {
    bus.on('agent-started', () => {});
    bus.on('agent-error', () => {});

    bus.clear();
    assert.equal(bus.listenerCount('agent-started'), 0);
    assert.equal(bus.listenerCount('agent-error'), 0);
  });

  it('should not throw when emitting with no listeners', () => {
    assert.doesNotThrow(() => {
      bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
    });
  });

  it('should catch and log listener errors without crashing', () => {
    bus.on('agent-started', () => { throw new Error('test error'); });
    bus.on('agent-started', () => {}); // Second listener should still fire

    assert.doesNotThrow(() => {
      bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
    });
  });

  it('should clearHistory()', () => {
    bus.emit('agent-started', { agent: 'PM', timestamp: 1 });
    assert.equal(bus.getHistory().length, 1);
    bus.clearHistory();
    assert.equal(bus.getHistory().length, 0);
  });

  it('should getHistory with limit', () => {
    for (let i = 0; i < 10; i++) {
      bus.emit('agent-started', { agent: `A${i}`, timestamp: i });
    }
    const recent = bus.getHistory(3);
    assert.equal(recent.length, 3);
  });
});
