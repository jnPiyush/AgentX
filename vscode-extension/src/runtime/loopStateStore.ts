// ---------------------------------------------------------------------------
// AgentX -- Shared Runtime: Loop State Store (filesystem boundary)
// ---------------------------------------------------------------------------
//
// The ONLY filesystem boundary for the shared loop runtime. Reads and parses
// the loop state file (.agentx/state/loop-state.json) into a `LoopState`. All
// gate decisions live in `loopState.ts` and operate on the parsed object so the
// pure logic stays portable to a future Node CLI (SPEC-401).
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { LoopState, LOOP_STATE_REL } from './loopState';

/**
 * Parse raw JSON text into a LoopState. Returns null on invalid JSON.
 */
export function parseLoopState(raw: string): LoopState | null {
  try {
    return JSON.parse(raw) as LoopState;
  } catch {
    return null;
  }
}

/**
 * Read the current loop state from the workspace.
 * Returns null if the file doesn't exist or is unreadable.
 */
export function readLoopStateFromFile(workspaceRoot: string): LoopState | null {
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
