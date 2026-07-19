// ---------------------------------------------------------------------------
// AgentX -- Shared Runtime: Benchmark Eval Harness (batch mode)
// ---------------------------------------------------------------------------
//
// Framework-free core of the built-in benchmark harness (harness feature 4).
// Runs a task set in batch mode, scores each task, and aggregates a report.
// Like the verification loop, this module has NO dependency on `fs`, `path`, or
// `vscode`: task execution is delegated to an INJECTABLE `BenchmarkExecutor`,
// so the pure logic (parse / validate / score / aggregate / format) is
// deterministically testable and the IO boundary lives in the caller.
//
// A report bridges into the harness evidence ledger (feature 2) via
// `toBenchmarkEvidence`, recorded as `runtime`-class evidence because a
// benchmark pass rate is an observation of real behavior on a task set.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single benchmark task: a prompt plus a command that verifies success. */
export interface BenchmarkTask {
  readonly id: string;
  readonly name: string;
  /** The task description / prompt handed to the agent under test. */
  readonly prompt: string;
  /** Optional command run before the task to prepare the workspace. */
  readonly setupCommand?: string;
  /** Command whose exit code determines pass (0) or fail (non-zero). */
  readonly verifyCommand: string;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly tags?: ReadonlyArray<string>;
}

/** A named, versioned collection of benchmark tasks. */
export interface BenchmarkTaskSet {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly tasks: ReadonlyArray<BenchmarkTask>;
}

/** Raw outcome of executing one task. Produced by the BenchmarkExecutor. */
export interface BenchmarkTaskExecution {
  readonly passed: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly output?: string;
  readonly error?: string;
}

/** Scored outcome of one task after execution. */
export interface BenchmarkTaskResult {
  readonly task: BenchmarkTask;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly detail: string;
  readonly skipped: boolean;
}

/** Aggregate report over a full task-set batch run. */
export interface BenchmarkReport {
  readonly taskSetId: string;
  readonly taskSetName: string;
  readonly results: ReadonlyArray<BenchmarkTaskResult>;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /** Pass rate over executed (non-skipped) tasks, 0..1. */
  readonly passRate: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly totalDurationMs: number;
}

/** Options controlling a batch run. */
export interface RunBenchmarkOptions {
  /** Stop the batch after the first failing task (records the rest as skipped). */
  readonly stopOnFirstFailure?: boolean;
  /** Only run tasks that carry at least one of these tags. */
  readonly filterTags?: ReadonlyArray<string>;
  /** Injectable clock for deterministic timestamps. */
  readonly nowMs?: () => number;
}

/** Injectable async task executor. Keeps real IO out of the pure core. */
export type BenchmarkExecutor = (task: BenchmarkTask) => Promise<BenchmarkTaskExecution>;

/**
 * Dependency-free evidence shape, structurally compatible with the extension's
 * `RecordHarnessEvidenceOptions`. Recorded as `runtime` evidence (feature 2).
 */
export interface BenchmarkEvidence {
  readonly evidenceType: 'runtime';
  readonly evidenceClass: 'runtime';
  readonly summary: string;
  readonly status: 'pass' | 'fail';
  readonly metadata: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Parsing & validation (pure)
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Return a list of human-readable validation errors for a task. An empty array
 * means the task is well-formed. Kept separate from `parseTaskSet` so callers
 * can surface per-task problems without aborting the whole set.
 */
export function validateBenchmarkTask(task: unknown, index: number): string[] {
  const errors: string[] = [];
  const label = `task[${index}]`;
  if (typeof task !== 'object' || task === null) {
    return [`${label} is not an object`];
  }
  const candidate = task as Record<string, unknown>;
  if (!isNonEmptyString(candidate.id)) {
    errors.push(`${label}.id is required`);
  }
  if (!isNonEmptyString(candidate.name)) {
    errors.push(`${label}.name is required`);
  }
  if (!isNonEmptyString(candidate.prompt)) {
    errors.push(`${label}.prompt is required`);
  }
  if (!isNonEmptyString(candidate.verifyCommand)) {
    errors.push(`${label}.verifyCommand is required`);
  }
  if (candidate.setupCommand !== undefined && typeof candidate.setupCommand !== 'string') {
    errors.push(`${label}.setupCommand must be a string when present`);
  }
  if (candidate.cwd !== undefined && typeof candidate.cwd !== 'string') {
    errors.push(`${label}.cwd must be a string when present`);
  }
  if (
    candidate.timeoutMs !== undefined &&
    (typeof candidate.timeoutMs !== 'number' || !Number.isFinite(candidate.timeoutMs) || candidate.timeoutMs <= 0)
  ) {
    errors.push(`${label}.timeoutMs must be a positive number when present`);
  }
  if (
    candidate.tags !== undefined &&
    (!Array.isArray(candidate.tags) || candidate.tags.some((tag) => typeof tag !== 'string'))
  ) {
    errors.push(`${label}.tags must be an array of strings when present`);
  }
  return errors;
}

/**
 * Parse and validate an unknown value (e.g. parsed JSON) into a task set.
 * Throws an Error listing every problem found so a malformed task set fails
 * loudly at load time rather than silently mid-run. Rejects duplicate task ids.
 */
export function parseTaskSet(raw: unknown): BenchmarkTaskSet {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Benchmark task set must be an object.');
  }
  const candidate = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(candidate.id)) {
    errors.push('task set `id` is required');
  }
  if (!isNonEmptyString(candidate.name)) {
    errors.push('task set `name` is required');
  }
  if (!Array.isArray(candidate.tasks)) {
    errors.push('task set `tasks` must be an array');
  }

  const tasks: BenchmarkTask[] = [];
  if (Array.isArray(candidate.tasks)) {
    if (candidate.tasks.length === 0) {
      errors.push('task set `tasks` must not be empty');
    }
    const seenIds = new Set<string>();
    candidate.tasks.forEach((task, index) => {
      const taskErrors = validateBenchmarkTask(task, index);
      errors.push(...taskErrors);
      if (taskErrors.length === 0) {
        const typed = task as BenchmarkTask;
        if (seenIds.has(typed.id)) {
          errors.push(`duplicate task id: ${typed.id}`);
        }
        seenIds.add(typed.id);
        tasks.push(typed);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Invalid benchmark task set:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    id: candidate.id as string,
    name: candidate.name as string,
    version: isNonEmptyString(candidate.version) ? candidate.version : undefined,
    tasks,
  };
}

// ---------------------------------------------------------------------------
// Scoring & aggregation (pure)
// ---------------------------------------------------------------------------

/**
 * Score one task from its raw execution outcome. Success requires BOTH the
 * executor's `passed` flag AND a zero exit code: the task contract makes exit
 * code the source of truth, so an inconsistent execution (e.g. `passed: true`
 * with a non-zero exit) is scored as a failure rather than trusted.
 */
export function scoreBenchmarkResult(
  task: BenchmarkTask,
  execution: BenchmarkTaskExecution,
): BenchmarkTaskResult {
  const passed = execution.passed === true && execution.exitCode === 0;
  const detail = passed
    ? `${task.name} passed (${execution.durationMs}ms)`
    : `${task.name} failed (exit ${execution.exitCode})${execution.error ? `: ${execution.error}` : ''}`;
  return {
    task,
    passed,
    exitCode: execution.exitCode,
    durationMs: execution.durationMs,
    detail,
    skipped: false,
  };
}

function makeSkippedTaskResult(task: BenchmarkTask): BenchmarkTaskResult {
  return {
    task,
    passed: false,
    exitCode: -1,
    durationMs: 0,
    detail: `${task.name} skipped (stop-on-first-failure)`,
    skipped: true,
  };
}

/**
 * Aggregate scored results into a report. Pass rate is computed over executed
 * (non-skipped) tasks; a batch with every task skipped has a pass rate of 0.
 */
export function aggregateBenchmarkReport(
  taskSet: Pick<BenchmarkTaskSet, 'id' | 'name'>,
  results: ReadonlyArray<BenchmarkTaskResult>,
  startedAt: string,
  finishedAt: string,
): BenchmarkReport {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let totalDurationMs = 0;

  for (const result of results) {
    totalDurationMs += result.durationMs;
    if (result.skipped) {
      skipped += 1;
    } else if (result.passed) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  const executed = passed + failed;
  const passRate = executed > 0 ? passed / executed : 0;

  return {
    taskSetId: taskSet.id,
    taskSetName: taskSet.name,
    results,
    total: results.length,
    passed,
    failed,
    skipped,
    passRate,
    startedAt,
    finishedAt,
    totalDurationMs,
  };
}

// ---------------------------------------------------------------------------
// Report formatting (pure)
// ---------------------------------------------------------------------------

/** Build a human-readable report block for the CLI / logs. */
export function formatBenchmarkReport(report: BenchmarkReport): string {
  const pct = (report.passRate * 100).toFixed(1);
  const lines: string[] = [];
  lines.push(`Benchmark: ${report.taskSetName} (${report.taskSetId})`);
  lines.push(
    `Pass rate: ${pct}% -- ${report.passed}/${report.passed + report.failed} passed, ${report.skipped} skipped (${report.totalDurationMs}ms).`,
  );
  for (const result of report.results) {
    const mark = result.skipped ? 'SKIP' : result.passed ? 'PASS' : 'FAIL';
    lines.push(`  [${mark}] ${result.detail}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Evidence bridge (pure) -- feeds harness feature 2
// ---------------------------------------------------------------------------

/**
 * Convert a report into a dependency-free evidence record. A report with zero
 * failures counts as pass evidence; any failure marks it fail so a benchmark
 * regression is visible in the evidence ledger.
 */
export function toBenchmarkEvidence(report: BenchmarkReport): BenchmarkEvidence {
  const status: 'pass' | 'fail' = report.failed === 0 && report.passed > 0 ? 'pass' : 'fail';
  const pct = (report.passRate * 100).toFixed(1);
  return {
    evidenceType: 'runtime',
    evidenceClass: 'runtime',
    summary: `Benchmark ${report.taskSetName}: ${pct}% pass (${report.passed}/${report.passed + report.failed})`,
    status,
    metadata: {
      taskSetId: report.taskSetId,
      passRate: report.passRate,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      total: report.total,
      totalDurationMs: report.totalDurationMs,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Async execution boundary (injectable executor)
// ---------------------------------------------------------------------------

function taskMatchesTags(task: BenchmarkTask, filterTags?: ReadonlyArray<string>): boolean {
  if (!filterTags || filterTags.length === 0) {
    return true;
  }
  const taskTags = task.tags ?? [];
  return filterTags.some((tag) => taskTags.includes(tag));
}

/**
 * Run a task set in batch mode. The only IO is delegated to `executor`. Tasks
 * filtered out by `filterTags` are excluded entirely (not counted as skipped).
 * With `stopOnFirstFailure`, the first failure short-circuits remaining tasks,
 * which are recorded as skipped so the report still lists the full batch.
 */
export async function runBenchmarkBatch(
  taskSet: BenchmarkTaskSet,
  executor: BenchmarkExecutor,
  options: RunBenchmarkOptions = {},
): Promise<BenchmarkReport> {
  const now = options.nowMs ?? Date.now;
  const startedAt = new Date(now()).toISOString();
  const selected = taskSet.tasks.filter((task) => taskMatchesTags(task, options.filterTags));
  const results: BenchmarkTaskResult[] = [];
  let shortCircuited = false;

  for (const task of selected) {
    if (shortCircuited) {
      results.push(makeSkippedTaskResult(task));
      continue;
    }

    const execution = await executor(task);
    const result = scoreBenchmarkResult(task, execution);
    results.push(result);

    if (options.stopOnFirstFailure && !result.passed) {
      shortCircuited = true;
    }
  }

  const finishedAt = new Date(now()).toISOString();
  return aggregateBenchmarkReport(taskSet, results, startedAt, finishedAt);
}
