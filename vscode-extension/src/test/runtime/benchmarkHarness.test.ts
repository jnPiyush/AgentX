import { strict as assert } from 'assert';
import {
  validateBenchmarkTask,
  parseTaskSet,
  scoreBenchmarkResult,
  aggregateBenchmarkReport,
  formatBenchmarkReport,
  toBenchmarkEvidence,
  runBenchmarkBatch,
  BenchmarkTask,
  BenchmarkTaskSet,
  BenchmarkTaskExecution,
} from '../../runtime';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    id: 't1',
    name: 'Task one',
    prompt: 'do the thing',
    verifyCommand: 'npm test',
    ...overrides,
  };
}

function makeSet(tasks: BenchmarkTask[]): BenchmarkTaskSet {
  return { id: 'set1', name: 'Sample set', tasks };
}

function makeExec(overrides?: Partial<BenchmarkTaskExecution>): BenchmarkTaskExecution {
  return { passed: true, exitCode: 0, durationMs: 50, ...overrides };
}

// ---------------------------------------------------------------------------
// validateBenchmarkTask
// ---------------------------------------------------------------------------

describe('validateBenchmarkTask', () => {
  it('returns no errors for a well-formed task', () => {
    assert.deepEqual(validateBenchmarkTask(makeTask(), 0), []);
  });

  it('flags every missing required field', () => {
    const errors = validateBenchmarkTask({}, 3);
    assert.ok(errors.some((e) => e.includes('id')));
    assert.ok(errors.some((e) => e.includes('name')));
    assert.ok(errors.some((e) => e.includes('prompt')));
    assert.ok(errors.some((e) => e.includes('verifyCommand')));
  });

  it('flags a non-object task', () => {
    const errors = validateBenchmarkTask(null, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /not an object/);
  });

  it('flags invalid optional fields', () => {
    const bad = {
      id: 't',
      name: 'n',
      prompt: 'p',
      verifyCommand: 'v',
      setupCommand: 7,
      timeoutMs: -5,
      tags: ['ok', 3],
      cwd: 42,
    };
    const errors = validateBenchmarkTask(bad, 0);
    assert.ok(errors.some((e) => e.includes('setupCommand')));
    assert.ok(errors.some((e) => e.includes('timeoutMs')));
    assert.ok(errors.some((e) => e.includes('tags')));
    assert.ok(errors.some((e) => e.includes('cwd')));
  });
});

// ---------------------------------------------------------------------------
// parseTaskSet
// ---------------------------------------------------------------------------

describe('parseTaskSet', () => {
  it('parses a valid task set', () => {
    const set = parseTaskSet({ id: 's', name: 'n', version: '1.0', tasks: [makeTask()] });
    assert.equal(set.id, 's');
    assert.equal(set.version, '1.0');
    assert.equal(set.tasks.length, 1);
  });

  it('throws on a non-object input', () => {
    assert.throws(() => parseTaskSet(42), /must be an object/);
  });

  it('throws when tasks is empty', () => {
    assert.throws(() => parseTaskSet({ id: 's', name: 'n', tasks: [] }), /must not be empty/);
  });

  it('throws and lists per-task errors', () => {
    assert.throws(() => parseTaskSet({ id: 's', name: 'n', tasks: [{}] }), /verifyCommand is required/);
  });

  it('rejects duplicate task ids', () => {
    const set = { id: 's', name: 'n', tasks: [makeTask({ id: 'dup' }), makeTask({ id: 'dup' })] };
    assert.throws(() => parseTaskSet(set), /duplicate task id: dup/);
  });
});

// ---------------------------------------------------------------------------
// scoreBenchmarkResult
// ---------------------------------------------------------------------------

describe('scoreBenchmarkResult', () => {
  it('scores a passing execution', () => {
    const result = scoreBenchmarkResult(makeTask(), makeExec({ passed: true }));
    assert.equal(result.passed, true);
    assert.match(result.detail, /passed/);
  });

  it('scores a failing execution and includes the error', () => {
    const result = scoreBenchmarkResult(makeTask(), makeExec({ passed: false, exitCode: 2, error: 'boom' }));
    assert.equal(result.passed, false);
    assert.match(result.detail, /boom/);
  });

  it('treats an inconsistent execution (passed=true, exit!=0) as a failure', () => {
    const result = scoreBenchmarkResult(makeTask(), makeExec({ passed: true, exitCode: 1 }));
    assert.equal(result.passed, false);
  });
});

// ---------------------------------------------------------------------------
// aggregateBenchmarkReport
// ---------------------------------------------------------------------------

describe('aggregateBenchmarkReport', () => {
  it('computes pass rate over executed tasks only', () => {
    const results = [
      scoreBenchmarkResult(makeTask({ id: 'a' }), makeExec({ passed: true, durationMs: 10 })),
      scoreBenchmarkResult(makeTask({ id: 'b' }), makeExec({ passed: false, durationMs: 20 })),
    ];
    const report = aggregateBenchmarkReport({ id: 's', name: 'n' }, results, 'a', 'b');
    assert.equal(report.passed, 1);
    assert.equal(report.failed, 1);
    assert.equal(report.passRate, 0.5);
    assert.equal(report.totalDurationMs, 30);
  });

  it('reports zero pass rate when every task is skipped', () => {
    const skipped = { task: makeTask(), passed: false, exitCode: -1, durationMs: 0, detail: 's', skipped: true };
    const report = aggregateBenchmarkReport({ id: 's', name: 'n' }, [skipped], 'a', 'b');
    assert.equal(report.passRate, 0);
    assert.equal(report.skipped, 1);
  });
});

// ---------------------------------------------------------------------------
// formatBenchmarkReport & toBenchmarkEvidence
// ---------------------------------------------------------------------------

describe('formatBenchmarkReport', () => {
  it('renders a pass-rate header and per-task marks', () => {
    const results = [
      scoreBenchmarkResult(makeTask({ id: 'a', name: 'A' }), makeExec({ passed: true })),
      scoreBenchmarkResult(makeTask({ id: 'b', name: 'B' }), makeExec({ passed: false })),
    ];
    const report = aggregateBenchmarkReport({ id: 's', name: 'Set' }, results, 'a', 'b');
    const text = formatBenchmarkReport(report);
    assert.match(text, /Pass rate: 50.0%/);
    assert.match(text, /\[PASS\]/);
    assert.match(text, /\[FAIL\]/);
  });
});

describe('toBenchmarkEvidence', () => {
  it('marks a clean sweep as pass runtime evidence', () => {
    const results = [scoreBenchmarkResult(makeTask(), makeExec({ passed: true }))];
    const report = aggregateBenchmarkReport({ id: 's', name: 'n' }, results, 'a', 'b');
    const ev = toBenchmarkEvidence(report);
    assert.equal(ev.evidenceClass, 'runtime');
    assert.equal(ev.status, 'pass');
  });

  it('marks any failure as fail evidence', () => {
    const results = [scoreBenchmarkResult(makeTask(), makeExec({ passed: false }))];
    const report = aggregateBenchmarkReport({ id: 's', name: 'n' }, results, 'a', 'b');
    assert.equal(toBenchmarkEvidence(report).status, 'fail');
  });
});

// ---------------------------------------------------------------------------
// runBenchmarkBatch (async, injectable executor)
// ---------------------------------------------------------------------------

describe('runBenchmarkBatch', () => {
  it('runs every task and aggregates the report', async () => {
    const set = makeSet([makeTask({ id: 'a' }), makeTask({ id: 'b' })]);
    const report = await runBenchmarkBatch(set, async () => makeExec({ passed: true }), { nowMs: () => 0 });
    assert.equal(report.total, 2);
    assert.equal(report.passed, 2);
    assert.equal(report.passRate, 1);
  });

  it('short-circuits remaining tasks on first failure', async () => {
    const set = makeSet([makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'c' })]);
    let calls = 0;
    const report = await runBenchmarkBatch(
      set,
      async () => {
        calls += 1;
        return makeExec({ passed: false, exitCode: 1 });
      },
      { stopOnFirstFailure: true, nowMs: () => 0 },
    );
    assert.equal(calls, 1);
    assert.equal(report.skipped, 2);
    assert.equal(report.failed, 1);
  });

  it('filters tasks by tag and excludes non-matching tasks from the report', async () => {
    const set = makeSet([
      makeTask({ id: 'a', tags: ['smoke'] }),
      makeTask({ id: 'b', tags: ['slow'] }),
    ]);
    const report = await runBenchmarkBatch(set, async () => makeExec({ passed: true }), {
      filterTags: ['smoke'],
      nowMs: () => 0,
    });
    assert.equal(report.total, 1);
    assert.equal(report.results[0].task.id, 'a');
  });

  it('uses the injected clock for timestamps', async () => {
    const set = makeSet([makeTask()]);
    const report = await runBenchmarkBatch(set, async () => makeExec(), { nowMs: () => 0 });
    assert.equal(report.startedAt, new Date(0).toISOString());
  });

  it('produces an empty report when the tag filter matches no tasks', async () => {
    const set = makeSet([makeTask({ id: 'a', tags: ['smoke'] })]);
    const report = await runBenchmarkBatch(set, async () => makeExec(), {
      filterTags: ['nonexistent'],
      nowMs: () => 0,
    });
    assert.equal(report.total, 0);
    assert.equal(report.passRate, 0);
  });

  it('excludes tasks with no tags when a tag filter is active', async () => {
    const set = makeSet([makeTask({ id: 'a' }), makeTask({ id: 'b', tags: ['smoke'] })]);
    const report = await runBenchmarkBatch(set, async () => makeExec(), {
      filterTags: ['smoke'],
      nowMs: () => 0,
    });
    assert.equal(report.total, 1);
    assert.equal(report.results[0].task.id, 'b');
  });
});
