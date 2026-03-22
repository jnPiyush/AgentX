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
  readonly iteration: number;
  readonly minIterations?: number;
  readonly maxIterations: number;
  readonly completionCriteria: string;
  readonly issueNumber?: number | null;
  readonly startedAt: string;
  readonly lastIterationAt: string;
  readonly history: ReadonlyArray<{
    readonly iteration: number;
    readonly timestamp: string;
    readonly summary: string;
    readonly status: string;
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

function getEffectiveMinIterations(state: LoopState): number {
  const defaultMin = Math.min(5, state.maxIterations);
  if (typeof state.minIterations === 'number' && state.minIterations > 0) {
    return Math.min(state.minIterations, state.maxIterations);
  }

  return defaultMin;
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

function getLoopStaleReason(
  state: LoopState,
  expectedIssue?: number | null,
  nowMs: number = Date.now(),
): string | null {
  if (typeof expectedIssue === 'number' && expectedIssue > 0 && typeof state.issueNumber === 'number' && state.issueNumber !== expectedIssue) {
    return `loop belongs to issue #${state.issueNumber}, not #${expectedIssue}`;
  }

  const lastTouchedMs = getLoopLastTouchedMs(state);
  if (lastTouchedMs === null) {
    return 'loop timestamp is missing or invalid';
  }

  const ageMs = nowMs - lastTouchedMs;
  if (ageMs >= LOOP_STALE_AFTER_MS) {
    return `loop last updated ${(ageMs / (60 * 60 * 1000)).toFixed(1)} hours ago`;
  }

  return null;
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

  const staleReason = getLoopStaleReason(state, expectedIssue);

  if (state.active) {
    if (staleReason) {
      return {
        allowed: false,
        reason: `Quality loop is stale (${staleReason}). Start a new loop for the current task.`,
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

  if (staleReason) {
    return {
      allowed: false,
      reason: `Quality loop is stale (${staleReason}). Start a new loop for the current task.`,
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
    return getLoopStaleReason(state, expectedIssue) !== null;
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
  const staleReason = getLoopStaleReason(state);
  if (state.active) {
    const readiness = state.iteration < minIterations
      ? `not ready to complete (${state.iteration}/${minIterations} min)`
      : 'minimum iterations met';
    if (staleReason) {
      return `Loop active ${state.iteration}/${state.maxIterations} (stale; ${staleReason}) [${state.completionCriteria}]`;
    }

    return `Loop active ${state.iteration}/${state.maxIterations} (${readiness}) [${state.completionCriteria}]`;
  }
  if (staleReason) {
    return `Loop ${state.status} (stale; ${staleReason})`;
  }

  return `Loop ${state.status} (${state.iteration} iterations, min ${minIterations})`;
}

/**
 * Get a combined quality and harness status string for compact UI display.
 */
export function getQualityStateDisplay(workspaceRoot: string): string {
  const loop = getLoopStatusDisplay(workspaceRoot);
  const harness = getHarnessStatusDisplay(workspaceRoot);
  return `${loop} | ${harness}`;
}
