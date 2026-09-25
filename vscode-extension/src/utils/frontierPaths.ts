import * as fs from 'fs';
import * as path from 'path';

export const FRONTIER_STATE_DIRECTORY = '.frontier';

export function resolveFrontierStateDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, FRONTIER_STATE_DIRECTORY);
}

export function resolveFrontierStatePath(workspaceRoot: string, ...segments: string[]): string {
  return path.join(resolveFrontierStateDirectory(workspaceRoot), ...segments);
}

export function hasFrontierState(workspaceRoot: string): boolean {
  return fs.existsSync(resolveFrontierStatePath(workspaceRoot, 'config.json'));
}