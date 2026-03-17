import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { runInitializeCommand } from './initializeCommandInternals';

/**
 * Register the AgentX: Config Advance command.
 * Downloads GitHub-specific runtime files (hooks, workflows, templates)
 * and configures remote integration via .vscode/mcp.json entries.
 * Local mode works out of the box without running this command.
 */
export function registerInitializeCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.initialize', async (_opts?: { legacy?: boolean }) => {
  await runInitializeCommand(context, agentx, _opts);
 });

 context.subscriptions.push(cmd);
}
