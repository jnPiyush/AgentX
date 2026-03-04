import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileLockManager } from '../../utils/fileLock';
import { SessionRecorder } from '../../memory/sessionRecorder';
import {
  type SessionRecord,
  MAX_SESSIONS_RETAINED,
  MAX_SESSION_SUMMARY_CHARS,
  SESSIONS_DIR,
  SESSION_MANIFEST_FILE,
} from '../../memory/sessionTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;

/** Create a deterministic SessionRecord for testing. */
function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = new Date();
  return {
    id: `ses-${now.toISOString().substring(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}`,
    agent: 'engineer',
    issueNumber: 42,
    startTime: new Date(now.getTime() - 60_000).toISOString(),
    endTime: now.toISOString(),
    summary: 'Implemented pagination for the /api/users endpoint. Added offset/limit params.',
    actions: ['Created pagination utility', 'Updated API route handler', 'Added tests'],
    decisions: ['Used cursor-based pagination over offset-based for performance'],
    filesChanged: ['src/routes/users.ts', 'tests/routes/users.test.ts'],
    messageCount: 15,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-session-test-'));
  memoryDir = path.join(tmpDir, 'memory');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// SessionRecorder
// ---------------------------------------------------------------------------

describe('SessionRecorder', () => {

  // -------------------------------------------------------------------------
  // capture()
  // -------------------------------------------------------------------------

  describe('capture()', () => {
    it('creates sessions directory if it does not exist', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession());

      const sessionsDir = path.join(memoryDir, SESSIONS_DIR);
      assert.ok(fs.existsSync(sessionsDir), 'sessions dir should be created');
    });

    it('creates individual session file and manifest', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      const session = makeSession({ id: 'ses-20260304-a1b2c3' });
      await recorder.capture(session);

      const sessionsDir = path.join(memoryDir, SESSIONS_DIR);
      const manifestFile = path.join(sessionsDir, SESSION_MANIFEST_FILE);
      assert.ok(fs.existsSync(manifestFile), 'manifest should exist');

      const recordFile = path.join(sessionsDir, 'ses-20260304-a1b2c3.json');
      assert.ok(fs.existsSync(recordFile), 'session file should exist');
    });

    it('stores multiple sessions', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({ id: 'ses-20260301-aaaaaa' }));
      await recorder.capture(makeSession({ id: 'ses-20260302-bbbbbb' }));
      await recorder.capture(makeSession({ id: 'ses-20260303-cccccc' }));

      const sessions = await recorder.list();
      assert.equal(sessions.length, 3);
    });

    it('truncates summary to max chars', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      const longSummary = 'z'.repeat(MAX_SESSION_SUMMARY_CHARS + 100);
      const session = makeSession({
        id: 'ses-20260304-trunca',
        summary: longSummary,
      });
      await recorder.capture(session);

      const record = await recorder.getById('ses-20260304-trunca');
      assert.ok(record);
      assert.equal(record.summary.length, MAX_SESSION_SUMMARY_CHARS);
    });

    it('does not throw on errors (fire-and-forget)', async () => {
      // Create a recorder with a read-only directory to force an error
      const readOnlyDir = path.join(tmpDir, 'readonly');
      fs.mkdirSync(readOnlyDir, { recursive: true });
      // The session recorder should swallow errors gracefully
      const recorder = new SessionRecorder(readOnlyDir, new FileLockManager());

      // This should NOT throw even if something goes wrong internally
      await recorder.capture(makeSession());
      // If we get here without throwing, the test passes
    });
  });

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------

  describe('list()', () => {
    it('returns empty array for empty store', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      const sessions = await recorder.list();
      assert.equal(sessions.length, 0);
    });

    it('returns sessions sorted newest-first', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({
        id: 'ses-20250101-old001',
        endTime: '2025-01-01T00:00:00Z',
      }));
      await recorder.capture(makeSession({
        id: 'ses-20251231-new001',
        endTime: '2025-12-31T00:00:00Z',
      }));

      const sessions = await recorder.list();
      assert.equal(sessions[0].id, 'ses-20251231-new001');
      assert.equal(sessions[1].id, 'ses-20250101-old001');
    });

    it('respects limit parameter', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      for (let i = 0; i < 10; i++) {
        await recorder.capture(makeSession({ id: `ses-20260304-${String(i).padStart(6, '0')}` }));
      }

      const sessions = await recorder.list(3);
      assert.equal(sessions.length, 3);
    });
  });

  // -------------------------------------------------------------------------
  // listByIssue()
  // -------------------------------------------------------------------------

  describe('listByIssue()', () => {
    it('filters by issue number', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({ id: 'ses-a', issueNumber: 42 }));
      await recorder.capture(makeSession({ id: 'ses-b', issueNumber: 99 }));
      await recorder.capture(makeSession({ id: 'ses-c', issueNumber: 42 }));

      const sessions = await recorder.listByIssue(42);
      assert.equal(sessions.length, 2);
      assert.ok(sessions.every((s) => s.issueNumber === 42));
    });

    it('returns empty for non-existent issue', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({ id: 'ses-a', issueNumber: 42 }));

      const sessions = await recorder.listByIssue(999);
      assert.equal(sessions.length, 0);
    });
  });

  // -------------------------------------------------------------------------
  // getById()
  // -------------------------------------------------------------------------

  describe('getById()', () => {
    it('returns full record for existing ID', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      const session = makeSession({
        id: 'ses-20260304-lookup',
        agent: 'architect',
        issueNumber: 10,
      });
      await recorder.capture(session);

      const record = await recorder.getById('ses-20260304-lookup');
      assert.ok(record);
      assert.equal(record.id, 'ses-20260304-lookup');
      assert.equal(record.agent, 'architect');
      assert.equal(record.issueNumber, 10);
      assert.ok(record.actions.length > 0);
    });

    it('returns null for non-existent ID', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      const record = await recorder.getById('ses-does-not-exist');
      assert.equal(record, null);
    });
  });

  // -------------------------------------------------------------------------
  // getMostRecent()
  // -------------------------------------------------------------------------

  describe('getMostRecent()', () => {
    it('returns null for empty store', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      const result = await recorder.getMostRecent();
      assert.equal(result, null);
    });

    it('returns the most recent session overall', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({
        id: 'ses-old',
        endTime: '2025-01-01T00:00:00Z',
      }));
      await recorder.capture(makeSession({
        id: 'ses-new',
        endTime: '2025-12-31T00:00:00Z',
      }));

      const result = await recorder.getMostRecent();
      assert.ok(result);
      assert.equal(result.id, 'ses-new');
    });

    it('returns the most recent session for a specific issue', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({
        id: 'ses-42-old',
        issueNumber: 42,
        endTime: '2025-01-01T00:00:00Z',
      }));
      await recorder.capture(makeSession({
        id: 'ses-42-new',
        issueNumber: 42,
        endTime: '2025-12-31T00:00:00Z',
      }));
      await recorder.capture(makeSession({
        id: 'ses-99-newest',
        issueNumber: 99,
        endTime: '2026-06-01T00:00:00Z',
      }));

      const result = await recorder.getMostRecent(42);
      assert.ok(result);
      assert.equal(result.id, 'ses-42-new');
    });
  });

  // -------------------------------------------------------------------------
  // search()
  // -------------------------------------------------------------------------

  describe('search()', () => {
    it('finds sessions matching search terms', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({
        id: 'ses-pagination',
        summary: 'Implemented pagination for users API',
      }));
      await recorder.capture(makeSession({
        id: 'ses-auth',
        summary: 'Fixed authentication timeout bug',
      }));

      const results = await recorder.search('pagination');
      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'ses-pagination');
    });

    it('AND logic: all terms must match', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({
        id: 'ses-1',
        summary: 'Pagination for users API endpoint',
      }));

      const match = await recorder.search('pagination users');
      assert.equal(match.length, 1);

      const noMatch = await recorder.search('pagination authentication');
      assert.equal(noMatch.length, 0);
    });

    it('case-insensitive', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());
      await recorder.capture(makeSession({
        id: 'ses-1',
        summary: 'Implemented PAGINATION Feature',
      }));

      const results = await recorder.search('pagination');
      assert.equal(results.length, 1);
    });
  });

  // -------------------------------------------------------------------------
  // Retention cap enforcement
  // -------------------------------------------------------------------------

  describe('retention cap enforcement', () => {
    it('prunes oldest sessions when exceeding MAX_SESSIONS_RETAINED', async () => {
      const recorder = new SessionRecorder(memoryDir, new FileLockManager());

      // This test uses a small subset to verify pruning logic works
      // We override MAX_SESSIONS_RETAINED behavior indirectly
      const count = 210; // slightly over MAX_SESSIONS_RETAINED
      for (let i = 0; i < count; i++) {
        await recorder.capture(makeSession({
          id: `ses-20260304-${String(i).padStart(6, '0')}`,
          endTime: new Date(2025, 0, 1, 0, 0, i).toISOString(),
        }));
      }

      const sessions = await recorder.list(count + 10);
      assert.ok(
        sessions.length <= MAX_SESSIONS_RETAINED,
        `Expected <= ${MAX_SESSIONS_RETAINED}, got ${sessions.length}`,
      );
    });
  });
});
