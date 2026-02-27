import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileLockManager } from '../../utils/fileLock';
import { JsonObservationStore } from '../../memory/observationStore';
import {
  type Observation,
  type ObservationCategory,
  MANIFEST_CACHE_TTL_MS,
} from '../../memory/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;

/** Create a deterministic Observation for testing. */
function makeObs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: `obs-engineer-42-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agent: 'engineer',
    issueNumber: 42,
    category: 'decision',
    content: 'decided to use JSON storage for Phase 1',
    summary: 'decided to use JSON storage for Phase 1',
    tokens: 10,
    timestamp: new Date().toISOString(),
    sessionId: 'session-test-001',
    ...overrides,
  };
}

function makeObsForIssue(issueNumber: number, id?: string): Observation {
  return makeObs({
    id: id ?? `obs-engineer-${issueNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    issueNumber,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-mem-test-'));
  memoryDir = path.join(tmpDir, 'memory');
});

afterEach(() => {
  // Clean up temp dir recursively.
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// JsonObservationStore
// ---------------------------------------------------------------------------

describe('JsonObservationStore', () => {

  // -------------------------------------------------------------------------
  // store()
  // -------------------------------------------------------------------------

  describe('store()', () => {
    it('creates memory dir if it does not exist', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObs()]);

      assert.ok(fs.existsSync(memoryDir), 'memory dir should be created');
    });

    it('creates issue file on first store', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObs({ issueNumber: 99 })]);

      const issueFile = path.join(memoryDir, 'issue-99.json');
      assert.ok(fs.existsSync(issueFile), 'issue-99.json should exist');
    });

    it('creates manifest.json on first store', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObs()]);

      const manifestFile = path.join(memoryDir, 'manifest.json');
      assert.ok(fs.existsSync(manifestFile), 'manifest.json should exist');
    });

    it('persists observations to the issue file', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs = makeObs({ issueNumber: 10 });
      await store.store([obs]);

      const raw = JSON.parse(fs.readFileSync(path.join(memoryDir, 'issue-10.json'), 'utf8'));
      assert.equal(raw.observations.length, 1);
      assert.equal(raw.observations[0].id, obs.id);
    });

    it('appends to existing issue file', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs1 = makeObs({ issueNumber: 5, id: 'obs-a' });
      const obs2 = makeObs({ issueNumber: 5, id: 'obs-b' });

      await store.store([obs1]);
      await store.store([obs2]);

      const raw = JSON.parse(fs.readFileSync(path.join(memoryDir, 'issue-5.json'), 'utf8'));
      assert.equal(raw.observations.length, 2);
    });

    it('handles multiple issues in a single store() call', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ issueNumber: 1, id: 'obs-i1' }),
        makeObs({ issueNumber: 2, id: 'obs-i2' }),
      ]);

      assert.ok(fs.existsSync(path.join(memoryDir, 'issue-1.json')));
      assert.ok(fs.existsSync(path.join(memoryDir, 'issue-2.json')));
    });

    it('does nothing for empty observations array', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([]);

      assert.ok(!fs.existsSync(memoryDir), 'dir should not be created for empty store');
    });

    it('updates manifest entries', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs = makeObs({ id: 'obs-manifest-test', issueNumber: 7 });
      await store.store([obs]);

      const manifest = JSON.parse(fs.readFileSync(path.join(memoryDir, 'manifest.json'), 'utf8'));
      assert.ok(manifest.entries.some((e: { id: string }) => e.id === 'obs-manifest-test'));
    });
  });

  // -------------------------------------------------------------------------
  // getByIssue()
  // -------------------------------------------------------------------------

  describe('getByIssue()', () => {
    it('returns empty array for unknown issue', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const result = await store.getByIssue(999);
      assert.deepEqual(result, []);
    });

    it('returns all observations for a known issue', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs1 = makeObsForIssue(20, 'obs-20-a');
      const obs2 = makeObsForIssue(20, 'obs-20-b');
      await store.store([obs1, obs2]);

      const result = await store.getByIssue(20);
      assert.equal(result.length, 2);
      assert.ok(result.some((o) => o.id === 'obs-20-a'));
      assert.ok(result.some((o) => o.id === 'obs-20-b'));
    });

    it('does not return observations from other issues', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObsForIssue(1, 'obs-for-1'), makeObsForIssue(2, 'obs-for-2')]);

      const result = await store.getByIssue(1);
      assert.ok(result.every((o) => o.issueNumber === 1));
      assert.ok(!result.some((o) => o.id === 'obs-for-2'));
    });
  });

  // -------------------------------------------------------------------------
  // getById()
  // -------------------------------------------------------------------------

  describe('getById()', () => {
    it('returns null for unknown ID', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const result = await store.getById('obs-nonexistent');
      assert.equal(result, null);
    });

    it('returns full observation for known ID', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs = makeObs({ id: 'obs-specific-id', issueNumber: 55 });
      await store.store([obs]);

      const result = await store.getById('obs-specific-id');
      assert.ok(result !== null);
      assert.equal(result.id, 'obs-specific-id');
      assert.equal(result.issueNumber, 55);
      assert.equal(result.content, obs.content);
    });
  });

  // -------------------------------------------------------------------------
  // search()
  // -------------------------------------------------------------------------

  describe('search()', () => {
    it('returns empty array when store is empty', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const result = await store.search('anything');
      assert.deepEqual(result, []);
    });

    it('finds observations matching query term', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ summary: 'decided to use JSON storage', id: 'obs-json' }),
        makeObs({ summary: 'error: ENOENT opening manifest', id: 'obs-err' }),
      ]);

      const result = await store.search('json');
      assert.ok(result.some((e) => e.id === 'obs-json'));
      assert.ok(!result.some((e) => e.id === 'obs-err'));
    });

    it('requires all terms to match (AND logic)', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ summary: 'decided to use JSON for Phase 1 storage', id: 'obs-all' }),
        makeObs({ summary: 'decided to use JSON only', id: 'obs-partial' }),
      ]);

      const result = await store.search('json phase');
      assert.ok(result.some((e) => e.id === 'obs-all'));
      assert.ok(!result.some((e) => e.id === 'obs-partial'));
    });

    it('is case-insensitive', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObs({ summary: 'Decided to Use JSON Storage', id: 'obs-case' })]);

      const result = await store.search('decided json');
      assert.ok(result.some((e) => e.id === 'obs-case'));
    });

    it('respects limit parameter', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs = Array.from({ length: 30 }, (_, i) =>
        makeObs({ id: `obs-${i}`, summary: 'decided to do something important' }),
      );
      await store.store(obs);

      const result = await store.search('decided', 5);
      assert.ok(result.length <= 5, `got ${result.length} results, expected <= 5`);
    });

    it('searches category and agent fields too', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ agent: 'reviewer', summary: 'approved PR for issue 42', id: 'obs-rev' }),
      ]);

      const result = await store.search('reviewer');
      assert.ok(result.some((e) => e.id === 'obs-rev'));
    });
  });

  // -------------------------------------------------------------------------
  // listByAgent()
  // -------------------------------------------------------------------------

  describe('listByAgent()', () => {
    it('returns empty array for unknown agent', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const result = await store.listByAgent('nonexistent');
      assert.deepEqual(result, []);
    });

    it('returns only entries for the specified agent', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ agent: 'engineer', id: 'obs-eng' }),
        makeObs({ agent: 'reviewer', id: 'obs-rev' }),
      ]);

      const result = await store.listByAgent('engineer');
      assert.ok(result.every((e) => e.agent === 'engineer'));
      assert.ok(!result.some((e) => e.id === 'obs-rev'));
    });
  });

  // -------------------------------------------------------------------------
  // listByCategory()
  // -------------------------------------------------------------------------

  describe('listByCategory()', () => {
    it('returns only entries for the specified category', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ category: 'decision', id: 'obs-dec' }),
        makeObs({ category: 'error', id: 'obs-err' }),
      ]);

      const result = await store.listByCategory('decision' as ObservationCategory);
      assert.ok(result.every((e) => e.category === 'decision'));
      assert.ok(!result.some((e) => e.id === 'obs-err'));
    });
  });

  // -------------------------------------------------------------------------
  // remove()
  // -------------------------------------------------------------------------

  describe('remove()', () => {
    it('returns false for unknown ID', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const result = await store.remove('obs-nonexistent');
      assert.equal(result, false);
    });

    it('removes observation from issue file and manifest', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const obs = makeObs({ id: 'obs-to-remove', issueNumber: 33 });
      await store.store([obs]);

      const removed = await store.remove('obs-to-remove');
      assert.equal(removed, true);

      const fromIssue = await store.getByIssue(33);
      assert.ok(!fromIssue.some((o) => o.id === 'obs-to-remove'));

      const fromManifest = await store.search('obs-to-remove');
      assert.ok(!fromManifest.some((e) => e.id === 'obs-to-remove'));
    });

    it('removes only the target observation, leaving others intact', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ id: 'keep-1', issueNumber: 8 }),
        makeObs({ id: 'remove-me', issueNumber: 8 }),
        makeObs({ id: 'keep-2', issueNumber: 8 }),
      ]);

      await store.remove('remove-me');

      const remaining = await store.getByIssue(8);
      assert.equal(remaining.length, 2);
      assert.ok(remaining.every((o) => o.id !== 'remove-me'));
    });
  });

  // -------------------------------------------------------------------------
  // getStats()
  // -------------------------------------------------------------------------

  describe('getStats()', () => {
    it('returns zero stats for empty store', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const stats = await store.getStats();

      assert.equal(stats.totalObservations, 0);
      assert.equal(stats.totalTokens, 0);
      assert.equal(stats.issueCount, 0);
      assert.equal(stats.oldestTimestamp, null);
      assert.equal(stats.newestTimestamp, null);
    });

    it('counts observations, tokens, and issues correctly', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ issueNumber: 1, tokens: 15, id: 'obs-s1' }),
        makeObs({ issueNumber: 2, tokens: 25, id: 'obs-s2' }),
        makeObs({ issueNumber: 1, tokens: 10, id: 'obs-s3' }),
      ]);

      const stats = await store.getStats();
      assert.equal(stats.totalObservations, 3);
      assert.equal(stats.totalTokens, 50);
      assert.equal(stats.issueCount, 2);
    });

    it('breaks down counts by category and agent', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([
        makeObs({ category: 'decision', agent: 'engineer', id: 'obs-c1' }),
        makeObs({ category: 'error', agent: 'engineer', id: 'obs-c2' }),
        makeObs({ category: 'decision', agent: 'reviewer', id: 'obs-c3' }),
      ]);

      const stats = await store.getStats();
      assert.equal(stats.byCategory['decision'], 2);
      assert.equal(stats.byCategory['error'], 1);
      assert.equal(stats.byAgent['engineer'], 2);
      assert.equal(stats.byAgent['reviewer'], 1);
    });

    it('sets oldestTimestamp and newestTimestamp', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const ts1 = '2026-01-01T10:00:00.000Z';
      const ts2 = '2026-02-01T10:00:00.000Z';
      await store.store([
        makeObs({ timestamp: ts2, id: 'obs-newer' }),
        makeObs({ timestamp: ts1, id: 'obs-older' }),
      ]);

      const stats = await store.getStats();
      assert.equal(stats.oldestTimestamp, ts1);
      assert.equal(stats.newestTimestamp, ts2);
    });
  });

  // -------------------------------------------------------------------------
  // Manifest cache
  // -------------------------------------------------------------------------

  describe('manifest cache', () => {
    it('invalidates cache after store()', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObs({ id: 'obs-first', summary: 'first observation stored' })]);

      // Warm the cache via search.
      await store.search('first');

      // Store another observation -- must invalidate cache.
      await store.store([makeObs({ id: 'obs-second', summary: 'second observation stored' })]);

      const result = await store.search('second');
      assert.ok(result.some((e) => e.id === 'obs-second'), 'new observation must appear after cache invalidation');
    });

    it('invalidates cache after remove()', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      await store.store([makeObs({ id: 'obs-remove-cache', summary: 'to be removed soon' })]);

      // Warm cache.
      await store.search('removed');

      // Remove should bust cache.
      await store.remove('obs-remove-cache');

      const result = await store.search('removed');
      assert.ok(!result.some((e) => e.id === 'obs-remove-cache'), 'removed entry must not appear');
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent safety (serial calls -- ensures no data corruption)
  // -------------------------------------------------------------------------

  describe('concurrent writes', () => {
    it('does not lose observations when storing concurrently for same issue', async () => {
      const store = new JsonObservationStore(memoryDir, new FileLockManager());
      const batch1 = Array.from({ length: 5 }, (_, i) =>
        makeObs({ issueNumber: 77, id: `obs-batch1-${i}`, summary: `batch 1 obs ${i}` }),
      );
      const batch2 = Array.from({ length: 5 }, (_, i) =>
        makeObs({ issueNumber: 77, id: `obs-batch2-${i}`, summary: `batch 2 obs ${i}` }),
      );

      // Fire both concurrently -- FileLockManager must serialize them.
      await Promise.all([store.store(batch1), store.store(batch2)]);

      const all = await store.getByIssue(77);
      assert.equal(all.length, 10, `expected 10 observations, got ${all.length}`);
    });
  });
});
