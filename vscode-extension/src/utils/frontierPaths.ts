import * as fs from 'fs';
import * as path from 'path';
import { workspacePathKey } from './workspaceProfiles';

export const FRONTIER_STATE_DIRECTORY = '.frontier';
const stateRoots = new Map<string, string | Error>();

function workspaceKey(root: string): string {
  return workspacePathKey(root);
}

export function registerFrontierStateDirectory(root: string, directory?: string | Error): void {
  const key = workspaceKey(root);
  if (directory) { stateRoots.set(key, directory); } else { stateRoots.delete(key); }
}

export function resolveRepositoryStatePath(root: string, ...segments: string[]): string {
  return path.join(root, FRONTIER_STATE_DIRECTORY, ...segments);
}

export function resolveFrontierStateDirectory(workspaceRoot: string): string {
  const selected = stateRoots.get(workspaceKey(workspaceRoot));
  if (selected instanceof Error) { throw selected; }
  return selected ?? path.join(workspaceRoot, FRONTIER_STATE_DIRECTORY);
}

export function resolveFrontierStatePath(workspaceRoot: string, ...segments: string[]): string {
  return path.join(resolveFrontierStateDirectory(workspaceRoot), ...segments);
}

export function hasFrontierState(workspaceRoot: string): boolean {
  return fs.existsSync(resolveFrontierStatePath(workspaceRoot, 'config.json'));
}

export function hasRepositoryState(workspaceRoot: string): boolean {
  return fs.existsSync(resolveRepositoryStatePath(workspaceRoot, 'config.json'));
}

export function isPrivateFrontierState(workspaceRoot: string): boolean {
  return stateRoots.has(workspaceKey(workspaceRoot));
}