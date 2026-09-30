import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { hasFrontierState } from '../utils/frontierPaths';

/**
 * Start repository discovery for an initialized Frontier workspace without waiting.
 * The CLI detaches the worker; a start failure is shown and retried at the next session start.
 */
export function startRepositoryDiscovery(agentx: FrontierContext, root?: string): void {
  void Promise.resolve()
    .then(() => agentx.runCli('context', ['--start-refresh'], root))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showWarningMessage(
        `Frontier: Repository discovery did not start (${message}). It retries at the next Frontier session start.`,
      );
    });
}

/**
 * Register the Frontier: Refresh Repository Context command.
 * Updates the repository graph incrementally and shows the orientation packet.
 */
export function registerRepositoryContextCommand(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
) {
  const cmd = vscode.commands.registerCommand('frontier.refreshRepositoryContext', async () => {
    const root = agentx.workspaceRoot;
    if (!root || !hasFrontierState(root)) {
      vscode.window.showWarningMessage('Frontier is not initialized. Run "Frontier: Initialize Local Runtime" first.');
      return;
    }

    try {
      const output = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Frontier: Updating repository context...',
          cancellable: false,
        },
        () => agentx.runCli('context', ['--sync']),
      );
      const channel = vscode.window.createOutputChannel('Frontier Repository Context');
      channel.clear();
      channel.appendLine(output);
      channel.show();
      vscode.window.showInformationMessage(
        'Frontier repository context updated. Curate notes in .frontier/state/repo-context/map.md.',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Repository context update failed: ${message}`);
    }
  });

  context.subscriptions.push(cmd);
}
