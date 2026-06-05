// ---------------------------------------------------------------------------
// AgentX -- Loop State Checker (extension-side facade)
// ---------------------------------------------------------------------------
//
// Thin facade over the framework-free shared loop runtime (`../runtime`). The
// gate logic, task-class inference, health checks, and status formatting now
// live in the shared package so a future Node CLI can reuse them (SPEC-401).
// This module keeps the extension's existing public surface unchanged and adds
// the only extension-specific concern that does not belong in the shared
// runtime: composing loop status with the harness status display.
//
// Used by:
//   - Agent router (block reviewer routing when loop incomplete)
//   - Status bar (show active loop iteration)
//   - Workflow command (auto-start loop for iterate=true steps)
// ---------------------------------------------------------------------------

import { getHarnessStatusDisplay } from './harnessState';
import {
  LoopState,
  LoopGateResult,
  evaluateHandoffGate,
  evaluateShouldAutoStart,
  buildLoopStatusDisplay,
  evaluateBudgetExceeded,
  readLoopStateFromFile,
} from '../runtime';

export { LoopState, LoopGateResult };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current loop state from the workspace.
 * Returns null if the file doesn't exist or is unreadable.
 */
export function readLoopState(workspaceRoot: string): LoopState | null {
  return readLoopStateFromFile(workspaceRoot);
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
  return evaluateHandoffGate(readLoopStateFromFile(workspaceRoot), expectedIssue);
}

/**
 * Check whether a loop should be auto-started for a workflow step.
 * Returns true if the step has iterate=true and no loop is currently active.
 */
export function shouldAutoStartLoop(workspaceRoot: string, expectedIssue?: number | null): boolean {
  return evaluateShouldAutoStart(readLoopStateFromFile(workspaceRoot), expectedIssue);
}

/**
 * Get a compact status string for display in status bar / chat.
 */
export function getLoopStatusDisplay(workspaceRoot: string): string {
  return buildLoopStatusDisplay(readLoopStateFromFile(workspaceRoot));
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
  return evaluateBudgetExceeded(readLoopStateFromFile(workspaceRoot));
}
