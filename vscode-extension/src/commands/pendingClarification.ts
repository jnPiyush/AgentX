import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';

let clarificationChannel: vscode.OutputChannel | undefined;

export function registerPendingClarificationCommand(
 context: vscode.ExtensionContext,
 frontierContext: FrontierContext,
): void {
 context.subscriptions.push(
  vscode.commands.registerCommand('frontier.showPendingClarification', async () => {
   const pending = await frontierContext.getPendingClarification();
   if (!pending) {
    vscode.window.showInformationMessage('There is no pending clarification right now.');
    return;
   }

   if (!clarificationChannel) {
    clarificationChannel = vscode.window.createOutputChannel('Frontier Clarification');
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
   clarificationChannel.appendLine(`@frontier continue "your guidance here"`);
   clarificationChannel.show(true);
  }),
 );
}