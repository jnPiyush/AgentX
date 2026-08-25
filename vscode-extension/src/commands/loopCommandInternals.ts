import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  completeHarnessThread,
  getHarnessStatusDisplay,
  recordHarnessIteration,
  recordHarnessStatusCheck,
  startHarnessThread,
} from '../utils/harnessState';

export const LOOP_ACTION_ITEMS = [
  { label: 'start', description: 'Start a new iterative refinement loop' },
  { label: 'status', description: 'Check active loop state' },
  { label: 'iterate', description: 'Advance to next iteration with summary' },
  { label: 'complete', description: 'Mark loop as successfully done' },
  { label: 'cancel', description: 'Cancel the active loop' },
  { label: 'rollback', description: 'Roll the loop back to an earlier iteration' },
];

export async function ensureLoopInitialized(agentx: AgentXContext): Promise<boolean> {
  if (!await agentx.checkInitialized()) {
    vscode.window.showWarningMessage('AgentX is not initialized.');
    return false;
  }

  return true;
}

export async function executeLoopAction(
  agentx: AgentXContext,
  action: string,
): Promise<void> {
  switch (action) {
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
    case 'rollback':
      await loopRollback(agentx);
      break;
  }
}

export async function loopStart(agentx: AgentXContext): Promise<void> {
  const prompt = await vscode.window.showInputBox({
    prompt: 'Task description for the iterative loop',
    placeHolder: 'e.g., Fix all failing tests in src/ following TDD',
    ignoreFocusOut: true,
  });
  if (!prompt) { return; }

  const maxIterStr = await vscode.window.showInputBox({
    prompt: 'Maximum iterations (safety limit)',
    value: '20',
    validateInput: (value) => {
      const iterationCount = parseInt(value, 10);
      return Number.isNaN(iterationCount) || iterationCount < 1
        ? 'Enter a positive integer'
        : null;
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
    const args: string[] = ['start', '-p', prompt, '-m', maxIterStr, '-c', criteria];
    if (issueStr && parseInt(issueStr, 10) > 0) {
      args.push('-i', issueStr);
    }

    const output = await agentx.runCli('loop', args);
    syncHarnessStart(agentx, prompt, criteria, issueStr);
    showLoopOutput('Loop Started', output, getHarnessDisplay(agentx));
    vscode.window.showInformationMessage('Iterative loop started with a default minimum of 5 review iterations.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Loop start failed: ${message}`);
  }
}

export async function loopStatus(agentx: AgentXContext): Promise<boolean> {
  try {
    const output = await agentx.runCli('loop', ['status']);
    syncHarnessStatus(agentx);
    showLoopOutput('Loop Status', output, getHarnessDisplay(agentx));
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Loop status failed: ${message}`);
    return false;
  }
}

export async function loopIterate(agentx: AgentXContext): Promise<void> {
  const summary = await vscode.window.showInputBox({
    prompt: 'Iteration summary (what was done/changed)',
    placeHolder: 'e.g., Fixed 3 tests, 2 remaining',
    ignoreFocusOut: true,
  });
  if (!summary) { return; }

  const evidence = await vscode.window.showInputBox({
    prompt: 'Iteration evidence file (required by quality gate)',
    placeHolder: 'e.g., .agentx/state/test-report.log',
    ignoreFocusOut: true,
  });
  if (!evidence?.trim()) { return; }

  // The reviewer pass must be recordable from this surface too: a loop cannot
  // complete without a structured verdict, so without these flags a loop driven
  // entirely through the VS Code commands could never be finished.
  const args = ['iterate', '-s', summary, '-e', evidence.trim()];
  const isReviewPass = await vscode.window.showQuickPick(['No', 'Yes'], {
    placeHolder: 'Is this the subagent review pass?',
    ignoreFocusOut: true,
  });
  if (!isReviewPass) { return; }
  if (isReviewPass === 'Yes') {
    const verdict = await vscode.window.showQuickPick(['approved', 'changes-requested'], {
      placeHolder: 'Reviewer verdict',
      ignoreFocusOut: true,
    });
    if (!verdict) { return; }
    const reviewer = await vscode.window.showInputBox({
      prompt: 'Reviewer id (required with a verdict)',
      placeHolder: 'e.g., engineer-subagent',
      ignoreFocusOut: true,
    });
    if (!reviewer?.trim()) { return; }
    const counts: Array<{ flag: string; label: string }> = [
      { flag: '--high', label: 'HIGH finding count' },
      { flag: '--medium', label: 'MEDIUM finding count' },
      { flag: '--low', label: 'LOW finding count' },
    ];
    const countArgs: string[] = [];
    for (const { flag, label } of counts) {
      const value = await vscode.window.showInputBox({
        prompt: label,
        value: '0',
        ignoreFocusOut: true,
        validateInput: (input) => (/^\d+$/.test(input.trim()) ? null : 'Enter a non-negative integer'),
      });
      if (value === undefined) { return; }
      countArgs.push(flag, value.trim());
    }
    args.push('--verdict', verdict, '--reviewer', reviewer.trim(), ...countArgs);
  }

  try {
    const output = await agentx.runCli('loop', args);
    syncHarnessIteration(agentx, summary);
    showLoopOutput('Loop Iteration', output, getHarnessDisplay(agentx));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Loop iterate failed: ${message}`);
  }
}

export async function loopComplete(agentx: AgentXContext): Promise<void> {
  const summary = await vscode.window.showInputBox({
    prompt: 'Completion summary',
    placeHolder: 'e.g., All tests passing, coverage at 85%',
  });

  // The CLI quality gate requires a fresh final-gate evidence artifact
  // (e.g., quality-gate.log, full-suite-report.xml). Prompt for it so the
  // command can complete instead of bouncing on the CLI's evidence check.
  const evidence = await vscode.window.showInputBox({
    prompt: 'Final-gate evidence file (required by quality gate)',
    placeHolder: 'e.g., .agentx/state/final-gate.log',
    ignoreFocusOut: true,
  });

  try {
    const args = ['complete'];
    if (summary) {
      args.push('-s', summary);
    }
    if (evidence && evidence.trim().length > 0) {
      args.push('-e', evidence.trim());
    }

    const output = await agentx.runCli('loop', args);
    syncHarnessComplete(agentx, summary ?? 'Loop completed successfully.');
    showLoopOutput('Loop Complete', output, getHarnessDisplay(agentx));
    vscode.window.showInformationMessage('Iterative loop completed successfully.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Loop complete failed: ${message}`);
  }
}

export async function loopCancel(agentx: AgentXContext): Promise<void> {
  try {
    const output = await agentx.runCli('loop', ['cancel']);
    syncHarnessCancel(agentx);
    showLoopOutput('Loop Cancelled', output, getHarnessDisplay(agentx));
    vscode.window.showInformationMessage('Iterative loop cancelled.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Loop cancel failed: ${message}`);
  }
}

export async function loopRollback(agentx: AgentXContext): Promise<void> {
  const target = await vscode.window.showInputBox({
    prompt: 'Roll back to which iteration number?',
    placeHolder: 'e.g., 3',
    validateInput: (value) => {
      const n = parseInt(value, 10);
      return Number.isNaN(n) || n < 1 ? 'Enter a positive integer' : null;
    },
    ignoreFocusOut: true,
  });
  if (!target) { return; }

  const reason = await vscode.window.showInputBox({
    prompt: 'Reason (optional)',
    placeHolder: 'e.g., Security finding requires re-doing the fix iteration',
  });

  try {
    const args = ['rollback', '-n', target.trim()];
    if (reason && reason.trim().length > 0) {
      args.push('-r', reason.trim());
    }
    const output = await agentx.runCli('loop', args);
    showLoopOutput('Loop Rollback', output, getHarnessDisplay(agentx));
    vscode.window.showInformationMessage(`Iterative loop rolled back to iteration ${target}.`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Loop rollback failed: ${message}`);
  }
}

function getHarnessDisplay(agentx: AgentXContext): string | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return getHarnessStatusDisplay(root);
}

function syncHarnessStart(
  agentx: AgentXContext,
  prompt: string,
  completionCriteria: string,
  issueStr?: string,
): void {
  const root = agentx.workspaceRoot;
  if (!root) {
    return;
  }

  try {
    const issueNumber = issueStr ? parseInt(issueStr, 10) : undefined;
    startHarnessThread(root, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt,
      completionCriteria,
      issueNumber: Number.isFinite(issueNumber) ? issueNumber : null,
      planPath: agentx.listExecutionPlanFiles()[0],
    });
  } catch (err: unknown) {
    showHarnessWarning(err);
  }
}

function syncHarnessStatus(agentx: AgentXContext): void {
  const root = agentx.workspaceRoot;
  if (!root) {
    return;
  }

  try {
    recordHarnessStatusCheck(root, 'Loop status requested');
  } catch (err: unknown) {
    showHarnessWarning(err);
  }
}

function syncHarnessIteration(agentx: AgentXContext, summary: string): void {
  const root = agentx.workspaceRoot;
  if (!root) {
    return;
  }

  try {
    recordHarnessIteration(root, summary);
  } catch (err: unknown) {
    showHarnessWarning(err);
  }
}

function syncHarnessComplete(agentx: AgentXContext, summary: string): void {
  const root = agentx.workspaceRoot;
  if (!root) {
    return;
  }

  try {
    completeHarnessThread(root, { status: 'complete', summary });
  } catch (err: unknown) {
    showHarnessWarning(err);
  }
}

function syncHarnessCancel(agentx: AgentXContext): void {
  const root = agentx.workspaceRoot;
  if (!root) {
    return;
  }

  try {
    completeHarnessThread(root, { status: 'cancelled', summary: 'Loop cancelled.' });
  } catch (err: unknown) {
    showHarnessWarning(err);
  }
}

function showHarnessWarning(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  void vscode.window.showWarningMessage(`Harness state was not updated: ${message}`);
}

function showLoopOutput(title: string, output: string, harnessDisplay?: string): void {
  const channel = vscode.window.createOutputChannel('AgentX Loop');
  channel.clear();
  channel.appendLine(`=== AgentX: ${title} ===\n`);
  channel.appendLine(output);
  if (harnessDisplay) {
    channel.appendLine('');
    channel.appendLine(`Harness: ${harnessDisplay}`);
  }
  channel.show();
}