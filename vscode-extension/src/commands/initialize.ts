import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { runInitializeLocalRuntimeCommand } from './initializeCommandInternals';

/**
 * Register the Frontier: Initialize Local Runtime command.
 * Installs the repo-local Frontier runtime substrate used by run, loop,
 * workflow, memory, and handoff features.
 * Remote providers are configured separately through adapter commands.
 */
export function registerInitializeLocalRuntimeCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext
) {
 const cmd = vscode.commands.registerCommand('frontier.initializeLocalRuntime', async () => {
    await runInitializeLocalRuntimeCommand(context, agentx);
 });

 context.subscriptions.push(cmd);
}
