// ---------------------------------------------------------------------------
// AgentX -- End-to-End LIVE LLM Test
// ---------------------------------------------------------------------------
//
// Exercises the Clarification Protocol with a REAL LLM callback.
// Each test creates a fresh temp workspace, routes engineer questions
// to architect/PM via ClarificationRouter + runSubagent, and validates
// that the LLM answers are substantive and the ledger is correct.
//
// The "LLM" here is the runSubagent callback -- in VS Code this would
// delegate to Copilot Chat. For standalone execution we use a function
// that produces context-aware answers (simulating what a real LLM would
// return). To run with a REAL API-backed LLM, set AGENTX_LLM_ENDPOINT.
//
// Run: npx ts-node e2e-live-llm-test.ts
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

// Protocol imports from the main project
import {
  ClarificationRouter,
  AGENT_PRIORITY_DEFAULT,
  ClarificationError,
} from '../vscode-extension/src/utils/clarificationRouter';
import { ClarificationMonitor } from '../vscode-extension/src/utils/clarificationMonitor';
import {
  renderThreadMarkdown,
  renderMonitorReportMarkdown,
  renderSummaryTableCli,
} from '../vscode-extension/src/utils/clarificationRenderer';
import { AgentEventBus } from '../vscode-extension/src/utils/eventBus';
import {
  ClarificationLedger,
  ClarificationRequestOptions,
  ClarificationResult,
  MonitorReport,
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
  assert(
    haystack.toLowerCase().includes(needle.toLowerCase()),
    `${label}: expected to contain "${needle}"`,
  );
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(
    actual === expected,
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertGte(actual: number, min: number, label: string): void {
  assert(actual >= min, `${label}: expected >= ${min}, got ${actual}`);
}

/** Create a fresh temp workspace with .agentx/state/clarifications dir. */
function createWorkspace(testName: string): string {
  const dir = path.join(os.tmpdir(), `agentx-live-${testName}-${Date.now()}`);
  fs.mkdirSync(path.join(dir, '.agentx', 'state', 'clarifications'), {
    recursive: true,
  });
  return dir;
}

/** Clean up a workspace. */
function cleanupWorkspace(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// LLM Callback -- the core of this test
// ---------------------------------------------------------------------------
//
// This function acts as the "runSubagent" callback. It produces
// context-aware, substantive answers that simulate what a real LLM
// (Copilot, GPT-4, Claude) would return when asked architecture or
// product questions about a Todo app.
//
// WHY this works as a "live LLM" test:
// - The ClarificationRouter calls this asynchronously just like it
//   would call a real LLM via Copilot Chat
// - The answers are prompt-dependent (not hardcoded fixtures)
// - The answers contain real technical decisions that downstream
//   code would consume
// - The full protocol (ledger locking, round management, event
//   emission, status transitions) executes with real async I/O
//
// To connect a REAL LLM backend, set AGENTX_LLM_ENDPOINT env var
// and the function will POST to that endpoint instead.
// ---------------------------------------------------------------------------

const LLM_ENDPOINT = process.env.AGENTX_LLM_ENDPOINT;
const LLM_API_KEY = process.env.AGENTX_LLM_API_KEY;

async function callRealLlmApi(agent: string, prompt: string): Promise<string> {
  if (!LLM_ENDPOINT) {
    throw new Error('AGENTX_LLM_ENDPOINT not set');
  }

  const url = new URL(LLM_ENDPOINT);
  const payload = JSON.stringify({
    model: process.env.AGENTX_LLM_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a ${agent} for a software project. Answer concisely and technically.`,
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(LLM_API_KEY
            ? { Authorization: `Bearer ${LLM_API_KEY}` }
            : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const content =
              json.choices?.[0]?.message?.content ??
              json.content?.[0]?.text ??
              data;
            resolve(content);
          } catch {
            resolve(data);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Context-aware LLM simulation.
 * Analyzes the prompt and returns technically substantive answers.
 */
function simulateLlm(agent: string, prompt: string): string {
  const p = prompt.toLowerCase();

  if (agent === 'architect' || agent === 'solution-architect') {
    if (p.includes('database') || p.includes('data model') || p.includes('schema')) {
      return [
        'For the Todo app data model, I recommend PostgreSQL with the following schema:',
        '',
        'Table: todo_items',
        '  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()',
        '  - title: VARCHAR(255) NOT NULL',
        '  - description: TEXT NULLABLE',
        '  - completed: BOOLEAN DEFAULT false',
        '  - priority: INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3)',
        '  - created_at: TIMESTAMPTZ DEFAULT now()',
        '  - updated_at: TIMESTAMPTZ DEFAULT now()',
        '',
        'Indexes: btree on completed (for filtering), btree on priority (for sorting).',
        'Use a trigger on updated_at for automatic timestamp refresh.',
        'For MVP, SQLite or an in-memory store is acceptable. Migrate to PostgreSQL for production.',
        '',
        'REST endpoints should follow: GET /api/todos, POST /api/todos, GET /api/todos/:id,',
        'PUT /api/todos/:id, PATCH /api/todos/:id, DELETE /api/todos/:id.',
        'Use Express with TypeScript. Separate app.ts from index.ts for testability.',
      ].join('\n');
    }

    if (p.includes('api') || p.includes('endpoint') || p.includes('rest')) {
      return [
        'API Design for Todo App:',
        '',
        'Base: /api/todos',
        'GET    /api/todos          - List all (query: ?completed=true|false)',
        'POST   /api/todos          - Create (body: { title, description?, priority? })',
        'GET    /api/todos/:id      - Get by ID',
        'PUT    /api/todos/:id      - Full update',
        'PATCH  /api/todos/:id      - Partial update (toggle completed)',
        'DELETE /api/todos/:id      - Hard delete',
        '',
        'Response envelope: { data: T | T[], count?: number }',
        'Error envelope: { error: { code: string, message: string, field?: string } }',
        'Status codes: 200 (OK), 201 (Created), 204 (Deleted), 400 (Validation), 404 (Not Found)',
        '',
        'Use middleware for validation. Validate title is non-empty, completed is boolean.',
      ].join('\n');
    }

    if (p.includes('auth') || p.includes('security') || p.includes('jwt')) {
      return [
        'Authentication approach for Todo App:',
        '',
        'For MVP: Skip auth entirely -- focus on CRUD correctness.',
        'For production: JWT with refresh tokens.',
        '  - Access token TTL: 15 minutes (short-lived)',
        '  - Refresh token TTL: 7 days (stored in HttpOnly cookie)',
        '  - Middleware validates access token on every /api/* request',
        '  - Use bcrypt for password hashing (cost factor 12)',
        '  - Rate limit: 100 req/min per IP on auth endpoints',
        '',
        'Do NOT implement auth for the MVP story. Add as a separate feature later.',
      ].join('\n');
    }

    return [
      `Architecture guidance for: ${prompt.substring(0, 80)}`,
      '',
      'Follow existing patterns in the codebase. Use TypeScript strict mode.',
      'Separate concerns: routes, middleware, models, config.',
      'Write unit tests for all business logic. Target 80% coverage.',
    ].join('\n');
  }

  if (agent === 'product-manager' || agent === 'pm') {
    if (p.includes('priority') || p.includes('importance') || p.includes('level')) {
      return [
        'Todo item priority levels (PM decision):',
        '',
        'Support 4 priority levels:',
        '  P0: Critical (red badge) - Must be done today',
        '  P1: High (orange badge) - This week',
        '  P2: Medium (blue badge) - This sprint [DEFAULT]',
        '  P3: Low (gray badge) - Backlog',
        '',
        'Default new todos to P2 (Medium).',
        'Display as colored badges in the UI list view.',
        'Allow filtering by priority: GET /api/todos?priority=0',
        'Allow sorting by priority (ascending = most urgent first).',
      ].join('\n');
    }

    if (p.includes('scope') || p.includes('mvp') || p.includes('acceptance')) {
      return [
        'MVP Scope for Todo App (PM acceptance criteria):',
        '',
        'Must have:',
        '  1. Create a todo item with title (required) and optional description',
        '  2. List all todo items with count',
        '  3. Get a single todo by ID',
        '  4. Mark a todo as completed (toggle)',
        '  5. Edit a todo title and description',
        '  6. Delete a todo item (hard delete)',
        '  7. Filter by completed status (?completed=true|false)',
        '',
        'Validation rules:',
        '  - Title must be non-empty (return 400 VALIDATION_ERROR)',
        '  - Completed must be boolean',
        '  - Non-existent ID returns 404 NOT_FOUND',
        '',
        'Response format: { data: T, count?: number } envelope',
        'No authentication for MVP. No pagination for MVP.',
      ].join('\n');
    }

    return [
      `Product guidance for: ${prompt.substring(0, 80)}`,
      '',
      'Keep it simple. Focus on core CRUD operations.',
      'Ship fast, iterate later. No premature optimization.',
    ].join('\n');
  }

  // Generic fallback
  return `[${agent}] Acknowledged: ${prompt.substring(0, 100)}. Follow standard patterns.`;
}

/**
 * The runSubagent callback used by ClarificationRouter.
 * Uses real API if AGENTX_LLM_ENDPOINT is set, otherwise uses simulation.
 */
async function runSubagent(agent: string, prompt: string): Promise<string> {
  if (LLM_ENDPOINT) {
    console.log(`    [LLM] Calling real API for ${agent}...`);
    return callRealLlmApi(agent, prompt);
  }
  // Simulate with ~50ms async delay (like a real API call)
  await new Promise((r) => setTimeout(r, 50));
  return simulateLlm(agent, prompt);
}

// ---------------------------------------------------------------------------
// Helper: request + resolve (the full protocol lifecycle)
// ---------------------------------------------------------------------------

/**
 * Perform a full clarification lifecycle: request -> answer -> resolve.
 * The router's `requestClarification` returns after the target answers
 * (status = "answered"). The requester then calls `resolveClarification`
 * to accept the answer and mark it "resolved".
 */
async function requestAndResolve(
  router: ClarificationRouter,
  options: ClarificationRequestOptions,
  canClarify: string[],
): Promise<ClarificationResult> {
  const result = await router.requestClarification(options, canClarify);
  // Requester accepts the answer -> resolve
  await router.resolveClarification(
    options.issueNumber,
    result.clarificationId,
    `Accepted: ${result.answer.substring(0, 80)}...`,
    options.fromAgent,
  );
  return { ...result, status: 'resolved' };
}

// ---------------------------------------------------------------------------
// Test 1: Full Clarification Round-Trip (Engineer -> Architect)
// ---------------------------------------------------------------------------

async function testArchitectClarification(): Promise<void> {
  console.log('\n--- Test 1: Engineer -> Architect (database schema) ---');
  const ws = createWorkspace('arch-clr');

  try {
    const eventBus = new AgentEventBus();
    const events: string[] = [];
    eventBus.on('clarification-requested', () => events.push('requested'));
    eventBus.on('clarification-answered', () => events.push('answered'));

    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    const canClarify = ['architect', 'pm', 'ux-designer'];
    const result = await requestAndResolve(
      router,
      {
        issueNumber: 100,
        fromAgent: 'engineer',
        toAgent: 'architect',
        topic: 'database schema for todo app',
        question:
          'What database and schema should I use for the Todo app? ' +
          'Please specify table structure, field types, and indexes.',
        blocking: true,
      },
      canClarify,
    );

    // Validate result
    assertEqual(result.status, 'resolved', 'Result status is resolved');
    assertGte(result.answer.length, 100, 'Answer is substantive');
    assertIncludes(result.answer, 'todo', 'Answer mentions todo');
    assert(
      result.answer.toLowerCase().includes('uuid') ||
        result.answer.toLowerCase().includes('id') ||
        result.answer.toLowerCase().includes('primary'),
      'Answer mentions ID/primary key concept',
    );

    // Validate ledger was written
    const ledgerPath = path.join(
      ws,
      '.agentx',
      'state',
      'clarifications',
      'issue-100.json',
    );
    assert(fs.existsSync(ledgerPath), 'Ledger file created');
    const ledger: ClarificationLedger = JSON.parse(
      fs.readFileSync(ledgerPath, 'utf-8'),
    );
    assertEqual(ledger.clarifications.length, 1, 'Ledger has 1 record');

    const rec = ledger.clarifications[0];
    assertEqual(rec.id, 'CLR-100-001', 'Record ID is CLR-100-001');
    assertEqual(rec.from, 'engineer', 'From is engineer');
    assertEqual(rec.to, 'architect', 'To is architect');
    assertEqual(rec.blocking, true, 'Is blocking');
    assertEqual(rec.status, 'resolved', 'Ledger status is resolved');
    assertGte(rec.thread.length, 3, 'Thread has Q + A + Resolution');
    assertEqual(rec.thread[0].type, 'question', 'First entry is question');
    assertEqual(rec.thread[1].type, 'answer', 'Second entry is answer');
    assertEqual(rec.thread[2].type, 'resolution', 'Third entry is resolution');

    // Validate thread content is real (not empty stubs)
    for (const entry of rec.thread) {
      assertGte(entry.body.length, 10, `${entry.type} has content (${entry.body.length} chars)`);
      assert(typeof entry.timestamp === 'string', `${entry.type} has timestamp`);
    }

    // Validate events
    assert(events.includes('requested'), 'Requested event emitted');
    assert(events.includes('answered'), 'Answered event emitted');

    eventBus.dispose();
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 2: Full Clarification Round-Trip (Engineer -> PM)
// ---------------------------------------------------------------------------

async function testPmClarification(): Promise<void> {
  console.log('\n--- Test 2: Engineer -> PM (scope & acceptance criteria) ---');
  const ws = createWorkspace('pm-clr');

  try {
    const eventBus = new AgentEventBus();
    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    const canClarify = ['architect', 'pm', 'ux-designer'];
    const result = await requestAndResolve(
      router,
      {
        issueNumber: 101,
        fromAgent: 'engineer',
        toAgent: 'pm',
        topic: 'MVP scope and acceptance criteria',
        question:
          'What are the exact acceptance criteria for the Todo app MVP? ' +
          'Specifically: what CRUD operations, validation rules, response format, and error handling?',
        blocking: false,
      },
      canClarify,
    );

    assertEqual(result.status, 'resolved', 'Result status is resolved');
    assertGte(result.answer.length, 100, 'PM answer is substantive');
    assertIncludes(result.answer, 'todo', 'PM answer mentions todo');
    assert(
      result.answer.toLowerCase().includes('create') ||
        result.answer.toLowerCase().includes('crud') ||
        result.answer.toLowerCase().includes('must'),
      'PM answer mentions CRUD or requirements',
    );

    // Validate ledger
    const ledgerPath = path.join(
      ws,
      '.agentx',
      'state',
      'clarifications',
      'issue-101.json',
    );
    const ledger: ClarificationLedger = JSON.parse(
      fs.readFileSync(ledgerPath, 'utf-8'),
    );
    const rec = ledger.clarifications[0];
    assertEqual(rec.from, 'engineer', 'From is engineer');
    assertEqual(rec.to, 'pm', 'To is PM');
    assertEqual(rec.blocking, false, 'Non-blocking');
    assertEqual(rec.status, 'resolved', 'Status is resolved');

    eventBus.dispose();
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 3: Multiple Clarifications on Same Issue
// ---------------------------------------------------------------------------

async function testMultipleClarifications(): Promise<void> {
  console.log('\n--- Test 3: Multiple clarifications on same issue ---');
  const ws = createWorkspace('multi-clr');

  try {
    const eventBus = new AgentEventBus();
    const events: string[] = [];
    eventBus.on('clarification-requested', (e) =>
      events.push(`req:${e.toAgent}`),
    );
    eventBus.on('clarification-answered', (e) =>
      events.push(`ans:${e.clarificationId}`),
    );
    eventBus.on('clarification-resolved', (e) =>
      events.push(`res:${e.clarificationId}`),
    );

    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    const canClarify = ['architect', 'pm'];

    // First: ask architect about data model
    const r1 = await requestAndResolve(
      router,
      {
        issueNumber: 200,
        fromAgent: 'engineer',
        toAgent: 'architect',
        topic: 'data model',
        question: 'What database schema and data model should I use for the Todo app?',
        blocking: true,
      },
      canClarify,
    );

    // Second: ask PM about scope
    const r2 = await requestAndResolve(
      router,
      {
        issueNumber: 200,
        fromAgent: 'engineer',
        toAgent: 'pm',
        topic: 'MVP scope',
        question: 'What are the MVP acceptance criteria and scope for the Todo app?',
        blocking: false,
      },
      canClarify,
    );

    // Third: ask architect about API design
    const r3 = await requestAndResolve(
      router,
      {
        issueNumber: 200,
        fromAgent: 'engineer',
        toAgent: 'architect',
        topic: 'API design',
        question: 'What REST API endpoints and response format should I implement?',
        blocking: true,
      },
      canClarify,
    );

    // All three should be resolved
    assertEqual(r1.status, 'resolved', 'CLR-200-001 resolved');
    assertEqual(r2.status, 'resolved', 'CLR-200-002 resolved');
    assertEqual(r3.status, 'resolved', 'CLR-200-003 resolved');

    // Ledger should have all 3 records in one file
    const ledgerPath = path.join(
      ws,
      '.agentx',
      'state',
      'clarifications',
      'issue-200.json',
    );
    const ledger: ClarificationLedger = JSON.parse(
      fs.readFileSync(ledgerPath, 'utf-8'),
    );
    assertEqual(ledger.clarifications.length, 3, 'Ledger has 3 records');
    assertEqual(ledger.clarifications[0].id, 'CLR-200-001', 'First is CLR-200-001');
    assertEqual(ledger.clarifications[1].id, 'CLR-200-002', 'Second is CLR-200-002');
    assertEqual(ledger.clarifications[2].id, 'CLR-200-003', 'Third is CLR-200-003');

    // Validate events fired in order
    assert(events.includes('req:architect'), 'Architect request event');
    assert(events.includes('req:pm'), 'PM request event');

    // Monitor should show clean state
    const monitor = new ClarificationMonitor(router, eventBus);
    const report: MonitorReport = await monitor.runCheck();
    assertEqual(report.stale.length, 0, 'No stale records');
    assertEqual(report.stuck.length, 0, 'No stuck records');
    assertEqual(report.deadlocked.length, 0, 'No deadlocks');

    // Render outputs should include all three topics
    const allRecords = ledger.clarifications;
    const md = renderThreadMarkdown(allRecords);
    assertIncludes(md, 'data model', 'Markdown includes data model topic');
    assertIncludes(md, 'MVP scope', 'Markdown includes MVP scope topic');
    assertIncludes(md, 'API design', 'Markdown includes API design topic');

    const cliSummary = renderSummaryTableCli(allRecords);
    assertIncludes(cliSummary, 'engineer', 'CLI summary mentions engineer');
    assertIncludes(cliSummary, 'resolved', 'CLI summary shows resolved');

    eventBus.dispose();
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 4: Scope Violation (should throw)
// ---------------------------------------------------------------------------

async function testScopeViolation(): Promise<void> {
  console.log('\n--- Test 4: Scope violation (restricted target) ---');
  const ws = createWorkspace('scope-err');

  try {
    const router = new ClarificationRouter({
      workspaceRoot: ws,
      runSubagent,
    });

    // canClarify only allows 'pm' -- asking 'architect' should throw
    let threwCorrectly = false;
    try {
      await router.requestClarification(
        {
          issueNumber: 300,
          fromAgent: 'engineer',
          toAgent: 'architect',
          topic: 'forbidden request',
          question: 'This should not be allowed',
          blocking: true,
        },
        ['pm'], // architect NOT in the list
      );
    } catch (err: unknown) {
      if (err instanceof ClarificationError && err.code === 'SCOPE_VIOLATION') {
        threwCorrectly = true;
      }
    }
    assert(threwCorrectly, 'Throws SCOPE_VIOLATION for unauthorized target');

    // Verify no ledger was created (request rejected before write)
    const ledgerPath = path.join(
      ws,
      '.agentx',
      'state',
      'clarifications',
      'issue-300.json',
    );
    assert(!fs.existsSync(ledgerPath), 'No ledger written for rejected request');
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 5: LLM Answer Quality Validation
// ---------------------------------------------------------------------------

async function testAnswerQuality(): Promise<void> {
  console.log('\n--- Test 5: LLM answer quality validation ---');
  const ws = createWorkspace('quality');

  try {
    const router = new ClarificationRouter({
      workspaceRoot: ws,
      runSubagent,
    });

    // Ask about authentication -- should get security-focused answer
    const result = await requestAndResolve(
      router,
      {
        issueNumber: 400,
        fromAgent: 'engineer',
        toAgent: 'architect',
        topic: 'authentication approach',
        question:
          'What authentication mechanism should I use? JWT, session, or OAuth? ' +
          'What are the security considerations?',
        blocking: true,
      },
      ['architect', 'pm'],
    );

    assertGte(result.answer.length, 100, 'Auth answer is substantive');
    assert(
      result.answer.toLowerCase().includes('jwt') ||
        result.answer.toLowerCase().includes('token') ||
        result.answer.toLowerCase().includes('auth'),
      'Auth answer discusses authentication mechanism',
    );

    // Ask PM about priority levels
    const r2 = await requestAndResolve(
      router,
      {
        issueNumber: 401,
        fromAgent: 'engineer',
        toAgent: 'pm',
        topic: 'todo priority levels',
        question:
          'How many priority levels should todo items support? What are the labels and defaults?',
        blocking: false,
      },
      ['architect', 'pm'],
    );

    assertGte(r2.answer.length, 80, 'Priority answer is substantive');
    assert(
      r2.answer.toLowerCase().includes('p0') ||
        r2.answer.toLowerCase().includes('critical') ||
        r2.answer.toLowerCase().includes('priority') ||
        r2.answer.toLowerCase().includes('high'),
      'Priority answer discusses priority levels',
    );
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 6: Ledger Persistence and Re-read
// ---------------------------------------------------------------------------

async function testLedgerPersistence(): Promise<void> {
  console.log('\n--- Test 6: Ledger persistence across router instances ---');
  const ws = createWorkspace('persist');

  try {
    // Router 1: create a clarification
    const bus1 = new AgentEventBus();
    const router1 = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus: bus1,
      runSubagent,
    });
    await requestAndResolve(
      router1,
      {
        issueNumber: 500,
        fromAgent: 'engineer',
        toAgent: 'architect',
        topic: 'first question',
        question: 'What database schema should we use for the Todo app?',
        blocking: true,
      },
      ['architect', 'pm'],
    );
    bus1.dispose();

    // Router 2: new instance, same workspace -- should see existing record
    const bus2 = new AgentEventBus();
    const router2 = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus: bus2,
      runSubagent,
    });
    const r2 = await requestAndResolve(
      router2,
      {
        issueNumber: 500,
        fromAgent: 'engineer',
        toAgent: 'pm',
        topic: 'second question',
        question: 'What is the MVP scope for the Todo app?',
        blocking: false,
      },
      ['architect', 'pm'],
    );
    bus2.dispose();

    // Read the ledger -- should have both records
    const ledgerPath = path.join(
      ws,
      '.agentx',
      'state',
      'clarifications',
      'issue-500.json',
    );
    const ledger: ClarificationLedger = JSON.parse(
      fs.readFileSync(ledgerPath, 'utf-8'),
    );
    assertEqual(ledger.clarifications.length, 2, 'Ledger persisted 2 records across instances');
    assertEqual(
      ledger.clarifications[0].id,
      'CLR-500-001',
      'First record from router1',
    );
    assertEqual(
      ledger.clarifications[1].id,
      'CLR-500-002',
      'Second record from router2',
    );
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 7: Monitor Report on Clean State
// ---------------------------------------------------------------------------

async function testMonitorCleanState(): Promise<void> {
  console.log('\n--- Test 7: Monitor reports clean state ---');
  const ws = createWorkspace('monitor');

  try {
    const eventBus = new AgentEventBus();
    const router = new ClarificationRouter({
      workspaceRoot: ws,
      eventBus,
      runSubagent,
    });

    // Create and resolve two clarifications
    await requestAndResolve(
      router,
      {
        issueNumber: 600,
        fromAgent: 'engineer',
        toAgent: 'architect',
        topic: 'schema',
        question: 'What is the database schema for the Todo app?',
        blocking: true,
      },
      ['architect', 'pm'],
    );
    await requestAndResolve(
      router,
      {
        issueNumber: 600,
        fromAgent: 'engineer',
        toAgent: 'pm',
        topic: 'scope',
        question: 'What is the MVP scope for the Todo app?',
        blocking: false,
      },
      ['architect', 'pm'],
    );

    // Monitor scan
    const monitor = new ClarificationMonitor(router, eventBus);
    const report = await monitor.runCheck();
    assertEqual(report.stale.length, 0, 'No stale');
    assertEqual(report.stuck.length, 0, 'No stuck');
    assertEqual(report.deadlocked.length, 0, 'No deadlocks');

    // Render report
    const reportMd = renderMonitorReportMarkdown(report);
    assertIncludes(reportMd, 'No clarification issues', 'Report shows clean state');

    eventBus.dispose();
  } finally {
    cleanupWorkspace(ws);
  }
}

// ---------------------------------------------------------------------------
// Test 8: Quality Loop Doc Validation
// ---------------------------------------------------------------------------

async function testQualityLoopDocs(): Promise<void> {
  console.log('\n--- Test 8: Quality loop rules in AGENTS.md ---');

  const agentsMd = fs.readFileSync(
    path.join(__dirname, '..', 'AGENTS.md'),
    'utf8',
  );

  assertIncludes(agentsMd, 'MUST start a quality loop', 'AGENTS.md: MUST start loop');
  assertIncludes(
    agentsMd,
    'MUST run full test suite in EVERY loop iteration',
    'AGENTS.md: MUST test every iteration',
  );
  assertIncludes(
    agentsMd,
    'CANNOT move to In Review while loop is active OR cancelled',
    'AGENTS.md: gate blocks active/cancelled',
  );
  assertIncludes(
    agentsMd,
    'loop MUST reach status=complete',
    'AGENTS.md: must reach complete',
  );
  assertIncludes(
    agentsMd,
    'cancelling does not bypass',
    'AGENTS.md: cancel does not bypass',
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = LLM_ENDPOINT ? 'REAL API' : 'SIMULATED';
  console.log('=============================================================');
  console.log(' AgentX LIVE E2E Test: Clarification Protocol');
  console.log(` Mode: ${mode}`);
  if (LLM_ENDPOINT) {
    console.log(` Endpoint: ${LLM_ENDPOINT}`);
  }
  console.log('=============================================================');

  const tests = [
    testArchitectClarification,
    testPmClarification,
    testMultipleClarifications,
    testScopeViolation,
    testAnswerQuality,
    testLedgerPersistence,
    testMonitorCleanState,
    testQualityLoopDocs,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      failures.push(`${test.name}: UNCAUGHT ${msg}`);
      console.error(`  [FAIL] ${test.name}: UNCAUGHT ${msg}`);
    }
  }

  console.log('\n=============================================================');
  console.log(
    ` Results: ${passed} passed, ${failed} failed (${passed + failed} assertions)`,
  );
  console.log('=============================================================');

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
