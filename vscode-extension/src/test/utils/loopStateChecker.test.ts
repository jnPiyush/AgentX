import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readLoopState,
  checkHandoffGate,
  shouldAutoStartLoop,
  getLoopStatusDisplay,
  isBudgetExceeded,
  LoopState,
} from '../../utils/loopStateChecker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-loop-test-'));
  fs.mkdirSync(path.join(dir, '.agentx', 'state'), { recursive: true });
  return dir;
}

function writeLoopState(wsRoot: string, state: Record<string, unknown>): void {
  const filePath = path.join(wsRoot, '.agentx', 'state', 'loop-state.json');
  fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

function makeCompleteState(overrides?: Partial<LoopState>): Record<string, unknown> {
  return {
    active: false,
    status: 'complete',
    prompt: 'Implement feature X',
    iteration: 5,
    minIterations: 5,
    maxIterations: 10,
    completionCriteria: 'ALL_TESTS_PASSING',
    issueNumber: 42,
    startedAt: isoMinutesAgo(70),
    lastIterationAt: isoMinutesAgo(5),
    history: [
      { iteration: 1, timestamp: isoMinutesAgo(60), summary: 'Initial impl', status: 'iterated' },
      { iteration: 2, timestamp: isoMinutesAgo(30), summary: 'Fix tests', status: 'iterated' },
      { iteration: 3, timestamp: isoMinutesAgo(15), summary: 'Refine edge cases', status: 'iterated' },
      { iteration: 4, timestamp: isoMinutesAgo(10), summary: 'Tighten validation', status: 'iterated' },
      { iteration: 5, timestamp: isoMinutesAgo(5), summary: 'All green', status: 'complete' },
    ],
    ...overrides,
  };
}

function makeActiveState(overrides?: Partial<LoopState>): Record<string, unknown> {
  return {
    active: true,
    status: 'active',
    prompt: 'Implement feature X',
    iteration: 2,
    minIterations: 5,
    maxIterations: 10,
    completionCriteria: 'ALL_TESTS_PASSING',
    issueNumber: 42,
    startedAt: isoMinutesAgo(45),
    lastIterationAt: isoMinutesAgo(10),
    history: [
      { iteration: 1, timestamp: isoMinutesAgo(30), summary: 'Initial impl', status: 'iterated' },
    ],
    ...overrides,
  };
}

function makeCancelledState(): Record<string, unknown> {
  return {
    active: false,
    status: 'cancelled',
    prompt: 'Implement feature X',
    iteration: 1,
    minIterations: 3,
    maxIterations: 10,
    completionCriteria: 'ALL_TESTS_PASSING',
    issueNumber: null,
    startedAt: isoMinutesAgo(20),
    lastIterationAt: isoMinutesAgo(5),
    history: [],
  };
}

// ---------------------------------------------------------------------------
// readLoopState
// ---------------------------------------------------------------------------

describe('readLoopState', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('returns null when loop-state.json does not exist', () => {
    const result = readLoopState(wsRoot);
    assert.equal(result, null);
  });

  it('returns null when workspace root does not exist', () => {
    const result = readLoopState('/non/existent/workspace');
    assert.equal(result, null);
  });

  it('reads a valid loop state file', () => {
    const expected = makeCompleteState();
    writeLoopState(wsRoot, expected);

    const result = readLoopState(wsRoot);
    assert.notEqual(result, null);
    assert.equal(result!.active, false);
    assert.equal(result!.status, 'complete');
     assert.equal(result!.iteration, 5);
     assert.equal(result!.minIterations, 5);
    assert.equal(result!.maxIterations, 10);
    assert.equal(result!.completionCriteria, 'ALL_TESTS_PASSING');
    assert.equal(result!.issueNumber, 42);
     assert.equal(result!.history.length, 5);
  });

  it('reads an active loop state', () => {
    writeLoopState(wsRoot, makeActiveState());

    const result = readLoopState(wsRoot);
    assert.notEqual(result, null);
    assert.equal(result!.active, true);
    assert.equal(result!.status, 'active');
    assert.equal(result!.iteration, 2);
  });

  it('returns null for invalid JSON', () => {
    const filePath = path.join(wsRoot, '.agentx', 'state', 'loop-state.json');
    fs.writeFileSync(filePath, '{ broken json !!!', 'utf-8');

    const result = readLoopState(wsRoot);
    assert.equal(result, null);
  });

  it('returns null for empty file', () => {
    const filePath = path.join(wsRoot, '.agentx', 'state', 'loop-state.json');
    fs.writeFileSync(filePath, '', 'utf-8');

    const result = readLoopState(wsRoot);
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// checkHandoffGate
// ---------------------------------------------------------------------------

describe('checkHandoffGate', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('blocks when no loop state file exists', () => {
    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.equal(gate.state, null);
    assert.ok(gate.reason.includes('No quality loop was started'));
  });

  it('blocks when loop is still active', () => {
    writeLoopState(wsRoot, makeActiveState());

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason.includes('still active'));
    assert.ok(gate.reason.includes('iteration 2/10'));
    assert.notEqual(gate.state, null);
    assert.equal(gate.state!.active, true);
  });

  it('blocks when loop was cancelled', () => {
    writeLoopState(wsRoot, makeCancelledState());

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason.includes('cancelled'));
    assert.ok(gate.reason.includes('does not satisfy'));
    assert.notEqual(gate.state, null);
  });

  it('allows when loop is complete', () => {
    writeLoopState(wsRoot, makeCompleteState());

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, true);
    assert.ok(gate.reason.includes('completed successfully'));
    assert.notEqual(gate.state, null);
    assert.equal(gate.state!.status, 'complete');
  });

  it('blocks when a completed loop does not meet the minimum review iterations', () => {
    writeLoopState(wsRoot, makeCompleteState({ iteration: 1, minIterations: 3 }));

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason.includes('completed too early'));
    assert.ok(gate.reason.includes('1/3'));
  });

  it('uses five as the default minimum when minIterations is missing', () => {
    const state = makeCompleteState({ iteration: 4 }) as Record<string, unknown>;
    delete state.minIterations;
    writeLoopState(wsRoot, state);

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason.includes('4/5'));
  });

  it('blocks when a completed loop is stale', () => {
    writeLoopState(wsRoot, makeCompleteState({
      startedAt: '2025-01-01T00:00:00Z',
      lastIterationAt: '2025-01-01T01:00:00Z',
    }));

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason.includes('stale'));
    assert.ok(gate.reason.includes('hours ago'));
  });

  it('blocks for unexpected status values', () => {
    writeLoopState(wsRoot, makeCompleteState({ status: 'unknown' as any, active: false }));

    const gate = checkHandoffGate(wsRoot);
    assert.equal(gate.allowed, false);
    assert.ok(gate.reason.includes('Unexpected loop status'));
  });
});

// ---------------------------------------------------------------------------
// shouldAutoStartLoop
// ---------------------------------------------------------------------------

describe('shouldAutoStartLoop', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('returns true when no loop state exists', () => {
    assert.equal(shouldAutoStartLoop(wsRoot), true);
  });

  it('returns true when previous loop is complete', () => {
    writeLoopState(wsRoot, makeCompleteState());
    assert.equal(shouldAutoStartLoop(wsRoot), true);
  });

  it('returns true when previous loop was cancelled', () => {
    writeLoopState(wsRoot, makeCancelledState());
    assert.equal(shouldAutoStartLoop(wsRoot), true);
  });

  it('returns false when loop is currently active', () => {
    writeLoopState(wsRoot, makeActiveState());
    assert.equal(shouldAutoStartLoop(wsRoot), false);
  });

  it('returns true when an active loop is stale', () => {
    writeLoopState(wsRoot, makeActiveState({
      startedAt: '2025-01-01T00:00:00Z',
      lastIterationAt: '2025-01-01T01:00:00Z',
    }));
    assert.equal(shouldAutoStartLoop(wsRoot), true);
  });
});

// ---------------------------------------------------------------------------
// getLoopStatusDisplay
// ---------------------------------------------------------------------------

describe('getLoopStatusDisplay', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('returns "No loop" when no state file exists', () => {
    assert.equal(getLoopStatusDisplay(wsRoot), 'No loop');
  });

  it('returns active loop display with iteration and criteria', () => {
    writeLoopState(wsRoot, makeActiveState());
    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('active'));
    assert.ok(display.includes('2/10'));
    assert.ok(display.includes('not ready to complete'));
    assert.ok(display.includes('2/5'));
    assert.ok(display.includes('ALL_TESTS_PASSING'));
  });

  it('returns complete status with iteration count', () => {
    writeLoopState(wsRoot, makeCompleteState());
    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('complete'));
    assert.ok(display.includes('5 iterations'));
    assert.ok(display.includes('min 5'));
  });

  it('shows stale completed status clearly', () => {
    writeLoopState(wsRoot, makeCompleteState({
      startedAt: '2025-01-01T00:00:00Z',
      lastIterationAt: '2025-01-01T01:00:00Z',
    }));
    assert.ok(getLoopStatusDisplay(wsRoot).includes('stale; loop last updated'));
  });

  it('uses the default minimum when reading a legacy loop-state file', () => {
    writeLoopState(wsRoot, {
      active: true,
      status: 'active',
      prompt: 'Legacy loop',
      iteration: 1,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      issueNumber: null,
        startedAt: isoMinutesAgo(10),
        lastIterationAt: isoMinutesAgo(5),
      history: [],
    });

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('1/5'));
  });

  it('shows when minimum iterations are met for an active loop', () => {
    writeLoopState(wsRoot, makeActiveState({ iteration: 3, minIterations: 3 }));

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('minimum iterations met'));
  });

  it('returns cancelled status', () => {
    writeLoopState(wsRoot, makeCancelledState());
    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('cancelled'));
  });

  it('shows budget remaining when budgetMinutes is set', () => {
    writeLoopState(wsRoot, makeActiveState({
      budgetMinutes: 60,
      startedAt: isoMinutesAgo(20),
    }));

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('remaining'), `Expected 'remaining' in: ${display}`);
  });

  it('shows budget exceeded when time exceeds budget', () => {
    writeLoopState(wsRoot, makeActiveState({
      budgetMinutes: 10,
      startedAt: isoMinutesAgo(30),
    }));

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('budget exceeded'), `Expected 'budget exceeded' in: ${display}`);
  });

  it('does not show budget info when budgetMinutes is not set', () => {
    writeLoopState(wsRoot, makeActiveState());

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(!display.includes('budget'), `Unexpected budget info in: ${display}`);
    assert.ok(!display.includes('remaining'), `Unexpected remaining info in: ${display}`);
  });

  it('shows latest harness score from history', () => {
    writeLoopState(wsRoot, makeActiveState({
      history: [
        { iteration: 1, timestamp: isoMinutesAgo(30), summary: 'Init', status: 'iterated', outcome: 'partial' as const, harnessScore: 40 },
        { iteration: 2, timestamp: isoMinutesAgo(15), summary: 'Fix', status: 'iterated', outcome: 'partial' as const, harnessScore: 60 },
      ],
    }));

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('score: 60'), `Expected 'score: 60' in: ${display}`);
    assert.ok(display.includes('+20'), `Expected '+20' delta in: ${display}`);
  });

  it('shows single harness score without delta', () => {
    writeLoopState(wsRoot, makeActiveState({
      history: [
        { iteration: 1, timestamp: isoMinutesAgo(10), summary: 'Init', status: 'iterated', outcome: 'partial' as const, harnessScore: 40 },
      ],
    }));

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('[score: 40]'), `Expected '[score: 40]' in: ${display}`);
    assert.ok(!display.includes('+'), `Unexpected delta in: ${display}`);
  });

  it('shows score without delta when delta is zero', () => {
    writeLoopState(wsRoot, makeActiveState({
      history: [
        { iteration: 1, timestamp: isoMinutesAgo(20), summary: 'Init', status: 'iterated', outcome: 'partial' as const, harnessScore: 60 },
        { iteration: 2, timestamp: isoMinutesAgo(10), summary: 'Recheck', status: 'iterated', outcome: 'partial' as const, harnessScore: 60 },
      ],
    }));

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('[score: 60]'), `Expected '[score: 60]' without delta in: ${display}`);
    assert.ok(!display.includes('[score: 60 ('), `Unexpected delta parenthetical in: ${display}`);
  });

  it('does not show score when history has no harnessScore', () => {
    writeLoopState(wsRoot, makeActiveState());

    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(!display.includes('score:'), `Unexpected score in: ${display}`);
  });
});

// ---------------------------------------------------------------------------
// isBudgetExceeded
// ---------------------------------------------------------------------------

describe('isBudgetExceeded', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('returns false when no loop state exists', () => {
    assert.equal(isBudgetExceeded(wsRoot), false);
  });

  it('returns false when no budget is set', () => {
    writeLoopState(wsRoot, makeActiveState());
    assert.equal(isBudgetExceeded(wsRoot), false);
  });

  it('returns false when budget is not yet exceeded', () => {
    writeLoopState(wsRoot, makeActiveState({
      budgetMinutes: 60,
      startedAt: isoMinutesAgo(10),
    }));
    assert.equal(isBudgetExceeded(wsRoot), false);
  });

  it('returns true when budget is exceeded', () => {
    writeLoopState(wsRoot, makeActiveState({
      budgetMinutes: 10,
      startedAt: isoMinutesAgo(30),
    }));
    assert.equal(isBudgetExceeded(wsRoot), true);
  });

  it('returns true when budget is exactly at boundary', () => {
    writeLoopState(wsRoot, makeActiveState({
      budgetMinutes: 10,
      startedAt: isoMinutesAgo(10),
    }));
    assert.equal(isBudgetExceeded(wsRoot), true);
  });
});

// ---------------------------------------------------------------------------
// LoopState history outcome and harnessScore fields
// ---------------------------------------------------------------------------

describe('LoopState history fields', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeTmpWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('reads outcome field from history entries', () => {
    writeLoopState(wsRoot, makeCompleteState({
      history: [
        { iteration: 1, timestamp: isoMinutesAgo(30), summary: 'Init', status: 'iterated', outcome: 'partial' },
        { iteration: 2, timestamp: isoMinutesAgo(15), summary: 'Fix', status: 'iterated', outcome: 'fail' },
        { iteration: 3, timestamp: isoMinutesAgo(5), summary: 'Done', status: 'complete', outcome: 'pass' },
      ],
    }));

    const state = readLoopState(wsRoot);
    assert.notEqual(state, null);
    assert.equal(state!.history[0].outcome, 'partial');
    assert.equal(state!.history[1].outcome, 'fail');
    assert.equal(state!.history[2].outcome, 'pass');
  });

  it('reads harnessScore field from history entries', () => {
    writeLoopState(wsRoot, makeCompleteState({
      history: [
        { iteration: 1, timestamp: isoMinutesAgo(30), summary: 'Init', status: 'iterated', harnessScore: 40 },
        { iteration: 2, timestamp: isoMinutesAgo(15), summary: 'Fix', status: 'iterated', harnessScore: 80 },
        { iteration: 3, timestamp: isoMinutesAgo(5), summary: 'Done', status: 'complete', harnessScore: 100 },
      ],
    }));

    const state = readLoopState(wsRoot);
    assert.notEqual(state, null);
    assert.equal(state!.history[0].harnessScore, 40);
    assert.equal(state!.history[1].harnessScore, 80);
    assert.equal(state!.history[2].harnessScore, 100);
  });

  it('handles history entries without outcome or harnessScore (backward compat)', () => {
    writeLoopState(wsRoot, makeCompleteState());

    const state = readLoopState(wsRoot);
    assert.notEqual(state, null);
    assert.equal(state!.history[0].outcome, undefined);
    assert.equal(state!.history[0].harnessScore, undefined);
  });

  it('reads budgetMinutes from state', () => {
    writeLoopState(wsRoot, makeActiveState({ budgetMinutes: 45 }));

    const state = readLoopState(wsRoot);
    assert.notEqual(state, null);
    assert.equal(state!.budgetMinutes, 45);
  });

  it('handles missing budgetMinutes gracefully', () => {
    writeLoopState(wsRoot, makeActiveState());

    const state = readLoopState(wsRoot);
    assert.notEqual(state, null);
    assert.equal(state!.budgetMinutes, undefined);
  });
});
