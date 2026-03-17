import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  ARCHIVE_URL,
  copyDirRecursive,
  downloadFile,
  ESSENTIAL_DIRS,
  ESSENTIAL_FILES,
  extractZip,
  mergeGitignore,
  promptWorkspaceRoot,
  readJsonWithComments,
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
   const tmpDir = path.join(root, '.agentx-install-tmp');
   const rawDir = path.join(root, '.agentx-install-raw');
   const zipFile = path.join(root, '.agentx-install.zip');

   try {
    progress.report({ message: 'Downloading AgentX...' });

    for (const currentPath of [tmpDir, rawDir]) {
     if (fs.existsSync(currentPath)) {
      fs.rmSync(currentPath, { recursive: true, force: true });
     }
    }
    if (fs.existsSync(zipFile)) {
     fs.unlinkSync(zipFile);
    }

    await downloadFile(ARCHIVE_URL, zipFile);

    progress.report({ message: 'Extracting essential files...', increment: 20 });
    await extractZip(zipFile, rawDir);

    const entries = fs.readdirSync(rawDir, { withFileTypes: true });
    const archiveRoot = entries.find((entry) => entry.isDirectory());
    if (!archiveRoot) {
      throw new Error('Archive extraction failed - no root directory found.');
    }
    const extractedRoot = path.join(rawDir, archiveRoot.name);

    fs.mkdirSync(tmpDir, { recursive: true });
    for (const dir of ESSENTIAL_DIRS) {
     const src = path.join(extractedRoot, dir);
     if (fs.existsSync(src)) {
      copyDirRecursive(src, path.join(tmpDir, dir));
     }
    }
    for (const file of ESSENTIAL_FILES) {
     const src = path.join(extractedRoot, file);
     if (fs.existsSync(src)) {
      const destFile = path.join(tmpDir, file);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(src, destFile);
     }
    }

    try {
     fs.rmSync(rawDir, { recursive: true, force: true });
    } catch {
     // finally will retry
    }
    try {
     fs.unlinkSync(zipFile);
    } catch {
     // finally will retry
    }

    progress.report({ message: 'Copying files...', increment: 30 });
    copyDirRecursive(tmpDir, root, isUpgrade);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    progress.report({ message: 'Configuring runtime...', increment: 20 });
    const runtimeDirs = [
     '.agentx/state', '.agentx/digests',
     'docs/artifacts/prd', 'docs/artifacts/adr', 'docs/artifacts/specs',
     'docs/ux', 'docs/artifacts/reviews', 'docs/execution/plans', 'docs/execution/progress',
     'docs/architecture',
     'memories', 'memories/session',
    ];
    for (const dir of runtimeDirs) {
     fs.mkdirSync(path.join(root, dir), { recursive: true });
    }

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

    progress.report({ message: 'Setting up git...', increment: 10 });
    mergeGitignore(root);

    try {
     const { execShell: exec } = await import('../utils/shell');
     const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
     if (!fs.existsSync(path.join(root, '.git'))) {
      await exec('git init --quiet', root, shell);
     }
     const hooksDir = path.join(root, '.git', 'hooks');
     for (const hook of ['pre-commit', 'commit-msg']) {
      const hookSrc = path.join(root, '.github', 'hooks', hook);
      const hookDest = path.join(hooksDir, hook);
      if (fs.existsSync(hookSrc)) {
       fs.copyFileSync(hookSrc, hookDest);
       if (process.platform !== 'win32') {
        try { fs.chmodSync(hookDest, 0o755); } catch { /* best-effort */ }
       }
      }
     }
     const preCommitPs1 = path.join(root, '.github', 'hooks', 'pre-commit.ps1');
     if (fs.existsSync(preCommitPs1)) {
      fs.copyFileSync(preCommitPs1, path.join(hooksDir, 'pre-commit.ps1'));
     }
    } catch {
     // Git not available - skip silently
    }

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
   } finally {
    for (const currentPath of [tmpDir, rawDir]) {
     try {
      if (fs.existsSync(currentPath)) {
       fs.rmSync(currentPath, { recursive: true, force: true });
      }
     } catch {
      // ignore cleanup failures
     }
    }
    try {
     if (fs.existsSync(zipFile)) {
      fs.unlinkSync(zipFile);
     }
    } catch {
      // ignore cleanup failures
    }
   }
  },
 );
}