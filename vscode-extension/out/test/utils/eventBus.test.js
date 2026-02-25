"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const eventBus_1 = require("../../utils/eventBus");
describe('AgentEventBus', () => {
    let bus;
    beforeEach(() => {
        bus = new eventBus_1.AgentEventBus();
    });
    afterEach(() => {
        bus.dispose();
    });
    it('should emit and receive events with correct payload', () => {
        const received = [];
        bus.on('agent-started', (e) => received.push(e));
        const event = {
            agent: 'Engineer',
            issueNumber: 42,
            timestamp: Date.now(),
        };
        bus.emit('agent-started', event);
        assert_1.strict.equal(received.length, 1);
        assert_1.strict.equal(received[0].agent, 'Engineer');
        assert_1.strict.equal(received[0].issueNumber, 42);
    });
    it('should support multiple listeners on the same event', () => {
        let count = 0;
        bus.on('agent-started', () => { count++; });
        bus.on('agent-started', () => { count++; });
        bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
        assert_1.strict.equal(count, 2);
    });
    it('should unsubscribe via returned function', () => {
        let count = 0;
        const unsub = bus.on('agent-started', () => { count++; });
        bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
        assert_1.strict.equal(count, 1);
        unsub();
        bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
        assert_1.strict.equal(count, 1, 'should not increment after unsubscribe');
    });
    it('should fire once() listener only once', () => {
        let count = 0;
        bus.once('tool-invoked', () => { count++; });
        const event = {
            agent: 'Engineer',
            tool: 'read_file',
            status: 'done',
            timestamp: Date.now(),
        };
        bus.emit('tool-invoked', event);
        bus.emit('tool-invoked', event);
        assert_1.strict.equal(count, 1);
    });
    it('should record event history', () => {
        bus.emit('agent-started', { agent: 'PM', timestamp: 1 });
        bus.emit('agent-started', { agent: 'Architect', timestamp: 2 });
        const history = bus.getHistory();
        assert_1.strict.equal(history.length, 2);
        assert_1.strict.equal(history[0].event, 'agent-started');
    });
    it('should limit history to maxHistory', () => {
        const smallBus = new eventBus_1.AgentEventBus(3);
        for (let i = 0; i < 5; i++) {
            smallBus.emit('agent-started', { agent: `Agent${i}`, timestamp: i });
        }
        const history = smallBus.getHistory();
        assert_1.strict.equal(history.length, 3);
        smallBus.dispose();
    });
    it('should return correct listenerCount', () => {
        assert_1.strict.equal(bus.listenerCount('agent-started'), 0);
        const unsub = bus.on('agent-started', () => { });
        assert_1.strict.equal(bus.listenerCount('agent-started'), 1);
        unsub();
        assert_1.strict.equal(bus.listenerCount('agent-started'), 0);
    });
    it('should clear specific event listeners', () => {
        bus.on('agent-started', () => { });
        bus.on('agent-error', () => { });
        bus.clear('agent-started');
        assert_1.strict.equal(bus.listenerCount('agent-started'), 0);
        assert_1.strict.equal(bus.listenerCount('agent-error'), 1);
    });
    it('should clear all listeners when no event specified', () => {
        bus.on('agent-started', () => { });
        bus.on('agent-error', () => { });
        bus.clear();
        assert_1.strict.equal(bus.listenerCount('agent-started'), 0);
        assert_1.strict.equal(bus.listenerCount('agent-error'), 0);
    });
    it('should not throw when emitting with no listeners', () => {
        assert_1.strict.doesNotThrow(() => {
            bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
        });
    });
    it('should catch and log listener errors without crashing', () => {
        bus.on('agent-started', () => { throw new Error('test error'); });
        bus.on('agent-started', () => { }); // Second listener should still fire
        assert_1.strict.doesNotThrow(() => {
            bus.emit('agent-started', { agent: 'PM', timestamp: Date.now() });
        });
    });
    it('should clearHistory()', () => {
        bus.emit('agent-started', { agent: 'PM', timestamp: 1 });
        assert_1.strict.equal(bus.getHistory().length, 1);
        bus.clearHistory();
        assert_1.strict.equal(bus.getHistory().length, 0);
    });
    it('should getHistory with limit', () => {
        for (let i = 0; i < 10; i++) {
            bus.emit('agent-started', { agent: `A${i}`, timestamp: i });
        }
        const recent = bus.getHistory(3);
        assert_1.strict.equal(recent.length, 3);
    });
});
//# sourceMappingURL=eventBus.test.js.map