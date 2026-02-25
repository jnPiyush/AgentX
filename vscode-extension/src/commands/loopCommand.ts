import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the AgentX: Iterative Loop commands.
 * Manages Ralph Loop style iterative refinement cycles.
 */
export function registerLoopCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 // Main loop management command
 const loopCmd = vscode.commands.registerCommand('agentx.loop', async () => {
  if (!await agentx.checkInitialized()) {
   vscode.window.showWarningMessage('AgentX is not initialized.');
   return;
  }

  const action = await vscode.window.showQuickPick(
   [
    { label: 'start', description: 'Start a new iterative refinement loop' },
    { label: 'status', description: 'Check active loop state' },
    { label: 'iterate', description: 'Advance to next iteration with summary' },
    { label: 'complete', description: 'Mark loop as successfully done' },
    { label: 'cancel', description: 'Cancel the active loop' },
   ],
   { placeHolder: 'Select loop action', title: 'AgentX Iterative Loop' }
  );
  if (!action) { return; }

  switch (action.label) {
   case 'start':
    await loopStart(agentx);
    break;
   case 'status':
    await loopStatus(agentx);
    break;
   case 'iterate':
    await loopIterate(agentx);
    break;
   case 'complete':
    await loopComplete(agentx);
    break;
   case 'cancel':
    await loopCancel(agentx);
    break;
  }
 });

 // Quick-start loop command
 const loopStartCmd = vscode.commands.registerCommand('agentx.loopStart', async () => {
  if (!await agentx.checkInitialized()) {
   vscode.window.showWarningMessage('AgentX is not initialized.');
   return;
  }
  await loopStart(agentx);
 });

 // Quick status command
 const loopStatusCmd = vscode.commands.registerCommand('agentx.loopStatus', async () => {
  if (!await agentx.checkInitialized()) {
   vscode.window.showWarningMessage('AgentX is not initialized.');
   return;
  }
  await loopStatus(agentx);
 });

 // Quick cancel command
 const loopCancelCmd = vscode.commands.registerCommand('agentx.loopCancel', async () => {
  if (!await agentx.checkInitialized()) {
   vscode.window.showWarningMessage('AgentX is not initialized.');
   return;
  }
  await loopCancel(agentx);
 });

 context.subscriptions.push(loopCmd, loopStartCmd, loopStatusCmd, loopCancelCmd);
}

async function loopStart(agentx: AgentXContext): Promise<void> {
 const prompt = await vscode.window.showInputBox({
  prompt: 'Task description for the iterative loop',
  placeHolder: 'e.g., Fix all failing tests in src/ following TDD',
  ignoreFocusOut: true,
 });
 if (!prompt) { return; }

 const maxIterStr = await vscode.window.showInputBox({
  prompt: 'Maximum iterations (safety limit)',
  value: '20',
  validateInput: (v) => {
   const n = parseInt(v, 10);
   return (isNaN(n) || n < 1) ? 'Enter a positive integer' : null;
  },
 });
 if (!maxIterStr) { return; }

 const criteria = await vscode.window.showInputBox({
  prompt: 'Completion criteria (what signals done)',
  placeHolder: 'e.g., ALL_TESTS_PASSING',
  value: 'TASK_COMPLETE',
 });
 if (!criteria) { return; }

 const issueStr = await vscode.window.showInputBox({
  prompt: 'Associated issue number (optional, press Enter to skip)',
  placeHolder: 'e.g., 42',
 });

 try {
  const args: string[] = [];
  args.push(`-LoopAction start`);
  args.push(`-Prompt "${prompt}"`);
  args.push(`-MaxIterations ${maxIterStr}`);
  args.push(`-CompletionCriteria "${criteria}"`);
  if (issueStr && parseInt(issueStr, 10) > 0) {
   args.push(`-Issue ${issueStr}`);
  }

  const output = await agentx.runCli('loop', {}, args);
  showLoopOutput('Loop Started', output);
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop start failed: ${message}`);
 }
}

async function loopStatus(agentx: AgentXContext): Promise<void> {
 try {
  const output = await agentx.runCli('loop', {}, ['-LoopAction status']);
  showLoopOutput('Loop Status', output);
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop status failed: ${message}`);
 }
}

async function loopIterate(agentx: AgentXContext): Promise<void> {
 const summary = await vscode.window.showInputBox({
  prompt: 'Iteration summary (what was done/changed)',
  placeHolder: 'e.g., Fixed 3 tests, 2 remaining',
  ignoreFocusOut: true,
 });
 if (!summary) { return; }

 try {
  const output = await agentx.runCli('loop', {}, [
   `-LoopAction iterate`,
   `-Summary "${summary}"`,
  ]);
  showLoopOutput('Loop Iteration', output);
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop iterate failed: ${message}`);
 }
}

async function loopComplete(agentx: AgentXContext): Promise<void> {
 const summary = await vscode.window.showInputBox({
  prompt: 'Completion summary',
  placeHolder: 'e.g., All tests passing, coverage at 85%',
 });

 try {
  const args = ['-LoopAction complete'];
  if (summary) {
   args.push(`-Summary "${summary}"`);
  }
  const output = await agentx.runCli('loop', {}, args);
  showLoopOutput('Loop Complete', output);
  vscode.window.showInformationMessage('Iterative loop completed successfully.');
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop complete failed: ${message}`);
 }
}

async function loopCancel(agentx: AgentXContext): Promise<void> {
 try {
  const output = await agentx.runCli('loop', {}, ['-LoopAction cancel']);
  showLoopOutput('Loop Cancelled', output);
  vscode.window.showInformationMessage('Iterative loop cancelled.');
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop cancel failed: ${message}`);
 }
}

function showLoopOutput(title: string, output: string): void {
 const channel = vscode.window.createOutputChannel('AgentX Loop');
 channel.clear();
 channel.appendLine(`=== AgentX: ${title} ===\n`);
 channel.appendLine(output);
 channel.show();
}
