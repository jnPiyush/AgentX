"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInitializeCommand = registerInitializeCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const initWizardPanel_1 = require("../views/initWizardPanel");
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
function registerInitializeCommand(context, agentx) {
    const cmd = vscode.commands.registerCommand('agentx.initialize', async (opts) => {
        // Default: open the WebView wizard
        if (!opts?.legacy) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
                return;
            }
            initWizardPanel_1.InitWizardPanel.createOrShow(context.extensionUri, agentx);
            return;
        }
        // ----------- Legacy quick-pick flow (kept for CLI / test usage) -----------
        let root;
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
            return;
        }
        if (folders.length === 1) {
            root = folders[0].uri.fsPath;
        }
        else {
            const pick = await vscode.window.showQuickPick(folders.map(f => ({ label: f.name, description: f.uri.fsPath, folder: f })), { placeHolder: 'Select workspace folder to initialize AgentX in', title: 'AgentX - Target Folder' });
            if (!pick) {
                return;
            }
            root = pick.folder.uri.fsPath;
        }
        if (!root) {
            vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
            return;
        }
        // Check if already initialized
        const initialized = await agentx.checkInitialized();
        if (initialized) {
            const overwrite = await vscode.window.showWarningMessage('AgentX is already initialized in this workspace. Reinstall?', 'Reinstall', 'Cancel');
            if (overwrite !== 'Reinstall') {
                return;
            }
        }
        // Pick mode (local is default)
        const mode = await vscode.window.showQuickPick([
            { label: 'local', description: 'Filesystem-based issue tracking, no GitHub required (default)' },
            { label: 'github', description: 'Full features: GitHub Actions, PRs, Projects' },
        ], { placeHolder: 'Select operating mode (default: local)', title: 'AgentX Mode' });
        if (!mode) {
            return;
        }
        // GitHub mode: ask for repo and project
        let repoSlug;
        let projectNum;
        if (mode.label === 'github') {
            // Try to auto-detect repo from git remote
            let detectedRepo;
            try {
                const { execShell: exec } = await Promise.resolve().then(() => __importStar(require('../utils/shell')));
                const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
                const remoteUrl = await exec('git remote get-url origin', root, shell);
                const match = remoteUrl.trim().match(/github\.com[:/]([^/]+\/[^/.]+)/);
                if (match) {
                    detectedRepo = match[1].replace(/\.git$/, '');
                }
            }
            catch { /* no git remote */ }
            if (detectedRepo) {
                const useDetected = await vscode.window.showQuickPick([
                    { label: detectedRepo, description: 'Detected from git remote' },
                    { label: 'Enter manually...', description: 'Type a different owner/repo' },
                ], { placeHolder: 'GitHub repository (owner/repo)', title: 'AgentX - GitHub Repo' });
                if (useDetected?.label === 'Enter manually...') {
                    repoSlug = await vscode.window.showInputBox({
                        prompt: 'GitHub repository (owner/repo)',
                        placeHolder: 'myorg/myproject',
                    });
                }
                else if (useDetected) {
                    repoSlug = useDetected.label;
                }
            }
            else {
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
                    if (v && !/^\d+$/.test(v)) {
                        return 'Must be a number';
                    }
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
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AgentX: Installing...',
            cancellable: false,
        }, async (progress) => {
            const tmpDir = path.join(root, '.agentx-install-tmp');
            const rawDir = path.join(root, '.agentx-install-raw');
            const zipFile = path.join(root, '.agentx-install.zip');
            try {
                progress.report({ message: 'Downloading AgentX...' });
                // Clean previous attempts
                for (const p of [tmpDir, rawDir]) {
                    if (fs.existsSync(p)) {
                        fs.rmSync(p, { recursive: true, force: true });
                    }
                }
                if (fs.existsSync(zipFile)) {
                    fs.unlinkSync(zipFile);
                }
                // Download zip archive (no git required)
                await downloadFile(ARCHIVE_URL, zipFile);
                progress.report({ message: 'Extracting essential files...', increment: 20 });
                // Extract full archive to raw dir, then selectively copy
                await extractZip(zipFile, rawDir);
                // Find the extracted root (e.g. AgentX-master/)
                const entries = fs.readdirSync(rawDir, { withFileTypes: true });
                const archiveRoot = entries.find(e => e.isDirectory());
                if (!archiveRoot) {
                    throw new Error('Archive extraction failed - no root directory found.');
                }
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
                try {
                    fs.rmSync(rawDir, { recursive: true, force: true });
                }
                catch { /* finally will retry */ }
                try {
                    fs.unlinkSync(zipFile);
                }
                catch { /* finally will retry */ }
                progress.report({ message: 'Copying files...', increment: 30 });
                // Copy files from tmp to workspace root
                copyDirRecursive(tmpDir, root);
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
                fs.writeFileSync(versionFile, JSON.stringify({
                    version: '5.3.0',
                    mode: mode.label,
                    installedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }, null, 2));
                // Agent status
                const statusFile = path.join(root, '.agentx', 'state', 'agent-status.json');
                if (!fs.existsSync(statusFile)) {
                    const agentStatus = {};
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
                }
                else {
                    fs.writeFileSync(configFile, JSON.stringify({
                        mode: 'github',
                        repo: repoSlug || null,
                        project: projectNum || null,
                        created: new Date().toISOString(),
                    }, null, 2));
                }
                progress.report({ message: 'Setting up git...', increment: 10 });
                // Auto-init git + hooks (non-destructive, both modes)
                try {
                    const { execShell: exec } = await Promise.resolve().then(() => __importStar(require('../utils/shell')));
                    const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
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
                }
                catch {
                    // Git not available - skip silently
                }
                progress.report({ message: 'Finalizing...', increment: 10 });
                // Invalidate cached root so auto-discovery picks up the new location
                agentx.invalidateCache();
                // Set context
                vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
                vscode.window.showInformationMessage(`AgentX initialized! Mode: ${mode.label}`);
                // Refresh tree views
                vscode.commands.executeCommand('agentx.refresh');
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`AgentX initialization failed: ${message}`);
            }
            finally {
                // Guaranteed cleanup - runs on success, error, or cancellation
                for (const p of [tmpDir, rawDir]) {
                    try {
                        if (fs.existsSync(p)) {
                            fs.rmSync(p, { recursive: true, force: true });
                        }
                    }
                    catch { /* ignore */ }
                }
                try {
                    if (fs.existsSync(zipFile)) {
                        fs.unlinkSync(zipFile);
                    }
                }
                catch { /* ignore */ }
            }
        });
    });
    context.subscriptions.push(cmd);
}
/**
 * Recursively copy directory contents into dest, merging without overwriting.
 * Existing files are intentionally preserved so that user-customized files
 * (e.g. AGENTS.md, agent definitions, workflow TOML files) survive a reinstall.
 * Only files that do not yet exist at the destination are copied.
 */
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        return;
    }
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else {
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
/** Download a file via HTTPS, following redirects (GitHub returns 302). */
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = (reqUrl, redirectCount = 0) => {
            if (redirectCount > 5) {
                reject(new Error('Too many redirects'));
                return;
            }
            const mod = reqUrl.startsWith('https') ? https : http;
            mod.get(reqUrl, (res) => {
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
            }).on('error', (err) => {
                fs.unlink(dest, () => { }); // clean up partial file
                reject(err);
            });
        };
        request(url);
    });
}
/** Extract a zip file using VS Code's built-in utilities or shell fallback. */
async function extractZip(zipPath, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    if (process.platform === 'win32') {
        // PowerShell Expand-Archive is available on all supported Windows versions
        const { execShell: exec } = await Promise.resolve().then(() => __importStar(require('../utils/shell')));
        await exec(`Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`, path.dirname(zipPath), 'pwsh');
    }
    else {
        // unzip is available on macOS and most Linux distros
        const { execShell: exec } = await Promise.resolve().then(() => __importStar(require('../utils/shell')));
        await exec(`unzip -qo "${zipPath}" -d "${destDir}"`, path.dirname(zipPath), 'bash');
    }
}
//# sourceMappingURL=initialize.js.map