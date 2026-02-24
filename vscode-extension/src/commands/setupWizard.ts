import * as vscode from 'vscode';
import {
  checkAllDependencies,
  DependencyResult,
  EnvironmentReport,
  DependencySeverity,
} from '../utils/dependencyChecker';

/**
 * Result of the critical pre-check.
 * `passed` is true only when all required dependencies are present.
 */
export interface PreCheckResult {
  passed: boolean;
  report: EnvironmentReport;
}

// -----------------------------------------------------------------------
// Icons used in the quick-pick and webview - ASCII-safe
// -----------------------------------------------------------------------
const ICON_PASS = '$(check)';
const ICON_FAIL = '$(error)';
const ICON_WARN = '$(warning)';
const ICON_INFO = '$(info)';

function severityIcon(r: DependencyResult): string {
  if (r.found) { return ICON_PASS; }
  switch (r.severity) {
    case 'required':    return ICON_FAIL;
    case 'recommended': return ICON_WARN;
    default:            return ICON_INFO;
  }
}

function severityLabel(s: DependencySeverity): string {
  switch (s) {
    case 'required':    return 'Required';
    case 'recommended': return 'Recommended';
    default:            return 'Optional';
  }
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Run the full environment check and present an interactive report.
 * Called by the `agentx.checkEnvironment` command and on first activation.
 */
export async function runSetupWizard(mode: string): Promise<void> {
  const report = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AgentX: Checking environment...',
      cancellable: false,
    },
    async () => checkAllDependencies(mode),
  );

  if (report.healthy && report.warningCount === 0) {
    vscode.window.showInformationMessage(
      'AgentX: Environment is healthy - all dependencies found.',
    );
    return;
  }

  // Show interactive report
  await showEnvironmentReport(report);
}

/**
 * Lightweight startup check - runs silently after activation and only
 * surfaces a notification when critical problems are detected.
 * When missing required dependencies are found it offers to auto-install them.
 */
export async function runStartupCheck(mode: string): Promise<void> {
  const result = await runCriticalPreCheck(mode, /* silent */ false);
  if (!result.passed) {
    console.warn('AgentX: Environment pre-check did not pass.');
  }
}

// -----------------------------------------------------------------------
//  Critical Pre-Check - auto-installs missing required dependencies
// -----------------------------------------------------------------------

/**
 * Check every required dependency and, if any are missing, prompt the user
 * to install them automatically. VS Code extensions are installed via the
 * Extensions API; external CLI tools are installed via a terminal.
 *
 * @param mode  - The AgentX operating mode ('local' or 'github').
 * @param blocking - When true (default), shows a modal dialog that demands
 *   action before the user can continue. When false, uses a
 *   non-modal warning (suitable for background startup checks).
 * @returns PreCheckResult - `passed` is true when all required deps
 *   are satisfied (either already present or successfully installed).
 */
export async function runCriticalPreCheck(
  mode: string,
  blocking = true,
): Promise<PreCheckResult> {
  // -- 1. Run all checks --------------------------------------------------
  const report = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AgentX: Checking dependencies...',
      cancellable: false,
    },
    async () => checkAllDependencies(mode),
  );

  if (report.healthy) {
    console.log('AgentX: All required dependencies found.');
    return { passed: true, report };
  }

  // -- 2. Collect missing required CLI tool dependencies ------------------
  const missing = report.results.filter(
    r => r.severity === 'required' && !r.found,
  );
  const missingNames = missing.map(r => r.name).join(', ');

  // -- 3. Build the prompt -------------------------------------------------
  const promptMsg =
    `AgentX is missing ${missing.length} required dependencies: ${missingNames}.\n`
    + `Install ${missing.length} CLI tool(s) now?`;

  // Modal gives "Install All" + "Open Setup Docs" + "Skip" (cancel)
  const action = blocking
    ? await vscode.window.showWarningMessage(
        promptMsg,
        { modal: true, detail: missing.map(r => `- ${r.name}: ${r.message}`).join('\n') },
        'Install All',
        'Open Setup Docs',
      )
    : await vscode.window.showWarningMessage(
        `AgentX: Missing required dependencies: ${missingNames}`,
        'Install All',
        'Open Setup Docs',
        'Dismiss',
      );

  // -- 4. Handle user choice -----------------------------------------------
  if (action === 'Install All') {
    // Install CLI tools via a terminal
    const toolsWithFix = missing.filter(r => r.fixCommand);

    if (toolsWithFix.length > 0) {
      const terminal = vscode.window.createTerminal({
        name: 'AgentX: Install Dependencies',
        shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
      });
      terminal.show();

      for (const tool of toolsWithFix) {
        if (tool.fixCommand) {
          terminal.sendText(
            `Write-Host '--- Installing ${tool.name} ---'; ${tool.fixCommand}`,
          );
        }
      }
      terminal.sendText(
        'Write-Host "--- All installations complete. You may close this terminal. ---"',
      );

      // Poll until tools become available (or user cancels / timeout)
      const toolNames = toolsWithFix.map(t => t.name);
      const toolsReady = await pollForExternalTools(mode, toolNames);

      if (toolsReady) {
        const freshReport = await checkAllDependencies(mode);
        if (freshReport.healthy) {
          vscode.window.showInformationMessage(
            'AgentX: All required dependencies are now installed.',
          );
          return { passed: true, report: freshReport };
        }
      } else {
        // Polling timed out or was cancelled
        vscode.window.showWarningMessage(
          'AgentX: Could not verify tool installation. '
          + 'Please check the terminal for errors, then re-run "AgentX: Check Environment".',
        );
        return { passed: false, report };
      }
    }

    // Offer a re-check
    const recheck = await vscode.window.showInformationMessage(
      'Run the dependency check again to verify everything is installed?',
      'Re-check Now',
      'Skip',
    );
    if (recheck === 'Re-check Now') {
      const freshReport = await checkAllDependencies(mode);
      if (freshReport.healthy) {
        vscode.window.showInformationMessage(
          'AgentX: All required dependencies are now present.',
        );
        return { passed: true, report: freshReport };
      }
      // Still not healthy
      const stillMissing = freshReport.results
        .filter(r => r.severity === 'required' && !r.found)
        .map(r => r.name)
        .join(', ');
      vscode.window.showWarningMessage(
        `AgentX: Still missing: ${stillMissing}. Open Setup Docs for manual instructions.`,
      );
      return { passed: false, report: freshReport };
    }

    // User chose "Skip" - optimistically assume they will handle it
    return { passed: false, report };
  }

  if (action === 'Open Setup Docs') {
    const docUri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('.'),
      'docs', 'SETUP.md',
    );
    try {
      const doc = await vscode.workspace.openTextDocument(docUri);
      await vscode.window.showTextDocument(doc);
    } catch {
      vscode.env.openExternal(
        vscode.Uri.parse('https://github.com/jnPiyush/AgentX/blob/master/docs/SETUP.md'),
      );
    }
    return { passed: false, report };
  }

  // Dismissed / cancelled
  return { passed: false, report };
}

// -----------------------------------------------------------------------
//  Poll for external tools after terminal installation
// -----------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;    // 5 seconds between checks
const POLL_MAX_WAIT_MS = 180_000;  // 3 minute maximum wait

/**
 * Poll `checkAllDependencies` until all required external (non-extension)
 * tools are found, the user cancels, or the timeout expires.
 *
 * Called after starting a terminal install for CLI tools like `gh`, `git`,
 * etc. so the pre-check can wait for the async terminal install to finish
 * rather than failing immediately.
 */
async function pollForExternalTools(
  mode: string,
  toolNames: string[],
): Promise<boolean> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AgentX: Waiting for dependency installation to complete...',
      cancellable: true,
    },
    async (_progress, token) => {
      let elapsed = 0;

      while (elapsed < POLL_MAX_WAIT_MS) {
        if (token.isCancellationRequested) {
          return false;
        }

        await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        elapsed += POLL_INTERVAL_MS;

        _progress.report({
          message: `Checking ${toolNames.join(', ')}... (${Math.round(elapsed / 1000)}s)`,
        });

        const freshReport = await checkAllDependencies(mode);
        const stillMissing = freshReport.results.filter(
          r => r.severity === 'required'
            && !r.found
            && r.fixCommand,
        );

        if (stillMissing.length === 0) {
          return true;
        }
      }

      return false;
    },
  );
}

// -----------------------------------------------------------------------
// Interactive report (quick-pick based)
// -----------------------------------------------------------------------

async function showEnvironmentReport(report: EnvironmentReport): Promise<void> {
  // Build quick-pick items for each dependency
  type DepItem = vscode.QuickPickItem & { dep?: DependencyResult };

  const items: DepItem[] = [];

  // Header
  const statusLine = report.healthy
    ? `${ICON_PASS} Environment healthy`
    : `${ICON_FAIL} ${report.criticalCount} required, ${report.warningCount} recommended issue(s)`;
  items.push({ label: statusLine, kind: vscode.QuickPickItemKind.Separator });

  // Group by severity
  const groups: [string, DependencySeverity][] = [
    ['Required', 'required'],
    ['Recommended', 'recommended'],
    ['Optional', 'optional'],
  ];

  for (const [header, sev] of groups) {
    const group = report.results.filter(r => r.severity === sev);
    if (group.length === 0) { continue; }

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

  // Footer actions
  items.push({ label: 'Actions', kind: vscode.QuickPickItemKind.Separator });
  items.push({
    label: '$(tools) Fix All Missing Dependencies',
    description: 'Install missing tools automatically',
    detail: 'Runs install commands for all missing required and recommended dependencies.',
  });
  items.push({
    label: '$(globe) Open Setup Documentation',
    description: 'View SETUP.md for manual instructions',
  });
  items.push({
    label: '$(refresh) Re-check Environment',
    description: 'Run all checks again',
  });

  const pick = await vscode.window.showQuickPick(items, {
    title: 'AgentX - Environment Health Check',
    placeHolder: 'Select a dependency to fix or an action to run',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!pick) { return; }

  // Handle actions
  if (pick.label.includes('Fix All Missing')) {
    await fixAllMissing(report);
  } else if (pick.label.includes('Open Setup Documentation')) {
    const docUri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('.'),
      'docs', 'SETUP.md',
    );
    try {
      const doc = await vscode.workspace.openTextDocument(docUri);
      await vscode.window.showTextDocument(doc);
    } catch {
      vscode.env.openExternal(
        vscode.Uri.parse('https://github.com/jnPiyush/AgentX/blob/master/docs/SETUP.md'),
      );
    }
  } else if (pick.label.includes('Re-check')) {
    await runSetupWizard(
      vscode.workspace.getConfiguration('agentx').get<string>('mode', 'local'),
    );
  } else if ((pick as DepItem).dep) {
    await fixSingleDependency((pick as DepItem).dep!);
  }
}

// -----------------------------------------------------------------------
// Fix actions
// -----------------------------------------------------------------------

/**
 * Fix a single missing dependency - run a terminal command or open
 * a browser to the download page.
 */
async function fixSingleDependency(dep: DependencyResult): Promise<void> {
  if (dep.found) {
    vscode.window.showInformationMessage(`${dep.name} is already installed (${dep.version}).`);
    return;
  }

  // Offer terminal install or browser download
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
      name: `AgentX: Install ${dep.name}`,
      shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
    });
    terminal.show();
    terminal.sendText(dep.fixCommand);
    vscode.window.showInformationMessage(
      `Installing ${dep.name}... Check the terminal for progress. Re-run the environment check when done.`,
    );
  } else if (choice === 'Open Download Page' && dep.fixUrl) {
    vscode.env.openExternal(vscode.Uri.parse(dep.fixUrl));
  }
}

/**
 * Attempt to fix all missing dependencies.
 */
async function fixAllMissing(report: EnvironmentReport): Promise<void> {
  const missing = report.results.filter(
    r => !r.found && (r.severity === 'required' || r.severity === 'recommended'),
  );

  if (missing.length === 0) {
    vscode.window.showInformationMessage('AgentX: No missing dependencies to fix.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `AgentX will attempt to install ${missing.length} missing dependencies: ${missing.map(r => r.name).join(', ')}. Continue?`,
    'Install All',
    'Cancel',
  );

  if (confirm !== 'Install All') { return; }

  // Separate VS Code extensions from external tools
  const externalTools = missing.filter(r => r.fixCommand);

  // Install external tools via a single terminal
  if (externalTools.length > 0) {
    const terminal = vscode.window.createTerminal({
      name: 'AgentX: Install Dependencies',
      shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
    });
    terminal.show();

    const separator = process.platform === 'win32' ? '; ' : ' && ';
    const commands = externalTools
      .filter(r => r.fixCommand)
      .map(r => `echo "--- Installing ${r.name} ---" ${separator} ${r.fixCommand}`);

    for (const cmd of commands) {
      terminal.sendText(cmd);
    }

    terminal.sendText('echo "--- All installations complete. Please restart your terminal and re-run AgentX environment check. ---"');

    vscode.window.showInformationMessage(
      'Installing dependencies in the terminal. Re-run the environment check after installations complete.',
    );
  }
}
