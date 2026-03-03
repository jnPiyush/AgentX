// ---------------------------------------------------------------------------
// AgentX -- Todo Demo Command (Stub)
// ---------------------------------------------------------------------------
//
// Placeholder for the manage_todo_list demo command.
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the todo demo command.
 * Currently a no-op stub -- will be replaced with full implementation.
 */
export function registerTodoDemoCommand(
  context: vscode.ExtensionContext,
  _agentxContext: AgentXContext,
): void {
  const disposable = vscode.commands.registerCommand(
    'agentx.todoDemo',
    () => {
      vscode.window.showInformationMessage('AgentX Todo Demo: coming soon');
    },
  );
  context.subscriptions.push(disposable);
}
