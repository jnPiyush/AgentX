import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the AgentX: Generate Weekly Digest command.
 */
export function registerDigestCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.generateDigest', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized.');
 return;
 }

 try {
 await vscode.window.withProgress(
 {
 location: vscode.ProgressLocation.Notification,
 title: 'AgentX: Generating weekly digest...',
 cancellable: false,
 },
 async () => {
 const output = await agentx.runCli('digest');
 const channel = vscode.window.createOutputChannel('AgentX Digest');
 channel.clear();
 channel.appendLine('=== AgentX Weekly Digest ===\n');
 channel.appendLine(output);
 channel.show();
 }
 );
 vscode.window.showInformationMessage('AgentX digest generated. Check .agentx/digests/');
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`Digest generation failed: ${message}`);
 }
 });

 context.subscriptions.push(cmd);
}
