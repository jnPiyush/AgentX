import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the AgentX: Check Dependencies command.
 * Validates issue dependencies before routing work.
 */
export function registerDepsCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.checkDeps', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized.');
 return;
 }

 const issueNumber = await vscode.window.showInputBox({
 prompt: 'Enter issue number to check dependencies',
 placeHolder: '42',
 validateInput: (val) => /^\d+$/.test(val) ? null : 'Enter a valid issue number',
 });
 if (!issueNumber) { return; }

 try {
    const output = await agentx.runCli('deps', [issueNumber]);
 const channel = vscode.window.createOutputChannel('AgentX Dependencies');
 channel.clear();
 channel.appendLine(`=== AgentX Dependencies: Issue #${issueNumber} ===\n`);
 channel.appendLine(output);
 channel.show();
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`Dependency check failed: ${message}`);
 }
 });

 context.subscriptions.push(cmd);
}
