import { REVERSIBILITY_TABLE } from './commandValidatorPolicy';
import type { Reversibility } from './commandValidatorTypes';

export function normaliseCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function splitCompoundCommand(command: string): readonly string[] {
  // Separators that start a new statement in pwsh or bash. Newline and a
  // single `&` are included: without them, `npm test\n<anything>` collapses to
  // one part whose allowlist prefix launders the second statement.
  const parts = command.split(/;|&&|\|\||(?<!\|)\|(?!\|)|\r?\n|(?<!&)&(?!&)/);
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function classifyReversibility(
  command: string,
): { reversibility: Reversibility; undoHint?: string } {
  const normalised = normaliseCommand(command);

  for (const entry of REVERSIBILITY_TABLE) {
    entry.pattern.lastIndex = 0;
    if (entry.pattern.test(normalised)) {
      return { reversibility: entry.reversibility, undoHint: entry.undoHint };
    }
  }

  return { reversibility: 'effort' };
}
