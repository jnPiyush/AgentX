import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readLoopState,
  checkHandoffGate,
  shouldAutoStartLoop,
  getLoopStatusDisplay,
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
    iteration: 3,
    minIterations: 3,
    maxIterations: 10,
    completionCriteria: 'ALL_TESTS_PASSING',
    issueNumber: 42,
    startedAt: isoMinutesAgo(70),
    lastIterationAt: isoMinutesAgo(5),
    history: [
      { iteration: 1, timestamp: isoMinutesAgo(60), summary: 'Initial impl', status: 'iterated' },
      { iteration: 2, timestamp: isoMinutesAgo(30), summary: 'Fix tests', status: 'iterated' },
      { iteration: 3, timestamp: isoMinutesAgo(5), summary: 'All green', status: 'complete' },
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
    minIterations: 3,
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
    assert.equal(result!.iteration, 3);
    assert.equal(result!.minIterations, 3);
    assert.equal(result!.maxIterations, 10);
    assert.equal(result!.completionCriteria, 'ALL_TESTS_PASSING');
    assert.equal(result!.issueNumber, 42);
    assert.equal(result!.history.length, 3);
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
    assert.ok(display.includes('2/3'));
    assert.ok(display.includes('ALL_TESTS_PASSING'));
  });

  it('returns complete status with iteration count', () => {
    writeLoopState(wsRoot, makeCompleteState());
    const display = getLoopStatusDisplay(wsRoot);
    assert.ok(display.includes('complete'));
    assert.ok(display.includes('3 iterations'));
    assert.ok(display.includes('min 3'));
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
    assert.ok(display.includes('1/3'));
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
});
