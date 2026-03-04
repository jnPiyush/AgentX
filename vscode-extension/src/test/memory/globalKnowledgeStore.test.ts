import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GlobalKnowledgeStore } from '../../memory/globalKnowledgeStore';
import {
  type KnowledgeEntry,
  type KnowledgeCategory,
  GLOBAL_KNOWLEDGE_DIR_NAME,
} from '../../memory/globalKnowledgeTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

function makeKnowledgeInput(overrides: Partial<KnowledgeEntry> = {}): Omit<KnowledgeEntry, 'id' | 'promotedAt' | 'usageCount' | 'lastUsedAt'> {
  return {
    category: 'pattern' as KnowledgeCategory,
    title: 'Always validate JWT expiry before trusting claims',
    content: 'JWT tokens should have their exp claim validated server-side even if the client checks expiry.',
    sourceProject: 'test-project',
    sourceIssue: 42,
    sourceObservationId: 'obs-test-001',
    promotionType: 'manual' as const,
    labels: ['security', 'auth'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-gk-test-'));
  // Override HOME so GlobalKnowledgeStore writes to temp
  originalHome = process.env['HOME'];
  originalUserProfile = process.env['USERPROFILE'];
  process.env['HOME'] = tmpHome;
  process.env['USERPROFILE'] = tmpHome;
});

afterEach(() => {
  // Restore HOME
  if (originalHome !== undefined) { process.env['HOME'] = originalHome; }
  else { delete process.env['HOME']; }
  if (originalUserProfile !== undefined) { process.env['USERPROFILE'] = originalUserProfile; }
  else { delete process.env['USERPROFILE']; }
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobalKnowledgeStore', () => {
  it('should be constructable', () => {
    const store = new GlobalKnowledgeStore();
    assert.ok(store, 'GlobalKnowledgeStore instance should be created');
  });

  it('should promote a knowledge entry and return it with an ID', async () => {
    const store = new GlobalKnowledgeStore();
    const input = makeKnowledgeInput();

    const entry = await store.promote(input);
    assert.ok(entry, 'Should return a knowledge entry');
    assert.ok(entry!.id.startsWith('GK-'), 'ID should start with GK-');
    assert.strictEqual(entry!.title, input.title);
    assert.strictEqual(entry!.category, 'pattern');
    assert.ok(entry!.promotedAt, 'Should have promotedAt timestamp');
    assert.strictEqual(entry!.usageCount, 0, 'Initial usage count should be 0');
  });

  it('should deduplicate similar entries and return null', async () => {
    const store = new GlobalKnowledgeStore();
    const input1 = makeKnowledgeInput({ title: 'Validate JWT expiry before trusting claims' });
    const input2 = makeKnowledgeInput({ title: 'Validate JWT expiry before trusting claims' });

    const first = await store.promote(input1);
    assert.ok(first, 'First entry should be promoted');

    const second = await store.promote(input2);
    assert.strictEqual(second, null, 'Duplicate should be deduplicated and return null');
  });

  it('should retrieve entry by ID', async () => {
    const store = new GlobalKnowledgeStore();
    const entry = await store.promote(makeKnowledgeInput());
    assert.ok(entry);

    const retrieved = await store.getById(entry!.id);
    assert.ok(retrieved, 'Should retrieve entry by ID');
    assert.strictEqual(retrieved!.id, entry!.id);
    assert.strictEqual(retrieved!.title, entry!.title);
  });

  it('should return null for non-existent ID', async () => {
    const store = new GlobalKnowledgeStore();
    const result = await store.getById('GK-nonexistent');
    assert.strictEqual(result, null, 'Should return null for missing ID');
  });

  it('should list entries', async () => {
    const store = new GlobalKnowledgeStore();
    await store.promote(makeKnowledgeInput({ title: 'Pattern A - unique alpha' }));
    await store.promote(makeKnowledgeInput({ title: 'Pattern B - unique beta', category: 'pitfall' }));

    const all = await store.list();
    assert.ok(all.length >= 2, 'Should list all entries');

    const pitfalls = await store.list('pitfall');
    assert.ok(pitfalls.some((e) => e.category === 'pitfall'), 'Should filter by category');
  });

  it('should search entries by keyword', async () => {
    const store = new GlobalKnowledgeStore();
    await store.promote(makeKnowledgeInput({ title: 'Connection pooling best practices' }));
    await store.promote(makeKnowledgeInput({ title: 'Database indexing strategies for JSON' }));

    const results = await store.search('pooling');
    assert.ok(results.some((r) => r.title.includes('pooling')), 'Should find by keyword');
  });

  it('should record usage and increment count', async () => {
    const store = new GlobalKnowledgeStore();
    const entry = await store.promote(makeKnowledgeInput({ title: 'Unique usage test entry' }));
    assert.ok(entry);

    await store.recordUsage(entry!.id);
    await store.recordUsage(entry!.id);

    const updated = await store.getById(entry!.id);
    assert.ok(updated);
    assert.strictEqual(updated!.usageCount, 2, 'Usage count should be 2');
    assert.ok(updated!.lastUsedAt, 'lastUsedAt should be set');
  });

  it('should remove an entry', async () => {
    const store = new GlobalKnowledgeStore();
    const entry = await store.promote(makeKnowledgeInput({ title: 'Entry to remove unique' }));
    assert.ok(entry);

    const removed = await store.remove(entry!.id);
    assert.strictEqual(removed, true, 'Should return true on successful removal');

    const gone = await store.getById(entry!.id);
    assert.strictEqual(gone, null, 'Entry should be gone after removal');
  });

  it('should get stats', async () => {
    const store = new GlobalKnowledgeStore();
    await store.promote(makeKnowledgeInput({ title: 'Stats test entry unique gamma' }));

    const stats = await store.getStats();
    assert.ok(stats.total >= 1, 'Should have at least one entry');
    assert.ok(typeof stats.sizeBytes === 'number', 'sizeBytes should be a number');
  });

  it('should format knowledge for prompt', async () => {
    const store = new GlobalKnowledgeStore();
    await store.promote(makeKnowledgeInput({ title: 'Prompt injection test unique delta', labels: ['security'] }));

    const formatted = await store.formatForPrompt('security');
    assert.ok(typeof formatted === 'string', 'Should return a string');
  });

  it('should prune entries unused for long durations', async () => {
    const store = new GlobalKnowledgeStore();
    const pruned = await store.prune();
    assert.ok(typeof pruned === 'number', 'Prune should return a number');
  });

  it('should store data in the user home directory', async () => {
    const store = new GlobalKnowledgeStore();
    await store.promote(makeKnowledgeInput({ title: 'Home dir test unique epsilon' }));

    const knowledgeDir = path.join(tmpHome, GLOBAL_KNOWLEDGE_DIR_NAME);
    assert.ok(fs.existsSync(knowledgeDir), 'Knowledge dir should exist in home');
  });
});
