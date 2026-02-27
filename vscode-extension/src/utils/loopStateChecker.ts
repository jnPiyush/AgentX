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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches the JSON schema written by agentx-cli.ps1 Invoke-LoopStart. */
export interface LoopState {
  readonly active: boolean;
  readonly status: 'active' | 'complete' | 'cancelled';
  readonly prompt: string;
  readonly iteration: number;
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
export function checkHandoffGate(workspaceRoot: string): LoopGateResult {
  const state = readLoopState(workspaceRoot);

  if (!state) {
    return {
      allowed: false,
      reason: 'No quality loop was started. Run `agentx loop start` before handing off to review.',
      state: null,
    };
  }

  if (state.active) {
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

  if (state.status === 'complete') {
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
export function shouldAutoStartLoop(workspaceRoot: string): boolean {
  const state = readLoopState(workspaceRoot);
  // Auto-start if no loop exists or previous loop is done
  return !state || !state.active;
}

/**
 * Get a compact status string for display in status bar / chat.
 */
export function getLoopStatusDisplay(workspaceRoot: string): string {
  const state = readLoopState(workspaceRoot);
  if (!state) {
    return 'No loop';
  }
  if (state.active) {
    return `Loop ${state.iteration}/${state.maxIterations} [${state.completionCriteria}]`;
  }
  return `Loop ${state.status} (${state.iteration} iterations)`;
}
