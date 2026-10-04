import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { hasRepositoryState, isPrivateFrontierState } from '../utils/frontierPaths';
import { FrontierContext } from '../frontierContext';
import { execShell } from '../utils/shell';
import { buildCliInvocation } from '../frontierContextInternals';
import { promptWorkspaceRoot, writeWorkspaceRuntimeWrappers } from './initializeInternals';

export async function runInitializeCursorCommand(extensionRoot: string, frontier?: FrontierContext): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showErrorMessage('Trust this workspace before initializing Cursor support.');
    return;
  }
  const root = await promptWorkspaceRoot('Frontier - Initialize Cursor');
  if (!root) { return; }
  frontier?.workspaceState.assertAvailable(root);
  frontier?.workspaceState.inspect(root, true);
  if (!hasRepositoryState(root) || isPrivateFrontierState(root)) {
    await vscode.window.showWarningMessage(
      'Initialize the Frontier local runtime in this workspace before running Initialize Cursor.',
    );
    return;
  }
  try {
    if (!fs.existsSync(path.join(root, '.frontier', 'runtime', 'frontier-cli.ps1'))) {
      writeWorkspaceRuntimeWrappers(extensionRoot, root, true);
    }
    const invocation = buildCliInvocation(
      path.join(root, '.frontier', 'runtime', 'frontier.ps1'), 'pwsh', 'cursor', ['setup'],
    );
    const output = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Frontier: Configuring Cursor...', cancellable: false },
      () => execShell(invocation.command, root, invocation.shellKind),
    );
    const result: unknown = JSON.parse(output);
    if (typeof result !== 'object' || result === null || !('status' in result) ||
        result.status !== 'configured' || !('preserved' in result) || !Array.isArray(result.preserved)) {
      throw new Error('Cursor setup returned an invalid result.');
    }
    const preserved = result.preserved.filter((item): item is string => typeof item === 'string');
    if (preserved.length) {
      await vscode.window.showWarningMessage(
        `Cursor configured. Custom overrides were preserved: ${preserved.join(', ')}. Review their compatibility.`,
      );
    } else {
      await vscode.window.showInformationMessage('Cursor configured with Frontier commands, native hooks and MCP. Reload Cursor if needed.');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Frontier: Cursor setup failed: ${message}`);
  }
}

export function registerInitializeCursorCommand(
  context: vscode.ExtensionContext,
  frontier: FrontierContext,
): void {
  context.subscriptions.push(vscode.commands.registerCommand(
    'frontier.initializeCursor', () => runInitializeCursorCommand(context.extensionUri.fsPath, frontier),
  ));
}
