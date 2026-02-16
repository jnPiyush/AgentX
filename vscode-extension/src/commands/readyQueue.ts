import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { ReadyQueueTreeProvider } from '../views/readyQueueTreeProvider';

/**
 * Register the AgentX: Show Ready Queue command.
 * Runs `.agentx/agentx.ps1 ready` and displays unblocked work.
 */
export function registerReadyQueueCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
 readyQueueProvider: ReadyQueueTreeProvider
) {
 const cmd = vscode.commands.registerCommand('agentx.readyQueue', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized. Run "AgentX: Initialize Project" first.');
 return;
 }

 try {
 const output = await agentx.runCli('ready');
 if (!output || output.includes('No ')) {
 vscode.window.showInformationMessage('AgentX: No unblocked work in the ready queue.');
 } else {
 // Show in output channel
 const channel = vscode.window.createOutputChannel('AgentX Ready Queue');
 channel.clear();
 channel.appendLine('=== AgentX Ready Queue ===\n');
 channel.appendLine(output);
 channel.show();
 }
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`AgentX ready queue failed: ${message}`);
 }

 readyQueueProvider.refresh();
 });

 context.subscriptions.push(cmd);
}
