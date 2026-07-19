import { strict as assert } from 'assert';
import {
  parseVerificationFailures,
  evaluateVerificationCheck,
  summarizeVerificationRun,
  formatVerificationFeedback,
  toVerificationEvidence,
  runVerificationLoop,
  VerificationCheck,
  CommandExecution,
  VerificationCheckResult,
} from '../../runtime';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheck(overrides?: Partial<VerificationCheck>): VerificationCheck {
  return {
    id: 'c1',
    kind: 'test',
    label: 'Unit tests',
    command: 'npm test',
    ...overrides,
  };
}

function makeExec(overrides?: Partial<CommandExecution>): CommandExecution {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    durationMs: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseVerificationFailures
// ---------------------------------------------------------------------------

describe('parseVerificationFailures', () => {
  it('parses tsc-style errors with file/line/col', () => {
    const stdout = "src/foo.ts(12,5): error TS2304: Cannot find name 'bar'.";
    const failures = parseVerificationFailures({ stdout, stderr: '' });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].file, 'src/foo.ts');
    assert.equal(failures[0].line, 12);
    assert.equal(failures[0].column, 5);
    assert.match(failures[0].message, /Cannot find name/);
  });

  it('parses eslint compact-style errors ending in a source extension', () => {
    const stdout = "/abs/foo.ts:20:9: 'x' is assigned a value but never used  no-unused-vars";
    const failures = parseVerificationFailures({ stdout, stderr: '' });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].file, '/abs/foo.ts');
    assert.equal(failures[0].line, 20);
    assert.equal(failures[0].column, 9);
  });

  it('falls back to generic error lines when no structured match exists', () => {
    const stderr = 'Something happened\nError: boom\nAll good here';
    const failures = parseVerificationFailures({ stdout: '', stderr });
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /Error: boom/);
  });

  it('returns empty array when output is clean', () => {
    const failures = parseVerificationFailures({ stdout: 'ok\ndone', stderr: '' });
    assert.equal(failures.length, 0);
  });

  it('caps the number of failures returned', () => {
    const stdout = Array.from({ length: 30 }, (_, i) => `src/f${i}.ts(1,1): error TS1: msg${i}`).join('\n');
    const failures = parseVerificationFailures({ stdout, stderr: '' }, 5);
    assert.equal(failures.length, 5);
  });
});

// ---------------------------------------------------------------------------
// evaluateVerificationCheck
// ---------------------------------------------------------------------------

describe('evaluateVerificationCheck', () => {
  it('marks a zero-exit execution as passed with no failures', () => {
    const result = evaluateVerificationCheck(makeCheck(), makeExec({ exitCode: 0 }));
    assert.equal(result.passed, true);
    assert.equal(result.failures.length, 0);
    assert.match(result.summary, /passed/);
  });

  it('marks a non-zero exit as failed and parses findings', () => {
    const exec = makeExec({ exitCode: 1, stdout: 'src/a.ts(3,2): error TS100: nope' });
    const result = evaluateVerificationCheck(makeCheck(), exec);
    assert.equal(result.passed, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.summary, /failed/);
  });

  it('treats a timeout as a failure even on exit 0', () => {
    const result = evaluateVerificationCheck(makeCheck(), makeExec({ exitCode: 0, timedOut: true }));
    assert.equal(result.passed, false);
    assert.equal(result.timedOut, true);
    assert.match(result.summary, /timed out/);
  });
});

// ---------------------------------------------------------------------------
// summarizeVerificationRun
// ---------------------------------------------------------------------------

describe('summarizeVerificationRun', () => {
  function res(overrides: Partial<VerificationCheckResult>): VerificationCheckResult {
    return {
      check: makeCheck(),
      passed: true,
      exitCode: 0,
      durationMs: 10,
      timedOut: false,
      failures: [],
      summary: 's',
      skipped: false,
      ...overrides,
    };
  }

  it('passes when all checks pass', () => {
    const run = summarizeVerificationRun([res({ passed: true }), res({ passed: true })], 'a', 'b');
    assert.equal(run.passed, true);
    assert.equal(run.passedCount, 2);
    assert.equal(run.failedCount, 0);
  });

  it('fails when a mandatory check fails', () => {
    const run = summarizeVerificationRun([res({ passed: true }), res({ passed: false })], 'a', 'b');
    assert.equal(run.passed, false);
    assert.equal(run.failedCount, 1);
  });

  it('does not fail the run for an optional check failure', () => {
    const optional = res({ passed: false, check: makeCheck({ optional: true }) });
    const run = summarizeVerificationRun([res({ passed: true }), optional], 'a', 'b');
    assert.equal(run.passed, true);
    assert.equal(run.failedCount, 1);
  });

  it('fails the run when a mandatory check was skipped', () => {
    const run = summarizeVerificationRun([res({ passed: false }), res({ skipped: true, passed: false })], 'a', 'b');
    assert.equal(run.passed, false);
    assert.equal(run.skippedCount, 1);
  });

  it('sums durations across checks', () => {
    const run = summarizeVerificationRun([res({ durationMs: 30 }), res({ durationMs: 70 })], 'a', 'b');
    assert.equal(run.totalDurationMs, 100);
  });
});

// ---------------------------------------------------------------------------
// formatVerificationFeedback
// ---------------------------------------------------------------------------

describe('formatVerificationFeedback', () => {
  it('returns a short confirmation on success', () => {
    const run = summarizeVerificationRun(
      [{ check: makeCheck(), passed: true, exitCode: 0, durationMs: 5, timedOut: false, failures: [], summary: 'ok', skipped: false }],
      'a',
      'b',
    );
    const text = formatVerificationFeedback(run);
    assert.match(text, /Verification passed/);
  });

  it('lists failing checks and truncates findings beyond the cap', () => {
    const failures = Array.from({ length: 8 }, (_, i) => ({ message: `msg${i}`, raw: `msg${i}` }));
    const failing: VerificationCheckResult = {
      check: makeCheck({ kind: 'lint', label: 'Lint' }),
      passed: false,
      exitCode: 1,
      durationMs: 5,
      timedOut: false,
      failures,
      summary: 'Lint failed',
      skipped: false,
    };
    const run = summarizeVerificationRun([failing], 'a', 'b');
    const text = formatVerificationFeedback(run, 3);
    assert.match(text, /Verification failed/);
    assert.match(text, /\[lint\]/);
    assert.match(text, /and 5 more finding/);
  });

  it('surfaces optional-check failures as warnings even when the run passes', () => {
    const optionalFail: VerificationCheckResult = {
      check: makeCheck({ kind: 'lint', label: 'Lint', optional: true }),
      passed: false,
      exitCode: 1,
      durationMs: 5,
      timedOut: false,
      failures: [{ message: 'style nit', raw: 'style nit' }],
      summary: 'Lint failed',
      skipped: false,
    };
    const pass: VerificationCheckResult = {
      check: makeCheck({ kind: 'test', label: 'Tests' }),
      passed: true,
      exitCode: 0,
      durationMs: 5,
      timedOut: false,
      failures: [],
      summary: 'Tests passed',
      skipped: false,
    };
    const run = summarizeVerificationRun([pass, optionalFail], 'a', 'b');
    assert.equal(run.passed, true);
    const text = formatVerificationFeedback(run);
    assert.match(text, /Verification passed/);
    assert.match(text, /Optional check warnings/);
    assert.match(text, /style nit/);
  });
});

// ---------------------------------------------------------------------------
// toVerificationEvidence
// ---------------------------------------------------------------------------

describe('toVerificationEvidence', () => {
  it('produces pass evidence for a green run', () => {
    const run = summarizeVerificationRun(
      [{ check: makeCheck(), passed: true, exitCode: 0, durationMs: 5, timedOut: false, failures: [], summary: 'ok', skipped: false }],
      'a',
      'b',
    );
    const ev = toVerificationEvidence(run);
    assert.equal(ev.evidenceClass, 'verification');
    assert.equal(ev.status, 'pass');
    assert.equal(ev.metadata.passed, true);
  });

  it('produces fail evidence for a red run', () => {
    const run = summarizeVerificationRun(
      [{ check: makeCheck(), passed: false, exitCode: 1, durationMs: 5, timedOut: false, failures: [], summary: 'bad', skipped: false }],
      'a',
      'b',
    );
    const ev = toVerificationEvidence(run);
    assert.equal(ev.status, 'fail');
    assert.equal(ev.metadata.failedCount, 1);
  });

  it('does not produce pass evidence for an empty (no-checks) run', () => {
    const run = summarizeVerificationRun([], 'a', 'b');
    const ev = toVerificationEvidence(run);
    assert.equal(ev.status, 'fail');
    assert.match(ev.summary, /inconclusive/);
  });
});

// ---------------------------------------------------------------------------
// runVerificationLoop (async, injectable runner)
// ---------------------------------------------------------------------------

describe('runVerificationLoop', () => {
  it('runs all checks and passes when every runner returns exit 0', async () => {
    const checks = [makeCheck({ id: 'a' }), makeCheck({ id: 'b' })];
    const run = await runVerificationLoop(checks, async () => makeExec({ exitCode: 0 }), { nowMs: () => 0 });
    assert.equal(run.passed, true);
    assert.equal(run.results.length, 2);
  });

  it('short-circuits remaining mandatory checks on first failure', async () => {
    const checks = [makeCheck({ id: 'a' }), makeCheck({ id: 'b' }), makeCheck({ id: 'c' })];
    let calls = 0;
    const run = await runVerificationLoop(
      checks,
      async () => {
        calls += 1;
        return makeExec({ exitCode: 1 });
      },
      { stopOnFirstFailure: true, nowMs: () => 0 },
    );
    assert.equal(run.passed, false);
    assert.equal(calls, 1, 'only the first check should execute');
    assert.equal(run.results[1].skipped, true);
    assert.equal(run.results[2].skipped, true);
  });

  it('does not short-circuit on an optional check failure', async () => {
    const checks = [makeCheck({ id: 'a', optional: true }), makeCheck({ id: 'b' })];
    let calls = 0;
    const run = await runVerificationLoop(
      checks,
      async (c) => {
        calls += 1;
        return makeExec({ exitCode: c.id === 'a' ? 1 : 0 });
      },
      { stopOnFirstFailure: true, nowMs: () => 0 },
    );
    assert.equal(calls, 2, 'optional failure must not stop the run');
    assert.equal(run.passed, true);
  });

  it('uses the injected clock for timestamps', async () => {
    const run = await runVerificationLoop([makeCheck()], async () => makeExec(), { nowMs: () => 0 });
    assert.equal(run.startedAt, new Date(0).toISOString());
  });

  it('passes vacuously when given no checks', async () => {
    const run = await runVerificationLoop([], async () => makeExec(), { nowMs: () => 0 });
    assert.equal(run.passed, true);
    assert.equal(run.results.length, 0);
  });

  it('does not fail the run when the only check is an optional failure', async () => {
    const run = await runVerificationLoop(
      [makeCheck({ optional: true })],
      async () => makeExec({ exitCode: 1 }),
      { nowMs: () => 0 },
    );
    assert.equal(run.passed, true);
    assert.equal(run.failedCount, 1);
  });
});
