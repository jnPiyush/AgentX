import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { type AdapterMode, runAddRemoteAdapterCommand } from './adaptersCommandInternals';

export function registerAddRemoteAdapterCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
): void {
 const cmd = vscode.commands.registerCommand('agentx.addRemoteAdapter', async (preferredMode?: AdapterMode) => {
    await runAddRemoteAdapterCommand(agentx, preferredMode);
 });

 context.subscriptions.push(cmd);
}