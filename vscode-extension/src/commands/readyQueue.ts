import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { ReadyQueueTreeProvider } from '../views/readyQueueTreeProvider';
import { stripAnsi } from '../utils/stripAnsi';

/** Shared output channel (created once for the lifetime of the extension). */
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Register the AgentX: Show Ready Queue command.
 * Runs `.agentx/agentx.ps1 ready --json` for the tree view and
 * the human-readable variant for the output channel.
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
 // Fetch JSON output for structured tree view
 const jsonOutput = await agentx.runCli('ready', ['--json']);
 const cleaned = stripAnsi(jsonOutput).trim();

 let issues: any[] | undefined;
 try {
  issues = JSON.parse(cleaned);
  if (!Array.isArray(issues)) { issues = undefined; }
 } catch { issues = undefined; }

 if (!issues || issues.length === 0) {
  vscode.window.showInformationMessage('AgentX: No unblocked work in the ready queue.');
 } else {
  // Show human-readable output in the output channel
  if (!outputChannel) {
  outputChannel = vscode.window.createOutputChannel('AgentX Ready Queue');
  }
  outputChannel.clear();
  outputChannel.appendLine('=== AgentX Ready Queue ===\n');
  for (const issue of issues) {
  const labels = issue.labels ?? [];
  const pMatch = labels.find((l: string) => /priority:p\d/i.test(l));
  const tMatch = labels.find((l: string) => /type:\w+/i.test(l));
  const priority = pMatch ? pMatch.replace('priority:', '').toUpperCase() : '';
  const type = tMatch ? tMatch.replace('type:', '') : 'story';
  const prefix = priority ? `[${priority}]` : '     ';
  outputChannel.appendLine(`  ${prefix} #${issue.number} (${type}) ${issue.title}`);
  }
  outputChannel.show();
 }

 // Feed structured data directly to tree -- no second CLI call
 readyQueueProvider.refresh(issues);
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`AgentX ready queue failed: ${message}`);
 readyQueueProvider.refresh();
 }
 });

 context.subscriptions.push(cmd);
}
