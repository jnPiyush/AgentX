// ---------------------------------------------------------------------------
// Tests -- Timing Utilities (US-3.2)
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import { time, timeSync, TimedResult, TimingLogger } from '../../utils/timingUtils';

describe('TimingUtils (US-3.2)', () => {
  // -----------------------------------------------------------------------
  // time() - async
  // -----------------------------------------------------------------------

  describe('time() async', () => {
    it('should return result and positive durationMs', async () => {
      const { result, durationMs, label } = await time('test-op', async () => 42);
      assert.equal(result, 42);
      assert.ok(durationMs >= 0, `durationMs should be >= 0, got ${durationMs}`);
      assert.equal(label, 'test-op');
    });

    it('should include ISO startedAt timestamp', async () => {
      const { startedAt } = await time('ts-test', async () => 'hello');
      // Should be a valid ISO string
      const parsed = new Date(startedAt);
      assert.ok(!isNaN(parsed.getTime()), `startedAt should be valid ISO, got: ${startedAt}`);
    });

    it('should measure non-trivial async operations', async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const { durationMs } = await time('delay', async () => {
        await delay(50);
        return 'done';
      });
      assert.ok(durationMs >= 30, `Expected >= 30ms for 50ms delay, got ${durationMs}`);
    });

    it('should propagate errors from async functions', async () => {
      await assert.rejects(
        () => time('failing', async () => { throw new Error('boom'); }),
        { message: 'boom' },
      );
    });

    it('should log success to TimingLogger', async () => {
      const logs: { message: string; metadata?: Record<string, unknown> }[] = [];
      const logger: TimingLogger = {
        log(message, metadata) { logs.push({ message, metadata }); },
      };

      await time('op', async () => 'ok', logger);

      assert.equal(logs.length, 1);
      assert.ok(logs[0].message.includes('[TIMING] op'));
      assert.equal(logs[0].metadata?.status, 'success');
      assert.equal(logs[0].metadata?.label, 'op');
      assert.ok(typeof logs[0].metadata?.durationMs === 'number');
    });

    it('should log error to TimingLogger when function throws', async () => {
      const logs: { message: string; metadata?: Record<string, unknown> }[] = [];
      const logger: TimingLogger = {
        log(message, metadata) { logs.push({ message, metadata }); },
      };

      try {
        await time('fail-op', async () => { throw new Error('oops'); }, logger);
      } catch {
        // expected
      }

      assert.equal(logs.length, 1);
      assert.ok(logs[0].message.includes('(error)'));
      assert.equal(logs[0].metadata?.status, 'error');
      assert.equal(logs[0].metadata?.error, 'oops');
    });

    it('should work without logger', async () => {
      const { result } = await time('no-logger', async () => 123);
      assert.equal(result, 123);
    });
  });

  // -----------------------------------------------------------------------
  // timeSync() - sync
  // -----------------------------------------------------------------------

  describe('timeSync() sync', () => {
    it('should return result and positive durationMs', () => {
      const { result, durationMs, label } = timeSync('sync-op', () => 'hello');
      assert.equal(result, 'hello');
      assert.ok(durationMs >= 0);
      assert.equal(label, 'sync-op');
    });

    it('should include ISO startedAt timestamp', () => {
      const { startedAt } = timeSync('ts', () => null);
      const parsed = new Date(startedAt);
      assert.ok(!isNaN(parsed.getTime()));
    });

    it('should propagate errors from sync functions', () => {
      assert.throws(
        () => timeSync('fail', () => { throw new Error('sync-boom'); }),
        { message: 'sync-boom' },
      );
    });

    it('should log success to TimingLogger', () => {
      const logs: { message: string; metadata?: Record<string, unknown> }[] = [];
      const logger: TimingLogger = {
        log(message, metadata) { logs.push({ message, metadata }); },
      };

      timeSync('sync', () => 42, logger);

      assert.equal(logs.length, 1);
      assert.ok(logs[0].message.includes('[TIMING] sync'));
      assert.equal(logs[0].metadata?.status, 'success');
    });

    it('should log error to TimingLogger on failure', () => {
      const logs: { message: string; metadata?: Record<string, unknown> }[] = [];
      const logger: TimingLogger = {
        log(message, metadata) { logs.push({ message, metadata }); },
      };

      try {
        timeSync('sync-fail', () => { throw new Error('err'); }, logger);
      } catch {
        // expected
      }

      assert.equal(logs.length, 1);
      assert.equal(logs[0].metadata?.status, 'error');
    });

    it('should handle returning complex objects', () => {
      const obj = { a: 1, b: [2, 3] };
      const { result } = timeSync('complex', () => obj);
      assert.deepEqual(result, obj);
    });
  });
});
