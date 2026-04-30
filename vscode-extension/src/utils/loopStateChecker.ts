// ---------------------------------------------------------------------------
// AgentX -- Loop State Checker
// ---------------------------------------------------------------------------
//
// Reads the iterative-loop state file (.agentx/state/loop-state.json) and
// exposes typed helpers for quality-gate enforcement.
//
// Used by:
//   - Agent router (block reviewer routing when loop incomplete)
//   - Status bar (show active loop iteration)
//   - Workflow command (auto-start loop for iterate=true steps)
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { getHarnessStatusDisplay } from './harnessState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches the JSON schema written by agentx-cli.ps1 Invoke-LoopStart. */
export interface LoopState {
  readonly active: boolean;
  readonly status: 'active' | 'complete' | 'cancelled';
  readonly prompt: string;
  readonly taskType?: string;
  readonly taskClass?: 'complex-delivery' | 'standard' | 'auto-fix-review' | 'agent-x';
  readonly iteration: number;
  readonly minIterations?: number;
  readonly maxIterations: number;
  readonly completionCriteria: string;
  readonly issueNumber?: number | null;
  readonly startedAt: string;
  readonly lastIterationAt: string;
  /** Optional time budget in minutes set at loop start. */
  readonly budgetMinutes?: number;
  readonly history: ReadonlyArray<{
    readonly iteration: number;
    readonly timestamp: string;
    readonly summary: string;
    readonly status: string;
    /** Structured outcome of this iteration: pass, fail, or partial. */
    readonly outcome?: 'pass' | 'fail' | 'partial';
    /** Harness audit score snapshot recorded during this iteration. */
    readonly harnessScore?: number;
  }>;
}

/** Result of the loop gate check. */
export interface LoopGateResult {
  /** Whether the gate allows the requested action to proceed. */
  readonly allowed: boolean;
  /** Human-readable reason when blocked. */
  readonly reason: string;
  /** Current loop state (null if no loop file exists). */
  readonly state: LoopState | null;
}

/** Relative path from workspace root to the loop state file. */
const LOOP_STATE_REL = '.agentx/state/loop-state.json';
const LOOP_STALE_AFTER_MS = 8 * 60 * 60 * 1000;
const LOOP_STUCK_AFTER_MS = 90 * 60 * 1000;
// Per-task-class minimum iterations. Must mirror agentx-cli.ps1
// ($Script:LOOP_*_MIN_ITERATIONS).
const DEFAULT_COMPLEX_MIN_ITERATIONS = 5;
const DEFAULT_STANDARD_MIN_ITERATIONS = 3;
const DEFAULT_AUTO_FIX_MIN_ITERATIONS = 5;
const DEFAULT_AGENT_X_MIN_ITERATIONS = 5;

type LoopTaskClass = 'complex-delivery' | 'standard' | 'auto-fix-review' | 'agent-x';
type LoopHealthKind = 'healthy' | 'stale' | 'stuck';

interface LoopHealth {
  readonly kind: LoopHealthKind;
  readonly reason: string | null;
}

function inferLoopTaskClass(state: Pick<LoopState, 'prompt' | 'completionCriteria' | 'taskType' | 'taskClass'>): LoopTaskClass {
  const explicitTaskClass = (state.taskClass ?? '').trim().toLowerCase();
  if (explicitTaskClass === 'complex-delivery') { return 'complex-delivery'; }
  if (explicitTaskClass === 'standard') { return 'standard'; }
  if (explicitTaskClass === 'auto-fix-review') { return 'auto-fix-review'; }
  if (explicitTaskClass === 'agent-x') { return 'agent-x'; }

  const fingerprint = `${state.taskType ?? ''}\n${state.prompt ?? ''}\n${state.completionCriteria ?? ''}`.toLowerCase();

  // Auto-fix and agent-x checks before the generic 'review' keyword so a prompt
  // like 'Review code and apply safe fixes' resolves to auto-fix-review, not standard.
  // Mirrors agentx-cli.ps1 Get-LoopTaskClass detection order.
  if (/\b(auto-fix|auto fix|apply safe fix|apply.*fixes|reviewer.*fix|fix.*review)\b/.test(fingerprint)) {
    return 'auto-fix-review';
  }
  if (/\b(autonomous|orchestrat|classify.*route|agent.x|agent x)\b/.test(fingerprint)) {
    return 'agent-x';
  }

  const standardPattern = /\b(bug|hotfix|regression|prd|product requirement|tech spec|technical spec|specification|adr|architecture doc|review|brainstorm|clarification|docs|documentation)\b/;
  const complexPattern = /\b(implement|implementation|build|create|ship|refactor|feature|endpoint|component|screen|prototype|wireframe|ux|ui|frontend|backend|model|training|data science|evaluation pipeline|notebook|agent|workflow|all_tests_passing|coverage)\b/;

  if (standardPattern.test(fingerprint)) {
    return 'standard';
  }

  if (complexPattern.test(fingerprint)) {
    return 'complex-delivery';
  }

  return 'standard';
}

function getDefaultMinIterations(state: LoopState): number {
  let baseMinimum: number;
  switch (inferLoopTaskClass(state)) {
    case 'complex-delivery': baseMinimum = DEFAULT_COMPLEX_MIN_ITERATIONS; break;
    case 'auto-fix-review': baseMinimum = DEFAULT_AUTO_FIX_MIN_ITERATIONS; break;
    case 'agent-x': baseMinimum = DEFAULT_AGENT_X_MIN_ITERATIONS; break;
    default: baseMinimum = DEFAULT_STANDARD_MIN_ITERATIONS;
  }
  return Math.min(baseMinimum, state.maxIterations);
}

function getEffectiveMinIterations(state: LoopState): number {
  if (typeof state.minIterations === 'number' && state.minIterations > 0) {
    return Math.min(state.minIterations, state.maxIterations);
  }

  return getDefaultMinIterations(state);
}

function getLoopLastTouchedMs(state: LoopState): number | null {
  const candidates = [state.lastIterationAt, state.startedAt];
  for (const candidate of candidates) {
    const value = Date.parse(candidate);
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  return null;
}

function getLoopHealth(
  state: LoopState,
  expectedIssue?: number | null,
  nowMs: number = Date.now(),
): LoopHealth {
  if (typeof expectedIssue === 'number' && expectedIssue > 0 && typeof state.issueNumber === 'number' && state.issueNumber !== expectedIssue) {
    return {
      kind: 'stale',
      reason: `loop belongs to issue #${state.issueNumber}, not #${expectedIssue}`,
    };
  }

  const lastTouchedMs = getLoopLastTouchedMs(state);
  if (lastTouchedMs === null) {
    return {
      kind: 'stale',
      reason: 'loop timestamp is missing or invalid',
    };
  }

  if (state.maxIterations <= 0 || state.iteration <= 0) {
    return {
      kind: 'stuck',
      reason: 'loop counters are missing or invalid',
    };
  }

  if (state.active && state.status !== 'active') {
    return {
      kind: 'stuck',
      reason: `active loop has unexpected status '${state.status}'`,
    };
  }

  if (state.active && state.history.length === 0) {
    return {
      kind: 'stuck',
      reason: 'active loop has no iteration history',
    };
  }

  // Find the latest non-rollback history entry. Rollback entries record the
  // iteration that was rolled BACK FROM (so their iteration number is
  // legitimately ahead of state.iteration after a rollback) -- they are not a
  // stuck signal. Mirrors Invoke-LoopRollback in agentx-cli.ps1.
  const latestForwardHistory = [...state.history]
    .reverse()
    .find((h) => h && h.status !== 'rollback');
  if (latestForwardHistory && typeof latestForwardHistory.iteration === 'number' && latestForwardHistory.iteration > state.iteration) {
    return {
      kind: 'stuck',
      reason: `history iteration ${latestForwardHistory.iteration} is ahead of loop iteration ${state.iteration}`,
    };
  }

  const ageMs = nowMs - lastTouchedMs;
  if (state.active && ageMs >= LOOP_STUCK_AFTER_MS) {
    return {
      kind: 'stuck',
      reason: `loop last updated ${(ageMs / (60 * 1000)).toFixed(0)} minutes ago`,
    };
  }

  if (ageMs >= LOOP_STALE_AFTER_MS) {
    return {
      kind: 'stale',
      reason: `loop last updated ${(ageMs / (60 * 60 * 1000)).toFixed(1)} hours ago`,
    };
  }

  return {
    kind: 'healthy',
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// Budget & Score helpers
// ---------------------------------------------------------------------------

function getBudgetRemainingMs(state: LoopState, nowMs: number = Date.now()): number | null {
  if (typeof state.budgetMinutes !== 'number' || state.budgetMinutes <= 0) {
    return null;
  }
  const startMs = Date.parse(state.startedAt);
  if (Number.isNaN(startMs)) {
    return null;
  }
  return (startMs + state.budgetMinutes * 60 * 1000) - nowMs;
}

function getBudgetSuffix(state: LoopState, nowMs: number = Date.now()): string {
  const remainingMs = getBudgetRemainingMs(state, nowMs);
  if (remainingMs === null) {
    return '';
  }
  if (remainingMs <= 0) {
    return ' (budget exceeded)';
  }
  const mins = Math.ceil(remainingMs / 60_000);
  return ` (${mins}m remaining)`;
}

function getScoreTrendSuffix(state: LoopState): string {
  if (!state.history || state.history.length === 0) {
    return '';
  }
  const scored = state.history.filter(
    (h): h is typeof h & { harnessScore: number } => typeof h.harnessScore === 'number',
  );
  if (scored.length === 0) {
    return '';
  }
  const latest = scored[scored.length - 1].harnessScore;
  if (scored.length === 1) {
    return ` [score: ${latest}]`;
  }
  const prev = scored[scored.length - 2].harnessScore;
  const delta = latest - prev;
  if (delta === 0) {
    return ` [score: ${latest}]`;
  }
  const arrow = delta > 0 ? '+' : '';
  return ` [score: ${latest} (${arrow}${delta})]`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current loop state from the workspace.
 * Returns null if the file doesn't exist or is unreadable.
 */
export function readLoopState(workspaceRoot: string): LoopState | null {
  const filePath = path.join(workspaceRoot, LOOP_STATE_REL);
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as LoopState;
  } catch {
    return null;
  }
}

/**
 * Check whether the engineer is allowed to hand off to reviewer.
 *
 * Gate rules (matches agentx-cli.ps1 quality gate):
 *  - Loop still active (active=true) -> BLOCKED
 *  - Loop never started (no state file) -> BLOCKED
 *  - Loop cancelled (status=cancelled) -> BLOCKED
 *  - Loop complete (status=complete) -> ALLOWED
 */
export function checkHandoffGate(workspaceRoot: string, expectedIssue?: number | null): LoopGateResult {
  const state = readLoopState(workspaceRoot);

  if (!state) {
    return {
      allowed: false,
      reason: 'No quality loop was started. Run `agentx loop start` before handing off to review.',
      state: null,
    };
  }

  const health = getLoopHealth(state, expectedIssue);

  if (state.active) {
    if (health.kind === 'stale') {
      return {
        allowed: false,
        reason: `Quality loop is stale (${health.reason}). Start a new loop for the current task.`,
        state,
      };
    }

    if (health.kind === 'stuck') {
      return {
        allowed: false,
        reason: `Quality loop is stuck (${health.reason}). Cancel or reset it, then start a new loop for the current task.`,
        state,
      };
    }

    return {
      allowed: false,
      reason: `Quality loop still active (iteration ${state.iteration}/${state.maxIterations}). `
        + 'Complete the loop with `agentx loop complete` before handing off.',
      state,
    };
  }

  if (state.status === 'cancelled') {
    return {
      allowed: false,
      reason: 'Quality loop was cancelled. Cancelling does not satisfy the quality gate. '
        + 'Start a new loop and complete it.',
      state,
    };
  }

  if (health.kind === 'stale') {
    return {
      allowed: false,
      reason: `Quality loop is stale (${health.reason}). Start a new loop for the current task.`,
      state,
    };
  }

  if (health.kind === 'stuck') {
    return {
      allowed: false,
      reason: `Quality loop is stuck (${health.reason}). Start a new loop for the current task.`,
      state,
    };
  }

  if (state.status === 'complete') {
    const minIterations = getEffectiveMinIterations(state);
    if (state.iteration < minIterations) {
      return {
        allowed: false,
        reason: `Quality loop completed too early (${state.iteration}/${minIterations} minimum review iterations). `
          + 'Run additional `agentx loop iterate` passes and complete the loop again.',
        state,
      };
    }

    return {
      allowed: true,
      reason: 'Quality loop completed successfully.',
      state,
    };
  }

  // Fallback for unexpected status values
  return {
    allowed: false,
    reason: `Unexpected loop status: '${state.status}'. Expected 'complete'.`,
    state,
  };
}

/**
 * Check whether a loop should be auto-started for a workflow step.
 * Returns true if the step has iterate=true and no loop is currently active.
 */
export function shouldAutoStartLoop(workspaceRoot: string, expectedIssue?: number | null): boolean {
  const state = readLoopState(workspaceRoot);
  if (!state) {
    return true;
  }

  if (state.active) {
    return getLoopHealth(state, expectedIssue).kind !== 'healthy';
  }

  return true;
}

/**
 * Get a compact status string for display in status bar / chat.
 */
export function getLoopStatusDisplay(workspaceRoot: string): string {
  const state = readLoopState(workspaceRoot);
  if (!state) {
    return 'No loop';
  }
  const minIterations = getEffectiveMinIterations(state);
  const health = getLoopHealth(state);
  const budgetSuffix = getBudgetSuffix(state);
  const scoreSuffix = getScoreTrendSuffix(state);
  if (state.active) {
    const readiness = state.iteration < minIterations
      ? `not ready to complete (${state.iteration}/${minIterations} min)`
      : 'minimum iterations met';
    if (health.kind === 'stale') {
      return `Loop active ${state.iteration}/${state.maxIterations} (stale; ${health.reason}) [${state.completionCriteria}]${budgetSuffix}${scoreSuffix}`;
    }

    if (health.kind === 'stuck') {
      return `Loop active ${state.iteration}/${state.maxIterations} (stuck; ${health.reason}) [${state.completionCriteria}]${budgetSuffix}${scoreSuffix}`;
    }

    return `Loop active ${state.iteration}/${state.maxIterations} (${readiness}) [${state.completionCriteria}]${budgetSuffix}${scoreSuffix}`;
  }
  if (health.kind === 'stale') {
    return `Loop ${state.status} (stale; ${health.reason})${scoreSuffix}`;
  }

  if (health.kind === 'stuck') {
    return `Loop ${state.status} (stuck; ${health.reason})${scoreSuffix}`;
  }

  return `Loop ${state.status} (${state.iteration} iterations, min ${minIterations})${scoreSuffix}`;
}

/**
 * Get a combined quality and harness status string for compact UI display.
 */
export function getQualityStateDisplay(workspaceRoot: string): string {
  const loop = getLoopStatusDisplay(workspaceRoot);
  const harness = getHarnessStatusDisplay(workspaceRoot);
  return `${loop} | ${harness}`;
}

/**
 * Check whether the loop has exceeded its optional time budget.
 * Returns false when no budget is set.
 */
export function isBudgetExceeded(workspaceRoot: string): boolean {
  const state = readLoopState(workspaceRoot);
  if (!state) {
    return false;
  }
  const remaining = getBudgetRemainingMs(state);
  return remaining !== null && remaining <= 0;
}
