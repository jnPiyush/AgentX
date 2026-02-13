import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

const BRANCH = 'master';
const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;

/** Essential directories and files to extract (everything else is skipped). */
const ESSENTIAL_DIRS = ['.agentx', '.github', '.vscode', 'scripts'];
const ESSENTIAL_FILES = ['AGENTS.md', 'Skills.md', '.gitignore'];

/**
 * Register the AgentX: Initialize Project command.
 * Downloads a zip archive, extracts only essential files, and copies framework files.
 */
export function registerInitializeCommand(
    context: vscode.ExtensionContext,
    agentx: AgentXContext
) {
    const cmd = vscode.commands.registerCommand('agentx.initialize', async () => {
        const root = agentx.workspaceRoot;
        if (!root) {
            vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
            return;
        }

        // Check if already initialized
        const initialized = await agentx.checkInitialized();
        if (initialized) {
            const overwrite = await vscode.window.showWarningMessage(
                'AgentX is already initialized in this workspace. Reinstall?',
                'Reinstall',
                'Cancel'
            );
            if (overwrite !== 'Reinstall') { return; }
        }

        // Pick mode
        const mode = await vscode.window.showQuickPick(
            [
                { label: 'github', description: 'Full features: GitHub Actions, PRs, Projects' },
                { label: 'local', description: 'Filesystem-based issue tracking, no GitHub required' },
            ],
            { placeHolder: 'Select operating mode', title: 'AgentX Mode' }
        );
        if (!mode) { return; }

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
                    if (!archiveRoot) { throw new Error('Archive extraction failed — no root directory found.'); }
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

                    // Clean up raw download
                    fs.rmSync(rawDir, { recursive: true, force: true });
                    fs.unlinkSync(zipFile);

                    progress.report({ message: 'Copying files...', increment: 30 });

                    // Copy files from tmp to workspace root
                    copyDirRecursive(tmpDir, root);

                    // Clean up tmp
                    fs.rmSync(tmpDir, { recursive: true, force: true });

                    // Local mode setup
                    if (mode.label === 'local') {
                        const configDir = path.join(root, '.agentx');
                        const configFile = path.join(configDir, 'config.json');
                        const configData = {
                            mode: 'local',
                            version: '5.1.0',
                            installedAt: new Date().toISOString(),
                        };
                        fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
                    }

                    progress.report({ message: 'Finalizing...', increment: 30 });

                    // Set context
                    vscode.commands.executeCommand('setContext', 'agentx.initialized', true);

                    vscode.window.showInformationMessage(
                        `AgentX initialized! Mode: ${mode.label}`
                    );

                    // Refresh tree views
                    vscode.commands.executeCommand('agentx.refresh');

                } catch (err: unknown) {
                    // Clean up on failure
                    for (const p of [tmpDir, rawDir]) {
                        if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); }
                    }
                    if (fs.existsSync(zipFile)) { fs.unlinkSync(zipFile); }

                    const message = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`AgentX initialization failed: ${message}`);
                }
            }
        );
    });

    context.subscriptions.push(cmd);
}

/** Recursively copy directory contents, merging into destination. */
function copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(src)) { return; }
    if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            // Don't overwrite existing files (merge mode)
            if (!fs.existsSync(destPath)) {
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
            const mod = reqUrl.startsWith('https') ? https : require('http');
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

/** Extract a zip file using VS Code's built-in utilities or shell fallback. */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
    fs.mkdirSync(destDir, { recursive: true });

    if (process.platform === 'win32') {
        // PowerShell Expand-Archive is available on all supported Windows versions
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
