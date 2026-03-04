// ---------------------------------------------------------------------------
// Tests -- Hook Priority System (US-4.5)
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import {
  HookRegistry,
  DEFAULT_HOOK_PRIORITY,
  PrioritizedHook,
  HookChainResult,
} from '../../agentic/hookPriority';

describe('HookPriority (US-4.5)', () => {
  // -----------------------------------------------------------------------
  // Registration and ordering
  // -----------------------------------------------------------------------

  describe('registration', () => {
    it('should register a hook with default priority', () => {
      const registry = new HookRegistry<string>('test');
      registry.register({ name: 'hook1', handler: async () => {} });
      assert.equal(registry.size, 1);
      const hooks = registry.getHooks();
      assert.equal(hooks[0].priority, DEFAULT_HOOK_PRIORITY);
    });

    it('should auto-generate unique IDs', () => {
      const registry = new HookRegistry<string>('test');
      const id1 = registry.register({ name: 'h1', handler: async () => {} });
      const id2 = registry.register({ name: 'h2', handler: async () => {} });
      assert.notEqual(id1, id2);
    });

    it('should use provided ID', () => {
      const registry = new HookRegistry<string>('test');
      const id = registry.register({ id: 'custom-id', name: 'h1', handler: async () => {} });
      assert.equal(id, 'custom-id');
    });

    it('should sort hooks by priority (lower first)', () => {
      const registry = new HookRegistry<string>('test');
      registry.register({ name: 'high', priority: 200, handler: async () => {} });
      registry.register({ name: 'low', priority: 10, handler: async () => {} });
      registry.register({ name: 'mid', priority: 100, handler: async () => {} });

      const hooks = registry.getHooks();
      assert.equal(hooks[0].name, 'low');
      assert.equal(hooks[1].name, 'mid');
      assert.equal(hooks[2].name, 'high');
    });

    it('should overwrite hook with same ID on re-registration', () => {
      const registry = new HookRegistry<string>('test');
      registry.register({ id: 'dup', name: 'v1', handler: async () => {} });
      registry.register({ id: 'dup', name: 'v2', handler: async () => {} });
      assert.equal(registry.size, 1);
      assert.equal(registry.getHooks()[0].name, 'v2');
    });

    it('DEFAULT_HOOK_PRIORITY should be 100', () => {
      assert.equal(DEFAULT_HOOK_PRIORITY, 100);
    });
  });

  // -----------------------------------------------------------------------
  // Unregistration
  // -----------------------------------------------------------------------

  describe('unregister', () => {
    it('should remove hook by ID and return true', () => {
      const registry = new HookRegistry<string>('test');
      const id = registry.register({ name: 'h1', handler: async () => {} });
      assert.equal(registry.unregister(id), true);
      assert.equal(registry.size, 0);
    });

    it('should return false for non-existent ID', () => {
      const registry = new HookRegistry<string>('test');
      assert.equal(registry.unregister('nope'), false);
    });
  });

  // -----------------------------------------------------------------------
  // executeAll
  // -----------------------------------------------------------------------

  describe('executeAll', () => {
    it('should execute hooks in priority order', async () => {
      const order: string[] = [];
      const registry = new HookRegistry<string>('test');

      registry.register({ name: 'C', priority: 300, handler: async () => { order.push('C'); } });
      registry.register({ name: 'A', priority: 10, handler: async () => { order.push('A'); } });
      registry.register({ name: 'B', priority: 50, handler: async () => { order.push('B'); } });

      await registry.executeAll('ctx');
      assert.deepEqual(order, ['A', 'B', 'C']);
    });

    it('should capture hook results', async () => {
      const registry = new HookRegistry<string, number>('test');
      registry.register({ name: 'double', handler: async (ctx) => ctx.length * 2 });
      registry.register({ name: 'triple', handler: async (ctx) => ctx.length * 3 });

      const chain = await registry.executeAll('hi');
      assert.equal(chain.successCount, 2);
      assert.equal(chain.errorCount, 0);
      assert.equal(chain.results[0].result, 4);  // 'hi'.length * 2
      assert.equal(chain.results[1].result, 6);  // 'hi'.length * 3
    });

    it('should continue execution when a hook throws', async () => {
      const order: string[] = [];
      const registry = new HookRegistry<string>('test');

      registry.register({
        name: 'okay1', priority: 10,
        handler: async () => { order.push('okay1'); },
      });
      registry.register({
        name: 'bomb', priority: 20,
        handler: async () => { throw new Error('boom'); },
      });
      registry.register({
        name: 'okay2', priority: 30,
        handler: async () => { order.push('okay2'); },
      });

      const chain = await registry.executeAll('test');
      assert.deepEqual(order, ['okay1', 'okay2']);
      assert.equal(chain.successCount, 2);
      assert.equal(chain.errorCount, 1);
      assert.ok(chain.results[1].error?.message === 'boom');
    });

    it('should return timing information', async () => {
      const registry = new HookRegistry<string>('test');
      registry.register({ name: 'h', handler: async () => {} });

      const chain = await registry.executeAll('x');
      assert.ok(chain.totalDurationMs >= 0);
      assert.ok(chain.results[0].durationMs >= 0);
    });

    it('should handle empty registry', async () => {
      const registry = new HookRegistry<string>('test');
      const chain = await registry.executeAll('x');
      assert.equal(chain.results.length, 0);
      assert.equal(chain.successCount, 0);
      assert.equal(chain.errorCount, 0);
    });
  });

  // -----------------------------------------------------------------------
  // executeUntilResult
  // -----------------------------------------------------------------------

  describe('executeUntilResult', () => {
    it('should return first non-undefined result', async () => {
      const registry = new HookRegistry<string, string>('test');
      registry.register({
        name: 'skip', priority: 10,
        handler: async () => undefined as unknown as string,
      });
      registry.register({
        name: 'winner', priority: 20,
        handler: async () => 'found-it',
      });
      registry.register({
        name: 'never', priority: 30,
        handler: async () => 'too-late',
      });

      const res = await registry.executeUntilResult('ctx');
      assert.equal(res.result, 'found-it');
      assert.equal(res.hookName, 'winner');
    });

    it('should return undefined result when no hook produces a result', async () => {
      const registry = new HookRegistry<string, string>('test');
      registry.register({
        name: 'noop', handler: async () => undefined as unknown as string,
      });

      const res = await registry.executeUntilResult('ctx');
      assert.equal(res.result, undefined);
      assert.equal(res.hookId, undefined);
    });

    it('should skip errored hooks and try next', async () => {
      const registry = new HookRegistry<string, string>('test');
      registry.register({
        name: 'error', priority: 10,
        handler: async () => { throw new Error('oops'); },
      });
      registry.register({
        name: 'ok', priority: 20,
        handler: async () => 'fallback',
      });

      const res = await registry.executeUntilResult('ctx');
      assert.equal(res.result, 'fallback');
      assert.equal(res.hookName, 'ok');
    });
  });

  // -----------------------------------------------------------------------
  // clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all hooks', () => {
      const registry = new HookRegistry<string>('test');
      registry.register({ name: 'a', handler: async () => {} });
      registry.register({ name: 'b', handler: async () => {} });
      assert.equal(registry.size, 2);

      registry.clear();
      assert.equal(registry.size, 0);
    });
  });

  // -----------------------------------------------------------------------
  // Backward compatibility
  // -----------------------------------------------------------------------

  describe('backward compatibility', () => {
    it('existing hooks without priority get default (100)', () => {
      const registry = new HookRegistry<void>('test');
      registry.register({ name: 'legacy', handler: async () => {} });
      const hooks = registry.getHooks();
      assert.equal(hooks[0].priority, 100);
    });

    it('new hooks with explicit priority mix correctly with default', () => {
      const order: string[] = [];
      const registry = new HookRegistry<void>('test');

      // Legacy hook (default priority 100)
      registry.register({
        name: 'legacy', handler: async () => { order.push('legacy'); },
      });
      // New hook with lower priority (runs first)
      registry.register({
        name: 'new-early', priority: 50,
        handler: async () => { order.push('new-early'); },
      });
      // New hook with higher priority (runs last)
      registry.register({
        name: 'new-late', priority: 150,
        handler: async () => { order.push('new-late'); },
      });

      // Verify order
      const hooks = registry.getHooks();
      assert.equal(hooks[0].name, 'new-early');
      assert.equal(hooks[1].name, 'legacy');
      assert.equal(hooks[2].name, 'new-late');
    });
  });
});
