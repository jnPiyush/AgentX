import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { GitStorageProvider } from '../../utils/gitStorageProvider';
import { GitObservationStore } from '../../memory/gitObservationStore';
import type { Observation, ObservationIndex } from '../../memory/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let provider: GitStorageProvider;
let store: GitObservationStore;

/** Create a fresh Git repository in a temp directory. */
function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-gitmem-test-'));
  execFileSync('git', ['init', dir], { encoding: 'utf-8' });
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test User'], { encoding: 'utf-8' });
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'], { encoding: 'utf-8' });
  return dir;
}

/** Create a deterministic Observation for testing. */
function makeObs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: `obs-engineer-42-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agent: 'engineer',
    issueNumber: 42,
    category: 'decision',
    content: 'decided to use Git storage for persistence',
    summary: 'decided to use Git storage for persistence',
    tokens: 12,
    timestamp: new Date().toISOString(),
    sessionId: 'session-git-test-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
// GitObservationStore
// ---------------------------------------------------------------------------

describe('GitObservationStore', () => {

  // Setup / teardown -- scoped to this describe block
  beforeEach(async () => {
    tmpDir = createTempRepo();
    provider = new GitStorageProvider({ workspaceRoot: tmpDir });
    await provider.init();
    store = new GitObservationStore(provider);
  });

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // store()
  // -------------------------------------------------------------------------

  describe('store()', () => {
    it('persists observations to Git', async () => {
      const obs = makeObs();
      await store.store([obs]);

      const exists = await provider.fileExists('memory/issue-42.json');
      assert.ok(exists, 'issue file should exist on data branch');
    });

    it('persists manifest alongside issue file', async () => {
      await store.store([makeObs()]);

      const exists = await provider.fileExists('memory/manifest.json');
      assert.ok(exists, 'manifest should exist on data branch');
    });

    it('handles empty observations array', async () => {
      await store.store([]);
      const exists = await provider.fileExists('memory/manifest.json');
      assert.ok(!exists, 'manifest should not exist for empty store');
    });

    it('appends to existing issue file', async () => {
      const obs1 = makeObs({ id: 'obs-1', content: 'first observation' });
      const obs2 = makeObs({ id: 'obs-2', content: 'second observation' });

      await store.store([obs1]);
      await store.store([obs2]);

      const results = await store.getByIssue(42);
      assert.strictEqual(results.length, 2);
    });

    it('groups observations by issue in separate files', async () => {
      const obs1 = makeObs({ id: 'obs-i10', issueNumber: 10 });
      const obs2 = makeObs({ id: 'obs-i20', issueNumber: 20 });

      await store.store([obs1, obs2]);

      const issue10 = await provider.fileExists('memory/issue-10.json');
      const issue20 = await provider.fileExists('memory/issue-20.json');
      assert.ok(issue10, 'issue-10.json should exist');
      assert.ok(issue20, 'issue-20.json should exist');
    });
  });

  // -------------------------------------------------------------------------
  // getByIssue() / getById()
  // -------------------------------------------------------------------------

  describe('getByIssue()', () => {
    it('loads all observations for an issue', async () => {
      await store.store([
        makeObs({ id: 'obs-a', issueNumber: 42 }),
        makeObs({ id: 'obs-b', issueNumber: 42 }),
        makeObs({ id: 'obs-c', issueNumber: 99 }),
      ]);

      const results = await store.getByIssue(42);
      assert.strictEqual(results.length, 2);
    });

    it('returns empty array for non-existent issue', async () => {
      const results = await store.getByIssue(999);
      assert.deepStrictEqual(results, []);
    });
  });

  describe('getById()', () => {
    it('loads a single observation by ID', async () => {
      const obs = makeObs({ id: 'obs-unique' });
      await store.store([obs]);

      const result = await store.getById('obs-unique');
      assert.ok(result);
      assert.strictEqual(result.id, 'obs-unique');
    });

    it('returns null for non-existent ID', async () => {
      const result = await store.getById('nonexistent');
      assert.strictEqual(result, null);
    });
  });

  // -------------------------------------------------------------------------
  // search()
  // -------------------------------------------------------------------------

  describe('search()', () => {
    it('finds observations by keyword in summary', async () => {
      await store.store([
        makeObs({ id: 'obs-1', summary: 'use JSON for storage' }),
        makeObs({ id: 'obs-2', summary: 'use Git for persistence' }),
      ]);

      const results = await store.search('Git');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'obs-2');
    });

    it('supports multiple search terms (all must match)', async () => {
      await store.store([
        makeObs({ id: 'obs-1', summary: 'use Git for storage' }),
        makeObs({ id: 'obs-2', summary: 'use Git for persistence' }),
      ]);

      const results = await store.search('Git persistence');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'obs-2');
    });

    it('respects the limit parameter', async () => {
      const observations = Array.from({ length: 10 }, (_, i) =>
        makeObs({
          id: `obs-${i}`,
          summary: `observation number ${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        }),
      );
      await store.store(observations);

      const results = await store.search('observation', 3);
      assert.strictEqual(results.length, 3);
    });

    it('returns empty array when no matches', async () => {
      await store.store([makeObs({ summary: 'unrelated content' })]);
      const results = await store.search('nonexistent-term');
      assert.strictEqual(results.length, 0);
    });
  });

  // -------------------------------------------------------------------------
  // listByAgent() / listByCategory()
  // -------------------------------------------------------------------------

  describe('listByAgent()', () => {
    it('filters by agent name', async () => {
      await store.store([
        makeObs({ id: 'obs-eng', agent: 'engineer' }),
        makeObs({ id: 'obs-pm', agent: 'product-manager' }),
      ]);

      const results = await store.listByAgent('engineer');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'obs-eng');
    });
  });

  describe('listByCategory()', () => {
    it('filters by category', async () => {
      await store.store([
        makeObs({ id: 'obs-dec', category: 'decision' }),
        makeObs({ id: 'obs-err', category: 'error' }),
      ]);

      const results = await store.listByCategory('error');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'obs-err');
    });
  });

  // -------------------------------------------------------------------------
  // remove()
  // -------------------------------------------------------------------------

  describe('remove()', () => {
    it('removes an observation by ID', async () => {
      await store.store([
        makeObs({ id: 'obs-keep' }),
        makeObs({ id: 'obs-remove' }),
      ]);

      const removed = await store.remove('obs-remove');
      assert.ok(removed, 'should return true');

      const result = await store.getById('obs-remove');
      assert.strictEqual(result, null, 'should be gone after removal');
    });

    it('returns false for non-existent ID', async () => {
      const removed = await store.remove('nonexistent');
      assert.strictEqual(removed, false);
    });
  });

  // -------------------------------------------------------------------------
  // getStats()
  // -------------------------------------------------------------------------

  describe('getStats()', () => {
    it('returns aggregate statistics', async () => {
      await store.store([
        makeObs({ id: 'obs-1', agent: 'engineer', category: 'decision', tokens: 10 }),
        makeObs({ id: 'obs-2', agent: 'engineer', category: 'error', tokens: 20 }),
        makeObs({ id: 'obs-3', agent: 'architect', category: 'decision', tokens: 15, issueNumber: 99 }),
      ]);

      const stats = await store.getStats();
      assert.strictEqual(stats.totalObservations, 3);
      assert.strictEqual(stats.totalTokens, 45);
      assert.strictEqual(stats.issueCount, 2);
      assert.strictEqual(stats.byAgent['engineer'], 2);
      assert.strictEqual(stats.byAgent['architect'], 1);
      assert.strictEqual(stats.byCategory['decision'], 2);
      assert.strictEqual(stats.byCategory['error'], 1);
      assert.ok(stats.oldestTimestamp);
      assert.ok(stats.newestTimestamp);
    });

    it('returns zeros for empty store', async () => {
      const stats = await store.getStats();
      assert.strictEqual(stats.totalObservations, 0);
      assert.strictEqual(stats.totalTokens, 0);
      assert.strictEqual(stats.issueCount, 0);
    });
  });

  // -------------------------------------------------------------------------
  // getIssueHistory()
  // -------------------------------------------------------------------------

  describe('getIssueHistory()', () => {
    it('returns commit history for an issue', async () => {
      await store.store([makeObs({ id: 'obs-v1', issueNumber: 42 })]);
      await store.store([makeObs({ id: 'obs-v2', issueNumber: 42 })]);

      const history = await store.getIssueHistory(42);
      assert.ok(history.length >= 2, `expected >=2 history entries, got ${history.length}`);
    });

    it('returns empty for non-existent issue', async () => {
      const history = await store.getIssueHistory(999);
      assert.deepStrictEqual(history, []);
    });
  });

  // -------------------------------------------------------------------------
  // Git integration
  // -------------------------------------------------------------------------

  describe('Git integration', () => {
    it('does not pollute the working tree', async () => {
      await store.store([makeObs()]);

      const memoryDir = path.join(tmpDir, 'memory');
      assert.ok(!fs.existsSync(memoryDir), 'memory dir should not exist in working tree');
    });
  });
});
