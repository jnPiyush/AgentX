import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClarificationRouter, ClarificationError, AGENT_PRIORITY_DEFAULT } from '../../utils/clarificationRouter';
import { ClarificationStatus, ClarificationRecord } from '../../utils/clarificationTypes';
import { AgentEventBus } from '../../utils/eventBus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRouter(workspaceRoot: string, overrides: Partial<{
  agentPriority: string[];
  runSubagent: (agentName: string, prompt: string) => Promise<string>;
}> = {}): ClarificationRouter {
  const bus = new AgentEventBus();
  return new ClarificationRouter({
    workspaceRoot,
    eventBus: bus,
    ...overrides,
  });
}

function makeTmpWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-router-test-'));
}

// ---------------------------------------------------------------------------
// Scope validation
// ---------------------------------------------------------------------------

describe('ClarificationRouter -- scope validation', () => {
  let dir: string;
  let router: ClarificationRouter;

  beforeEach(() => {
    dir = makeTmpWorkspace();
    router = makeRouter(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects clarification when toAgent not in canClarifyList', async () => {
    await assert.rejects(
      () => router.requestClarification(
        { issueNumber: 1, fromAgent: 'engineer', toAgent: 'product-manager', topic: 'scope', question: 'Q?', blocking: false },
        ['architect'] // canClarifyList does NOT include product-manager
      ),
      (err: unknown) => {
        assert.ok(err instanceof ClarificationError);
        assert.equal((err as ClarificationError).code, 'SCOPE_VIOLATION');
        return true;
      }
    );
  });

  it('allows clarification when toAgent is in canClarifyList', async () => {
    let called = false;
    const r = makeRouter(dir, {
      runSubagent: async (_agentName, _prompt) => { called = true; return 'Answer from architect'; },
    });

    await r.requestClarification(
      { issueNumber: 1, fromAgent: 'engineer', toAgent: 'architect', topic: 'tech', question: 'Q?', blocking: false },
      ['architect', 'product-manager']
    );

    assert.equal(called, true, 'runSubagent must be invoked for valid scope');
  });
});

// ---------------------------------------------------------------------------
// Ledger creation and record persistence
// ---------------------------------------------------------------------------

describe('ClarificationRouter -- ledger persistence', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates ledger file under clarifications/ directory', async () => {
    const r = makeRouter(dir, {
      runSubagent: async () => 'answer',
    });

    await r.requestClarification(
      { issueNumber: 7, fromAgent: 'engineer', toAgent: 'architect', topic: 'algo', question: 'Which sort?', blocking: false },
      ['architect']
    );

    const ledgerPath = path.join(dir, '.agentx', 'state', 'clarifications', 'issue-7.json');
    assert.ok(fs.existsSync(ledgerPath), 'ledger file must be created');

    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    assert.equal(ledger.issueNumber, 7);
    assert.equal(ledger.clarifications.length, 1);
    assert.equal(ledger.clarifications[0].from, 'engineer');
    assert.equal(ledger.clarifications[0].to, 'architect');
  });

  it('record has status resolved after single round', async () => {
    const r = makeRouter(dir, {
      runSubagent: async () => 'Use quicksort.',
    });

    const result = await r.requestClarification(
      { issueNumber: 8, fromAgent: 'engineer', toAgent: 'architect', topic: 'sort', question: 'Which?', blocking: false },
      ['architect']
    );

    assert.equal(result.status, 'answered' as ClarificationStatus);
    assert.ok(result.answer);
    assert.match(result.answer as string, /quicksort/i);
  });

  it('issueNumber is stored on the ClarificationRecord', async () => {
    const r = makeRouter(dir, {
      runSubagent: async () => 'ok',
    });

    await r.requestClarification(
      { issueNumber: 99, fromAgent: 'engineer', toAgent: 'architect', topic: 'X', question: 'Q', blocking: false },
      ['architect']
    );

    const [rec] = r.getRecords(99);
    assert.equal((rec as ClarificationRecord).issueNumber, 99);
  });
});

// ---------------------------------------------------------------------------
// getAllRecords
// ---------------------------------------------------------------------------

describe('ClarificationRouter -- getAllRecords', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty array when no ledgers exist', async () => {
    const r = makeRouter(dir);
    const records = r.getAllRecords();
    assert.equal(records.length, 0);
  });

  it('aggregates records from multiple ledger files', async () => {
    const r = makeRouter(dir, { runSubagent: async () => 'a' });

    await r.requestClarification(
      { issueNumber: 1, fromAgent: 'engineer', toAgent: 'architect', topic: 'T1', question: 'Q1', blocking: false },
      ['architect']
    );
    await r.requestClarification(
      { issueNumber: 2, fromAgent: 'engineer', toAgent: 'architect', topic: 'T2', question: 'Q2', blocking: false },
      ['architect']
    );

    const all = r.getAllRecords();
    assert.equal(all.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Manual resolve
// ---------------------------------------------------------------------------

describe('ClarificationRouter -- resolveClarification', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('marks record as resolved', async () => {
    // Manually write a pending ledger.
    const clarDir = path.join(dir, '.agentx', 'state', 'clarifications');
    fs.mkdirSync(clarDir, { recursive: true });

    const id = 'clar-test-001';
    const ledger = {
      issueNumber: 5,
      clarifications: [{
        id, issueNumber: 5, from: 'engineer', to: 'architect',
        topic: 'T', blocking: false, status: 'pending', round: 1, maxRounds: 3,
        created: new Date().toISOString(), staleAfter: new Date(Date.now() + 3600_000).toISOString(),
        resolvedAt: null, thread: [],
      }],
    };
    fs.writeFileSync(path.join(clarDir, 'issue-5.json'), JSON.stringify(ledger), 'utf8');

    const r = makeRouter(dir);
    await r.resolveClarification(5, id, 'Problem solved.', 'test-agent');

    const [rec] = r.getRecords(5);
    assert.equal((rec as ClarificationRecord).status, 'resolved');
    assert.ok((rec as ClarificationRecord).resolvedAt);
  });
});

// ---------------------------------------------------------------------------
// AGENT_PRIORITY_DEFAULT
// ---------------------------------------------------------------------------

describe('AGENT_PRIORITY_DEFAULT', () => {
  it('contains expected agent names', () => {
    assert.ok(AGENT_PRIORITY_DEFAULT.includes('product-manager'));
    assert.ok(AGENT_PRIORITY_DEFAULT.includes('engineer'));
    assert.ok(AGENT_PRIORITY_DEFAULT.includes('architect'));
  });

  it('architect outranks engineer', () => {
    const archIdx = AGENT_PRIORITY_DEFAULT.indexOf('architect');
    const engIdx = AGENT_PRIORITY_DEFAULT.indexOf('engineer');
    assert.ok(archIdx < engIdx, 'architect should have higher priority (lower index) than engineer');
  });
});
