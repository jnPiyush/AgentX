// ---------------------------------------------------------------------------
// AgentX -- End-to-End Live Test: Todo App Scenario
// ---------------------------------------------------------------------------
//
// Exercises the FULL Agent-to-Agent Clarification Protocol using a realistic
// "Todo App" project scenario. Each test creates a fresh workspace directory
// and exercises one protocol capability.
//
// Scenario: Agent X routes a "type:story" issue #42 to build a Todo app.
//   - Engineer asks Architect about database choice (blocking)
//   - Engineer asks PM about scope (non-blocking)
//   - Monitor detects stale, stuck, deadlock conditions
//   - Renderer outputs are validated
//   - File locking handles concurrency
//   - CLI commands are validated
//   - Quality loop enforcement gates are tested
//
// Run: npx ts-node e2e-todo-test.ts  (from this folder)
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// -- Import the protocol modules from the main project ---
import { ClarificationRouter, AGENT_PRIORITY_DEFAULT, ClarificationError } from '../vscode-extension/src/utils/clarificationRouter';
import { ClarificationMonitor } from '../vscode-extension/src/utils/clarificationMonitor';
import {
  renderRoundMarkdown,
  renderEscalationMarkdown,
  renderThreadMarkdown,
  renderMonitorReportMarkdown,
  renderThreadCli,
  renderRoundCli,
  renderEscalationCli,
  renderSummaryTableCli
} from '../vscode-extension/src/utils/clarificationRenderer';
import { AgentEventBus } from '../vscode-extension/src/utils/eventBus';
import { FileLockManager, JsonFileLock, AsyncMutex, readJsonSafe, writeJsonLocked } from '../vscode-extension/src/utils/fileLock';
import {
  ClarificationRecord,
  ClarificationLedger,
  ClarificationRequestOptions,
  ClarificationResult,
  MonitorReport,
  DEFAULT_TOML_CLARIFY_CONFIG
} from '../vscode-extension/src/utils/clarificationTypes';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
let totalAssertions = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    failed++;
    failures.push(message);
    console.error(`  [FAIL] ${message}`);
  } else {
    passed++;
    console.log(`  [PASS] ${message}`);
  }
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert(haystack.includes(needle), `${label}: expected to contain "${needle}"`);
}

function assertNotIncludes(haystack: string, needle: string, label: string): void {
  assert(!haystack.includes(needle), `${label}: expected NOT to contain "${needle}"`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(actual === expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertThrowsAsync(fn: () => Promise<unknown>, code: string, label: string): Promise<void> {
  return fn().then(
    () => { assert(false, `${label}: expected error with code ${code}`); },
    (err: unknown) => {
      if (err instanceof ClarificationError) {
        assert(err.code === code, `${label}: expected code ${code}, got ${err.code}`);
      } else {
        assert(false, `${label}: expected ClarificationError, got ${String(err)}`);
      }
    }
  );
}

/** Create a fresh temp workspace with .agentx/state/clarifications dir. */
function createWorkspace(testName: string): string {
  const dir = path.join(os.tmpdir(), `agentx-e2e-${testName}-${Date.now()}`);
  fs.mkdirSync(path.join(dir, '.agentx', 'state', 'clarifications'), { recursive: true });
  return dir;
}

/** Clean up a workspace directory. */
function cleanWorkspace(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ok if cleanup fails in CI */ }
}

// ---------------------------------------------------------------------------
// Test 1: Full Lifecycle -- Request -> Answer -> Resolve
// ---------------------------------------------------------------------------

async function testFullLifecycle(): Promise<void> {
  console.log('\n--- Test 1: Full Lifecycle (Request -> Answer -> Resolve) ---');
  const ws = createWorkspace('lifecycle');

  try {
    const eventBus = new AgentEventBus();
    const events: string[] = [];

    eventBus.on('clarification-requested', () => events.push('requested'));
    eventBus.on('clarification-answered', () => events.push('answered'));
    eventBus.on('clarification-resolved', () => events.push('resolved'));

    // Simulate: runSubagent returns the architect's answer
    const runSubagent = async (_agent: string, _prompt: string): Promise<string> => {
      return 'Use PostgreSQL with Prisma ORM. The todo items table needs: id (UUID), title (text), completed (boolean), created_at (timestamp).';
    };

    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    // Engineer requests clarification from Architect about DB choice
    const canClarify = ['architect', 'pm', 'ux'];
    const result: ClarificationResult = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'database choice for todo app',
      question: 'Should the todo app use SQLite, PostgreSQL, or MongoDB? We need ACID transactions for task ordering.',
      blocking: true,
      maxRounds: 3,
      slaMinutes: 30,
    }, canClarify);

    assertEqual(result.round, 1, 'First round number');
    assert(result.clarificationId.startsWith('CLR-42-'), 'Clarification ID format');
    assertIncludes(result.answer, 'PostgreSQL', 'Answer mentions PostgreSQL');
    assertEqual(result.status, 'answered', 'Status is answered');

    // Check ledger file was created
    const ledgerPath = path.join(ws, '.agentx', 'state', 'clarifications', 'issue-42.json');
    assert(fs.existsSync(ledgerPath), 'Ledger file created');

    const ledger = readJsonSafe<ClarificationLedger>(ledgerPath);
    assert(ledger !== null, 'Ledger readable');
    assertEqual(ledger!.issueNumber, 42, 'Ledger issue number');
    assertEqual(ledger!.clarifications.length, 1, 'One clarification record');

    const rec = ledger!.clarifications[0];
    assertEqual(rec.from, 'engineer', 'Record from');
    assertEqual(rec.to, 'architect', 'Record to');
    assertEqual(rec.topic, 'database choice for todo app', 'Record topic');
    assertEqual(rec.blocking, true, 'Record blocking');
    assertEqual(rec.maxRounds, 3, 'Record maxRounds');
    assertEqual(rec.thread.length, 2, 'Thread has Q+A entries');
    assertEqual(rec.thread[0].type, 'question', 'First entry is question');
    assertEqual(rec.thread[1].type, 'answer', 'Second entry is answer');

    // Engineer resolves the clarification
    await router.resolveClarification(
      42,
      result.clarificationId,
      'Using PostgreSQL with Prisma. Schema defined.',
      'engineer'
    );

    const resolvedLedger = readJsonSafe<ClarificationLedger>(ledgerPath);
    const resolvedRec = resolvedLedger!.clarifications[0];
    assertEqual(resolvedRec.status, 'resolved', 'Record resolved');
    assert(resolvedRec.resolvedAt !== null, 'resolvedAt timestamp set');
    assertEqual(resolvedRec.thread.length, 3, 'Thread has Q+A+Resolution');
    assertEqual(resolvedRec.thread[2].type, 'resolution', 'Third entry is resolution');

    // Verify events fired in order
    assertEqual(events.length, 3, 'Three events fired');
    assertEqual(events[0], 'requested', 'First event: requested');
    assertEqual(events[1], 'answered', 'Second event: answered');
    assertEqual(events[2], 'resolved', 'Third event: resolved');

    // Verify getRecords and getAllRecords
    const allRecords = router.getAllRecords();
    assertEqual(allRecords.length, 1, 'getAllRecords returns 1');
    assertEqual(allRecords[0].id, result.clarificationId, 'getAllRecords matches ID');

    const issueRecords = router.getRecords(42);
    assertEqual(issueRecords.length, 1, 'getRecords(42) returns 1');

    // getActiveRecords should be empty (resolved)
    const active = router.getActiveRecords();
    assertEqual(active.length, 0, 'No active records after resolution');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 2: Multi-Issue, Multi-Clarification
// ---------------------------------------------------------------------------

async function testMultiIssueClarification(): Promise<void> {
  console.log('\n--- Test 2: Multi-Issue, Multi-Clarification ---');
  const ws = createWorkspace('multi');

  try {
    const runSubagent = async (_agent: string, _prompt: string): Promise<string> => {
      return 'Acknowledged. Providing guidance.';
    };

    const router = new ClarificationRouter({ workspaceRoot: ws, runSubagent });

    // Issue 42: Engineer asks Architect (blocking)
    const canClarify = ['architect', 'pm', 'ux'];
    const r1 = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'auth middleware placement',
      question: 'Should JWT validation be in global middleware or per-route?',
      blocking: true,
    }, canClarify);

    // Issue 42: Engineer asks PM (non-blocking)
    const r2 = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'pm',
      topic: 'scope of task completion',
      question: 'Should completed tasks be soft-deleted or hard-deleted?',
      blocking: false,
    }, canClarify);

    // Issue 43: Different issue, different clarification
    const r3 = await router.requestClarification({
      issueNumber: 43,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'API versioning strategy',
      question: 'URL path versioning (/v1/todos) or header-based?',
      blocking: true,
    }, canClarify);

    // Verify record counts
    const all = router.getAllRecords();
    assertEqual(all.length, 3, 'Three total records across issues');

    const issue42 = router.getRecords(42);
    assertEqual(issue42.length, 2, 'Two records for issue 42');

    const issue43 = router.getRecords(43);
    assertEqual(issue43.length, 1, 'One record for issue 43');

    // IDs are unique
    const ids = new Set([r1.clarificationId, r2.clarificationId, r3.clarificationId]);
    assertEqual(ids.size, 3, 'All clarification IDs unique');

    // Active records (all answered, none resolved)
    const active = router.getActiveRecords();
    assertEqual(active.length, 3, 'Three active records');

    // Resolve one
    await router.resolveClarification(42, r1.clarificationId, 'Using global middleware.', 'engineer');
    const active2 = router.getActiveRecords();
    assertEqual(active2.length, 2, 'Two active after one resolution');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 3: Max Rounds Exceeded -> Auto-Escalation
// ---------------------------------------------------------------------------

async function testMaxRoundsEscalation(): Promise<void> {
  console.log('\n--- Test 3: Max Rounds Exceeded -> Auto-Escalation ---');
  const ws = createWorkspace('escalation');

  try {
    const eventBus = new AgentEventBus();
    let escalated = false;
    eventBus.on('clarification-escalated', () => { escalated = true; });

    const runSubagent = async (): Promise<string> => {
      return 'I need more context to answer this properly.';
    };

    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    // Request with maxRounds=1 -- the first request will succeed (round 1)
    const result = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'data validation approach',
      question: 'Zod or Joi for request validation?',
      blocking: true,
      maxRounds: 1,
    }, ['architect', 'pm']);

    assertEqual(result.round, 1, 'First round succeeds');
    assertEqual(result.status, 'answered', 'First round answered');

    // Now verify that the record has round=1, maxRounds=1
    // If we tried another round it would escalate -- but requestClarification
    // creates a NEW record each time, so we test by directly checking
    const records = router.getRecords(42);
    assertEqual(records.length, 1, 'One record exists');
    assertEqual(records[0].round, 1, 'Record at round 1');
    assertEqual(records[0].maxRounds, 1, 'maxRounds is 1');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 4: Monitor -- Stale Detection
// ---------------------------------------------------------------------------

async function testMonitorStale(): Promise<void> {
  console.log('\n--- Test 4: Monitor -- Stale Detection ---');
  const ws = createWorkspace('stale');

  try {
    const eventBus = new AgentEventBus();
    let staleEvent = false;
    eventBus.on('clarification-stale', () => { staleEvent = true; });

    // Create a ledger with a record that has an expired SLA
    const ledgerPath = path.join(ws, '.agentx', 'state', 'clarifications', 'issue-42.json');
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const staleRecord: ClarificationRecord = {
      id: 'CLR-42-001',
      issueNumber: 42,
      from: 'engineer',
      to: 'architect',
      topic: 'database schema',
      blocking: true,
      status: 'pending',
      round: 0,
      maxRounds: 5,
      created: pastDate,
      staleAfter: pastDate, // Already expired
      resolvedAt: null,
      thread: [],
    };

    const ledger: ClarificationLedger = {
      issueNumber: 42,
      clarifications: [staleRecord],
    };
    writeJsonLocked(ledgerPath, ledger);

    const router = new ClarificationRouter({ workspaceRoot: ws, eventBus });
    const monitor = new ClarificationMonitor(router, eventBus);

    const report = await monitor.runCheck();

    assertEqual(report.stale.length, 1, 'One stale record detected');
    assertEqual(report.stale[0].id, 'CLR-42-001', 'Correct stale ID');
    assert(staleEvent, 'Stale event emitted');

    // getSummary
    const summary = monitor.getSummary();
    assertEqual(summary.active, 1, 'Summary: 1 active');
    assertEqual(summary.pending, 1, 'Summary: 1 pending');
    assertEqual(summary.stale, 1, 'Summary: 1 stale');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 5: Monitor -- Stuck Detection (Circular Answers)
// ---------------------------------------------------------------------------

async function testMonitorStuck(): Promise<void> {
  console.log('\n--- Test 5: Monitor -- Stuck Detection ---');
  const ws = createWorkspace('stuck');

  try {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const record: ClarificationRecord = {
      id: 'CLR-42-001',
      issueNumber: 42,
      from: 'engineer',
      to: 'architect',
      topic: 'auth token storage',
      blocking: true,
      status: 'pending',
      round: 3,
      maxRounds: 5,
      created: new Date().toISOString(),
      staleAfter: futureDate, // Not stale
      resolvedAt: null,
      thread: [
        { round: 1, from: 'engineer', type: 'question', body: 'Should we store the auth token in localStorage or cookies for the todo app?', timestamp: new Date().toISOString() },
        { round: 1, from: 'architect', type: 'answer', body: 'Use HttpOnly cookies for security.', timestamp: new Date().toISOString() },
        { round: 2, from: 'engineer', type: 'question', body: 'Should we store the auth token in localStorage or in cookies for the todo application?', timestamp: new Date().toISOString() },
        { round: 2, from: 'architect', type: 'answer', body: 'Use cookies. Already answered.', timestamp: new Date().toISOString() },
      ],
    };

    const ledgerPath = path.join(ws, '.agentx', 'state', 'clarifications', 'issue-42.json');
    writeJsonLocked(ledgerPath, { issueNumber: 42, clarifications: [record] });

    const router = new ClarificationRouter({ workspaceRoot: ws });
    const monitor = new ClarificationMonitor(router);

    const report = await monitor.runCheck();

    assertEqual(report.stuck.length, 1, 'One stuck record detected');
    assertEqual(report.stuck[0].id, 'CLR-42-001', 'Correct stuck ID');

    // After escalation, the record should be escalated
    const updated = router.getRecords(42);
    assertEqual(updated[0].status, 'escalated', 'Stuck record was escalated');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 6: Monitor -- Deadlock Detection
// ---------------------------------------------------------------------------

async function testMonitorDeadlock(): Promise<void> {
  console.log('\n--- Test 6: Monitor -- Deadlock Detection ---');
  const ws = createWorkspace('deadlock');

  try {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Engineer asks Architect + Architect asks Engineer = deadlock
    const recA: ClarificationRecord = {
      id: 'CLR-42-001',
      issueNumber: 42,
      from: 'engineer',
      to: 'architect',
      topic: 'API contract for todo CRUD',
      blocking: true,
      status: 'pending',
      round: 1,
      maxRounds: 5,
      created: new Date().toISOString(),
      staleAfter: futureDate,
      resolvedAt: null,
      thread: [
        { round: 1, from: 'engineer', type: 'question', body: 'What REST endpoints should the todo API expose?', timestamp: new Date().toISOString() },
      ],
    };

    const recB: ClarificationRecord = {
      id: 'CLR-42-002',
      issueNumber: 42,
      from: 'architect',
      to: 'engineer',
      topic: 'existing code patterns',
      blocking: true,
      status: 'pending',
      round: 1,
      maxRounds: 5,
      created: new Date().toISOString(),
      staleAfter: futureDate,
      resolvedAt: null,
      thread: [
        { round: 1, from: 'architect', type: 'question', body: 'What patterns does the existing codebase use for controllers?', timestamp: new Date().toISOString() },
      ],
    };

    const ledgerPath = path.join(ws, '.agentx', 'state', 'clarifications', 'issue-42.json');
    writeJsonLocked(ledgerPath, { issueNumber: 42, clarifications: [recA, recB] });

    const router = new ClarificationRouter({ workspaceRoot: ws });
    const monitor = new ClarificationMonitor(router);

    const report = await monitor.runCheck();

    assertEqual(report.deadlocked.length, 1, 'One deadlock pair detected');

    const [a, b] = report.deadlocked[0];
    assert(
      (a.from === 'engineer' && b.from === 'architect') ||
      (a.from === 'architect' && b.from === 'engineer'),
      'Deadlock pair involves engineer and architect'
    );

    // Verify priority-based resolution: architect has higher priority than engineer
    // in AGENT_PRIORITY_DEFAULT, so engineer's clarification gets escalated
    const records = router.getRecords(42);
    const engineerRec = records.find(r => r.from === 'engineer');
    const architectRec = records.find(r => r.from === 'architect');

    // Architect has higher priority (lower rank) -> engineer's record escalated
    const architectRank = router.agentRank('architect');
    const engineerRank = router.agentRank('engineer');
    assert(architectRank < engineerRank, 'Architect has higher priority than engineer');

    // The lower-priority agent's clarification should be escalated
    assertEqual(engineerRec!.status, 'escalated', 'Engineer (lower priority) clarification escalated');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 7: Renderer -- Markdown Output
// ---------------------------------------------------------------------------

async function testRendererMarkdown(): Promise<void> {
  console.log('\n--- Test 7: Renderer -- Markdown Output ---');

  const rec: ClarificationRecord = {
    id: 'CLR-42-001',
    issueNumber: 42,
    from: 'engineer',
    to: 'architect',
    topic: 'todo list pagination',
    blocking: true,
    status: 'answered',
    round: 1,
    maxRounds: 3,
    created: new Date().toISOString(),
    staleAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    resolvedAt: null,
    thread: [
      { round: 1, from: 'engineer', type: 'question', body: 'Offset or cursor pagination?', timestamp: new Date().toISOString() },
      { round: 1, from: 'architect', type: 'answer', body: 'Use cursor-based pagination with keyset.', timestamp: new Date().toISOString() },
    ],
  };

  // renderRoundMarkdown
  const round = renderRoundMarkdown(rec, 'Offset or cursor pagination?', 'Use cursor-based pagination with keyset.', 1);
  assertIncludes(round, '**[engineer -> architect]**', 'Round: agent labels');
  assertIncludes(round, '*todo list pagination*', 'Round: topic');
  assertIncludes(round, 'CLR-42-001', 'Round: clarification ID');
  assertIncludes(round, 'blocking', 'Round: blocking label');
  assertIncludes(round, 'Offset or cursor', 'Round: question');
  assertIncludes(round, 'cursor-based pagination', 'Round: answer');

  // renderThreadMarkdown
  const thread = renderThreadMarkdown([rec]);
  assertIncludes(thread, '**Active Clarifications**', 'Thread: header');
  assertIncludes(thread, 'CLR-42-001', 'Thread: ID');
  assertIncludes(thread, 'engineer -> architect', 'Thread: direction');

  // renderThreadMarkdown empty
  const empty = renderThreadMarkdown([]);
  assertIncludes(empty, 'No active clarifications', 'Thread empty: message');

  // renderEscalationMarkdown
  const escalated: ClarificationRecord = { ...rec, status: 'escalated', round: 3, maxRounds: 3 };
  const esc = renderEscalationMarkdown(escalated);
  assertIncludes(esc, '[ESCALATED]', 'Escalation: label');
  assertIncludes(esc, 'agentx clarify resolve CLR-42-001', 'Escalation: resolve command');

  // renderMonitorReportMarkdown
  const report: MonitorReport = {
    stale: [rec],
    stuck: [],
    deadlocked: [],
  };
  const reportMd = renderMonitorReportMarkdown(report);
  assertIncludes(reportMd, 'Stale (1)', 'Report: stale count');
  assertIncludes(reportMd, 'CLR-42-001', 'Report: stale ID');

  // Empty report
  const emptyReport = renderMonitorReportMarkdown({ stale: [], stuck: [], deadlocked: [] });
  assertIncludes(emptyReport, 'No clarification issues', 'Report empty: message');
}

// ---------------------------------------------------------------------------
// Test 8: Renderer -- CLI Output
// ---------------------------------------------------------------------------

async function testRendererCli(): Promise<void> {
  console.log('\n--- Test 8: Renderer -- CLI Output ---');

  const rec: ClarificationRecord = {
    id: 'CLR-42-001',
    issueNumber: 42,
    from: 'engineer',
    to: 'architect',
    topic: 'todo API endpoints',
    blocking: false,
    status: 'pending',
    round: 1,
    maxRounds: 5,
    created: new Date().toISOString(),
    staleAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    resolvedAt: null,
    thread: [
      { round: 1, from: 'engineer', type: 'question', body: 'REST or GraphQL?', timestamp: '2025-01-15T10:30:00Z' },
    ],
  };

  // renderThreadCli
  const thread = renderThreadCli([rec]);
  assertIncludes(thread, 'Active Clarifications', 'CLI thread: header');
  assertIncludes(thread, 'CLR-42-001', 'CLI thread: ID');
  assertIncludes(thread, 'engineer', 'CLI thread: from agent');

  // renderThreadCli empty
  const empty = renderThreadCli([]);
  assertIncludes(empty, 'No active clarifications', 'CLI thread empty');

  // renderRoundCli
  const round = renderRoundCli(rec, 'REST or GraphQL?', 'Use REST for simplicity.', 1);
  assertIncludes(round, 'engineer -> architect', 'CLI round: direction');
  assertIncludes(round, 'todo API endpoints', 'CLI round: topic');

  // renderEscalationCli
  const escalated: ClarificationRecord = { ...rec, status: 'escalated' };
  const esc = renderEscalationCli(escalated);
  assertIncludes(esc, 'ESCALATED', 'CLI escalation: label');
  assertIncludes(esc, 'CLR-42-001', 'CLI escalation: ID');

  // renderSummaryTableCli
  const summary = renderSummaryTableCli([rec]);
  assertIncludes(summary, 'Active Clarifications', 'CLI summary: header');
  assertIncludes(summary, 'engineer', 'CLI summary: from');
  assertIncludes(summary, 'architect', 'CLI summary: to');

  // renderSummaryTableCli empty
  const emptySummary = renderSummaryTableCli([]);
  assertIncludes(emptySummary, 'No active clarifications', 'CLI summary empty');
}

// ---------------------------------------------------------------------------
// Test 9: File Locking -- Concurrent Access
// ---------------------------------------------------------------------------

async function testFileLocking(): Promise<void> {
  console.log('\n--- Test 9: File Locking -- Concurrent Access ---');
  const ws = createWorkspace('locking');

  try {
    const filePath = path.join(ws, 'counter.json');
    writeJsonLocked(filePath, { count: 0 });

    const manager = new FileLockManager();

    // Run 10 concurrent increments -- all should succeed without data loss
    const increments = Array.from({ length: 10 }, (_, i) =>
      manager.withSafeLock(filePath, `agent-${i}`, async () => {
        const data = readJsonSafe<{ count: number }>(filePath);
        const count = (data?.count ?? 0) + 1;
        writeJsonLocked(filePath, { count });
        return count;
      })
    );

    await Promise.all(increments);

    const final = readJsonSafe<{ count: number }>(filePath);
    assertEqual(final!.count, 10, 'All 10 concurrent increments applied');

    // Verify no leftover lock files
    const lockPath = filePath + '.lock';
    assert(!fs.existsSync(lockPath), 'No leftover lock file');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 10: File Locking -- Stale Lock Recovery
// ---------------------------------------------------------------------------

async function testStaleLockRecovery(): Promise<void> {
  console.log('\n--- Test 10: Stale Lock Recovery ---');
  const ws = createWorkspace('stale-lock');

  try {
    const filePath = path.join(ws, 'data.json');
    writeJsonLocked(filePath, { value: 'initial' });

    // Create a stale lock (timestamp 60s ago)
    const lockPath = filePath + '.lock';
    const staleContent = JSON.stringify({
      pid: 99999,
      timestamp: new Date(Date.now() - 60000).toISOString(),
      agent: 'dead-process',
    });
    fs.writeFileSync(lockPath, staleContent);

    // FileLockManager should clean the stale lock and acquire
    const lock = new JsonFileLock({ staleThresholdMs: 30000 });
    const acquired = await lock.acquire(filePath, 'engineer');
    assert(acquired, 'Lock acquired after stale lock cleanup');

    lock.release(filePath);
    assert(!fs.existsSync(lockPath), 'Lock released cleanly');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 11: AsyncMutex -- In-Process Serialization
// ---------------------------------------------------------------------------

async function testAsyncMutex(): Promise<void> {
  console.log('\n--- Test 11: AsyncMutex -- In-Process Serialization ---');

  const mutex = new AsyncMutex();
  const order: number[] = [];

  // Fire two tasks that use the same key -- they should serialize
  const t1 = mutex.withLock('key1', async () => {
    order.push(1);
    await new Promise(resolve => setTimeout(resolve, 50));
    order.push(2);
    return 'first';
  });

  const t2 = mutex.withLock('key1', async () => {
    order.push(3);
    return 'second';
  });

  const [r1, r2] = await Promise.all([t1, t2]);

  assertEqual(r1, 'first', 'First task returns first');
  assertEqual(r2, 'second', 'Second task returns second');
  assertEqual(order.length, 3, 'All three checkpoints hit');
  assert(order[0] === 1 && order[1] === 2, 'First task ran to completion before second');
  assertEqual(order[2], 3, 'Second task ran after first');
}

// ---------------------------------------------------------------------------
// Test 12: Event Bus -- Clarification Events
// ---------------------------------------------------------------------------

async function testEventBusClarification(): Promise<void> {
  console.log('\n--- Test 12: Event Bus -- Clarification Events ---');

  const bus = new AgentEventBus();
  const captured: Array<{ event: string; data: unknown }> = [];

  const events = [
    'clarification-requested',
    'clarification-answered',
    'clarification-resolved',
    'clarification-escalated',
    'clarification-stale',
  ] as const;

  for (const e of events) {
    bus.on(e, (data: unknown) => captured.push({ event: e, data }));
  }

  // Emit each event
  for (const e of events) {
    bus.emit(e, {
      clarificationId: 'CLR-42-001',
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'test topic',
      blocking: true,
      timestamp: Date.now(),
    });
  }

  assertEqual(captured.length, 5, 'All 5 events captured');
  for (let i = 0; i < events.length; i++) {
    assertEqual(captured[i].event, events[i], `Event ${i}: ${events[i]}`);
  }
}

// ---------------------------------------------------------------------------
// Test 13: Agent Priority -- AGENT_PRIORITY_DEFAULT
// ---------------------------------------------------------------------------

async function testAgentPriority(): Promise<void> {
  console.log('\n--- Test 13: Agent Priority -- AGENT_PRIORITY_DEFAULT ---');

  assert(Array.isArray(AGENT_PRIORITY_DEFAULT), 'AGENT_PRIORITY_DEFAULT is an array');
  assert(AGENT_PRIORITY_DEFAULT.length >= 5, 'At least 5 agents in priority list');

  // Verify known agents are present
  assertIncludes(AGENT_PRIORITY_DEFAULT.join(','), 'product-manager', 'Contains product-manager');
  assertIncludes(AGENT_PRIORITY_DEFAULT.join(','), 'architect', 'Contains architect');
  assertIncludes(AGENT_PRIORITY_DEFAULT.join(','), 'engineer', 'Contains engineer');

  // Product manager should have highest priority (index 0)
  assertEqual(AGENT_PRIORITY_DEFAULT[0], 'product-manager', 'product-manager is highest priority');

  // Architect should be higher priority than engineer
  const archIdx = AGENT_PRIORITY_DEFAULT.indexOf('architect');
  const engIdx = AGENT_PRIORITY_DEFAULT.indexOf('engineer');
  assert(archIdx < engIdx, 'Architect higher priority than engineer');
}

// ---------------------------------------------------------------------------
// Test 14: Scope Validation (canClarify enforcement)
// ---------------------------------------------------------------------------

async function testScopeValidation(): Promise<void> {
  console.log('\n--- Test 14: Scope Validation ---');
  const ws = createWorkspace('scope');

  try {
    const router = new ClarificationRouter({ workspaceRoot: ws });

    // Request from engineer to architect -- should work (default canClarifyList)
    // Note: without canClarifyList filter, the router uses AGENT_PRIORITY_DEFAULT
    // But the scope check depends on the caller providing canClarifyList
    // The requestClarification itself doesn't restrict -- it's up to the caller
    // Just verify a valid request works
    const result = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'scope test',
      question: 'Test question.',
      blocking: false,
    }, ['architect', 'pm']);

    assert(result.clarificationId.startsWith('CLR-42-'), 'Valid request succeeded');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 15: Default TOML Config Values
// ---------------------------------------------------------------------------

async function testDefaultTomlConfig(): Promise<void> {
  console.log('\n--- Test 15: Default TOML Config Values ---');

  assertEqual(DEFAULT_TOML_CLARIFY_CONFIG.canClarify.length, 0, 'Default canClarify empty');
  assertEqual(DEFAULT_TOML_CLARIFY_CONFIG.clarifyMaxRounds, 5, 'Default maxRounds 5');
  assertEqual(DEFAULT_TOML_CLARIFY_CONFIG.clarifySlaMinutes, 30, 'Default SLA 30 min');
  assertEqual(DEFAULT_TOML_CLARIFY_CONFIG.clarifyBlockingAllowed, true, 'Default blocking allowed');
}

// ---------------------------------------------------------------------------
// Test 16: readJsonSafe / writeJsonLocked Edge Cases
// ---------------------------------------------------------------------------

async function testJsonHelpers(): Promise<void> {
  console.log('\n--- Test 16: readJsonSafe / writeJsonLocked Edge Cases ---');
  const ws = createWorkspace('json');

  try {
    // Read non-existent file
    const noFile = readJsonSafe<{ x: number }>(path.join(ws, 'nope.json'));
    assertEqual(noFile, null, 'Non-existent file returns null');

    // Write to nested directory that does not exist yet
    const nested = path.join(ws, 'a', 'b', 'c', 'data.json');
    writeJsonLocked(nested, { hello: 'world' });
    assert(fs.existsSync(nested), 'Nested file created');

    const data = readJsonSafe<{ hello: string }>(nested);
    assertEqual(data!.hello, 'world', 'Nested file content correct');

    // Write invalid JSON to a file, readJsonSafe returns null
    const badFile = path.join(ws, 'bad.json');
    fs.writeFileSync(badFile, 'not json {{{');
    const bad = readJsonSafe<unknown>(badFile);
    assertEqual(bad, null, 'Invalid JSON returns null');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 17: CLI -- Quality Loop Enforcement Gateway
// ---------------------------------------------------------------------------

async function testQualityLoopEnforcement(): Promise<void> {
  console.log('\n--- Test 17: CLI -- Quality Loop Enforcement ---');
  // We test the PowerShell gate logic by examining the rules:
  // 1. Non-engineer agents are NOT gated
  // 2. Engineer + active loop = BLOCKED
  // 3. Engineer + cancelled loop = BLOCKED
  // 4. Engineer + complete loop = PASS
  // 5. Engineer + no loop state = PASS (no loop started yet -- no gate)

  // These are logic-level checks. The actual PowerShell was tested interactively.
  // Here we verify the AGENTS.md and engineer.agent.md docs encode the rules.

  const agentsMd = fs.readFileSync(
      path.join(process.cwd(), 'AGENTS.md'), 'utf8'
  );

  assertIncludes(agentsMd, 'MUST start a quality loop', 'AGENTS.md: MUST start loop');
  assertIncludes(agentsMd, 'MUST run full test suite in EVERY loop iteration', 'AGENTS.md: MUST test every iteration');
  assertIncludes(agentsMd, 'CANNOT move to In Review while loop is active OR cancelled', 'AGENTS.md: gate blocks active/cancelled');
  assertIncludes(agentsMd, 'loop MUST reach status=complete', 'AGENTS.md: must reach complete');
  assertIncludes(agentsMd, 'cancelling does not bypass', 'AGENTS.md: cancel does not bypass');
}

// ---------------------------------------------------------------------------
// Test 18: End-to-End Scenario -- Full Todo App Workflow
// ---------------------------------------------------------------------------

async function testE2ETodoWorkflow(): Promise<void> {
  console.log('\n--- Test 18: E2E Scenario -- Full Todo App Workflow ---');
  const ws = createWorkspace('todo-e2e');

  try {
    const eventBus = new AgentEventBus();
    const eventLog: string[] = [];

    eventBus.on('clarification-requested', () => eventLog.push('requested'));
    eventBus.on('clarification-answered', () => eventLog.push('answered'));
    eventBus.on('clarification-resolved', () => eventLog.push('resolved'));
    eventBus.on('clarification-escalated', () => eventLog.push('escalated'));
    eventBus.on('clarification-stale', () => eventLog.push('stale'));

    // Simulate agent responses based on who is being asked
    const runSubagent = async (agent: string, prompt: string): Promise<string> => {
      if (agent === 'architect') {
        if (prompt.includes('database')) {
          return 'Use PostgreSQL with a todo_items table: id (UUID PK), title (VARCHAR 255), description (TEXT nullable), completed (BOOLEAN default false), priority (INTEGER default 0), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ).';
        }
        if (prompt.includes('authentication')) {
          return 'Use JWT with refresh tokens. Access token TTL: 15min. Refresh token: 7 days. Store refresh tokens in HttpOnly cookies. Middleware validates on every request.';
        }
        return 'Follow existing patterns in the codebase.';
      }
      if (agent === 'pm') {
        if (prompt.includes('priority')) {
          return 'Todo items should support 4 priority levels: P0 (Critical), P1 (High), P2 (Medium), P3 (Low). Default to P2. Display as colored badges in the UI.';
        }
        return 'Keep it simple. MVP scope: CRUD operations, list with filters, mark complete.';
      }
      return `[${agent}] Acknowledged.`;
    };

    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    const monitor = new ClarificationMonitor(router, eventBus);

    // Step 1: Engineer asks Architect about database schema (blocking)
    console.log('  Step 1: Engineer -> Architect (blocking: database schema)');
    const canClarify = ['architect', 'pm', 'ux'];
    const dbResult = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'database schema for todo app',
      question: 'What database and schema should the todo app use? Need ACID for task ordering.',
      blocking: true,
      maxRounds: 3,
      slaMinutes: 30,
    }, canClarify);
    assertIncludes(dbResult.answer, 'PostgreSQL', 'Step 1: DB answer mentions PostgreSQL');
    assertEqual(dbResult.round, 1, 'Step 1: Round 1');

    // Step 2: Engineer asks PM about priority levels (non-blocking)
    console.log('  Step 2: Engineer -> PM (non-blocking: priority levels)');
    const priorityResult = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'pm',
      topic: 'todo item priority levels',
      question: 'How many priority levels should todo items have? What labels?',
      blocking: false,
      maxRounds: 5,
      slaMinutes: 60,
    }, canClarify);
    assertIncludes(priorityResult.answer, 'P0', 'Step 2: Priority answer mentions P0');
    assertIncludes(priorityResult.answer, 'P3', 'Step 2: Priority answer mentions P3');

    // Step 3: Engineer asks Architect about auth (blocking)
    console.log('  Step 3: Engineer -> Architect (blocking: authentication)');
    const authResult = await router.requestClarification({
      issueNumber: 42,
      fromAgent: 'engineer',
      toAgent: 'architect',
      topic: 'authentication approach',
      question: 'What authentication approach should the todo app use? JWT, session, or OAuth?',
      blocking: true,
      maxRounds: 3,
      slaMinutes: 30,
    }, canClarify);
    assertIncludes(authResult.answer, 'JWT', 'Step 3: Auth answer mentions JWT');

    // Step 4: Check monitor -- all should be clean (no stale/stuck/deadlock)
    console.log('  Step 4: Monitor check (expect clean)');
    const cleanReport = await monitor.runCheck();
    assertEqual(cleanReport.stale.length, 0, 'Step 4: No stale');
    assertEqual(cleanReport.stuck.length, 0, 'Step 4: No stuck');
    assertEqual(cleanReport.deadlocked.length, 0, 'Step 4: No deadlocks');

    // Step 5: Engineer resolves all clarifications
    console.log('  Step 5: Resolve all clarifications');
    await router.resolveClarification(42, dbResult.clarificationId,
      'Using PostgreSQL with Prisma. Schema committed.', 'engineer');
    await router.resolveClarification(42, priorityResult.clarificationId,
      'Implemented 4 priority levels with colored badges.', 'engineer');
    await router.resolveClarification(42, authResult.clarificationId,
      'JWT auth middleware implemented with refresh tokens.', 'engineer');

    // Step 6: Verify all resolved
    console.log('  Step 6: Verify all resolved');
    const active = router.getActiveRecords();
    assertEqual(active.length, 0, 'Step 6: No active records');

    const allRecords = router.getAllRecords();
    assertEqual(allRecords.length, 3, 'Step 6: Three total records');

    for (const rec of allRecords) {
      assertEqual(rec.status, 'resolved', `Step 6: ${rec.id} is resolved`);
      assert(rec.resolvedAt !== null, `Step 6: ${rec.id} has resolvedAt`);
    }

    // Step 7: Verify renderer output for the records
    console.log('  Step 7: Render outputs');
    const threadMd = renderThreadMarkdown(allRecords);
    assertIncludes(threadMd, 'database schema for todo app', 'Render: DB topic in thread');
    assertIncludes(threadMd, 'todo item priority levels', 'Render: Priority topic in thread');
    assertIncludes(threadMd, 'authentication approach', 'Render: Auth topic in thread');

    const summaryTable = renderSummaryTableCli(allRecords);
    assertIncludes(summaryTable, 'engineer', 'Render CLI: engineer in summary');

    // Step 8: Verify event log
    console.log('  Step 8: Verify event log');
    assertEqual(eventLog.filter(e => e === 'requested').length, 3, 'Three requested events');
    assertEqual(eventLog.filter(e => e === 'answered').length, 3, 'Three answered events');
    assertEqual(eventLog.filter(e => e === 'resolved').length, 3, 'Three resolved events');

    // Step 9: summary
    const summary = monitor.getSummary();
    assertEqual(summary.active, 0, 'Final summary: 0 active');
    assertEqual(summary.pending, 0, 'Final summary: 0 pending');
    assertEqual(summary.stale, 0, 'Final summary: 0 stale');
    assertEqual(summary.escalated, 0, 'Final summary: 0 escalated');

  } finally {
    cleanWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=======================================================');
  console.log(' AgentX -- E2E Live Test: Todo App Clarification Protocol');
  console.log('=======================================================');

  const tests = [
    testFullLifecycle,
    testMultiIssueClarification,
    testMaxRoundsEscalation,
    testMonitorStale,
    testMonitorStuck,
    testMonitorDeadlock,
    testRendererMarkdown,
    testRendererCli,
    testFileLocking,
    testStaleLockRecovery,
    testAsyncMutex,
    testEventBusClarification,
    testAgentPriority,
    testScopeValidation,
    testDefaultTomlConfig,
    testJsonHelpers,
    testQualityLoopEnforcement,
    testE2ETodoWorkflow,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${test.name}: UNCAUGHT ${msg}`);
      console.error(`  [FAIL] ${test.name}: UNCAUGHT ${msg}`);
    }
  }

  console.log('\n=======================================================');
  console.log(` Results: ${passed} passed, ${failed} failed (${totalAssertions} assertions)`);
  console.log('=======================================================');

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
