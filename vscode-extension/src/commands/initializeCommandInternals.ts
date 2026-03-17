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
} from './initializeInternals';
import { runSilentInstall } from './setupWizard';

export async function runInitializeCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
 _opts?: { legacy?: boolean },
): Promise<void> {
 let root: string | undefined;
 const folders = vscode.workspace.workspaceFolders;
 if (!folders || folders.length === 0) {
  vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
  return;
 }
 if (folders.length === 1) {
  root = folders[0].uri.fsPath;
 } else {
  const pick = await vscode.window.showQuickPick(
   folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
   { placeHolder: 'Select workspace folder to initialize AgentX in', title: 'AgentX - Target Folder' },
  );
  if (!pick) {
   return;
  }
  root = pick.folder.uri.fsPath;
 }
 if (!root) {
  vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
  return;
 }

 const preCheck = await runSilentInstall(agentx);
 if (!preCheck.passed) {
  vscode.window.showWarningMessage(
   'AgentX: Some required dependencies could not be installed. Run "AgentX: Check Environment" for details.',
  );
  return;
 }

 const initialized = fs.existsSync(path.join(root, '.agentx', 'config.json'));
 let isUpgrade = false;
 if (initialized) {
  const overwrite = await vscode.window.showWarningMessage(
   'AgentX is already initialized in this workspace. Reinstall?',
   'Reinstall',
   'Cancel',
  );
  if (overwrite !== 'Reinstall') {
   return;
  }
  isUpgrade = true;
 }

 const mode = await vscode.window.showQuickPick(
  [
   { label: 'github', description: 'GitHub Actions, PRs, Projects (via MCP)' },
   { label: 'ado', description: 'Azure DevOps work items, boards, pipelines (via MCP)' },
  ],
  { placeHolder: 'Select integration to add', title: 'AgentX - Config Advance' },
 );
 if (!mode) {
  return;
 }

 let repoSlug: string | undefined;
 let projectNum: number | undefined;
 let adoOrg: string | undefined;
 let adoProject: string | undefined;

 if (mode.label === 'github') {
  let detectedRepo: string | undefined;
  try {
   const { execShell: exec } = await import('../utils/shell');
   const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
   const remoteUrl = await exec('git remote get-url origin', root, shell);
   const match = remoteUrl.trim().match(/github\.com[:/]([^/]+\/[^/.]+)/);
   if (match) {
    detectedRepo = match[1].replace(/\.git$/, '');
   }
  } catch {
   // No git remote available.
  }

  if (detectedRepo) {
   const useDetected = await vscode.window.showQuickPick(
    [
     { label: detectedRepo, description: 'Detected from git remote' },
     { label: 'Enter manually...', description: 'Type a different owner/repo' },
    ],
    { placeHolder: 'GitHub repository (owner/repo)', title: 'AgentX - GitHub Repo' },
   );
   if (useDetected?.label === 'Enter manually...') {
    repoSlug = await vscode.window.showInputBox({
     prompt: 'GitHub repository (owner/repo)',
     placeHolder: 'myorg/myproject',
    });
   } else if (useDetected) {
    repoSlug = useDetected.label;
   }
  } else {
   repoSlug = await vscode.window.showInputBox({
    prompt: 'GitHub repository (owner/repo)',
    placeHolder: 'myorg/myproject',
   });
  }

  const projectInput = await vscode.window.showInputBox({
   prompt: 'GitHub Project number (leave empty to skip)',
   placeHolder: '1',
   validateInput: (value) => {
    if (value && !/^\d+$/.test(value)) {
     return 'Must be a number';
    }
    return undefined;
   },
  });
  if (projectInput) {
   projectNum = parseInt(projectInput, 10);
  }
 }

 if (mode.label === 'ado') {
  adoOrg = await vscode.window.showInputBox({
   prompt: 'Azure DevOps organization name (e.g. myorg)',
   placeHolder: 'myorg',
  });
  adoProject = await vscode.window.showInputBox({
   prompt: 'Azure DevOps project name',
   placeHolder: 'MyProject',
  });
 }

 const vscodeDir = path.join(root, '.vscode');
 fs.mkdirSync(vscodeDir, { recursive: true });
 const mcpPath = path.join(vscodeDir, 'mcp.json');
 let mcpConfig: { servers?: Record<string, unknown> } = {};
 if (fs.existsSync(mcpPath)) {
  try {
   const raw = fs.readFileSync(mcpPath, 'utf-8');
   try {
    mcpConfig = JSON.parse(raw);
   } catch {
    let stripped = '';
    let inStr = false;
    let esc = false;
    for (let index = 0; index < raw.length; index++) {
     const char = raw[index];
     if (esc) {
      stripped += char;
      esc = false;
      continue;
     }
     if (inStr) {
      if (char === '\\') {
       esc = true;
      } else if (char === '"') {
       inStr = false;
      }
      stripped += char;
      continue;
     }
     if (char === '"') {
      inStr = true;
      stripped += char;
      continue;
     }
     if (char === '/' && raw[index + 1] === '/') {
      while (index < raw.length && raw[index] !== '\n') {
       index++;
      }
      continue;
     }
     if (char === '/' && raw[index + 1] === '*') {
      index += 2;
      while (index < raw.length && !(raw[index] === '*' && raw[index + 1] === '/')) {
       index++;
      }
      index++;
      continue;
     }
     stripped += char;
    }
    mcpConfig = JSON.parse(stripped);
   }
  } catch {
   // Start fresh on invalid config.
  }
 }
 if (!mcpConfig.servers) {
  mcpConfig.servers = {};
 }

 if (mode.label === 'github') {
  mcpConfig.servers.github = {
   type: 'http',
   url: 'https://api.githubcopilot.com/mcp/',
  };
 } else {
  mcpConfig.servers.ado = {
   type: 'http',
   url: 'https://api.githubcopilot.com/mcp/',
  };
 }

 fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));

 await vscode.window.withProgress(
  {
   location: vscode.ProgressLocation.Notification,
   title: 'AgentX: Installing...',
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
    let previousInstalledAt: string | undefined;
    if (isUpgrade && fs.existsSync(versionFile)) {
     try {
      const prev = JSON.parse(fs.readFileSync(versionFile, 'utf-8')) as { installedAt?: string };
      previousInstalledAt = prev.installedAt;
     } catch {
      // corrupt version file - reset
     }
    }
    const currentExtVersion = context.extension?.packageJSON?.version ?? '8.0.0';
    fs.writeFileSync(versionFile, JSON.stringify({
     version: currentExtVersion,
     integration: mode.label,
     installedAt: previousInstalledAt || new Date().toISOString(),
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

    const configDir = path.join(root, '.agentx');
    const configFile = path.join(configDir, 'config.json');
    if (mode.label === 'ado') {
     fs.writeFileSync(configFile, JSON.stringify({
      integration: 'ado',
      provider: 'ado',
      organization: adoOrg || null,
      project: adoProject || null,
      created: new Date().toISOString(),
     }, null, 2));
    } else {
     fs.writeFileSync(configFile, JSON.stringify({
      integration: 'github',
      provider: 'github',
      repo: repoSlug || null,
      project: projectNum || null,
      created: new Date().toISOString(),
     }, null, 2));
    }

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
      if (fs.existsSync(hookSrc)) {
       fs.copyFileSync(hookSrc, path.join(hooksDir, hook));
      }
     }
     const preCommitPs1 = path.join(root, '.github', 'hooks', 'pre-commit.ps1');
     if (fs.existsSync(preCommitPs1)) {
      fs.copyFileSync(preCommitPs1, path.join(hooksDir, 'pre-commit.ps1'));
     }
    } catch {
     // Git not available - skip silently
    }

    progress.report({ message: 'Finalizing...', increment: 10 });
    agentx.invalidateCache();

    vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
    vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
    vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

    vscode.window.showInformationMessage(
     `AgentX: ${mode.label === 'github' ? 'GitHub' : 'Azure DevOps'} integration added!`,
    );

    vscode.commands.executeCommand('agentx.refresh');
   } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`AgentX initialization failed: ${message}`);
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