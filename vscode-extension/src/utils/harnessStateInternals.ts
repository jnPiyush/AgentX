import * as fs from 'fs';
import * as path from 'path';

import type {
  HarnessState,
  HarnessThread,
  HarnessTurn,
} from './harnessStateTypes';

const HARNESS_STATE_REL = '.agentx/state/harness-state.json';

export function createDefaultState(): HarnessState {
  return {
    version: 1,
    threads: [],
    turns: [],
    items: [],
    evidence: [],
    contracts: [],
    contractFindings: [],
    stopGates: [],
    contextBudgets: [],
    notes: [],
    checkpoints: [],
    permissionRecords: [],
    teamTasks: [],
  };
}

export function ensureStateDir(workspaceRoot: string): string {
  const dir = path.join(workspaceRoot, '.agentx', 'state');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getStatePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, HARNESS_STATE_REL);
}

export function writeHarnessState(workspaceRoot: string, state: HarnessState): void {
  ensureStateDir(workspaceRoot);
  fs.writeFileSync(getStatePath(workspaceRoot), JSON.stringify(state, null, 2), 'utf-8');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string, count: number): string {
  return `${prefix}-${Date.now()}-${count + 1}`;
}

export function toPosixRelative(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
}

export function findMarkdownFiles(dir: string, results: string[]): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}

export function getActiveThread(state: HarnessState): HarnessThread | undefined {
  return [...state.threads].reverse().find((thread) => thread.status === 'active');
}

export function getActiveTurn(state: HarnessState, threadId: string): HarnessTurn | undefined {
  return [...state.turns].reverse().find((turn) => turn.threadId === threadId && turn.status === 'active');
}

export function replaceThread(state: HarnessState, thread: HarnessThread): HarnessState {
  return {
    ...state,
    threads: state.threads.map((candidate) => candidate.id === thread.id ? thread : candidate),
  };
}

export function replaceTurn(state: HarnessState, turn: HarnessTurn): HarnessState {
  return {
    ...state,
    turns: state.turns.map((candidate) => candidate.id === turn.id ? turn : candidate),
  };
}
