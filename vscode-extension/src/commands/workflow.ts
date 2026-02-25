import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the AgentX: Run Workflow command.
 * Lets user pick a workflow type and runs it.
 */
export function registerWorkflowCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.runWorkflow', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized.');
 return;
 }

 const workflowType = await vscode.window.showQuickPick(
 [
 { label: 'feature', description: 'PM -> UX -> Architect -> Engineer -> Reviewer' },
 { label: 'epic', description: 'Full epic workflow with PRD and breakdown' },
 { label: 'story', description: 'Engineer -> Reviewer (spec ready)' },
 { label: 'bug', description: 'Engineer -> Reviewer (direct)' },
 { label: 'spike', description: 'Architect research spike' },
 { label: 'devops', description: 'DevOps pipeline workflow' },
 { label: 'docs', description: 'Documentation update' },
 ],
 { placeHolder: 'Select workflow type', title: 'AgentX Workflow' }
 );
 if (!workflowType) { return; }

 try {
    const output = await agentx.runCli('workflow', [workflowType.label]);
 const channel = vscode.window.createOutputChannel('AgentX Workflow');
 channel.clear();
 channel.appendLine(`=== AgentX Workflow: ${workflowType.label} ===\n`);
 channel.appendLine(output);
 channel.show();
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`Workflow failed: ${message}`);
 }
 });

 context.subscriptions.push(cmd);
}
