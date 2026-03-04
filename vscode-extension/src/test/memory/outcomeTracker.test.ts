import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileLockManager } from '../../utils/fileLock';
import { OutcomeTracker } from '../../memory/outcomeTracker';
import {
  type OutcomeRecord,
  type OutcomeResult,
  MAX_ACTION_SUMMARY_CHARS,
  MAX_LESSON_CHARS,
  MAX_OUTCOMES_PER_ISSUE,
  OUTCOMES_DIR,
  OUTCOME_MANIFEST_FILE,
} from '../../memory/outcomeTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;

/** Create a deterministic OutcomeRecord for testing. */
function makeOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    id: `out-engineer-42-${Date.now()}`,
    agent: 'engineer',
    issueNumber: 42,
    result: 'pass',
    actionSummary: 'Implemented pagination for /api/users endpoint',
    rootCause: null,
    lesson: 'Cursor-based pagination outperforms offset for large datasets',
    iterationCount: 3,
    timestamp: new Date().toISOString(),
    sessionId: 'session-test-001',
    labels: ['type:story', 'priority:p1'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-outcome-test-'));
  memoryDir = path.join(tmpDir, 'memory');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// OutcomeTracker
// ---------------------------------------------------------------------------

describe('OutcomeTracker', () => {

  // -------------------------------------------------------------------------
  // record()
  // -------------------------------------------------------------------------

  describe('record()', () => {
    it('creates outcomes directory if it does not exist', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome());

      const outcomesDir = path.join(memoryDir, OUTCOMES_DIR);
      assert.ok(fs.existsSync(outcomesDir), 'outcomes dir should be created');
    });

    it('creates individual record file and manifest', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const outcome = makeOutcome({ id: 'out-engineer-42-1234567890' });
      await tracker.record(outcome);

      const outcomesDir = path.join(memoryDir, OUTCOMES_DIR);
      const manifestFile = path.join(outcomesDir, OUTCOME_MANIFEST_FILE);
      assert.ok(fs.existsSync(manifestFile), 'manifest should exist');

      const recordFile = path.join(outcomesDir, 'out-engineer-42-1234567890.json');
      assert.ok(fs.existsSync(recordFile), 'record file should exist');
    });

    it('stores multiple outcomes in manifest', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());

      await tracker.record(makeOutcome({ id: 'out-engineer-42-001' }));
      await tracker.record(makeOutcome({ id: 'out-engineer-42-002', result: 'fail' }));
      await tracker.record(makeOutcome({ id: 'out-architect-10-003', agent: 'architect', issueNumber: 10 }));

      const stats = await tracker.getStats();
      assert.equal(stats.totalOutcomes, 3);
    });

    it('truncates actionSummary to max chars', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const longSummary = 'x'.repeat(MAX_ACTION_SUMMARY_CHARS + 50);
      const outcome = makeOutcome({
        id: 'out-engineer-42-truncate',
        actionSummary: longSummary,
      });
      await tracker.record(outcome);

      const record = await tracker.getById('out-engineer-42-truncate');
      assert.ok(record);
      assert.equal(record.actionSummary.length, MAX_ACTION_SUMMARY_CHARS);
    });

    it('truncates lesson to max chars', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const longLesson = 'y'.repeat(MAX_LESSON_CHARS + 50);
      const outcome = makeOutcome({
        id: 'out-engineer-42-lesson',
        lesson: longLesson,
      });
      await tracker.record(outcome);

      const record = await tracker.getById('out-engineer-42-lesson');
      assert.ok(record);
      assert.equal(record.lesson.length, MAX_LESSON_CHARS);
    });
  });

  // -------------------------------------------------------------------------
  // query()
  // -------------------------------------------------------------------------

  describe('query()', () => {
    it('returns all outcomes when no filter', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-a-1-001' }));
      await tracker.record(makeOutcome({ id: 'out-b-2-002' }));

      const results = await tracker.query({});
      assert.equal(results.length, 2);
    });

    it('filters by agent', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-engineer-1-001', agent: 'engineer' }));
      await tracker.record(makeOutcome({ id: 'out-architect-2-002', agent: 'architect' }));

      const results = await tracker.query({ agent: 'engineer' });
      assert.equal(results.length, 1);
      assert.equal(results[0].agent, 'engineer');
    });

    it('filters by issueNumber', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-e-42-001', issueNumber: 42 }));
      await tracker.record(makeOutcome({ id: 'out-e-99-002', issueNumber: 99 }));

      const results = await tracker.query({ issueNumber: 42 });
      assert.equal(results.length, 1);
      assert.equal(results[0].issueNumber, 42);
    });

    it('filters by result', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-e-1-pass', result: 'pass' }));
      await tracker.record(makeOutcome({ id: 'out-e-2-fail', result: 'fail' }));
      await tracker.record(makeOutcome({ id: 'out-e-3-partial', result: 'partial' }));

      const results = await tracker.query({ result: 'fail' });
      assert.equal(results.length, 1);
      assert.equal(results[0].result, 'fail');
    });

    it('filters by labels (any match)', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-1', labels: ['type:story', 'priority:p1'] }));
      await tracker.record(makeOutcome({ id: 'out-2', labels: ['type:bug', 'priority:p0'] }));

      const results = await tracker.query({ labels: ['type:bug'] });
      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'out-2');
    });

    it('respects limit', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      for (let i = 0; i < 10; i++) {
        await tracker.record(makeOutcome({ id: `out-e-42-${i}` }));
      }

      const results = await tracker.query({ limit: 3 });
      assert.equal(results.length, 3);
    });

    it('returns newest-first', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-old',
        timestamp: '2025-01-01T00:00:00Z',
      }));
      await tracker.record(makeOutcome({
        id: 'out-new',
        timestamp: '2025-12-31T00:00:00Z',
      }));

      const results = await tracker.query({});
      assert.equal(results[0].id, 'out-new');
      assert.equal(results[1].id, 'out-old');
    });
  });

  // -------------------------------------------------------------------------
  // search()
  // -------------------------------------------------------------------------

  describe('search()', () => {
    it('finds outcomes matching search terms', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-1',
        actionSummary: 'Implemented pagination feature',
      }));
      await tracker.record(makeOutcome({
        id: 'out-2',
        actionSummary: 'Fixed authentication bug',
      }));

      const results = await tracker.search('pagination');
      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'out-1');
    });

    it('AND logic: all terms must match', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-1',
        actionSummary: 'Implemented pagination feature',
      }));

      const match = await tracker.search('pagination feature');
      assert.equal(match.length, 1);

      const noMatch = await tracker.search('pagination authentication');
      assert.equal(noMatch.length, 0);
    });

    it('case-insensitive', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-1',
        actionSummary: 'Implemented PAGINATION feature',
      }));

      const results = await tracker.search('pagination');
      assert.equal(results.length, 1);
    });

    it('returns all (limited) on empty query', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-1' }));
      await tracker.record(makeOutcome({ id: 'out-2' }));

      const results = await tracker.search('', 10);
      assert.equal(results.length, 2);
    });
  });

  // -------------------------------------------------------------------------
  // getById()
  // -------------------------------------------------------------------------

  describe('getById()', () => {
    it('returns full record for existing ID', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const outcome = makeOutcome({ id: 'out-engineer-42-lookup' });
      await tracker.record(outcome);

      const record = await tracker.getById('out-engineer-42-lookup');
      assert.ok(record);
      assert.equal(record.id, 'out-engineer-42-lookup');
      assert.equal(record.agent, 'engineer');
      assert.equal(record.issueNumber, 42);
      assert.equal(record.result, 'pass');
    });

    it('returns null for non-existent ID', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const record = await tracker.getById('out-does-not-exist');
      assert.equal(record, null);
    });
  });

  // -------------------------------------------------------------------------
  // formatLessonsForPrompt()
  // -------------------------------------------------------------------------

  describe('formatLessonsForPrompt()', () => {
    it('returns empty string when no outcomes', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const result = await tracker.formatLessonsForPrompt('engineer');
      assert.equal(result, '');
    });

    it('formats lessons for matching agent', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-eng-42-001',
        agent: 'engineer',
        lesson: 'Use cursor-based pagination for large datasets',
        result: 'pass',
      }));

      const result = await tracker.formatLessonsForPrompt('engineer');
      assert.ok(result.includes('Lessons from Previous Outcomes'));
      assert.ok(result.includes('[PASS]'));
      assert.ok(result.includes('cursor-based pagination'));
    });

    it('includes root cause for failed outcomes', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-eng-42-fail',
        agent: 'engineer',
        result: 'fail',
        rootCause: 'Missing null check on user input',
        lesson: 'Always validate input at boundaries',
      }));

      const result = await tracker.formatLessonsForPrompt('engineer');
      assert.ok(result.includes('[FAIL]'));
      assert.ok(result.includes('Root cause:'));
      assert.ok(result.includes('Missing null check'));
    });

    it('does not include outcomes from other agents', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({
        id: 'out-arch-10-001',
        agent: 'architect',
        lesson: 'Architect-specific lesson',
      }));
      await tracker.record(makeOutcome({
        id: 'out-eng-42-002',
        agent: 'engineer',
        lesson: 'Engineer-specific lesson',
      }));

      const result = await tracker.formatLessonsForPrompt('engineer');
      assert.ok(result.includes('Engineer-specific lesson'));
      assert.ok(!result.includes('Architect-specific lesson'));
    });
  });

  // -------------------------------------------------------------------------
  // getStats()
  // -------------------------------------------------------------------------

  describe('getStats()', () => {
    it('returns zero stats for empty store', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      const stats = await tracker.getStats();

      assert.equal(stats.totalOutcomes, 0);
      assert.equal(stats.passCount, 0);
      assert.equal(stats.failCount, 0);
      assert.equal(stats.partialCount, 0);
      assert.equal(stats.avgIterationCount, 0);
    });

    it('counts by result type', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-1', result: 'pass' }));
      await tracker.record(makeOutcome({ id: 'out-2', result: 'pass' }));
      await tracker.record(makeOutcome({ id: 'out-3', result: 'fail' }));
      await tracker.record(makeOutcome({ id: 'out-4', result: 'partial' }));

      const stats = await tracker.getStats();
      assert.equal(stats.totalOutcomes, 4);
      assert.equal(stats.passCount, 2);
      assert.equal(stats.failCount, 1);
      assert.equal(stats.partialCount, 1);
    });

    it('counts by agent', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());
      await tracker.record(makeOutcome({ id: 'out-1', agent: 'engineer' }));
      await tracker.record(makeOutcome({ id: 'out-2', agent: 'engineer' }));
      await tracker.record(makeOutcome({ id: 'out-3', agent: 'architect' }));

      const stats = await tracker.getStats();
      assert.equal(stats.byAgent['engineer'], 2);
      assert.equal(stats.byAgent['architect'], 1);
    });
  });

  // -------------------------------------------------------------------------
  // Per-issue cap enforcement
  // -------------------------------------------------------------------------

  describe('per-issue cap enforcement', () => {
    it('keeps only MAX_OUTCOMES_PER_ISSUE outcomes per issue', async () => {
      const tracker = new OutcomeTracker(memoryDir, new FileLockManager());

      // Record more than the cap for a single issue
      const count = MAX_OUTCOMES_PER_ISSUE + 5;
      for (let i = 0; i < count; i++) {
        await tracker.record(makeOutcome({
          id: `out-engineer-42-${String(i).padStart(5, '0')}`,
          issueNumber: 42,
          timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
        }));
      }

      const results = await tracker.query({ issueNumber: 42, limit: count + 10 });
      assert.ok(
        results.length <= MAX_OUTCOMES_PER_ISSUE,
        `Expected <= ${MAX_OUTCOMES_PER_ISSUE}, got ${results.length}`,
      );
    });
  });
});
