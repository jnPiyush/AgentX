import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  createTaskBundle,
  listTaskBundles,
  promoteTaskBundle,
  renderTaskBundlesText,
  resolveTaskBundle,
  TaskBundlePromotionTarget,
  TaskBundleRecord,
  TaskBundleState,
} from '../taskBundles/task-bundles';

let taskBundleChannel: vscode.OutputChannel | undefined;

function getTaskBundleChannel(): vscode.OutputChannel {
  if (!taskBundleChannel) {
    taskBundleChannel = vscode.window.createOutputChannel('Frontier Task Bundles');
  }
  return taskBundleChannel;
}

function showBundles(records: ReadonlyArray<TaskBundleRecord>): void {
  const channel = getTaskBundleChannel();
  channel.clear();
  channel.appendLine(renderTaskBundlesText(records));
  channel.show(true);
}

async function promptScope(forListing = false): Promise<{ readonly issue?: number; readonly plan?: string; readonly all?: boolean } | undefined> {
  const selected = await vscode.window.showQuickPick(
    [
      { label: 'Use active context', value: 'active' },
      { label: 'Specific issue', value: 'issue' },
      { label: 'Specific plan', value: 'plan' },
      ...(forListing ? [{ label: 'All bundles', value: 'all' }] : []),
    ],
    {
      title: forListing ? 'Task Bundle Scope' : 'Task Bundle Parent Scope',
      placeHolder: 'Choose how Frontier should resolve task bundle context',
    },
  );

  if (!selected) {
    return undefined;
  }
  if (selected.value === 'active') {
    return {};
  }
  if (selected.value === 'all') {
    return { all: true };
  }
  if (selected.value === 'issue') {
    const issueValue = await vscode.window.showInputBox({
      title: 'Parent Issue Number',
      prompt: 'Enter the parent issue number for the task bundle',
      validateInput: (value) => (/^\d+$/.test(value.trim()) ? undefined : 'Enter a numeric issue number.'),
    });
    if (!issueValue) {
      return undefined;
    }
    return { issue: Number(issueValue) };
  }

  const plan = await vscode.window.showInputBox({
    title: 'Parent Plan Path',
    prompt: 'Enter a workspace-relative execution plan path',
    value: 'docs/execution/plans/',
  });
  if (!plan) {
    return undefined;
  }
  return { plan };
}

async function selectBundle(agentx: FrontierContext, title: string): Promise<TaskBundleRecord | undefined> {
  const bundles = await listTaskBundles(agentx, { all: true });
  if (bundles.length === 0) {
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    bundles.map((bundle) => ({
      label: `${bundle.bundleId} ${bundle.title}`,
      description: `${bundle.state} | ${bundle.priority} | ${bundle.parentContext.issueNumber ? `#${bundle.parentContext.issueNumber}` : (bundle.parentContext.planReference ?? 'no-scope')}`,
      detail: bundle.summary || bundle.promotionMode,
      bundleId: bundle.bundleId,
    })),
    { title, placeHolder: 'Select a task bundle' },
  );

  if (!selected) {
    return undefined;
  }
  return bundles.find((bundle) => bundle.bundleId === selected.bundleId);
}

export function registerTaskBundleCommands(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('frontier.showTaskBundles', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to show task bundles.');
        return;
      }

      try {
        const scope = await promptScope(true);
        if (!scope) {
          return;
        }
        showBundles(await listTaskBundles(agentx, scope));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to list task bundles: ${message}`);
      }
    }),
    vscode.commands.registerCommand('frontier.createTaskBundle', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to create task bundles.');
        return;
      }

      const title = await vscode.window.showInputBox({
        title: 'Task Bundle Title',
        prompt: 'Enter a short title for the task bundle',
        validateInput: (value) => (value.trim() ? undefined : 'A task bundle title is required.'),
      });
      if (!title) {
        return;
      }

      const summary = await vscode.window.showInputBox({
        title: 'Task Bundle Summary',
        prompt: 'Optional bundle summary',
      });
      const priority = await vscode.window.showQuickPick(['p0', 'p1', 'p2', 'p3'], {
        title: 'Task Bundle Priority',
        placeHolder: 'Choose a priority',
      });
      if (!priority) {
        return;
      }
      const promotionMode = await vscode.window.showQuickPick(
        ['none', 'story_candidate', 'feature_candidate', 'review_finding_candidate'],
        {
          title: 'Promotion Mode',
          placeHolder: 'Choose the intended downstream handling',
        },
      );
      if (!promotionMode) {
        return;
      }
      const scope = await promptScope(false);
      if (!scope) {
        return;
      }

      try {
        const bundle = await createTaskBundle(agentx, {
          title,
          summary,
          priority: priority as TaskBundleRecord['priority'],
          promotionMode: promotionMode as TaskBundleRecord['promotionMode'],
          owner: 'engineer',
          issue: scope.issue,
          plan: scope.plan,
        });
        showBundles([bundle]);
        vscode.window.showInformationMessage(`Frontier created task bundle ${bundle.bundleId}.`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to create the task bundle: ${message}`);
      }
    }),
    vscode.commands.registerCommand('frontier.resolveTaskBundle', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to resolve task bundles.');
        return;
      }

      try {
        const bundle = await selectBundle(agentx, 'Resolve Task Bundle');
        if (!bundle) {
          vscode.window.showWarningMessage('No task bundle was selected.');
          return;
        }
        const state = await vscode.window.showQuickPick(['Done', 'Archived'] as TaskBundleState[], {
          title: 'Resolution State',
          placeHolder: 'Choose the resolution state',
        });
        if (!state) {
          return;
        }
        const archiveReason = state === 'Archived'
          ? await vscode.window.showInputBox({
              title: 'Archive Reason',
              prompt: 'Why should this task bundle remain archived and searchable?',
              validateInput: (value) => (value.trim() ? undefined : 'Archived task bundles require an archive reason.'),
            })
          : undefined;
        if (state === 'Archived' && !archiveReason) {
          return;
        }

        const updated = await resolveTaskBundle(agentx, {
          bundleId: bundle.bundleId,
          state: state as Extract<TaskBundleState, 'Done' | 'Archived'>,
          archiveReason,
        });
        showBundles([updated]);
        vscode.window.showInformationMessage(`Frontier resolved task bundle ${updated.bundleId} as ${updated.state}.`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to resolve the task bundle: ${message}`);
      }
    }),
    vscode.commands.registerCommand('frontier.promoteTaskBundle', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to promote task bundles.');
        return;
      }

      try {
        const bundle = await selectBundle(agentx, 'Promote Task Bundle');
        if (!bundle) {
          vscode.window.showWarningMessage('No task bundle was selected.');
          return;
        }
        const target = await vscode.window.showQuickPick(
          ['story', 'feature', 'review-finding'] as TaskBundlePromotionTarget[],
          {
            title: 'Promotion Target',
            placeHolder: 'Choose the durable promotion target',
          },
        );
        if (!target) {
          return;
        }

        const result = await promoteTaskBundle(agentx, {
          bundleId: bundle.bundleId,
          target: target as TaskBundlePromotionTarget,
        });
        showBundles([result.bundle]);
        vscode.window.showInformationMessage(
          `Frontier promoted ${result.bundle.bundleId} to ${result.targetReference} (${result.duplicateCheckResult}).`,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to promote the task bundle: ${message}`);
      }
    }),
  );
}