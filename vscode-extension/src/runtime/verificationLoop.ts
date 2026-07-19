// ---------------------------------------------------------------------------
// AgentX -- Shared Runtime: Live Verification Loop
// ---------------------------------------------------------------------------
//
// Framework-free core of the "verify after every edit, feed errors back" loop
// (harness feature 3). This module has NO dependency on `fs`, `path`, or
// `vscode`. The pure functions (parse / evaluate / summarize / format) operate
// on already-captured command output so they are deterministically testable.
// A single async boundary (`runVerificationLoop`) executes checks through an
// INJECTABLE `CommandRunner`, so real command execution lives in the caller and
// tests can supply a fake runner.
//
// The output of a run bridges into the harness evidence ledger (feature 2) via
// `toVerificationEvidence`, which returns a plain, dependency-free shape that
// the extension can hand to `recordHarnessEvidence`.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationCheckKind = 'lint' | 'compile' | 'typecheck' | 'test' | 'custom';

/** A single verification command to run after an edit. */
export interface VerificationCheck {
  readonly id: string;
  readonly kind: VerificationCheckKind;
  readonly label: string;
  /** Shell command to execute (run by the caller-supplied CommandRunner). */
  readonly command: string;
  readonly cwd?: string;
  /** Optional checks record failures but do not fail the overall run. */
  readonly optional?: boolean;
}

/** Result of executing a single command. Produced by the CommandRunner. */
export interface CommandExecution {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut?: boolean;
}

/** A structured failure extracted from command output. */
export interface VerificationFailureDetail {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
  /** The raw source line the failure was parsed from. */
  readonly raw: string;
}

/** Outcome of a single check after execution + parsing. */
export interface VerificationCheckResult {
  readonly check: VerificationCheck;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly failures: ReadonlyArray<VerificationFailureDetail>;
  readonly summary: string;
  /** True when the check was skipped (e.g. stop-on-first-failure short-circuit). */
  readonly skipped: boolean;
}

/** Aggregate outcome of a verification run over one or more checks. */
export interface VerificationRunResult {
  readonly passed: boolean;
  readonly results: ReadonlyArray<VerificationCheckResult>;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly totalDurationMs: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
}

/** Options controlling how a verification run executes. */
export interface RunVerificationOptions {
  /** When true, stop executing remaining checks after the first hard failure. */
  readonly stopOnFirstFailure?: boolean;
  /** Cap the number of failure details captured per check (default 20). */
  readonly maxFailuresPerCheck?: number;
  /** Injectable clock for deterministic timestamps. */
  readonly nowMs?: () => number;
}

/** Injectable async command executor. Keeps real IO out of the pure core. */
export type CommandRunner = (check: VerificationCheck) => Promise<CommandExecution>;

/**
 * Dependency-free evidence shape. Structurally compatible with the extension's
 * `RecordHarnessEvidenceOptions` so the caller can pass it straight through to
 * `recordHarnessEvidence` without this module importing from `utils`.
 */
export interface VerificationEvidence {
  readonly evidenceType: 'verification';
  readonly evidenceClass: 'verification';
  readonly summary: string;
  readonly status: 'pass' | 'fail';
  readonly metadata: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_FAILURES_PER_CHECK = 20;
/** How many failures to surface per check in the fed-back feedback message. */
const FEEDBACK_FAILURES_PER_CHECK = 5;

// ---------------------------------------------------------------------------
// Failure parsing (pure)
// ---------------------------------------------------------------------------

// tsc:      src/foo.ts(12,5): error TS2304: Cannot find name 'bar'.
const TSC_PATTERN = /^(?<file>[^\s(].*?)\((?<line>\d+),(?<col>\d+)\):\s*error\s+TS\d+:\s*(?<msg>.+)$/;
// eslint:   /abs/foo.ts:12:5: 'x' is assigned a value but never used  (compact format)
const ESLINT_COMPACT_PATTERN = /^(?<file>.+?):(?<line>\d+):(?<col>\d+):\s*(?<msg>.+?)(?:\s{2,}\S+)?$/;
// generic:  Error: something went wrong   |   FAIL src/foo.test.ts
const GENERIC_ERROR_PATTERN = /\b(error|failed|fail|exception|assertionerror)\b/i;

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function toPositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Extract structured failures from command output. Recognizes tsc and eslint
 * (compact) formats, then falls back to generic error/fail lines. The parser is
 * intentionally conservative: it prefers precise matches and only uses the
 * generic fallback when no structured matches were found.
 */
export function parseVerificationFailures(
  execution: Pick<CommandExecution, 'stdout' | 'stderr'>,
  maxFailures: number = DEFAULT_MAX_FAILURES_PER_CHECK,
): VerificationFailureDetail[] {
  const combined = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`;
  const lines = normalizeLines(combined);
  const structured: VerificationFailureDetail[] = [];

  for (const raw of lines) {
    const tsc = TSC_PATTERN.exec(raw);
    if (tsc?.groups) {
      structured.push({
        file: tsc.groups.file,
        line: toPositiveInt(tsc.groups.line),
        column: toPositiveInt(tsc.groups.col),
        message: tsc.groups.msg.trim(),
        raw,
      });
      continue;
    }

    const eslint = ESLINT_COMPACT_PATTERN.exec(raw);
    // Guard against matching plain "URL:80:1"-style noise: require a file-like
    // token that ends in a source extension.
    if (eslint?.groups && /\.[a-z0-9]+$/i.test(eslint.groups.file)) {
      structured.push({
        file: eslint.groups.file,
        line: toPositiveInt(eslint.groups.line),
        column: toPositiveInt(eslint.groups.col),
        message: eslint.groups.msg.trim(),
        raw,
      });
      continue;
    }
  }

  if (structured.length > 0) {
    return structured.slice(0, maxFailures);
  }

  // Generic fallback: surface lines that look like errors so the agent still
  // gets actionable feedback for tools we do not parse precisely.
  const generic = lines
    .filter((raw) => GENERIC_ERROR_PATTERN.test(raw))
    .map((raw) => ({ message: raw.trim(), raw }));
  return generic.slice(0, maxFailures);
}

// ---------------------------------------------------------------------------
// Check evaluation (pure)
// ---------------------------------------------------------------------------

/**
 * Turn a raw command execution into a structured check result. A check passes
 * when its exit code is 0 and it did not time out. Failures are always parsed
 * when a check does not pass so callers get consistent detail.
 */
export function evaluateVerificationCheck(
  check: VerificationCheck,
  execution: CommandExecution,
  maxFailures: number = DEFAULT_MAX_FAILURES_PER_CHECK,
): VerificationCheckResult {
  const timedOut = execution.timedOut === true;
  const passed = execution.exitCode === 0 && !timedOut;
  const failures = passed ? [] : parseVerificationFailures(execution, maxFailures);
  const summary = passed
    ? `${check.label} passed`
    : timedOut
      ? `${check.label} timed out after ${execution.durationMs}ms`
      : `${check.label} failed (exit ${execution.exitCode}, ${failures.length} finding${failures.length === 1 ? '' : 's'})`;

  return {
    check,
    passed,
    exitCode: execution.exitCode,
    durationMs: execution.durationMs,
    timedOut,
    failures,
    summary,
    skipped: false,
  };
}

function makeSkippedResult(check: VerificationCheck): VerificationCheckResult {
  return {
    check,
    passed: false,
    exitCode: -1,
    durationMs: 0,
    timedOut: false,
    failures: [],
    summary: `${check.label} skipped (earlier check failed)`,
    skipped: true,
  };
}

// ---------------------------------------------------------------------------
// Run aggregation (pure)
// ---------------------------------------------------------------------------

/**
 * A run passes when every non-skipped, non-optional check passed. Optional
 * checks and skipped checks never fail the run on their own, but skipped
 * mandatory checks (from stop-on-first-failure) mean the run already failed.
 */
export function summarizeVerificationRun(
  results: ReadonlyArray<VerificationCheckResult>,
  startedAt: string,
  finishedAt: string,
): VerificationRunResult {
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let totalDurationMs = 0;
  let runPassed = true;

  for (const result of results) {
    totalDurationMs += result.durationMs;
    if (result.skipped) {
      skippedCount += 1;
      runPassed = false;
      continue;
    }
    if (result.passed) {
      passedCount += 1;
      continue;
    }
    failedCount += 1;
    if (!result.check.optional) {
      runPassed = false;
    }
  }

  return {
    passed: runPassed,
    results,
    startedAt,
    finishedAt,
    totalDurationMs,
    passedCount,
    failedCount,
    skippedCount,
  };
}

// ---------------------------------------------------------------------------
// Feedback formatting (pure) -- the "feed errors back" surface
// ---------------------------------------------------------------------------

function formatFailureLine(failure: VerificationFailureDetail): string {
  const location = failure.file
    ? `${failure.file}${failure.line ? `:${failure.line}` : ''}${failure.column ? `:${failure.column}` : ''} - `
    : '';
  return `    ${location}${failure.message}`;
}

function appendCheckFindings(
  lines: string[],
  result: VerificationCheckResult,
  failuresPerCheck: number,
): void {
  const optionalTag = result.check.optional ? ' (optional)' : '';
  lines.push(`  [${result.check.kind}] ${result.summary}${optionalTag}`);
  const shown = result.failures.slice(0, failuresPerCheck);
  for (const failure of shown) {
    lines.push(formatFailureLine(failure));
  }
  const hidden = result.failures.length - shown.length;
  if (hidden > 0) {
    lines.push(`    ... and ${hidden} more finding${hidden === 1 ? '' : 's'}`);
  }
}

/**
 * Build an agent-consumable feedback message from a run. On success it returns a
 * short confirmation (still surfacing any optional-check failures as warnings so
 * they are never silently swallowed); on failure it lists each failing check
 * with a bounded number of concrete findings, so the model can fix and re-verify.
 */
export function formatVerificationFeedback(
  run: VerificationRunResult,
  failuresPerCheck: number = FEEDBACK_FAILURES_PER_CHECK,
): string {
  const optionalFailures = run.results.filter((r) => !r.passed && !r.skipped && r.check.optional);

  if (run.passed) {
    const header = `Verification passed: ${run.passedCount} check${run.passedCount === 1 ? '' : 's'} green (${run.totalDurationMs}ms).`;
    if (optionalFailures.length === 0) {
      return header;
    }
    const lines = [header, `Optional check warnings (${optionalFailures.length}):`];
    for (const result of optionalFailures) {
      appendCheckFindings(lines, result, failuresPerCheck);
    }
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push(
    `Verification failed: ${run.failedCount} failing, ${run.passedCount} passing, ${run.skippedCount} skipped. Fix the findings below and re-run verification.`,
  );

  for (const result of run.results) {
    if (result.passed || result.skipped) {
      continue;
    }
    appendCheckFindings(lines, result, failuresPerCheck);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Evidence bridge (pure) -- feeds harness feature 2
// ---------------------------------------------------------------------------

/**
 * Convert a run into a dependency-free evidence record. The extension passes
 * the returned object to `recordHarnessEvidence`, capturing verification-class
 * evidence automatically after each edit (harness feature 2).
 *
 * A run only counts as PASS evidence when at least one check actually passed. An
 * empty run (zero checks) is vacuously `passed` at the run level but must NOT
 * produce passing verification evidence -- otherwise a misconfigured caller
 * could record valid-looking evidence without executing anything.
 */
export function toVerificationEvidence(run: VerificationRunResult): VerificationEvidence {
  const meaningfulPass = run.passed && run.passedCount > 0;
  const status: 'pass' | 'fail' = meaningfulPass ? 'pass' : 'fail';
  const summary = meaningfulPass
    ? `Verification passed (${run.passedCount} checks, ${run.totalDurationMs}ms)`
    : run.passedCount === 0 && run.failedCount === 0
      ? 'Verification inconclusive (no checks executed)'
      : `Verification failed (${run.failedCount} failing of ${run.results.length} checks)`;
  return {
    evidenceType: 'verification',
    evidenceClass: 'verification',
    summary,
    status,
    metadata: {
      passed: run.passed,
      passedCount: run.passedCount,
      failedCount: run.failedCount,
      skippedCount: run.skippedCount,
      totalDurationMs: run.totalDurationMs,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Async execution boundary (injectable runner)
// ---------------------------------------------------------------------------

/**
 * Execute a set of verification checks in order and aggregate the outcome. The
 * only IO is delegated to `runner`; everything else is the pure logic above.
 * With `stopOnFirstFailure`, a hard failure short-circuits remaining mandatory
 * checks (they are recorded as skipped). Optional-check failures never
 * short-circuit.
 */
export async function runVerificationLoop(
  checks: ReadonlyArray<VerificationCheck>,
  runner: CommandRunner,
  options: RunVerificationOptions = {},
): Promise<VerificationRunResult> {
  const now = options.nowMs ?? Date.now;
  const maxFailures = options.maxFailuresPerCheck ?? DEFAULT_MAX_FAILURES_PER_CHECK;
  const startedAt = new Date(now()).toISOString();
  const results: VerificationCheckResult[] = [];
  let shortCircuited = false;

  for (const check of checks) {
    if (shortCircuited) {
      results.push(makeSkippedResult(check));
      continue;
    }

    const execution = await runner(check);
    const result = evaluateVerificationCheck(check, execution, maxFailures);
    results.push(result);

    if (options.stopOnFirstFailure && !result.passed && !check.optional) {
      shortCircuited = true;
    }
  }

  const finishedAt = new Date(now()).toISOString();
  return summarizeVerificationRun(results, startedAt, finishedAt);
}
