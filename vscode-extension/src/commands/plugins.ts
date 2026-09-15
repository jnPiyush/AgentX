import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { runAddPluginCommand } from './pluginsCommandInternals';

export function registerAddPluginCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext,
): void {
 const cmd = vscode.commands.registerCommand('frontier.addPlugin', async () => {
  await runAddPluginCommand(context, agentx);
 });

 context.subscriptions.push(cmd);
}