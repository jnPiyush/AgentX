import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { InitWizardPanel } from '../views/initWizardPanel';
import { resolveWindowsShell } from '../utils/shell';
import { runCriticalPreCheck } from './setupWizard';

const BRANCH = 'master';
const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;

/** Essential directories and files to extract (everything else is skipped). */
const ESSENTIAL_DIRS = ['.agentx', '.github', '.vscode', 'scripts'];
const ESSENTIAL_FILES = ['AGENTS.md', 'Skills.md', '.gitignore'];

/**
 * Register the AgentX: Initialize Project command.
 * Opens a WebView wizard for guided setup, or falls back to the legacy
 * quick-pick flow when launched with `{ legacy: true }` argument.
 */
export function registerInitializeCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.initialize', async (opts?: { legacy?: boolean }) => {
 // Default: open the WebView wizard
 if (!opts?.legacy) {
 const folders = vscode.workspace.workspaceFolders;
 if (!folders || folders.length === 0) {
 vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
 return;
 }
 InitWizardPanel.createOrShow(context.extensionUri, agentx);
 return;
 }

 // ----------- Legacy quick-pick flow (kept for CLI / test usage) -----------
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
 folders.map(f => ({ label: f.name, description: f.uri.fsPath, folder: f })),
 { placeHolder: 'Select workspace folder to initialize AgentX in', title: 'AgentX - Target Folder' }
 );
 if (!pick) { return; }
 root = pick.folder.uri.fsPath;
 }
 if (!root) {
 vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
 return;
 }

 // Pre-flight: check all required dependencies and auto-install if missing
 const modeConfig = vscode.workspace.getConfiguration('agentx').get<string>('mode', 'local');
 const preCheck = await runCriticalPreCheck(modeConfig, /* blocking */ true);
 if (!preCheck.passed) {
 // User chose not to install or install is pending reload
 return;
 }

 // Check if already initialized for the selected target folder
 const initialized = fs.existsSync(path.join(root, '.agentx'))
  || fs.existsSync(path.join(root, 'AGENTS.md'));
 let isUpgrade = false;
 if (initialized) {
 const overwrite = await vscode.window.showWarningMessage(
 'AgentX is already initialized in this workspace. Reinstall?',
 'Reinstall',
 'Cancel'
 );
 if (overwrite !== 'Reinstall') { return; }
 isUpgrade = true;
 }

 // Pick mode (local is default)
 const mode = await vscode.window.showQuickPick(
 [
 { label: 'local', description: 'Filesystem-based issue tracking, no GitHub required (default)' },
 { label: 'github', description: 'Full features: GitHub Actions, PRs, Projects' },
 ],
 { placeHolder: 'Select operating mode (default: local)', title: 'AgentX Mode' }
 );
 if (!mode) { return; }

 // GitHub mode: ask for repo and project
 let repoSlug: string | undefined;
 let projectNum: number | undefined;

 if (mode.label === 'github') {
 // Try to auto-detect repo from git remote
 let detectedRepo: string | undefined;
 try {
 const { execShell: exec } = await import('../utils/shell');
 const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
 const remoteUrl = await exec('git remote get-url origin', root, shell);
 const match = remoteUrl.trim().match(/github\.com[:/]([^/]+\/[^/.]+)/);
 if (match) {
 detectedRepo = match[1].replace(/\.git$/, '');
 }
 } catch { /* no git remote */ }

 if (detectedRepo) {
 const useDetected = await vscode.window.showQuickPick(
 [
 { label: detectedRepo, description: 'Detected from git remote' },
 { label: 'Enter manually...', description: 'Type a different owner/repo' },
 ],
 { placeHolder: 'GitHub repository (owner/repo)', title: 'AgentX - GitHub Repo' }
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

 // Ask for project number
 const projectInput = await vscode.window.showInputBox({
 prompt: 'GitHub Project number (leave empty to skip)',
 placeHolder: '1',
 validateInput: (v) => {
 if (v && !/^\d+$/.test(v)) { return 'Must be a number'; }
 return undefined;
 },
 });
 if (projectInput) {
 projectNum = parseInt(projectInput, 10);
 }
 }

 // Save to settings
 const config = vscode.workspace.getConfiguration('agentx');
 await config.update('mode', mode.label, vscode.ConfigurationTarget.Workspace);

 // Run installation with progress
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

 // Clean previous attempts
 for (const p of [tmpDir, rawDir]) {
 if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); }
 }
 if (fs.existsSync(zipFile)) { fs.unlinkSync(zipFile); }

 // Download zip archive (no git required)
 await downloadFile(ARCHIVE_URL, zipFile);

 progress.report({ message: 'Extracting essential files...', increment: 20 });

 // Extract full archive to raw dir, then selectively copy
 await extractZip(zipFile, rawDir);

 // Find the extracted root (e.g. AgentX-master/)
 const entries = fs.readdirSync(rawDir, { withFileTypes: true });
 const archiveRoot = entries.find(e => e.isDirectory());
 if (!archiveRoot) { throw new Error('Archive extraction failed - no root directory found.'); }
 const extractedRoot = path.join(rawDir, archiveRoot.name);

 // Copy only essential paths
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
 fs.copyFileSync(src, path.join(tmpDir, file));
 }
 }

 // Clean up raw download (best-effort; finally block guarantees cleanup)
 try { fs.rmSync(rawDir, { recursive: true, force: true }); } catch { /* finally will retry */ }
 try { fs.unlinkSync(zipFile); } catch { /* finally will retry */ }

 progress.report({ message: 'Copying files...', increment: 30 });

 // Copy files from tmp to workspace root
 copyDirRecursive(tmpDir, root, isUpgrade);

 // Clean up tmp
 fs.rmSync(tmpDir, { recursive: true, force: true });

 progress.report({ message: 'Configuring runtime...', increment: 20 });

 // Create runtime directories
 const runtimeDirs = [
 '.agentx/state', '.agentx/digests',
 'docs/prd', 'docs/adr', 'docs/specs',
 'docs/ux', 'docs/reviews', 'docs/progress',
 ];
 if (mode.label === 'local') {
 runtimeDirs.push('.agentx/issues');
 }
 for (const dir of runtimeDirs) {
 fs.mkdirSync(path.join(root, dir), { recursive: true });
 }

 // Version tracking
 const versionFile = path.join(root, '.agentx', 'version.json');
 let previousInstalledAt: string | undefined;
 if (isUpgrade && fs.existsSync(versionFile)) {
 try {
 const prev = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
 previousInstalledAt = prev.installedAt;
 } catch { /* corrupt version file - reset */ }
 }
 fs.writeFileSync(versionFile, JSON.stringify({
 version: '6.5.3',
 mode: mode.label,
 installedAt: previousInstalledAt || new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 }, null, 2));

 // Agent status
 const statusFile = path.join(root, '.agentx', 'state', 'agent-status.json');
 if (!fs.existsSync(statusFile)) {
 const agentStatus: Record<string, unknown> = {};
 for (const agent of ['product-manager', 'ux-designer', 'architect', 'engineer', 'reviewer', 'devops-engineer']) {
 agentStatus[agent] = { status: 'idle', issue: null, lastActivity: null };
 }
 fs.writeFileSync(statusFile, JSON.stringify(agentStatus, null, 2));
 }

 // Mode config
 const configDir = path.join(root, '.agentx');
 const configFile = path.join(configDir, 'config.json');
 if (mode.label === 'local') {
 fs.writeFileSync(configFile, JSON.stringify({
 mode: 'local',
 nextIssueNumber: 1,
 created: new Date().toISOString(),
 }, null, 2));
 } else {
 fs.writeFileSync(configFile, JSON.stringify({
 mode: 'github',
 repo: repoSlug || null,
 project: projectNum || null,
 created: new Date().toISOString(),
 }, null, 2));
 }

 progress.report({ message: 'Setting up git...', increment: 10 });

 // Merge AgentX entries into the user's .gitignore
 mergeGitignore(root);

 // Auto-init git + hooks (non-destructive, both modes)
 try {
 const { execShell: exec } = await import('../utils/shell');
 const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
 if (!fs.existsSync(path.join(root, '.git'))) {
 await exec('git init --quiet', root, shell);
 }
 // Install hooks
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

 // Invalidate cached root so auto-discovery picks up the new location
 agentx.invalidateCache();

 // Set context
 vscode.commands.executeCommand('setContext', 'agentx.initialized', true);

 vscode.window.showInformationMessage(
 `AgentX initialized! Mode: ${mode.label}`
 );

 // Refresh tree views
 vscode.commands.executeCommand('agentx.refresh');

 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`AgentX initialization failed: ${message}`);
 } finally {
 // Guaranteed cleanup - runs on success, error, or cancellation
 for (const p of [tmpDir, rawDir]) {
 try { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); } } catch { /* ignore */ }
 }
 try { if (fs.existsSync(zipFile)) { fs.unlinkSync(zipFile); } } catch { /* ignore */ }
 }
 }
 );
 });

 context.subscriptions.push(cmd);
}

/**
 * Recursively copy directory contents into dest.
 *
 * @param overwrite - When true, existing files are replaced with the source
 *   version (used during upgrade / reinstall so framework files get updated).
 *   When false (default), existing files are preserved so that user-customized
 *   files (e.g. custom agent definitions, workflow TOML files) survive a
 *   fresh install.
 */
function copyDirRecursive(src: string, dest: string, overwrite = false): void {
  if (!fs.existsSync(src)) { return; }
  if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, overwrite);
    } else {
      if (overwrite || !fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

/** Download a file via HTTPS, following redirects (GitHub returns 302). */
function downloadFile(url: string, dest: string): Promise<void> {
 return new Promise((resolve, reject) => {
 const file = fs.createWriteStream(dest);
 const request = (reqUrl: string, redirectCount = 0) => {
 if (redirectCount > 5) {
 reject(new Error('Too many redirects'));
 return;
 }
 const mod = reqUrl.startsWith('https') ? https : http;
 mod.get(reqUrl, (res: { statusCode?: number; headers: { location?: string }; pipe: (s: fs.WriteStream) => void; resume: () => void }) => {
 if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
 res.resume();
 request(res.headers.location, redirectCount + 1);
 return;
 }
 if (res.statusCode && res.statusCode !== 200) {
 reject(new Error(`Download failed with status ${res.statusCode}`));
 return;
 }
 res.pipe(file);
 file.on('finish', () => { file.close(); resolve(); });
 }).on('error', (err: Error) => {
 fs.unlink(dest, () => {}); // clean up partial file
 reject(err);
 });
 };
 request(url);
 });
}

/**
 * Merge AgentX-specific entries into the user's .gitignore.
 *
 * Non-destructive: reads the existing file, checks which AgentX entries are
 * already present, and appends only the missing ones under a clearly marked
 * section block. If no .gitignore exists, creates one with the AgentX block.
 */
function mergeGitignore(root: string): void {
  const MARKER_START = '# --- AgentX (auto-generated, do not edit this block) ---';
  const MARKER_END = '# --- /AgentX ---';

  const agentxEntries = [
    '# AgentX framework',
    '.agentx/',
    '.github/agents/',
    '.github/instructions/',
    '.github/prompts/',
    '.github/skills/',
    '.github/templates/',
    '.github/hooks/',
    '.github/scripts/',
    '.github/schemas/',
    '.github/ISSUE_TEMPLATE/',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/agent-delegation.md',
    '.github/agentx-security.yml',
    '.github/CODEOWNERS',
    '.github/copilot-instructions.md',
    'AGENTS.md',
    'Skills.md',
    'scripts/',
    'packs/',
  ];

  const gitignorePath = path.join(root, '.gitignore');

  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }

  // If our marker block already exists, replace it (handles upgrades)
  if (existing.includes(MARKER_START)) {
    const before = existing.substring(0, existing.indexOf(MARKER_START));
    const afterIdx = existing.indexOf(MARKER_END);
    const after = afterIdx >= 0
      ? existing.substring(afterIdx + MARKER_END.length)
      : '';
    const block = [MARKER_START, ...agentxEntries, MARKER_END].join('\n');
    fs.writeFileSync(gitignorePath, (before.trimEnd() + '\n\n' + block + after).trimStart(), 'utf-8');
    return;
  }

  // Append new block
  const block = '\n\n' + [MARKER_START, ...agentxEntries, MARKER_END].join('\n') + '\n';
  fs.writeFileSync(gitignorePath, existing.trimEnd() + block, 'utf-8');
}

/** Extract a zip file using VS Code's built-in utilities or shell fallback. */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
 fs.mkdirSync(destDir, { recursive: true });

 if (process.platform === 'win32') {
 // Use the best available PowerShell (pwsh > powershell.exe)
 const resolved = resolveWindowsShell();
 if (!resolved) {
 throw new Error(
 'PowerShell is not installed. Install PowerShell 7+ (pwsh) from '
 + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell '
 + 'or ensure Windows PowerShell (powershell.exe) is available.'
 );
 }
 const { execShell: exec } = await import('../utils/shell');
 await exec(
 `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
 path.dirname(zipPath),
 'pwsh'
 );
 } else {
 // unzip is available on macOS and most Linux distros
 const { execShell: exec } = await import('../utils/shell');
 await exec(
 `unzip -qo "${zipPath}" -d "${destDir}"`,
 path.dirname(zipPath),
 'bash'
 );
 }
}
