import * as vscode from 'vscode';

const STARTUP_DEP_CHECK_PREFIX = 'frontier.startupDependencyCheck';
export const STARTUP_DEP_CHECK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface StartupDependencyCheckState {
 version: string;
 checkedAt: number;
}

function getStartupDependencyCheckKey(workspaceRoot?: string): string {
 return `${STARTUP_DEP_CHECK_PREFIX}:${workspaceRoot ?? 'no-workspace'}`;
}

export function shouldRunStartupDependencyCheck(
 context: vscode.ExtensionContext,
 workspaceRoot: string | undefined,
 extensionVersion: string,
 now: number = Date.now(),
): boolean {
 if (!workspaceRoot) {
  return false;
 }

 const state = context.globalState.get<StartupDependencyCheckState>(
  getStartupDependencyCheckKey(workspaceRoot),
 );

 if (!state) {
  return true;
 }

 if (state.version !== extensionVersion) {
  return true;
 }

 return now - state.checkedAt >= STARTUP_DEP_CHECK_COOLDOWN_MS;
}

export async function markStartupDependencyCheck(
 context: vscode.ExtensionContext,
 workspaceRoot: string | undefined,
 extensionVersion: string,
 now: number = Date.now(),
): Promise<void> {
 if (!workspaceRoot) {
  return;
 }

 await context.globalState.update(getStartupDependencyCheckKey(workspaceRoot), {
  version: extensionVersion,
  checkedAt: now,
 });
}