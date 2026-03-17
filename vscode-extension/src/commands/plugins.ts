import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { runAddPluginCommand } from './pluginsCommandInternals';

export function registerAddPluginCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
): void {
 const cmd = vscode.commands.registerCommand('agentx.addPlugin', async () => {
  await runAddPluginCommand(context, agentx);
 });

 context.subscriptions.push(cmd);
}