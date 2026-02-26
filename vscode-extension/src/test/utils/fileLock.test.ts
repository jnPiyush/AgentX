import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AsyncMutex,
  JsonFileLock,
  FileLockManager,
  readJsonSafe,
  writeJsonLocked,
} from '../../utils/fileLock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpFile(dir: string, name: string): string {
  return path.join(dir, name);
}

// ---------------------------------------------------------------------------
// AsyncMutex
// ---------------------------------------------------------------------------

describe('AsyncMutex', () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  it('runs a single task immediately', async () => {
    let ran = false;
    await mutex.withLock('k', async () => { ran = true; });
    assert.equal(ran, true);
  });

  it('serialises concurrent tasks per key', async () => {
    const order: number[] = [];
    const t1 = mutex.withLock('k', async () => {
      // Yield to allow t2 to queue.
      await new Promise(r => setTimeout(r, 5));
      order.push(1);
    });
    const t2 = mutex.withLock('k', async () => { order.push(2); });

    await Promise.all([t1, t2]);
    assert.deepEqual(order, [1, 2], 'tasks must run in arrival order');
  });

  it('allows concurrent tasks on different keys', async () => {
    const order: string[] = [];
    const t1 = mutex.withLock('a', async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push('a');
    });
    const t2 = mutex.withLock('b', async () => {
      await new Promise(r => setTimeout(r, 1));
      order.push('b');
    });

    await Promise.all([t1, t2]);
    assert.deepEqual(order, ['b', 'a'], 'independent keys should not block each other');
  });

  it('releases lock even when the task throws', async () => {
    await assert.rejects(
      () => mutex.withLock('k', async () => { throw new Error('boom'); }),
      /boom/
    );
    // Should not deadlock -- next task should run fine.
    let ran = false;
    await mutex.withLock('k', async () => { ran = true; });
    assert.equal(ran, true);
  });
});

// ---------------------------------------------------------------------------
// JsonFileLock
// ---------------------------------------------------------------------------

describe('JsonFileLock', () => {
  let dir: string;
  let lock: JsonFileLock;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-lock-test-'));
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    lock = new JsonFileLock();
  });

  it('acquires and releases a lock file', async () => {
    const file = makeTmpFile(dir, 'test1.json');
    const lockFile = file + '.lock';

    const acquired = await lock.acquire(file, 'test-agent');
    assert.equal(acquired, true);
    assert.equal(fs.existsSync(lockFile), true, '.lock file must exist after acquire');

    await lock.release(file);
    assert.equal(fs.existsSync(lockFile), false, '.lock file must be removed after release');
  });

  it('withLock runs fn and always releases', async () => {
    const file = makeTmpFile(dir, 'test2.json');
    let wasCalled = false;

    await lock.withLock(file, 'agent', async () => { wasCalled = true; });

    assert.equal(wasCalled, true);
    assert.equal(fs.existsSync(file + '.lock'), false, 'lock file must be released');
  });

  it('withLock releases lock even on fn error', async () => {
    const file = makeTmpFile(dir, 'test3.json');

    await assert.rejects(
      () => lock.withLock(file, 'agent', async () => { throw new Error('fn-error'); }),
      /fn-error/
    );
    assert.equal(fs.existsSync(file + '.lock'), false, 'lock must be cleaned up on error');
  });

  it('cleans up stale lock files', async () => {
    const file = makeTmpFile(dir, 'test4.json');
    const lockFile = file + '.lock';

    // Write a stale lock (created 60 s ago).
    const stalePayload = JSON.stringify({ agent: 'stale', created: new Date(Date.now() - 60_000).toISOString() });
    fs.writeFileSync(lockFile, stalePayload, 'utf8');

    const acquired = await lock.acquire(file, 'new-agent');
    assert.equal(acquired, true, 'should acquire over stale lock');

    await lock.release(file);
  });
});

// ---------------------------------------------------------------------------
// FileLockManager
// ---------------------------------------------------------------------------

describe('FileLockManager', () => {
  let dir: string;
  let manager: FileLockManager;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-manager-test-'));
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    manager = new FileLockManager();
  });

  it('withSafeLock serialises writes and releases', async () => {
    const file = makeTmpFile(dir, 'safe.json');
    const results: number[] = [];

    await Promise.all([
      manager.withSafeLock(file, 'a', async () => {
        await new Promise(r => setTimeout(r, 5));
        results.push(1);
      }),
      manager.withSafeLock(file, 'b', async () => { results.push(2); }),
    ]);

    assert.deepEqual(results, [1, 2], 'must run in order');
    assert.equal(fs.existsSync(file + '.lock'), false);
  });
});

// ---------------------------------------------------------------------------
// readJsonSafe / writeJsonLocked
// ---------------------------------------------------------------------------

describe('readJsonSafe / writeJsonLocked', () => {
  let dir: string;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-json-test-'));
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('readJsonSafe returns null for missing file', async () => {
    const result = await readJsonSafe<Record<string, unknown>>(path.join(dir, 'missing.json'));
    assert.equal(result, null);
  });

  it('writeJsonLocked writes valid JSON and readJsonSafe reads it back', async () => {
    const file = path.join(dir, 'round-trip.json');
    const data = { hello: 'world', num: 42 };

    await writeJsonLocked(file, data);
    const read = await readJsonSafe<typeof data>(file);

    assert.deepEqual(read, data);
    assert.equal(fs.existsSync(file + '.lock'), false, 'lock should be released');
  });
});
