import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  copyBundledRuntimeAssets,
  copyCopilotCliAssets,
  mergeGitignore,
  promptWorkspaceRoot,
  readJsonWithComments,
  RUNTIME_DIRS,
  writeWorkspaceRuntimeWrappers,
} from './initializeInternals';
import { syncDetectedAdoAdapter, syncDetectedGitHubAdapter } from './adaptersCommandInternals';
import { checkAllDependencies } from '../utils/dependencyChecker';
import {
  hasFrontierState,
  migrateLegacyState,
  resolveFrontierStatePath,
} from '../utils/frontierPaths';

interface ExistingVersionStamp {
  readonly installedAt?: string;
}

interface ExistingConfig {
  readonly created?: string;
  readonly nextIssueNumber?: number;
  readonly [key: string]: unknown;
}

export async function runInitializeLocalRuntimeCommand(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): Promise<void> {
 const root = await promptWorkspaceRoot('Frontier - Initialize Local Runtime');
 if (!root) {
  return;
 }

 const initialized = hasFrontierState(root);
 let isUpgrade = false;
 if (initialized) {
  const overwrite = await vscode.window.showWarningMessage(
   'Frontier local runtime is already initialized in this workspace. Reinstall?',
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
    title: 'Frontier: Initializing local runtime...',
   cancellable: false,
  },
  async (progress) => {
   try {
    progress.report({ message: 'Creating workspace state...', increment: 40 });
    migrateLegacyState(root);
    for (const dir of RUNTIME_DIRS) {
     fs.mkdirSync(path.join(root, dir), { recursive: true });
    }
    copyBundledRuntimeAssets(context.extensionUri.fsPath, root);
    // Optionally seed workspace .github/ with Frontier assets for non-VS-Code
    // surfaces (e.g. GitHub Copilot CLI) that need repo-local discovery of
    // agents/skills/instructions/prompts/templates/schemas. VS Code chat,
    // commands, and the Frontier runtime resolve these from the extension bundle
    // via runtimeAssets.resolveAssetPath, so the seed is opt-in.
    // Setting: agentx.seedRepoLocalAssets (default false). Always skip-existing
    // to preserve any workspace overrides the user has committed to .github/.
    const seedRepoLocalAssets = vscode.workspace
      .getConfiguration('agentx')
      .get<boolean>('seedRepoLocalAssets', false);
    if (seedRepoLocalAssets) {
      copyCopilotCliAssets(context.extensionUri.fsPath, root, false);
    }
    writeWorkspaceRuntimeWrappers(context.extensionUri.fsPath, root);

    const versionFile = resolveFrontierStatePath(root, 'version.json');
    const previousVersion = isUpgrade ? readJsonWithComments<ExistingVersionStamp>(versionFile) : undefined;
    const currentExtVersion = context.extension?.packageJSON?.version ?? '8.0.0';
    fs.writeFileSync(versionFile, JSON.stringify({
     version: currentExtVersion,
     installedAt: previousVersion?.installedAt || new Date().toISOString(),
     updatedAt: new Date().toISOString(),
    }, null, 2));

    const statusFile = resolveFrontierStatePath(root, 'state', 'agent-status.json');
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
      'fabric-engineer',
      'power-platform-builder',
      'consulting-research',
      'powerbi-analyst',
     ]) {
      agentStatus[agent] = { status: 'idle', issue: null, lastActivity: null };
     }
     fs.writeFileSync(statusFile, JSON.stringify(agentStatus, null, 2));
    }

    const configFile = resolveFrontierStatePath(root, 'config.json');
    const existingConfig = readJsonWithComments<ExistingConfig>(configFile);
    const provider = existingConfig?.provider ?? existingConfig?.integration ?? existingConfig?.mode ?? 'local';
    fs.writeFileSync(configFile, JSON.stringify({
     provider,
     integration: provider,
     mode: provider,
     enforceIssues: false,
     nextIssueNumber: 1,
     created: new Date().toISOString(),
     ...existingConfig,
     updatedAt: new Date().toISOString(),
    }, null, 2));

    progress.report({ message: 'Finalizing runtime...', increment: 30 });
    mergeGitignore(root);

    if (!existingConfig) {
      await syncDetectedGitHubAdapter(agentx, { root });
      await syncDetectedAdoAdapter(agentx, { root });
    }

    progress.report({ message: 'Finalizing...', increment: 10 });
    agentx.invalidateCache();

    vscode.commands.executeCommand('setContext', 'frontier.initialized', true);
    vscode.commands.executeCommand('setContext', 'frontier.githubConnected', agentx.githubConnected);
    vscode.commands.executeCommand('setContext', 'frontier.adoConnected', agentx.adoConnected);

    vscode.window.showInformationMessage('Frontier: Local runtime initialized.');

    // Non-blocking advisory: notify if recommended tools are missing (never blocks init).
    checkAllDependencies(agentx).then((report) => {
      const missing = report.results
        .filter((r) => (r.severity === 'required' || r.severity === 'recommended') && !r.found)
        .map((r) => r.name);
      if (missing.length > 0) {
        void vscode.window.showWarningMessage(
          `Frontier: Optional tools not detected: ${missing.join(', ')}. Run "Frontier: Check Environment" to install.`,
          'Check Environment',
        ).then((action) => {
          if (action === 'Check Environment') {
            void vscode.commands.executeCommand('frontier.checkEnvironment');
          }
        });
      }
    }).catch(() => { /* non-blocking - ignore errors */ });

    vscode.commands.executeCommand('frontier.refresh');
   } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Frontier local runtime initialization failed: ${message}`);
   }
  },
 );
}