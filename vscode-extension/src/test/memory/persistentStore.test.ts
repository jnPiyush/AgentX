// ---------------------------------------------------------------------------
// Tests -- Persistent Cross-Session Memory Store
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PersistentStore,
  MemoryEntry,
  MemoryStats,
} from '../../memory/persistentStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-mem-test-'));
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PersistentStore', () => {
  let tmpDir: string;
  let store: PersistentStore;

  beforeEach(() => {
    tmpDir = makeTempDir();
    store = new PersistentStore(tmpDir, {
      memoryDir: path.join(tmpDir, '.agentx', 'memory'),
      defaultTtlMs: 60_000, // 1 minute for tests
      maxEntries: 100,
    });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // -----------------------------------------------------------------------
  // store()
  // -----------------------------------------------------------------------
  describe('store', () => {
    it('should store an entry and return it with a key', () => {
      const entry = store.store('test observation', 'engineer', ['code']);
      assert.ok(entry.key.startsWith('mem-engineer-'), 'Key should start with mem-engineer-');
      assert.equal(entry.value, 'test observation');
      assert.equal(entry.agent, 'engineer');
      assert.deepEqual([...entry.tags], ['code']);
      assert.ok(entry.createdAt > 0, 'Should have a creation timestamp');
      assert.ok(entry.expiresAt > entry.createdAt, 'Should have an expiry');
    });

    it('should create the store file on first write', () => {
      assert.equal(store.exists(), false, 'Store should not exist yet');
      store.store('hello', 'test-agent');
      assert.equal(store.exists(), true, 'Store should exist after store()');
    });

    it('should persist entries in JSONL format', () => {
      store.store('Entry 1', 'agent-a', ['tag1']);
      store.store('Entry 2', 'agent-b', ['tag2']);

      const content = fs.readFileSync(store.getStorePath(), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      assert.equal(lines.length, 2, 'Should have 2 JSONL lines');

      const first = JSON.parse(lines[0]) as MemoryEntry;
      assert.equal(first.value, 'Entry 1');
    });

    it('should support zero TTL (never expire)', () => {
      const entry = store.store('permanent note', 'architect', [], 0);
      assert.equal(entry.expiresAt, 0, 'expiresAt should be 0 for no expiry');
    });

    it('should allow custom TTL override', () => {
      const entry = store.store('short lived', 'engineer', [], 5000);
      assert.ok(
        entry.expiresAt - entry.createdAt <= 6000,
        'Expiry should be roughly 5 seconds from creation',
      );
    });
  });

  // -----------------------------------------------------------------------
  // query()
  // -----------------------------------------------------------------------
  describe('query', () => {
    it('should return empty array when store is empty', () => {
      const results = store.query();
      assert.deepEqual(results, []);
    });

    it('should return all active entries', () => {
      store.store('A', 'eng', ['code']);
      store.store('B', 'eng', ['docs']);
      store.store('C', 'arch', ['design']);

      const results = store.query();
      assert.equal(results.length, 3);
    });

    it('should filter by agent', () => {
      store.store('A', 'engineer', ['code']);
      store.store('B', 'architect', ['design']);
      store.store('C', 'engineer', ['test']);

      const results = store.query({ agent: 'engineer' });
      assert.equal(results.length, 2);
      assert.ok(results.every((r) => r.agent === 'engineer'));
    });

    it('should filter by tags (AND logic)', () => {
      store.store('A', 'eng', ['code', 'typescript']);
      store.store('B', 'eng', ['code', 'python']);
      store.store('C', 'eng', ['docs']);

      const results = store.query({ tags: ['code', 'typescript'] });
      assert.equal(results.length, 1);
      assert.equal(results[0].value, 'A');
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) {
        store.store(`Entry ${i}`, 'eng');
      }

      const results = store.query({ limit: 3 });
      assert.equal(results.length, 3);
    });

    it('should return newest first', () => {
      store.store('Old', 'eng');
      // Small delay to ensure different timestamps
      store.store('New', 'eng');

      const results = store.query();
      assert.ok(results[0].createdAt >= results[1].createdAt, 'Newest should come first');
    });

    it('should exclude expired entries by default', () => {
      // Store with very short TTL (already expired)
      const entry = store.store('expired', 'eng', [], 1);
      // Manually write an expired entry
      const expiredEntry: MemoryEntry = {
        key: 'mem-eng-expired-abc123',
        value: 'old data',
        tags: [],
        createdAt: Date.now() - 120_000,
        expiresAt: Date.now() - 60_000, // expired 1 minute ago
        agent: 'eng',
      };

      // Append expired entry directly
      fs.appendFileSync(store.getStorePath(), JSON.stringify(expiredEntry) + '\n', 'utf-8');

      const results = store.query();
      assert.ok(
        !results.some((r) => r.key === 'mem-eng-expired-abc123'),
        'Should not include expired entries',
      );
    });

    it('should include expired entries when requested', () => {
      const expired: MemoryEntry = {
        key: 'mem-eng-expired-xyz789',
        value: 'old data',
        tags: [],
        createdAt: Date.now() - 120_000,
        expiresAt: Date.now() - 60_000,
        agent: 'eng',
      };
      store.store('active', 'eng');
      fs.appendFileSync(store.getStorePath(), JSON.stringify(expired) + '\n', 'utf-8');

      const results = store.query({ includeExpired: true });
      assert.ok(
        results.some((r) => r.key === 'mem-eng-expired-xyz789'),
        'Should include expired entries when requested',
      );
    });
  });

  // -----------------------------------------------------------------------
  // get()
  // -----------------------------------------------------------------------
  describe('get', () => {
    it('should retrieve an entry by key', () => {
      const stored = store.store('findme', 'eng');
      const found = store.get(stored.key);
      assert.ok(found, 'Should find the entry');
      assert.equal(found!.value, 'findme');
    });

    it('should return undefined for non-existent key', () => {
      const found = store.get('mem-eng-999-abc');
      assert.equal(found, undefined);
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete', () => {
    it('should delete an entry by key and return true', () => {
      const entry = store.store('delete me', 'eng');
      const deleted = store.delete(entry.key);
      assert.equal(deleted, true);
      assert.equal(store.get(entry.key), undefined);
    });

    it('should return false for non-existent key', () => {
      const deleted = store.delete('mem-eng-999-abc');
      assert.equal(deleted, false);
    });

    it('should not affect other entries', () => {
      const a = store.store('A', 'eng');
      const b = store.store('B', 'eng');
      store.delete(a.key);

      const found = store.get(b.key);
      assert.ok(found, 'Other entries should remain');
      assert.equal(found!.value, 'B');
    });
  });

  // -----------------------------------------------------------------------
  // prune()
  // -----------------------------------------------------------------------
  describe('prune', () => {
    it('should remove expired entries', () => {
      store.store('active', 'eng', [], 0); // never expires
      const expired: MemoryEntry = {
        key: 'mem-eng-prune-aaa111',
        value: 'old data',
        tags: [],
        createdAt: Date.now() - 120_000,
        expiresAt: Date.now() - 60_000,
        agent: 'eng',
      };
      fs.appendFileSync(store.getStorePath(), JSON.stringify(expired) + '\n', 'utf-8');

      const pruned = store.prune();
      assert.ok(pruned >= 1, 'Should prune at least 1 expired entry');
      assert.equal(store.get('mem-eng-prune-aaa111'), undefined);
    });

    it('should enforce maxEntries limit', () => {
      const smallStore = new PersistentStore(tmpDir, {
        memoryDir: path.join(tmpDir, '.agentx', 'memory2'),
        defaultTtlMs: 0, // never expire
        maxEntries: 5,
      });

      for (let i = 0; i < 10; i++) {
        smallStore.store(`Entry ${i}`, 'eng');
      }

      smallStore.prune();
      const results = smallStore.query({ limit: 100 });
      assert.ok(results.length <= 5, `Should have at most 5 entries after prune, got ${results.length}`);
    });
  });

  // -----------------------------------------------------------------------
  // getStats()
  // -----------------------------------------------------------------------
  describe('getStats', () => {
    it('should return zero stats for empty store', () => {
      const stats = store.getStats();
      assert.equal(stats.totalEntries, 0);
      assert.equal(stats.activeEntries, 0);
      assert.equal(stats.expiredEntries, 0);
    });

    it('should return correct counts', () => {
      store.store('A', 'engineer', ['code']);
      store.store('B', 'architect', ['design', 'code']);

      const stats = store.getStats();
      assert.equal(stats.totalEntries, 2);
      assert.equal(stats.activeEntries, 2);
      assert.ok(stats.agents.includes('engineer'));
      assert.ok(stats.agents.includes('architect'));
      assert.ok(stats.tags.includes('code'));
      assert.ok(stats.tags.includes('design'));
      assert.ok(stats.sizeBytes > 0, 'Should report file size');
    });
  });

  // -----------------------------------------------------------------------
  // clear()
  // -----------------------------------------------------------------------
  describe('clear', () => {
    it('should remove all entries', () => {
      store.store('A', 'eng');
      store.store('B', 'eng');
      store.clear();

      const results = store.query();
      assert.equal(results.length, 0);
    });
  });

  // -----------------------------------------------------------------------
  // exists()
  // -----------------------------------------------------------------------
  describe('exists', () => {
    it('should return false before any writes', () => {
      assert.equal(store.exists(), false);
    });

    it('should return true after a write', () => {
      store.store('test', 'eng');
      assert.equal(store.exists(), true);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle malformed JSONL lines gracefully', () => {
      store.store('valid', 'eng');
      fs.appendFileSync(store.getStorePath(), 'NOT VALID JSON\n', 'utf-8');
      store.store('also valid', 'eng');

      const results = store.query();
      assert.equal(results.length, 2, 'Should skip malformed lines');
    });

    it('should handle empty tags array', () => {
      const entry = store.store('no tags', 'eng', []);
      assert.deepEqual([...entry.tags], []);
    });

    it('should store entries from multiple agents', () => {
      store.store('A', 'engineer');
      store.store('B', 'architect');
      store.store('C', 'reviewer');

      const stats = store.getStats();
      assert.equal(stats.agents.length, 3);
    });
  });
});
