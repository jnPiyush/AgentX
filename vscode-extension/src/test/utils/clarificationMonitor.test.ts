import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClarificationMonitor } from '../../utils/clarificationMonitor';
import { ClarificationRouter } from '../../utils/clarificationRouter';
import { ClarificationRecord, ClarificationLedger } from '../../utils/clarificationTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-monitor-test-'));
}

function makeRouterAndMonitor(workspaceRoot: string): { router: ClarificationRouter; monitor: ClarificationMonitor } {
  const router = new ClarificationRouter({ workspaceRoot });
  const monitor = new ClarificationMonitor(router);
  return { router, monitor };
}

function makeRecord(overrides: Partial<ClarificationRecord> = {}): ClarificationRecord {
  const base: ClarificationRecord = {
    id: `clar-${Math.random().toString(36).slice(2, 8)}`,
    issueNumber: 1,
    from: 'engineer',
    to: 'architect',
    topic: 'algorithm choice',
    blocking: false,
    status: 'pending',
    round: 1,
    maxRounds: 3,
    created: new Date().toISOString(),
    staleAfter: new Date(Date.now() + 3_600_000).toISOString(),
    resolvedAt: null,
    thread: [],
  };
  return { ...base, ...overrides };
}

function writeLedger(workspaceRoot: string, ledger: ClarificationLedger): void {
  const clarDir = path.join(workspaceRoot, '.agentx', 'state', 'clarifications');
  fs.mkdirSync(clarDir, { recursive: true });
  fs.writeFileSync(
    path.join(clarDir, `issue-${ledger.issueNumber}.json`),
    JSON.stringify(ledger, null, 2),
    'utf8'
  );
}

// ---------------------------------------------------------------------------
// Stale detection
// ---------------------------------------------------------------------------

describe('ClarificationMonitor -- stale detection', () => {
  let dir: string;
  let monitor: ClarificationMonitor;

  beforeEach(() => {
    dir = makeTmpDir();
    ({ monitor } = makeRouterAndMonitor(dir));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not mark fresh pending record as stale', async () => {
    const rec = makeRecord();
    writeLedger(dir, { issueNumber: 1, clarifications: [rec] });

    const report = await monitor.runCheck();
    assert.equal(report.stale.length, 0);
  });

  it('marks overdue pending record as stale', async () => {
    const rec = makeRecord({
      staleAfter: new Date(Date.now() - 1_000).toISOString(),
    });
    writeLedger(dir, { issueNumber: 1, clarifications: [rec] });

    const report = await monitor.runCheck();
    assert.ok(report.stale.some(r => r.id === rec.id), 'stale record must appear in report.stale');
  });

  it('does not report resolved records as stale', async () => {
    const rec = makeRecord({
      status: 'resolved',
      staleAfter: new Date(Date.now() - 1_000).toISOString(),
    });
    writeLedger(dir, { issueNumber: 1, clarifications: [rec] });

    const report = await monitor.runCheck();
    assert.equal(report.stale.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Stuck detection (Jaccard similarity on question text)
// ---------------------------------------------------------------------------

describe('ClarificationMonitor -- stuck detection', () => {
  let dir: string;
  let monitor: ClarificationMonitor;

  beforeEach(() => {
    dir = makeTmpDir();
    ({ monitor } = makeRouterAndMonitor(dir));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not flag record with single question', async () => {
    const rec = makeRecord({
      thread: [{ round: 1, from: 'engineer', type: 'question' as const, body: 'Which sort algorithm?', timestamp: new Date().toISOString() }],
    });
    writeLedger(dir, { issueNumber: 2, clarifications: [rec] });

    const report = await monitor.runCheck();
    assert.equal(report.stuck.length, 0);
  });

  it('flags record when last two questions are nearly identical', async () => {
    const sameQuestion = 'Which sort algorithm should I use for large datasets? Please advise.';
    const rec = makeRecord({
      round: 2,
      thread: [
        { round: 1, from: 'engineer', type: 'question' as const, body: sameQuestion, timestamp: new Date().toISOString() },
        { round: 2, from: 'engineer', type: 'question' as const, body: sameQuestion, timestamp: new Date().toISOString() },
      ],
    });
    writeLedger(dir, { issueNumber: 3, clarifications: [rec] });

    const report = await monitor.runCheck();
    assert.ok(report.stuck.some(r => r.id === rec.id), `expected ${rec.id} in stuck records`);
  });

  it('does not flag record when questions are semantically different', async () => {
    const rec = makeRecord({
      round: 2,
      thread: [
        { round: 1, from: 'engineer', type: 'question' as const, body: 'What sorting algorithm is best?', timestamp: new Date().toISOString() },
        { round: 2, from: 'engineer', type: 'question' as const, body: 'Should we use Redis or Memcached?', timestamp: new Date().toISOString() },
      ],
    });
    writeLedger(dir, { issueNumber: 4, clarifications: [rec] });

    const report = await monitor.runCheck();
    assert.equal(report.stuck.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Deadlock detection
// ---------------------------------------------------------------------------

describe('ClarificationMonitor -- deadlock detection', () => {
  let dir: string;
  let monitor: ClarificationMonitor;

  beforeEach(() => {
    dir = makeTmpDir();
    ({ monitor } = makeRouterAndMonitor(dir));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects mutual A->B and B->A pending on same issue', async () => {
    const recAB = makeRecord({ id: 'clar-ab', issueNumber: 5, from: 'engineer', to: 'architect' });
    const recBA = makeRecord({ id: 'clar-ba', issueNumber: 5, from: 'architect', to: 'engineer' });
    writeLedger(dir, { issueNumber: 5, clarifications: [recAB, recBA] });

    const report = await monitor.runCheck();
    assert.ok(report.deadlocked.length > 0, 'deadlock pair must be reported');
    const flatIds = report.deadlocked.flatMap(pair => [pair[0].id, pair[1].id]);
    assert.ok(flatIds.includes('clar-ab') && flatIds.includes('clar-ba'));
  });

  it('does not flag mutual pending on different issues', async () => {
    writeLedger(dir, { issueNumber: 10, clarifications: [makeRecord({ id: 'clar-ab2', issueNumber: 10, from: 'engineer', to: 'architect' })] });
    writeLedger(dir, { issueNumber: 11, clarifications: [makeRecord({ id: 'clar-ba2', issueNumber: 11, from: 'architect', to: 'engineer' })] });

    const report = await monitor.runCheck();
    assert.equal(report.deadlocked.length, 0);
  });

  it('does not include resolved records in deadlock check', async () => {
    const recAB = makeRecord({ id: 'clar-ab3', issueNumber: 6, from: 'engineer', to: 'architect', status: 'resolved' });
    const recBA = makeRecord({ id: 'clar-ba3', issueNumber: 6, from: 'architect', to: 'engineer' });
    writeLedger(dir, { issueNumber: 6, clarifications: [recAB, recBA] });

    const report = await monitor.runCheck();
    assert.equal(report.deadlocked.length, 0);
  });
});

// ---------------------------------------------------------------------------
// getSummary (sync)
// ---------------------------------------------------------------------------

describe('ClarificationMonitor -- getSummary', () => {
  let dir: string;
  let monitor: ClarificationMonitor;

  beforeEach(() => {
    dir = makeTmpDir();
    ({ monitor } = makeRouterAndMonitor(dir));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns zero counts when no clarifications exist', () => {
    const summary = monitor.getSummary();
    assert.equal(summary.active, 0);
    assert.equal(summary.pending, 0);
    assert.equal(summary.stale, 0);
    assert.equal(summary.escalated, 0);
  });

  it('counts records by status correctly', () => {
    writeLedger(dir, {
      issueNumber: 20,
      clarifications: [
        makeRecord({ status: 'pending' }),
        makeRecord({ status: 'pending' }),
        makeRecord({ status: 'stale' }),
        makeRecord({ status: 'escalated' }),
        makeRecord({ status: 'resolved' }),
      ],
    });

    const summary = monitor.getSummary();
    assert.equal(summary.pending, 2);
    assert.equal(summary.escalated, 1);
    assert.ok(summary.active >= 3, 'active = pending + stale + escalated at minimum');
  });
});
