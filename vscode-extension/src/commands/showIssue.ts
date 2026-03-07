import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { stripAnsi } from '../utils/stripAnsi';

let issueChannel: vscode.OutputChannel | undefined;

export function registerShowIssueCommand(
 context: vscode.ExtensionContext,
 agentxContext: AgentXContext
): void {
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.showIssue', async (issueNumber: string) => {
   if (!issueNumber) { return; }
   try {
    const output = await agentxContext.runCli('issue', ['get', issueNumber]);
    const cleaned = stripAnsi(output);
    if (!issueChannel) {
     issueChannel = vscode.window.createOutputChannel('AgentX Issue Detail');
    }
    issueChannel.clear();
    try {
     const issue = JSON.parse(cleaned);
     issueChannel.appendLine(`=== Issue #${issue.number}: ${issue.title} ===`);
     issueChannel.appendLine('');
     issueChannel.appendLine(`  Status : ${issue.status ?? 'unknown'}`);
     issueChannel.appendLine(`  State  : ${issue.state ?? 'unknown'}`);
     if (issue.labels?.length > 0) {
      issueChannel.appendLine(`  Labels : ${issue.labels.join(', ')}`);
     }
     if (issue.body) {
      issueChannel.appendLine('');
      issueChannel.appendLine('--- Body ---');
      issueChannel.appendLine(issue.body);
     }
    } catch {
     issueChannel.appendLine(`=== Issue #${issueNumber} ===\n`);
     issueChannel.appendLine(cleaned);
    }
    issueChannel.show(true);
   } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to load issue #${issueNumber}: ${message}`);
   }
  })
 );
}
