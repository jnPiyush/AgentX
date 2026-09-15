import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  assessBoundedParallelDelivery,
  listBoundedParallelRuns,
  reconcileBoundedParallelRun,
  renderBoundedParallelRunsText,
  startBoundedParallelDelivery,
} from '../parallel/parallel-delivery';

let parallelChannel: vscode.OutputChannel | undefined;

function getParallelChannel(): vscode.OutputChannel {
  if (!parallelChannel) {
    parallelChannel = vscode.window.createOutputChannel('Frontier Bounded Parallel');
  }
  return parallelChannel;
}

function showRuns(markdown: string): void {
  const channel = getParallelChannel();
  channel.clear();
  channel.appendLine(markdown);
  channel.show(true);
}

async function promptIssueOrPlan(): Promise<{ readonly issue?: number; readonly plan?: string } | undefined> {
  const selected = await vscode.window.showQuickPick(
    [
      { label: 'Use active context', value: 'active' },
      { label: 'Specific issue', value: 'issue' },
      { label: 'Specific plan', value: 'plan' },
    ],
    { title: 'Bounded Parallel Parent Scope', placeHolder: 'Choose how to resolve the parent work context' },
  );
  if (!selected) {
    return undefined;
  }
  if (selected.value === 'active') {
    return {};
  }
  if (selected.value === 'issue') {
    const issue = await vscode.window.showInputBox({
      title: 'Parent Issue Number',
      validateInput: (value) => (/^\d+$/.test(value.trim()) ? undefined : 'Enter a numeric issue number.'),
    });
    return issue ? { issue: Number(issue) } : undefined;
  }
  const plan = await vscode.window.showInputBox({ title: 'Parent Plan Path', value: 'docs/execution/plans/' });
  return plan ? { plan } : undefined;
}

export function registerParallelDeliveryCommands(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('frontier.showBoundedParallelRuns', async () => {
      if (!agentx.workspaceRoot) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to show bounded parallel runs.');
        return;
      }
      try {
        showRuns(renderBoundedParallelRunsText(await listBoundedParallelRuns(agentx)));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to list bounded parallel runs: ${message}`);
      }
    }),
    vscode.commands.registerCommand('frontier.assessBoundedParallelDelivery', async () => {
      if (!agentx.workspaceRoot) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to assess bounded parallel delivery.');
        return;
      }
      const scope = await promptIssueOrPlan();
      if (!scope) {
        return;
      }
      const title = await vscode.window.showInputBox({ title: 'Assessment Title', value: 'Bounded parallel delivery' });
      if (!title) {
        return;
      }
      const scopeIndependence = await vscode.window.showQuickPick(
        ['independent', 'loosely-coupled', 'coupled'],
        { title: 'Scope Independence', placeHolder: 'How independent are the parallel work scopes?' },
      );
      if (!scopeIndependence) {
        return;
      }
      const dependencyCoupling = await vscode.window.showQuickPick(
        ['low', 'medium', 'high'],
        { title: 'Dependency Coupling', placeHolder: 'How tightly coupled are the dependencies?' },
      );
      if (!dependencyCoupling) {
        return;
      }
      const artifactOverlap = await vscode.window.showQuickPick(
        ['low', 'medium', 'high'],
        { title: 'Artifact Overlap', placeHolder: 'How much do the output artifacts overlap?' },
      );
      if (!artifactOverlap) {
        return;
      }
      const reviewComplexity = await vscode.window.showQuickPick(
        ['bounded', 'heightened', 'high'],
        { title: 'Review Complexity', placeHolder: 'How complex is the parallel review?' },
      );
      if (!reviewComplexity) {
        return;
      }
      const recoveryComplexity = await vscode.window.showQuickPick(
        ['recoverable', 'contained', 'high'],
        { title: 'Recovery Complexity', placeHolder: 'How complex would recovery from a failure be?' },
      );
      if (!recoveryComplexity) {
        return;
      }
      try {
        const run = await assessBoundedParallelDelivery(agentx, {
          title,
          issue: scope.issue,
          plan: scope.plan,
          scopeIndependence,
          dependencyCoupling,
          artifactOverlap,
          reviewComplexity,
          recoveryComplexity,
        });
        showRuns(renderBoundedParallelRunsText([run]));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to assess bounded parallel delivery: ${message}`);
      }
    }),
    vscode.commands.registerCommand('frontier.startBoundedParallelDelivery', async () => {
      if (!agentx.workspaceRoot) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to start bounded parallel delivery.');
        return;
      }
      const runs = await listBoundedParallelRuns(agentx);
      const eligibleRuns = runs.filter((run) => run.assessment.decision === 'eligible');
      const selected = await vscode.window.showQuickPick(
        eligibleRuns.map((run) => ({ label: `${run.parallelId} ${run.title}`, parallelId: run.parallelId })),
        { title: 'Eligible Bounded Parallel Run', placeHolder: 'Choose an eligible run to start' },
      );
      if (!selected) {
        return;
      }
      const unitsJson = await vscode.window.showInputBox({
        title: 'Task Units JSON',
        prompt: 'Enter a JSON array of task-unit objects',
        value: '[{"title":"Unit A","scopeBoundary":"docs only","owner":"engineer","recoveryGuidance":"retry sequentially"}]',
      });
      if (!unitsJson) {
        return;
      }
      try {
        const parsed = JSON.parse(unitsJson) as Array<Record<string, string>>;
        const run = await startBoundedParallelDelivery(agentx, {
          parallelId: selected.parallelId,
          units: parsed.map((unit) => ({
            title: unit.title,
            scopeBoundary: unit.scopeBoundary,
            owner: unit.owner,
            isolationMode: unit.isolationMode,
            status: unit.status,
            mergeReadiness: unit.mergeReadiness,
            recoveryGuidance: unit.recoveryGuidance,
            summarySignal: unit.summarySignal,
          })),
        });
        showRuns(renderBoundedParallelRunsText([run]));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to start bounded parallel delivery: ${message}`);
      }
    }),
    vscode.commands.registerCommand('frontier.reconcileBoundedParallelRun', async () => {
      if (!agentx.workspaceRoot) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to reconcile bounded parallel output.');
        return;
      }
      const runs = await listBoundedParallelRuns(agentx);
      const selected = await vscode.window.showQuickPick(
        runs.map((run) => ({ label: `${run.parallelId} ${run.title}`, parallelId: run.parallelId })),
        { title: 'Reconcile Bounded Parallel Run', placeHolder: 'Choose a run to reconcile' },
      );
      if (!selected) {
        return;
      }
      const overlapReview = await vscode.window.showQuickPick(
        ['pass', 'fail', 'pending'],
        { title: 'Overlap Review', placeHolder: 'Did overlap review pass?' },
      );
      if (!overlapReview) {
        return;
      }
      const conflictReview = await vscode.window.showQuickPick(
        ['pass', 'fail', 'pending'],
        { title: 'Conflict Review', placeHolder: 'Did conflict review pass?' },
      );
      if (!conflictReview) {
        return;
      }
      const acceptanceEvidence = await vscode.window.showQuickPick(
        ['pass', 'fail', 'pending'],
        { title: 'Acceptance Evidence', placeHolder: 'Is acceptance evidence sufficient?' },
      );
      if (!acceptanceEvidence) {
        return;
      }
      const ownerApproval = await vscode.window.showQuickPick(
        ['approved', 'rejected', 'pending'],
        { title: 'Owner Approval', placeHolder: 'Has the owner approved the parallel output?' },
      );
      if (!ownerApproval) {
        return;
      }
      try {
        const run = await reconcileBoundedParallelRun(agentx, {
          parallelId: selected.parallelId,
          overlapReview,
          conflictReview,
          acceptanceEvidence,
          ownerApproval,
        });
        showRuns(renderBoundedParallelRunsText([run]));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to reconcile bounded parallel output: ${message}`);
      }
    }),
  );
}