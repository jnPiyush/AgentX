import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
 ARCHIVE_URL,
 copyDirRecursive,
 downloadFile,
 extractZip,
} from './initializeInternals';

interface PluginManifest {
 readonly name?: string;
 readonly description?: string;
 readonly version?: string;
}

interface PluginPick extends vscode.QuickPickItem {
 readonly pluginDir: string;
}

function resolveWorkspaceRoot(): string | undefined {
 const folders = vscode.workspace.workspaceFolders;
 if (!folders || folders.length === 0) {
  return undefined;
 }

 return folders.length === 1 ? folders[0].uri.fsPath : undefined;
}

function loadPluginManifest(pluginDir: string): PluginManifest {
 const manifestPath = path.join(pluginDir, 'plugin.json');
 if (!fs.existsSync(manifestPath)) {
  return {};
 }

 try {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
 } catch {
  return {};
 }
}

function getPluginPicks(pluginsRoot: string): PluginPick[] {
  return fs.readdirSync(pluginsRoot, { withFileTypes: true })
   .filter((entry) => entry.isDirectory())
   .map((entry) => {
    const pluginDir = path.join(pluginsRoot, entry.name);
    const manifest = loadPluginManifest(pluginDir);
    const label = manifest.name ?? entry.name;
    const versionSuffix = manifest.version ? ` v${manifest.version}` : '';

    return {
     label,
     description: `${manifest.description ?? 'AgentX plugin'}${versionSuffix}`,
     pluginDir,
    } satisfies PluginPick;
   })
   .sort((left, right) => left.label.localeCompare(right.label));
}

export async function runAddPluginCommand(
 context: vscode.ExtensionContext,
 _agentx: AgentXContext,
): Promise<void> {
 const root = resolveWorkspaceRoot();
 if (!root) {
  vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
  return;
 }

 if (!fs.existsSync(path.join(root, '.agentx', 'config.json'))) {
  vscode.window.showWarningMessage(
   'AgentX plugins require an initialized workspace. Run "AgentX: Config Advance" first.',
  );
  return;
 }

 const tmpDir = path.join(root, '.agentx-plugin-install-tmp');
 const rawDir = path.join(root, '.agentx-plugin-install-raw');
 const zipFile = path.join(root, '.agentx-plugin-install.zip');

 try {
  for (const currentPath of [tmpDir, rawDir]) {
   if (fs.existsSync(currentPath)) {
    fs.rmSync(currentPath, { recursive: true, force: true });
   }
  }
  if (fs.existsSync(zipFile)) {
   fs.unlinkSync(zipFile);
  }

  await vscode.window.withProgress(
   {
    location: vscode.ProgressLocation.Notification,
    title: 'AgentX: Loading plugin catalog...',
    cancellable: false,
   },
   async (progress) => {
    progress.report({ message: 'Downloading plugin catalog...' });
    await downloadFile(ARCHIVE_URL, zipFile);
    progress.report({ message: 'Extracting plugin catalog...', increment: 40 });
    await extractZip(zipFile, rawDir);
   },
  );

  const entries = fs.readdirSync(rawDir, { withFileTypes: true });
  const archiveRoot = entries.find((entry) => entry.isDirectory());
  if (!archiveRoot) {
   throw new Error('Archive extraction failed - no root directory found.');
  }

  const pluginsRoot = path.join(rawDir, archiveRoot.name, '.agentx', 'plugins');
  if (!fs.existsSync(pluginsRoot)) {
   throw new Error('No AgentX plugins were found in the source archive.');
  }

  const picks = getPluginPicks(pluginsRoot);
  if (picks.length === 0) {
   throw new Error('No AgentX plugins are available to install.');
  }

  const pick = await vscode.window.showQuickPick(picks, {
   placeHolder: 'Select a plugin to install',
   title: 'AgentX - Add Plugin',
  });
  if (!pick) {
   return;
  }

  const pluginTarget = path.join(root, '.agentx', 'plugins', path.basename(pick.pluginDir));
  if (fs.existsSync(pluginTarget)) {
   const overwrite = await vscode.window.showWarningMessage(
    `AgentX plugin \"${pick.label}\" is already installed. Reinstall?`,
    'Reinstall',
    'Cancel',
   );
   if (overwrite !== 'Reinstall') {
    return;
   }
  }

  await vscode.window.withProgress(
   {
    location: vscode.ProgressLocation.Notification,
    title: 'AgentX: Installing plugin...',
    cancellable: false,
   },
   async (progress) => {
    progress.report({ message: `Installing ${pick.label}...` });
    fs.mkdirSync(path.dirname(pluginTarget), { recursive: true });
    copyDirRecursive(pick.pluginDir, pluginTarget, true);
   },
  );

  vscode.window.showInformationMessage(`AgentX plugin installed: ${pick.label}`);
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`AgentX plugin install failed: ${message}`);
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
  void context;
 }
}