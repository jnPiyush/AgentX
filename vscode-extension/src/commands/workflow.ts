import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
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
 * Register the Frontier workflow-steps command.
 * Lets the user inspect workflow steps for a selected type.
 * Auto-starts an iterative loop when the rendered workflow includes iterate=true.
 */
export function registerWorkflowCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext
) {
 const showWorkflowSteps = async (workflowLabel?: string) => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('Frontier is not initialized.');
 return;
 }

 const workflowType = workflowLabel
  ? WORKFLOW_OPTIONS.find((option) => option.label === workflowLabel)
  : await vscode.window.showQuickPick(
   WORKFLOW_OPTIONS,
   { placeHolder: 'Select workflow type', title: 'Frontier Workflow Steps' },
  );
 if (!workflowType) { return; }

 try {
     const output = await agentx.runCli('workflow', [workflowType.label]);
   const channel = vscode.window.createOutputChannel('Frontier Workflow Steps');
 channel.clear();
   channel.appendLine(`=== Frontier Workflow Steps: ${workflowType.label} ===\n`);
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
     await vscode.commands.executeCommand('frontier.loopStart');
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

 const cmd = vscode.commands.registerCommand('frontier.runWorkflow', async () => {
  await showWorkflowSteps();
 });

 const directCmd = vscode.commands.registerCommand('frontier.runWorkflowType', async (workflowLabel: string) => {
  await showWorkflowSteps(workflowLabel);
 });

 context.subscriptions.push(cmd, directCmd);
}
