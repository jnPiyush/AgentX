import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

let clarificationChannel: vscode.OutputChannel | undefined;

export function registerPendingClarificationCommand(
 context: vscode.ExtensionContext,
 agentxContext: AgentXContext,
): void {
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.showPendingClarification', async () => {
   const pending = await agentxContext.getPendingClarification();
   if (!pending) {
    vscode.window.showInformationMessage('There is no pending clarification right now.');
    return;
   }

   if (!clarificationChannel) {
    clarificationChannel = vscode.window.createOutputChannel('AgentX Clarification');
   }

   clarificationChannel.clear();
   clarificationChannel.appendLine(`=== Pending Clarification: ${pending.agentName} ===`);
   clarificationChannel.appendLine('');
   clarificationChannel.appendLine(pending.prompt);
   if (pending.humanPrompt) {
    clarificationChannel.appendLine('');
    clarificationChannel.appendLine('--- Current guidance ---');
    clarificationChannel.appendLine(pending.humanPrompt);
   }
   clarificationChannel.appendLine('');
   clarificationChannel.appendLine('Continue in Copilot Chat with:');
   clarificationChannel.appendLine(`@agentx continue "your guidance here"`);
   clarificationChannel.show(true);
  }),
 );
}