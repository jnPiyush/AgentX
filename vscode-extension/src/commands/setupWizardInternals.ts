import * as vscode from 'vscode';
import {
  checkAllDependencies,
  DependencyResult,
  DependencySeverity,
  EnvironmentReport,
  IntegrationProvider,
} from '../utils/dependencyChecker';
import { FrontierContext } from '../frontierContext';
import { PreCheckResult } from './setupWizardTypes';

const ICON_PASS = '$(check)';
const ICON_FAIL = '$(error)';
const ICON_WARN = '$(warning)';
const ICON_INFO = '$(info)';

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_WAIT_MS = 180_000;

export async function runSetupWizardFlow(agentx: FrontierContext): Promise<void> {
  const report = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Frontier: Checking environment...',
      cancellable: false,
    },
    async () => checkAllDependencies(agentx),
  );

  if (report.healthy && report.warningCount === 0) {
    vscode.window.showInformationMessage(
      'Frontier: Environment is healthy - all dependencies found.',
    );
    return;
  }

  await showEnvironmentReport(report, agentx);
}

export async function runStartupCheckFlow(agentx: FrontierContext): Promise<void> {
  const report = await checkAllDependencies(agentx);

  if (report.healthy) {
    return;
  }

  const missingRequired = report.results.filter(
    (result) => result.severity === 'required' && !result.found,
  );

  if (missingRequired.length === 0) {
    return;
  }

  const missingNames = missingRequired.map((result) => result.name).join(', ');
  const action = await vscode.window.showWarningMessage(
    `Frontier: Missing required dependencies: ${missingNames}`,
    'Check Environment',
    'Dismiss',
  );

  if (action === 'Check Environment') {
    await runSetupWizardFlow(agentx);
    return;
  }

  console.warn(`Frontier: Startup dependency check dismissed. Missing: ${missingNames}`);
}

export async function runSilentInstallFlow(agentx: FrontierContext): Promise<PreCheckResult> {
  const report = await checkAllDependencies(agentx);

  if (report.healthy) {
    console.log('Frontier: All required dependencies found (silent check).');
    return { passed: true, report };
  }

  const missing = report.results.filter(
    (result) => result.severity === 'required' && !result.found,
  );
  const toolsWithFix = missing.filter((result) => result.fixCommand);

  if (toolsWithFix.length === 0) {
    console.warn(
      'Frontier: Missing dependencies with no auto-fix:',
      missing.map((result) => result.name).join(', '),
    );
    return { passed: false, report };
  }

  const terminalNames = toolsWithFix.map((tool) => tool.name).join(', ');

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Frontier: Installing ${terminalNames}...`,
      cancellable: false,
    },
    async (progress) => {
      const terminal = vscode.window.createTerminal({
        name: 'Frontier: Silent Install',
        shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
        hideFromUser: true,
      });

      for (const tool of toolsWithFix) {
        if (tool.fixCommand) {
          terminal.sendText(tool.fixCommand);
        }
      }

      progress.report({ message: `Waiting for ${terminalNames}...` });

      let elapsed = 0;

      while (elapsed < POLL_MAX_WAIT_MS) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        elapsed += POLL_INTERVAL_MS;

        progress.report({
          message: `Checking ${terminalNames}... (${Math.round(elapsed / 1000)}s)`,
        });

        const freshReport = await checkAllDependencies(agentx);
        if (freshReport.healthy) {
          terminal.dispose();
          console.log('Frontier: All dependencies installed silently.');
          return { passed: true, report: freshReport };
        }
      }

      terminal.dispose();
      const finalReport = await checkAllDependencies(agentx);
      const stillMissing = finalReport.results
        .filter((result) => result.severity === 'required' && !result.found)
        .map((result) => result.name)
        .join(', ');
      console.warn(`Frontier: Silent install timed out. Still missing: ${stillMissing}`);
      vscode.window.showWarningMessage(
        `Frontier: Could not install: ${stillMissing}. Run "Frontier: Check Environment" to retry.`,
      );
      return { passed: false, report: finalReport };
    },
  );
}

export async function runCriticalPreCheckFlow(
  agentx: FrontierContext,
  blocking = true,
): Promise<PreCheckResult> {
  const report = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Frontier: Checking dependencies...',
      cancellable: false,
    },
    async () => checkAllDependencies(agentx),
  );

  if (report.healthy) {
    console.log('Frontier: All required dependencies found.');
    return { passed: true, report };
  }

  const missing = report.results.filter(
    (result) => result.severity === 'required' && !result.found,
  );
  const missingNames = missing.map((result) => result.name).join(', ');

  const promptMsg =
    `Frontier is missing ${missing.length} required dependencies: ${missingNames}.\n`
    + `Install ${missing.length} CLI tool(s) now?`;

  const action = blocking
    ? await vscode.window.showWarningMessage(
        promptMsg,
        { modal: true, detail: missing.map((result) => `- ${result.name}: ${result.message}`).join('\n') },
        'Install All',
        'Open Setup Docs',
      )
    : await vscode.window.showWarningMessage(
        `Frontier: Missing required dependencies: ${missingNames}`,
        'Install All',
        'Open Setup Docs',
        'Dismiss',
      );

  if (action === 'Install All') {
    const toolsWithFix = missing.filter((result) => result.fixCommand);

    if (toolsWithFix.length > 0) {
      const terminal = vscode.window.createTerminal({
        name: 'Frontier: Install Dependencies',
        shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
      });
      terminal.show();

      for (const tool of toolsWithFix) {
        if (tool.fixCommand) {
          terminal.sendText(
            `echo "--- Installing ${tool.name} ---"; ${tool.fixCommand}`,
          );
        }
      }
      terminal.sendText(
        'echo "--- All installations complete. You may close this terminal. ---"',
      );

      const toolNames = toolsWithFix.map((tool) => tool.name);
      const toolsReady = await pollForExternalTools(agentx, toolNames);

      if (toolsReady) {
        const freshReport = await checkAllDependencies(agentx);
        if (freshReport.healthy) {
          vscode.window.showInformationMessage(
            'Frontier: All required dependencies are now installed.',
          );
          return { passed: true, report: freshReport };
        }
      } else {
        vscode.window.showWarningMessage(
          'Frontier: Could not verify tool installation. '
          + 'Please check the terminal for errors, then re-run "Frontier: Check Environment".',
        );
        return { passed: false, report };
      }
    }

    const recheck = await vscode.window.showInformationMessage(
      'Run the dependency check again to verify everything is installed?',
      'Re-check Now',
      'Skip',
    );
    if (recheck === 'Re-check Now') {
      const freshReport = await checkAllDependencies(agentx);
      if (freshReport.healthy) {
        vscode.window.showInformationMessage(
          'Frontier: All required dependencies are now present.',
        );
        return { passed: true, report: freshReport };
      }
      const stillMissing = freshReport.results
        .filter((result) => result.severity === 'required' && !result.found)
        .map((result) => result.name)
        .join(', ');
      vscode.window.showWarningMessage(
        `Frontier: Still missing: ${stillMissing}. Open Setup Docs for manual instructions.`,
      );
      return { passed: false, report: freshReport };
    }

    return { passed: false, report };
  }

  if (action === 'Open Setup Docs') {
    const docUri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('.'),
      'docs', 'GUIDE.md',
    );
    try {
      const doc = await vscode.workspace.openTextDocument(docUri);
      await vscode.window.showTextDocument(doc);
    } catch {
      vscode.env.openExternal(
        vscode.Uri.parse('https://github.com/jnPiyush/AgentX/blob/master/docs/GUIDE.md'),
      );
    }
    return { passed: false, report };
  }

  return { passed: false, report };
}

export async function pollForExternalTools(
  agentx: FrontierContext,
  toolNames: string[],
): Promise<boolean> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Frontier: Waiting for dependency installation to complete...',
      cancellable: true,
    },
    async (progress, token) => {
      let elapsed = 0;

      while (elapsed < POLL_MAX_WAIT_MS) {
        if (token.isCancellationRequested) {
          return false;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        elapsed += POLL_INTERVAL_MS;

        progress.report({
          message: `Checking ${toolNames.join(', ')}... (${Math.round(elapsed / 1000)}s)`,
        });

        const freshReport = await checkAllDependencies(agentx);
        const stillMissing = freshReport.results.filter(
          (result) => result.severity === 'required' && !result.found && result.fixCommand,
        );

        if (stillMissing.length === 0) {
          return true;
        }
      }

      return false;
    },
  );
}

export async function showEnvironmentReport(report: EnvironmentReport, integration?: IntegrationProvider): Promise<void> {
  type DepItem = vscode.QuickPickItem & { dep?: DependencyResult };

  const items: DepItem[] = [];
  const statusLine = report.healthy
    ? `${ICON_PASS} Environment healthy`
    : `${ICON_FAIL} ${report.criticalCount} required, ${report.warningCount} recommended issue(s)`;
  items.push({ label: statusLine, kind: vscode.QuickPickItemKind.Separator });

  const groups: [string, DependencySeverity][] = [
    ['Required', 'required'],
    ['Recommended', 'recommended'],
    ['Optional', 'optional'],
  ];

  for (const [header, severity] of groups) {
    const group = report.results.filter((result) => result.severity === severity);
    if (group.length === 0) {
      continue;
    }

    items.push({ label: header, kind: vscode.QuickPickItemKind.Separator });
    for (const dep of group) {
      const icon = severityIcon(dep);
      const status = dep.found ? dep.version || 'OK' : 'MISSING';
      items.push({
        label: `${icon} ${dep.name}`,
        description: status,
        detail: dep.message,
        dep,
      });
    }
  }

  items.push({ label: 'Actions', kind: vscode.QuickPickItemKind.Separator });
  items.push({
    label: '$(tools) Fix All Missing Dependencies',
    description: 'Install missing tools automatically',
    detail: 'Runs install commands for all missing required and recommended dependencies.',
  });
  items.push({
    label: '$(globe) Open Setup Documentation',
    description: 'View GUIDE.md for manual instructions',
  });
  items.push({
    label: '$(refresh) Re-check Environment',
    description: 'Run all checks again',
  });

  const pick = await vscode.window.showQuickPick(items, {
    title: 'Frontier - Environment Health Check',
    placeHolder: 'Select a dependency to fix or an action to run',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!pick) {
    return;
  }

  if (pick.label.includes('Fix All Missing')) {
    await fixAllMissing(report);
    return;
  }

  if (pick.label.includes('Open Setup Documentation')) {
    await openSetupDocumentation();
    return;
  }

  if (pick.label.includes('Re-check')) {
    const recheckReport = await checkAllDependencies(integration);
    if (recheckReport.healthy && recheckReport.warningCount === 0) {
      vscode.window.showInformationMessage(
        'Frontier: Environment is healthy - all dependencies found.',
      );
      return;
    }

    await showEnvironmentReport(recheckReport, integration);
    return;
  }

  if (pick.dep) {
    await fixSingleDependency(pick.dep);
  }
}

function severityIcon(result: DependencyResult): string {
  if (result.found) {
    return ICON_PASS;
  }

  switch (result.severity) {
    case 'required':
      return ICON_FAIL;
    case 'recommended':
      return ICON_WARN;
    default:
      return ICON_INFO;
  }
}

async function openSetupDocumentation(): Promise<void> {
  const docUri = vscode.Uri.joinPath(
    vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('.'),
    'docs',
    'GUIDE.md',
  );

  try {
    const doc = await vscode.workspace.openTextDocument(docUri);
    await vscode.window.showTextDocument(doc);
  } catch {
    vscode.env.openExternal(
      vscode.Uri.parse('https://github.com/jnPiyush/AgentX/blob/master/docs/GUIDE.md'),
    );
  }
}

async function fixSingleDependency(dep: DependencyResult): Promise<void> {
  if (dep.found) {
    vscode.window.showInformationMessage(`${dep.name} is already installed (${dep.version}).`);
    return;
  }

  const choices: string[] = [];
  if (dep.fixCommand) { choices.push('Install via Terminal'); }
  if (dep.fixUrl) { choices.push('Open Download Page'); }
  choices.push('Cancel');

  const choice = await vscode.window.showInformationMessage(
    `${dep.name} is missing. ${dep.message}`,
    ...choices,
  );

  if (choice === 'Install via Terminal' && dep.fixCommand) {
    const terminal = vscode.window.createTerminal({
      name: `Frontier: Install ${dep.name}`,
      shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
    });
    terminal.show();
    terminal.sendText(dep.fixCommand);
    vscode.window.showInformationMessage(
      `Installing ${dep.name}... Check the terminal for progress. Re-run the environment check when done.`,
    );
    return;
  }

  if (choice === 'Open Download Page' && dep.fixUrl) {
    vscode.env.openExternal(vscode.Uri.parse(dep.fixUrl));
  }
}

async function fixAllMissing(report: EnvironmentReport): Promise<void> {
  const missing = report.results.filter(
    (result) => !result.found && (result.severity === 'required' || result.severity === 'recommended'),
  );

  if (missing.length === 0) {
    vscode.window.showInformationMessage('Frontier: No missing dependencies to fix.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Frontier will attempt to install ${missing.length} missing dependencies: ${missing.map((result) => result.name).join(', ')}. Continue?`,
    'Install All',
    'Cancel',
  );

  if (confirm !== 'Install All') {
    return;
  }

  const externalTools = missing.filter((result) => result.fixCommand);
  if (externalTools.length === 0) {
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: 'Frontier: Install Dependencies',
    shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
  });
  terminal.show();

  const separator = process.platform === 'win32' ? '; ' : ' && ';
  const commands = externalTools
    .filter((result) => result.fixCommand)
    .map((result) => `echo "--- Installing ${result.name} ---" ${separator} ${result.fixCommand}`);

  for (const command of commands) {
    terminal.sendText(command);
  }

  terminal.sendText('echo "--- All installations complete. Please restart your terminal and re-run Frontier environment check. ---"');
  vscode.window.showInformationMessage(
    'Installing dependencies in the terminal. Re-run the environment check after installations complete.',
  );
}