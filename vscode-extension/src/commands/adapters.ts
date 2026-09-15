import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { type AdapterMode, runAddRemoteAdapterCommand } from './adaptersCommandInternals';

export function registerAddRemoteAdapterCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext,
): void {
 const cmd = vscode.commands.registerCommand('frontier.addRemoteAdapter', async (preferredMode?: AdapterMode) => {
    await runAddRemoteAdapterCommand(agentx, preferredMode);
 });

 context.subscriptions.push(cmd);
}