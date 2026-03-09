import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { shouldAutoStartLoop, getLoopStatusDisplay } from '../utils/loopStateChecker';

export interface WorkflowOption {
 readonly label: string;
 readonly description: string;
}

export const WORKFLOW_OPTIONS: ReadonlyArray<WorkflowOption> = [
 { label: 'feature', description: 'PM -> [Architect, Data Scientist, UX] -> Engineer -> Reviewer -> [DevOps, Tester]' },
 { label: 'epic', description: 'Full epic workflow with PRD and breakdown' },
 { label: 'story', description: 'Engineer -> Reviewer (spec ready)' },
 { label: 'bug', description: 'Engineer -> Reviewer (direct)' },
 { label: 'spike', description: 'Architect research spike' },
 { label: 'devops', description: 'DevOps pipeline workflow' },
 { label: 'docs', description: 'Documentation update' },
 { label: 'iterative-loop', description: 'Extended iterative refinement with planning + review' },
];

/**
 * Register the AgentX: Run Workflow command.
 * Lets user pick a workflow type and runs it.
 * Auto-starts an iterative loop when a workflow step has iterate=true.
 */
export function registerWorkflowCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const runWorkflow = async (workflowLabel?: string) => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized.');
 return;
 }

 const workflowType = workflowLabel
  ? WORKFLOW_OPTIONS.find((option) => option.label === workflowLabel)
  : await vscode.window.showQuickPick(
   WORKFLOW_OPTIONS,
   { placeHolder: 'Select workflow type', title: 'AgentX Workflow' },
  );
 if (!workflowType) { return; }

 try {
    const output = await agentx.runCli('workflow', [workflowType.label]);
 const channel = vscode.window.createOutputChannel('AgentX Workflow');
 channel.clear();
 channel.appendLine(`=== AgentX Workflow: ${workflowType.label} ===\n`);
 channel.appendLine(output);
 channel.show();

 // ---------------------------------------------------------------
 // Auto-start iterative loop for workflows with iterate=true steps
 // ---------------------------------------------------------------
 const hasIterateStep = /\[LOOP\]/i.test(output);
 const root = agentx.workspaceRoot;
 if (hasIterateStep && root && shouldAutoStartLoop(root)) {
   const autoStart = await vscode.window.showInformationMessage(
     'This workflow has an iterative loop step. Start a quality loop now?',
     'Start Loop', 'Skip'
   );
   if (autoStart === 'Start Loop') {
     await vscode.commands.executeCommand('agentx.loopStart');
   }
 } else if (hasIterateStep && root) {
   vscode.window.showInformationMessage(
     `Quality loop already active: ${getLoopStatusDisplay(root)}`
   );
 }
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`Workflow failed: ${message}`);
 }
 };

 const cmd = vscode.commands.registerCommand('agentx.runWorkflow', async () => {
  await runWorkflow();
 });

 const directCmd = vscode.commands.registerCommand('agentx.runWorkflowType', async (workflowLabel: string) => {
  await runWorkflow(workflowLabel);
 });

 context.subscriptions.push(cmd, directCmd);
}
