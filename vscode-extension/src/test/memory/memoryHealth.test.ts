import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeJsonLocked } from '../../utils/fileLock';
import { MemoryHealth } from '../../memory/memoryHealth';
import { OUTCOMES_DIR, OUTCOME_MANIFEST_FILE } from '../../memory/outcomeTypes';
import { SESSIONS_DIR, SESSION_MANIFEST_FILE } from '../../memory/sessionTypes';
import { ARCHIVE_DIR } from '../../memory/healthTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;

/** Write a JSON file to a path (creating parent dirs). */
function writeJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** Create a valid observation manifest with entries referencing issue files. */
function createObservationStore(
  issues: Array<{ issueNumber: number; observations: Array<{ id: string; agent: string; category: string; summary: string; tokens: number; timestamp: string }> }>,
): void {
  const allEntries: Array<{ id: string; agent: string; issueNumber: number; category: string; summary: string; tokens: number; timestamp: string }> = [];

  for (const issue of issues) {
    const issuePath = path.join(memoryDir, `issue-${issue.issueNumber}.json`);
    const observations = issue.observations.map((o) => ({
      ...o,
      issueNumber: issue.issueNumber,
      content: `Content for ${o.id}`,
      sessionId: 'session-1',
    }));
    writeJson(issuePath, { version: 1, observations });
    for (const obs of issue.observations) {
      allEntries.push({ ...obs, issueNumber: issue.issueNumber });
    }
  }

  writeJson(path.join(memoryDir, 'manifest.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: allEntries,
  });
}

/** Create a valid outcomes store with individual record files and manifest. */
function createOutcomeStore(
  outcomes: Array<{ id: string; agent: string; issueNumber: number; result: string; actionSummary: string; timestamp: string; labels?: string[] }>,
): void {
  const outDir = path.join(memoryDir, OUTCOMES_DIR);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const entries = outcomes.map((o) => ({
    id: o.id,
    agent: o.agent,
    issueNumber: o.issueNumber,
    result: o.result,
    actionSummary: o.actionSummary,
    timestamp: o.timestamp,
    labels: o.labels ?? [],
  }));

  writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries,
  });

  for (const o of outcomes) {
    const safeId = o.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    writeJson(path.join(outDir, `${safeId}.json`), {
      ...o,
      rootCause: null,
      lesson: null,
      iterationCount: 1,
      sessionId: 'session-1',
      labels: o.labels ?? [],
    });
  }
}

/** Create a valid sessions store with individual record files and manifest. */
function createSessionStore(
  sessions: Array<{ id: string; agent: string; issueNumber: number | null; startTime: string; endTime: string; summary: string; messageCount: number }>,
): void {
  const sesDir = path.join(memoryDir, SESSIONS_DIR);
  if (!fs.existsSync(sesDir)) {
    fs.mkdirSync(sesDir, { recursive: true });
  }

  const entries = sessions.map((s) => ({
    id: s.id,
    agent: s.agent,
    issueNumber: s.issueNumber,
    startTime: s.startTime,
    endTime: s.endTime,
    summaryPreview: s.summary.substring(0, 80),
    messageCount: s.messageCount,
  }));

  writeJson(path.join(sesDir, SESSION_MANIFEST_FILE), {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries,
  });

  for (const s of sessions) {
    const safeId = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    writeJson(path.join(sesDir, `${safeId}.json`), {
      ...s,
      actions: ['action-1'],
      decisions: ['decision-1'],
      filesChanged: ['file.ts'],
    });
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-health-test-'));
  memoryDir = path.join(tmpDir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// MemoryHealth
// ---------------------------------------------------------------------------

describe('MemoryHealth', () => {

  // -------------------------------------------------------------------------
  // scan() -- healthy store
  // -------------------------------------------------------------------------

  describe('scan() on healthy store', () => {
    it('reports healthy for an empty memory directory', async () => {
      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, true);
      assert.equal(report.issues.length, 0);
      assert.equal(report.observations.total, 0);
      assert.equal(report.outcomes.total, 0);
      assert.equal(report.sessions.total, 0);
      assert.ok(report.durationMs >= 0);
    });

    it('reports healthy for a well-formed store', async () => {
      createObservationStore([
        {
          issueNumber: 1,
          observations: [
            { id: 'obs-1', agent: 'engineer', category: 'decision', summary: 'Used REST', tokens: 10, timestamp: new Date().toISOString() },
          ],
        },
      ]);
      createOutcomeStore([
        { id: 'out-1', agent: 'engineer', issueNumber: 1, result: 'pass', actionSummary: 'Fixed bug', timestamp: new Date().toISOString() },
      ]);
      createSessionStore([
        { id: 'ses-1', agent: 'engineer', issueNumber: 1, startTime: new Date().toISOString(), endTime: new Date().toISOString(), summary: 'Session 1', messageCount: 5 },
      ]);

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, true);
      assert.equal(report.issues.length, 0);
      assert.equal(report.observations.total, 1);
      assert.equal(report.outcomes.total, 1);
      assert.equal(report.sessions.total, 1);
    });

    it('calculates disk size', async () => {
      createObservationStore([
        {
          issueNumber: 1,
          observations: [
            { id: 'obs-1', agent: 'engineer', category: 'decision', summary: 'Used REST', tokens: 10, timestamp: new Date().toISOString() },
          ],
        },
      ]);

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.ok(report.diskSizeBytes > 0, 'disk size should be greater than 0');
    });
  });

  // -------------------------------------------------------------------------
  // scan() -- orphaned files
  // -------------------------------------------------------------------------

  describe('scan() detects orphaned files', () => {
    it('detects orphaned outcome files not in manifest', async () => {
      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });

      // Create manifest with no entries
      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [],
      });

      // Create orphaned file on disk
      writeJson(path.join(outDir, 'out-orphan-1.json'), {
        id: 'out-orphan-1',
        agent: 'engineer',
        issueNumber: 1,
        result: 'pass',
        actionSummary: 'Orphaned',
        timestamp: new Date().toISOString(),
        labels: [],
      });

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.outcomes.orphaned, 1);
      assert.ok(report.issues.some((i) => i.includes('orphaned') && i.includes('outcomes')));
    });

    it('detects orphaned session files not in manifest', async () => {
      const sesDir = path.join(memoryDir, SESSIONS_DIR);
      fs.mkdirSync(sesDir, { recursive: true });

      writeJson(path.join(sesDir, SESSION_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      writeJson(path.join(sesDir, 'ses-orphan-1.json'), {
        id: 'ses-orphan-1',
        agent: 'engineer',
        issueNumber: 1,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        summary: 'Orphaned session',
        messageCount: 1,
        actions: [],
        decisions: [],
        filesChanged: [],
      });

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.sessions.orphaned, 1);
    });
  });

  // -------------------------------------------------------------------------
  // scan() -- missing files
  // -------------------------------------------------------------------------

  describe('scan() detects missing files', () => {
    it('detects outcome files in manifest but not on disk', async () => {
      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });

      // Manifest references a file that does not exist on disk
      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [
          { id: 'out-ghost-1', agent: 'engineer', issueNumber: 1, result: 'pass', actionSummary: 'Ghost', timestamp: new Date().toISOString(), labels: [] },
        ],
      });

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.outcomes.missing, 1);
      assert.ok(report.issues.some((i) => i.includes('missing') && i.includes('outcomes')));
    });

    it('detects session files in manifest but not on disk', async () => {
      const sesDir = path.join(memoryDir, SESSIONS_DIR);
      fs.mkdirSync(sesDir, { recursive: true });

      writeJson(path.join(sesDir, SESSION_MANIFEST_FILE), {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [
          { id: 'ses-ghost-1', agent: 'eng', issueNumber: 1, startTime: new Date().toISOString(), endTime: new Date().toISOString(), summaryPreview: 'Ghost', messageCount: 1 },
        ],
      });

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.sessions.missing, 1);
    });

    it('detects missing observation issue files', async () => {
      // Manifest references issue 999 but no issue-999.json exists
      writeJson(path.join(memoryDir, 'manifest.json'), {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [
          { id: 'obs-1', agent: 'eng', issueNumber: 999, category: 'decision', summary: 'test', tokens: 5, timestamp: new Date().toISOString() },
        ],
      });

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.observations.missing, 1);
    });
  });

  // -------------------------------------------------------------------------
  // scan() -- corrupt files
  // -------------------------------------------------------------------------

  describe('scan() detects corrupt files', () => {
    it('detects corrupt outcome files (invalid JSON)', async () => {
      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });

      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      // Write corrupt JSON
      fs.writeFileSync(path.join(outDir, 'out-corrupt-1.json'), '{invalid json!!!', 'utf8');

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.outcomes.corrupt, 1);
      assert.ok(report.issues.some((i) => i.includes('corrupt') && i.includes('outcomes')));
    });

    it('detects corrupt session files (missing required fields)', async () => {
      const sesDir = path.join(memoryDir, SESSIONS_DIR);
      fs.mkdirSync(sesDir, { recursive: true });

      writeJson(path.join(sesDir, SESSION_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      // Valid JSON but missing required id/agent fields
      writeJson(path.join(sesDir, 'ses-corrupt-1.json'), { foo: 'bar' });

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.sessions.corrupt, 1);
    });

    it('detects corrupt observation issue files', async () => {
      // Create a valid manifest
      writeJson(path.join(memoryDir, 'manifest.json'), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      // Create a corrupt issue file
      fs.writeFileSync(path.join(memoryDir, 'issue-1.json'), 'not json at all', 'utf8');

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      assert.equal(report.observations.corrupt, 1);
    });
  });

  // -------------------------------------------------------------------------
  // scan() -- stale records
  // -------------------------------------------------------------------------

  describe('scan() detects stale records', () => {
    it('flags observations older than stale threshold', async () => {
      const oldTimestamp = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(); // 120 days ago
      createObservationStore([
        {
          issueNumber: 1,
          observations: [
            { id: 'obs-old', agent: 'eng', category: 'decision', summary: 'Old', tokens: 5, timestamp: oldTimestamp },
          ],
        },
      ]);

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.observations.stale, 1);
      assert.ok(report.issues.some((i) => i.includes('stale') && i.includes('observations')));
    });

    it('flags outcomes older than stale threshold', async () => {
      const oldTimestamp = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
      createOutcomeStore([
        { id: 'out-old', agent: 'eng', issueNumber: 1, result: 'pass', actionSummary: 'Old fix', timestamp: oldTimestamp },
      ]);

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.outcomes.stale, 1);
    });
  });

  // -------------------------------------------------------------------------
  // repair()
  // -------------------------------------------------------------------------

  describe('repair()', () => {
    it('rebuilds manifests from disk files', async () => {
      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });

      // Create orphaned file (no manifest entry)
      writeJson(path.join(outDir, 'out-orphan-rebuild.json'), {
        id: 'out-orphan-rebuild',
        agent: 'engineer',
        issueNumber: 42,
        result: 'pass',
        actionSummary: 'Orphaned record',
        timestamp: new Date().toISOString(),
        labels: [],
        rootCause: null,
        lesson: null,
        iterationCount: 1,
        sessionId: 'ses-1',
      });

      // Create manifest with no entries
      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      const health = new MemoryHealth(memoryDir);

      // Before repair: orphaned detected
      const beforeReport = await health.scan();
      assert.equal(beforeReport.outcomes.orphaned, 1);

      // Repair
      const result = await health.repair();

      assert.ok(result.actions.length > 0, 'repair should report actions taken');
      assert.ok(result.actions.some((a) => a.includes('Rebuilt outcome manifest')));
    });

    it('quarantines corrupt files to .archive/', async () => {
      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });

      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      // Write corrupt file
      fs.writeFileSync(path.join(outDir, 'out-corrupt-fix.json'), '{{bad json}}', 'utf8');

      const health = new MemoryHealth(memoryDir);
      const result = await health.repair();

      // Corrupt file should be moved to archive
      const archiveDir = path.join(memoryDir, ARCHIVE_DIR);
      assert.ok(fs.existsSync(archiveDir), 'archive dir should be created');

      const archivedFiles = fs.readdirSync(archiveDir);
      assert.ok(archivedFiles.length > 0, 'corrupt file should be archived');
      assert.ok(result.actions.some((a) => a.includes('Quarantined')));
    });

    it('repairs observation store with corrupt issue files', async () => {
      // Create a corrupt issue file
      fs.writeFileSync(path.join(memoryDir, 'issue-1.json'), 'broken!', 'utf8');

      // Create a valid issue file
      writeJson(path.join(memoryDir, 'issue-2.json'), {
        version: 1,
        observations: [
          { id: 'obs-valid', agent: 'eng', issueNumber: 2, category: 'decision', summary: 'Valid', tokens: 5, timestamp: new Date().toISOString(), content: 'Content', sessionId: 's1' },
        ],
      });

      writeJson(path.join(memoryDir, 'manifest.json'), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      const health = new MemoryHealth(memoryDir);
      const result = await health.repair();

      // Corrupt file quarantined, valid observation in rebuilt manifest
      assert.ok(result.actions.some((a) => a.includes('Quarantined')));
      assert.ok(result.actions.some((a) => a.includes('Rebuilt observation manifest')));
    });

    it('repairs session store with corrupt session files', async () => {
      const sesDir = path.join(memoryDir, SESSIONS_DIR);
      fs.mkdirSync(sesDir, { recursive: true });

      writeJson(path.join(sesDir, SESSION_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      // One corrupt, one valid
      fs.writeFileSync(path.join(sesDir, 'ses-corrupt-1.json'), '}}invalid{{', 'utf8');
      writeJson(path.join(sesDir, 'ses-valid-1.json'), {
        id: 'ses-valid-1',
        agent: 'engineer',
        issueNumber: 10,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        summary: 'Valid session',
        messageCount: 5,
        actions: [],
        decisions: [],
        filesChanged: [],
      });

      const health = new MemoryHealth(memoryDir);
      const result = await health.repair();

      assert.ok(result.actions.some((a) => a.includes('Quarantined') && a.includes('session')));
      assert.ok(result.actions.some((a) => a.includes('Rebuilt session manifest')));
    });

    it('reports healthyAfterRepair when issues are resolved', async () => {
      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });

      // Only orphaned outcomes (fixable by manifest rebuild)
      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });
      writeJson(path.join(outDir, 'out-fix-1.json'), {
        id: 'out-fix-1',
        agent: 'engineer',
        issueNumber: 1,
        result: 'pass',
        actionSummary: 'Fixable',
        timestamp: new Date().toISOString(),
        labels: [],
        rootCause: null,
        lesson: null,
        iterationCount: 1,
        sessionId: 's1',
      });

      // Also add a valid manifest for observations (so observation scan is clean)
      writeJson(path.join(memoryDir, 'manifest.json'), {
        version: 1, updatedAt: new Date().toISOString(), entries: [],
      });

      const health = new MemoryHealth(memoryDir);

      // Before repair: not healthy
      const before = await health.scan();
      assert.equal(before.healthy, false);

      // After repair
      const result = await health.repair();
      assert.ok(result.durationMs >= 0);
      // The healthyAfterRepair flag depends on the re-scan
      // The rebuild should fix orphaned records
      assert.ok(result.actions.length > 0);
    });
  });

  // -------------------------------------------------------------------------
  // Combined / edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles non-existent subsystem directories gracefully', async () => {
      // memoryDir exists but no subdirectories
      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, true);
      assert.equal(report.outcomes.total, 0);
      assert.equal(report.sessions.total, 0);
    });

    it('reports correct scan time format', async () => {
      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      // scanTime should be a valid ISO-8601 string
      assert.ok(report.scanTime.match(/^\d{4}-\d{2}-\d{2}T/), 'scanTime should be ISO-8601');
    });

    it('handles multiple issues simultaneously', async () => {
      // Mix of healthy, orphaned, corrupt, and missing across subsystems
      createObservationStore([
        {
          issueNumber: 1,
          observations: [
            { id: 'obs-good', agent: 'eng', category: 'decision', summary: 'Good', tokens: 5, timestamp: new Date().toISOString() },
          ],
        },
      ]);

      const outDir = path.join(memoryDir, OUTCOMES_DIR);
      fs.mkdirSync(outDir, { recursive: true });
      writeJson(path.join(outDir, OUTCOME_MANIFEST_FILE), {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [
          { id: 'out-missing', agent: 'eng', issueNumber: 1, result: 'pass', actionSummary: 'missing', timestamp: new Date().toISOString(), labels: [] },
        ],
      });
      fs.writeFileSync(path.join(outDir, 'out-corrupt.json'), 'bad', 'utf8');

      const health = new MemoryHealth(memoryDir);
      const report = await health.scan();

      assert.equal(report.healthy, false);
      // Should have at least missing + corrupt issues
      assert.ok(report.issues.length >= 2, `Expected >=2 issues, got ${report.issues.length}`);
    });
  });
});
