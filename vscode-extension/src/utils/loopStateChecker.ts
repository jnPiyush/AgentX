// ---------------------------------------------------------------------------
// Frontier -- Loop State Checker (extension-side facade)
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

import * as fs from 'fs';
import * as path from 'path';
import { getHarnessStatusDisplay } from './harnessState';
import {
  LoopState,
  LoopGateResult,
  LoopScope,
  ARTIFACT_DECLARATION_FILE,
  requiresEngineeringLoop,
  evaluateHandoffGate,
  evaluateShouldAutoStart,
  buildLoopStatusDisplay,
  evaluateBudgetExceeded,
  readLoopStateFromFile,
} from '../runtime';

export { LoopState, LoopGateResult, LoopScope };

/** Attach frontier-artifacts.json declarations; an unreadable declaration fails closed. */
export function withDeclaredArtifacts(workspaceRoot: string, scope: LoopScope): LoopScope {
  const file = path.join(workspaceRoot, ARTIFACT_DECLARATION_FILE);
  if (!fs.existsSync(file)) { return scope; }
  try {
    const declaration = JSON.parse(fs.readFileSync(file, 'utf8')) as { schemaVersion?: unknown; coveredArtifacts?: unknown };
    if (declaration.schemaVersion === 1 && Array.isArray(declaration.coveredArtifacts)
      && declaration.coveredArtifacts.every(entry => typeof entry === 'string')) {
      return { ...scope, declaredArtifacts: declaration.coveredArtifacts as string[] };
    }
  } catch { /* fall through to fail closed */ }
  // '/' is never a valid glob, so classification of any mutation reports covered.
  return { ...scope, declaredArtifacts: ['/'] };
}

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
 * Gate rules (matches frontier-cli.ps1 quality gate):
 *  - Loop still active (active=true) -> BLOCKED
 *  - Loop never started (no state file) -> BLOCKED
 *  - Loop cancelled (status=cancelled) -> BLOCKED
 *  - Loop complete (status=complete) -> ALLOWED
 * Explicit exempt scopes return N/A without reading persisted state.
 * Omitted scope retains the legacy evidence gate.
 */
export function checkHandoffGate(
  workspaceRoot: string,
  expectedIssue?: number | null,
  scope?: LoopScope,
): LoopGateResult {
  const declaredScope = scope && withDeclaredArtifacts(workspaceRoot, scope);
  const state = declaredScope && !requiresEngineeringLoop(declaredScope)
    ? null : readLoopStateFromFile(workspaceRoot);
  return evaluateHandoffGate(state, expectedIssue, undefined, declaredScope);
}

/**
 * Check whether a loop should be auto-started for a workflow step.
 * Explicit exempt scopes never start loops or read persisted state.
 */
export function shouldAutoStartLoop(
  workspaceRoot: string,
  expectedIssue?: number | null,
  scope?: LoopScope,
): boolean {
  if (scope && !requiresEngineeringLoop(withDeclaredArtifacts(workspaceRoot, scope))) { return false; }
  return evaluateShouldAutoStart(readLoopStateFromFile(workspaceRoot), expectedIssue, undefined, scope && withDeclaredArtifacts(workspaceRoot, scope));
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
