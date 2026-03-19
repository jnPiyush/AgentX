import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  copyBundledRuntimeAssets,
  mergeGitignore,
  promptWorkspaceRoot,
  readJsonWithComments,
  RUNTIME_DIRS,
} from './initializeInternals';
import { syncDetectedAdoAdapter, syncDetectedGitHubAdapter } from './adaptersCommandInternals';
import { checkAllDependencies } from '../utils/dependencyChecker';

interface ExistingVersionStamp {
  readonly installedAt?: string;
}

interface ExistingConfig {
  readonly created?: string;
  readonly nextIssueNumber?: number;
}

export async function runInitializeLocalRuntimeCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): Promise<void> {
 const root = await promptWorkspaceRoot('AgentX - Initialize Local Runtime');
 if (!root) {
  return;
 }

 const initialized = fs.existsSync(path.join(root, '.agentx', 'config.json'));
 let isUpgrade = false;
 if (initialized) {
  const overwrite = await vscode.window.showWarningMessage(
   'AgentX local runtime is already initialized in this workspace. Reinstall?',
   'Reinstall',
   'Cancel',
  );
  if (overwrite !== 'Reinstall') {
   return;
  }
  isUpgrade = true;
 }

 await vscode.window.withProgress(
  {
   location: vscode.ProgressLocation.Notification,
    title: 'AgentX: Initializing local runtime...',
   cancellable: false,
  },
  async (progress) => {
   try {
    progress.report({ message: 'Creating workspace state...', increment: 40 });
    for (const dir of RUNTIME_DIRS) {
     fs.mkdirSync(path.join(root, dir), { recursive: true });
    }
      copyBundledRuntimeAssets(context.extensionUri.fsPath, root);

    const versionFile = path.join(root, '.agentx', 'version.json');
    const previousVersion = isUpgrade ? readJsonWithComments<ExistingVersionStamp>(versionFile) : undefined;
    const currentExtVersion = context.extension?.packageJSON?.version ?? '8.0.0';
    fs.writeFileSync(versionFile, JSON.stringify({
     version: currentExtVersion,
     provider: 'local',
     mode: 'local',
     integration: 'local',
     installedAt: previousVersion?.installedAt || new Date().toISOString(),
     updatedAt: new Date().toISOString(),
    }, null, 2));

    const statusFile = path.join(root, '.agentx', 'state', 'agent-status.json');
    if (!fs.existsSync(statusFile)) {
     const agentStatus: Record<string, unknown> = {};
     for (const agent of [
      'product-manager',
      'ux-designer',
      'architect',
      'engineer',
      'reviewer',
      'devops-engineer',
      'auto-fix-reviewer',
      'data-scientist',
      'tester',
      'consulting-research',
      'powerbi-analyst',
     ]) {
      agentStatus[agent] = { status: 'idle', issue: null, lastActivity: null };
     }
     fs.writeFileSync(statusFile, JSON.stringify(agentStatus, null, 2));
    }

    const existingConfig = isUpgrade ? readJsonWithComments<ExistingConfig>(path.join(root, '.agentx', 'config.json')) : undefined;
    fs.writeFileSync(path.join(root, '.agentx', 'config.json'), JSON.stringify({
     provider: 'local',
     integration: 'local',
     mode: 'local',
     enforceIssues: false,
     nextIssueNumber: existingConfig?.nextIssueNumber ?? 1,
     created: existingConfig?.created ?? new Date().toISOString(),
     updatedAt: new Date().toISOString(),
    }, null, 2));

    progress.report({ message: 'Finalizing runtime...', increment: 30 });
    mergeGitignore(root);

    await syncDetectedGitHubAdapter(agentx);
    await syncDetectedAdoAdapter(agentx);

    progress.report({ message: 'Finalizing...', increment: 10 });
    agentx.invalidateCache();

    vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
    vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
    vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

    vscode.window.showInformationMessage('AgentX: Local runtime initialized.');

    // Non-blocking advisory: notify if recommended tools are missing (never blocks init).
    checkAllDependencies(agentx).then((report) => {
      const missing = report.results
        .filter((r) => (r.severity === 'required' || r.severity === 'recommended') && !r.found)
        .map((r) => r.name);
      if (missing.length > 0) {
        void vscode.window.showWarningMessage(
          `AgentX: Optional tools not detected: ${missing.join(', ')}. Run "AgentX: Check Environment" to install.`,
          'Check Environment',
        ).then((action) => {
          if (action === 'Check Environment') {
            void vscode.commands.executeCommand('agentx.checkEnvironment');
          }
        });
      }
    }).catch(() => { /* non-blocking - ignore errors */ });

    vscode.commands.executeCommand('agentx.refresh');
   } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`AgentX local runtime initialization failed: ${message}`);
   }
  },
 );
}