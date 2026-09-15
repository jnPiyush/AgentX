import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';

/**
 * Register the Frontier: Generate Weekly Digest command.
 */
export function registerDigestCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext
) {
 const cmd = vscode.commands.registerCommand('frontier.generateDigest', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('Frontier is not initialized.');
 return;
 }

 try {
 await vscode.window.withProgress(
 {
 location: vscode.ProgressLocation.Notification,
 title: 'Frontier: Generating weekly digest...',
 cancellable: false,
 },
 async () => {
 const output = await agentx.runCli('digest');
 const channel = vscode.window.createOutputChannel('Frontier Digest');
 channel.clear();
 channel.appendLine('=== Frontier Weekly Digest ===\n');
 channel.appendLine(output);
 channel.show();
 }
 );
 vscode.window.showInformationMessage('Frontier digest generated. Check .agentx/digests/');
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`Digest generation failed: ${message}`);
 }
 });

 context.subscriptions.push(cmd);
}
