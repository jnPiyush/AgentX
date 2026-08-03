// ---------------------------------------------------------------------------
// AgentX -- Command Validator
// ---------------------------------------------------------------------------
//
// Replaces the 4-entry denylist in toolEngine.ts with a defense-in-depth
// allowlist approach:
//
//   Layer 1 -- Blocked:   hard-coded dangerous patterns (never execute)
//   Layer 2 -- Allowed:   known-safe commands (auto-execute, no prompt)
//   Layer 3 -- Confirm:   everything else (prompt user, show reversibility)
//
// Compound commands (joined by ;  &&  ||  |) are split and each sub-command
// is classified independently.  The final classification is the most
// restrictive of all sub-commands.
// ---------------------------------------------------------------------------

import {
  BLOCKED_PATTERNS,
  DEFAULT_ALLOWLIST,
} from './commandValidatorPolicy';
import {
  classifyReversibility,
  normaliseCommand,
  splitCompoundCommand,
} from './commandValidatorHelpers';
import type {
  CommandClassification,
  CommandValidationResult,
} from './commandValidatorTypes';

export type {
  CommandClassification,
  CommandValidationResult,
  Reversibility,
} from './commandValidatorTypes';
export { BLOCKED_PATTERNS, DEFAULT_ALLOWLIST } from './commandValidatorPolicy';
export { classifyReversibility, splitCompoundCommand } from './commandValidatorHelpers';

/**
 * Validate a single (non-compound) command string.
 * @internal Use validateCommand() for the public API.
 */
function validateSingle(
  command: string,
  effectiveAllowlist: readonly string[],
): CommandValidationResult {
  const norm = normaliseCommand(command);

  // Layer 1: hard-block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(norm)) {
      return {
        classification: 'blocked',
        command,
        reason: `Blocked by security policy: matches dangerous pattern.`,
      };
    }
  }

  // Layer 2: allowlist -- check if the normalised command starts with an
  // allowlisted prefix (case-insensitive, already normalised).
  for (const entry of effectiveAllowlist) {
    const entryNorm = normaliseCommand(entry);
    // Match if norm equals the entry exactly, or starts with "entry " (to
    // correctly handle "git status --short" starting with "git status").
    if (norm === entryNorm || norm.startsWith(entryNorm + ' ')) {
      return {
        classification: 'allowed',
        command,
        reversibility: 'easy',
      };
    }
  }

  // NOTE: Bare program names (e.g. "node", "python", "docker") are NOT
  // auto-allowed even if they appear in the allowlist without a subcommand.
  // The allowlist entry must include a safe subcommand prefix (e.g.
  // "npm test", "git status").  A bare "python" would auto-allow
  // "python -c 'import os; os.system(...)'", breaching the security model.
  // Unknown flag combinations route to confirmation (Layer 3).

  // Layer 3: unknown -- requires confirmation with reversibility info
  const rev = classifyReversibility(command);
  return {
    classification: 'requires_confirmation',
    command,
    reversibility: rev.reversibility,
    undoHint: rev.undoHint,
    reason: 'Command is not in the allowlist; user confirmation required.',
  };
}

/**
 * Validate a command string (potentially compound) against the security policy.
 *
 * For compound commands (containing ;  &&  ||  |), each sub-command is
 * validated independently and the most restrictive classification wins:
 *   blocked > requires_confirmation > allowed
 *
 * @param command       The raw command string from the LLM tool call.
 * @param customAllowlist  Optional extra entries to merge with DEFAULT_ALLOWLIST.
 * @returns             A CommandValidationResult describing the decision.
 */
export function validateCommand(
  command: string,
  customAllowlist?: readonly string[],
): CommandValidationResult {
  const effectiveAllowlist: readonly string[] = customAllowlist
    ? [...DEFAULT_ALLOWLIST, ...customAllowlist]
    : DEFAULT_ALLOWLIST;

  // -----------------------------------------------------------------------
  // Layer 1 (pre-split): check the FULL original command against blocked
  // patterns.  Patterns like fork-bombs and pipe-to-shell span the entire
  // command string and must be evaluated before splitting on operators.
  // -----------------------------------------------------------------------
  const fullNorm = normaliseCommand(command);
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(fullNorm)) {
      return {
        classification: 'blocked',
        command,
        reason: `Blocked by security policy: matches dangerous pattern.`,
      };
    }
  }

  const parts = splitCompoundCommand(command);

  if (parts.length === 0) {
    return {
      classification: 'blocked',
      command,
      reason: 'Empty command.',
    };
  }

  // Classify each part; accumulate most restrictive result
  const RANK: Record<CommandClassification, number> = {
    allowed: 0,
    requires_confirmation: 1,
    blocked: 2,
  };

  let worst: CommandValidationResult = {
    classification: 'allowed',
    command,
    reversibility: 'easy',
  };

  for (const part of parts) {
    const result = validateSingle(part, effectiveAllowlist);
    if (RANK[result.classification] > RANK[worst.classification]) {
      // Keep the original compound command string, not the sub-command
      worst = { ...result, command };
    }
  }

  return worst;
}
