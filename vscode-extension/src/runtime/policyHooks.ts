import * as path from 'path';
import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { privateWorkspacePath } from '../utils/workspaceProfiles';

export function registerPolicyHookEnvironment(
  context: vscode.ExtensionContext, frontier: FrontierContext,
): void {
  const runtime = path.join(context.extensionPath,
    '.github', 'frontier', '.frontier', 'runtime', 'policy-hook.js');
  const previousRuntime = process.env.FRONTIER_HOOK_RUNTIME;
  const previousProfiles = process.env.FRONTIER_HOOK_PROFILES;
  let profiles = '';
  const update = () => {
    const entries: Array<{ workspaceRoot: string; stateRoot: string; authority: string; graphEnabled: boolean }> = [];
    if (vscode.workspace.isTrusted) {
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        try {
          const root = frontier.workspaceState.assertAvailable(folder.uri.fsPath);
          const authority = frontier.workspaceState.authority(root);
          entries.push({ workspaceRoot: root, authority,
            graphEnabled: vscode.workspace.getConfiguration('frontier', folder.uri)
              .get<boolean>('repositoryContext.enabled', true),
            stateRoot: privateWorkspacePath(context.globalStorageUri.fsPath, root, authority) });
        } catch (error) {
          console.warn('Frontier hook workspace binding unavailable:', error);
        }
      }
    }
    profiles = JSON.stringify(entries);
    process.env.FRONTIER_HOOK_RUNTIME = runtime;
    process.env.FRONTIER_HOOK_PROFILES = profiles;
  };
  update();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(update),
    vscode.workspace.onDidGrantWorkspaceTrust(update),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('frontier.repositoryContext.enabled')) { update(); }
    }),
    new vscode.Disposable(() => {
      if (process.env.FRONTIER_HOOK_RUNTIME === runtime) {
        if (previousRuntime === undefined) { delete process.env.FRONTIER_HOOK_RUNTIME; }
        else { process.env.FRONTIER_HOOK_RUNTIME = previousRuntime; }
      }
      if (process.env.FRONTIER_HOOK_PROFILES === profiles) {
        if (previousProfiles === undefined) { delete process.env.FRONTIER_HOOK_PROFILES; }
        else { process.env.FRONTIER_HOOK_PROFILES = previousProfiles; }
      }
    }),
  );
}