import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentXContext } from '../agentxContext';
import { execShell } from '../utils/shell';
import { runCriticalPreCheck } from '../commands/setupWizard';

// -----------------------------------------------------------------------
// Types for WebView <-> Extension messaging
// -----------------------------------------------------------------------

/** Messages sent FROM the WebView TO the extension. */
interface WizardSubmitMessage {
  type: 'submit';
  mode: 'local' | 'github';
  workspaceFolder: string;
  repoSlug: string;
  projectNumber: string;
}

interface WizardCancelMessage {
  type: 'cancel';
}

interface WizardReadyMessage {
  type: 'ready';
}

type WizardIncomingMessage =
  | WizardSubmitMessage
  | WizardCancelMessage
  | WizardReadyMessage;

/** Messages sent FROM the extension TO the WebView. */
interface WizardInitDataMessage {
  type: 'initData';
  workspaceFolders: Array<{ name: string; path: string }>;
  detectedRepo: string | null;
  alreadyInitialized: boolean;
}

interface WizardProgressMessage {
  type: 'progress';
  step: string;
  percent: number;
}

interface WizardCompleteMessage {
  type: 'complete';
  success: boolean;
  message: string;
  mode: string;
}

type WizardOutgoingMessage =
  | WizardInitDataMessage
  | WizardProgressMessage
  | WizardCompleteMessage;

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

const BRANCH = 'master';
const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;
const ESSENTIAL_DIRS = ['.agentx', '.github', '.vscode', 'scripts'];
const ESSENTIAL_FILES = ['AGENTS.md', 'Skills.md', '.gitignore'];

// -----------------------------------------------------------------------
// Panel Manager (singleton per session)
// -----------------------------------------------------------------------

export class InitWizardPanel {
  public static currentPanel: InitWizardPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _agentx: AgentXContext;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Show the wizard panel (creates or reveals existing).
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    agentx: AgentXContext,
  ): void {
    const column = vscode.ViewColumn.One;

    if (InitWizardPanel.currentPanel) {
      InitWizardPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'agentxInitWizard',
      'AgentX - Initialize Project',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
      },
    );

    InitWizardPanel.currentPanel = new InitWizardPanel(panel, extensionUri, agentx);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    agentx: AgentXContext,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._agentx = agentx;

    // Set HTML content
    this._panel.webview.html = this._getHtml(this._panel.webview);

    // Set panel icon
    this._panel.iconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'icon.png');

    // Handle messages from WebView
    this._panel.webview.onDidReceiveMessage(
      (msg: WizardIncomingMessage) => this._onMessage(msg),
      null,
      this._disposables,
    );

    // Cleanup on dispose
    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  // -------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------

  private async _onMessage(msg: WizardIncomingMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this._sendInitData();
        break;
      case 'cancel':
        this._panel.dispose();
        break;
      case 'submit':
        await this._runInstall(msg);
        break;
    }
  }

  /** Gather workspace info and push it to the WebView. */
  private async _sendInitData(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const workspaceFolders = folders.map(f => ({
      name: f.name,
      path: f.uri.fsPath,
    }));

    // Try to detect repo from git remote
    let detectedRepo: string | null = null;
    const root = folders[0]?.uri.fsPath;
    if (root) {
      try {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const remoteUrl = await execShell('git remote get-url origin', root, shell);
        const match = remoteUrl.trim().match(/github\.com[:/]([^/]+\/[^/.]+)/);
        if (match) {
          detectedRepo = match[1].replace(/\.git$/, '');
        }
      } catch { /* no git remote */ }
    }

    const alreadyInitialized = await this._agentx.checkInitialized();

    const data: WizardInitDataMessage = {
      type: 'initData',
      workspaceFolders,
      detectedRepo,
      alreadyInitialized,
    };
    this._postMessage(data);
  }

  /** Run the full installation process, reporting progress to the WebView. */
  private async _runInstall(msg: WizardSubmitMessage): Promise<void> {
    const root = msg.workspaceFolder;

    if (!root || !fs.existsSync(root)) {
      this._postMessage({
        type: 'complete',
        success: false,
        message: 'Workspace folder not found.',
        mode: msg.mode,
      });
      return;
    }

    // Pre-flight: check all required dependencies and auto-install if missing
    this._postMessage({ type: 'progress', step: 'Checking dependencies...', percent: 2 });
    const preCheck = await runCriticalPreCheck(msg.mode, /* blocking */ true);
    if (!preCheck.passed) {
      this._postMessage({
        type: 'complete',
        success: false,
        message: 'Required dependencies are missing. Install them and try again.',
        mode: msg.mode,
      });
      return;
    }

    const tmpDir = path.join(root, '.agentx-install-tmp');
    const rawDir = path.join(root, '.agentx-install-raw');
    const zipFile = path.join(root, '.agentx-install.zip');
    const isUpgrade = await this._agentx.checkInitialized();

    try {
      // Step 1: Download
      this._postMessage({ type: 'progress', step: 'Downloading AgentX...', percent: 10 });
      for (const p of [tmpDir, rawDir]) {
        if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); }
      }
      if (fs.existsSync(zipFile)) { fs.unlinkSync(zipFile); }
      await downloadFile(ARCHIVE_URL, zipFile);

      // Step 2: Extract
      this._postMessage({ type: 'progress', step: 'Extracting essential files...', percent: 30 });
      await extractZip(zipFile, rawDir);
      const entries = fs.readdirSync(rawDir, { withFileTypes: true });
      const archiveRoot = entries.find(e => e.isDirectory());
      if (!archiveRoot) { throw new Error('Archive extraction failed - no root directory found.'); }
      const extractedRoot = path.join(rawDir, archiveRoot.name);

      // Step 3: Copy essentials
      this._postMessage({ type: 'progress', step: 'Copying framework files...', percent: 50 });
      fs.mkdirSync(tmpDir, { recursive: true });
      for (const dir of ESSENTIAL_DIRS) {
        const src = path.join(extractedRoot, dir);
        if (fs.existsSync(src)) { copyDirRecursive(src, path.join(tmpDir, dir)); }
      }
      for (const file of ESSENTIAL_FILES) {
        const src = path.join(extractedRoot, file);
        if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(tmpDir, file)); }
      }
      try { fs.rmSync(rawDir, { recursive: true, force: true }); } catch { /* cleanup */ }
      try { fs.unlinkSync(zipFile); } catch { /* cleanup */ }
      copyDirRecursive(tmpDir, root, isUpgrade);
      fs.rmSync(tmpDir, { recursive: true, force: true });

      // Step 4: Configure runtime
      this._postMessage({ type: 'progress', step: 'Configuring runtime...', percent: 70 });
      const runtimeDirs = [
        '.agentx/state', '.agentx/digests',
        'docs/prd', 'docs/adr', 'docs/specs',
        'docs/ux', 'docs/reviews', 'docs/progress',
      ];
      if (msg.mode === 'local') { runtimeDirs.push('.agentx/issues'); }
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
        version: '6.5.1',
        mode: msg.mode,
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
      if (msg.mode === 'local') {
        fs.writeFileSync(configFile, JSON.stringify({
          mode: 'local',
          nextIssueNumber: 1,
          created: new Date().toISOString(),
        }, null, 2));
      } else {
        fs.writeFileSync(configFile, JSON.stringify({
          mode: 'github',
          repo: msg.repoSlug || null,
          project: msg.projectNumber ? parseInt(msg.projectNumber, 10) : null,
          created: new Date().toISOString(),
        }, null, 2));
      }

      // Step 5: Git setup
      this._postMessage({ type: 'progress', step: 'Setting up git hooks...', percent: 85 });
      try {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        if (!fs.existsSync(path.join(root, '.git'))) {
          await execShell('git init --quiet', root, shell);
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
      } catch { /* Git not available - skip silently */ }

      // Step 6: Finalize
      this._postMessage({ type: 'progress', step: 'Finalizing...', percent: 95 });

      // Save mode to workspace settings
      const config = vscode.workspace.getConfiguration('agentx');
      await config.update('mode', msg.mode, vscode.ConfigurationTarget.Workspace);

      // Invalidate cached root
      this._agentx.invalidateCache();
      vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
      vscode.commands.executeCommand('agentx.refresh');

      // Done!
      this._postMessage({
        type: 'complete',
        success: true,
        message: `AgentX initialized successfully in ${msg.mode} mode!`,
        mode: msg.mode,
      });

      vscode.window.showInformationMessage(`AgentX initialized! Mode: ${msg.mode}`);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this._postMessage({
        type: 'complete',
        success: false,
        message: `Installation failed: ${message}`,
        mode: msg.mode,
      });
    } finally {
      for (const p of [tmpDir, rawDir]) {
        try { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); } } catch { /* ignore */ }
      }
      try { if (fs.existsSync(zipFile)) { fs.unlinkSync(zipFile); } } catch { /* ignore */ }
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private _postMessage(msg: WizardOutgoingMessage): void {
    this._panel.webview.postMessage(msg);
  }

  private _dispose(): void {
    InitWizardPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) { d.dispose(); }
    this._disposables = [];
  }

  // -------------------------------------------------------------------
  // WebView HTML
  // -------------------------------------------------------------------

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>AgentX - Initialize Project</title>
  <style nonce="${nonce}">
    /* ---- Reset & base ---- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
      overflow-x: hidden;
    }

    /* ---- Layout ---- */
    .wizard {
      max-width: 620px;
      margin: 0 auto;
      padding: 32px 24px 40px;
    }

    /* ---- Header ---- */
    .wizard-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .wizard-header h1 {
      font-size: 22px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 6px;
    }
    .wizard-header p {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    /* ---- Stepper ---- */
    .stepper {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0;
      margin-bottom: 32px;
    }
    .step-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .step-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      border: 2px solid var(--vscode-input-border, #3c3c3c);
      color: var(--vscode-descriptionForeground);
      background: transparent;
      transition: all 0.2s ease;
    }
    .step-dot.active {
      border-color: var(--vscode-focusBorder, #007acc);
      color: var(--vscode-focusBorder, #007acc);
      background: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 12%, transparent);
    }
    .step-dot.done {
      border-color: var(--vscode-testing-iconPassed, #73c991);
      color: var(--vscode-editor-background);
      background: var(--vscode-testing-iconPassed, #73c991);
    }
    .step-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .step-label.active { color: var(--vscode-foreground); font-weight: 600; }
    .step-connector {
      width: 40px;
      height: 2px;
      background: var(--vscode-input-border, #3c3c3c);
      margin: 0 8px;
      transition: background 0.2s ease;
    }
    .step-connector.done {
      background: var(--vscode-testing-iconPassed, #73c991);
    }

    /* ---- Steps ---- */
    .step-content { display: none; }
    .step-content.visible { display: block; animation: fadeIn 0.2s ease; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ---- Cards (mode selection) ---- */
    .card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .mode-card {
      border: 2px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 8px;
      padding: 20px 16px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
      background: var(--vscode-input-background, #1e1e1e);
    }
    .mode-card:hover {
      border-color: var(--vscode-focusBorder, #007acc);
      background: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 6%, var(--vscode-input-background, #1e1e1e));
    }
    .mode-card.selected {
      border-color: var(--vscode-focusBorder, #007acc);
      background: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 12%, var(--vscode-input-background, #1e1e1e));
    }
    .mode-card .card-icon {
      font-size: 28px;
      margin-bottom: 10px;
      display: block;
    }
    .mode-card .card-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .mode-card .card-desc {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    /* ---- Badge ---- */
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-top: 8px;
    }
    .badge-default {
      background: color-mix(in srgb, var(--vscode-testing-iconPassed, #73c991) 18%, transparent);
      color: var(--vscode-testing-iconPassed, #73c991);
    }
    .badge-pro {
      background: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 18%, transparent);
      color: var(--vscode-focusBorder, #007acc);
    }

    /* ---- Form elements ---- */
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--vscode-foreground);
    }
    .form-group .hint {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    input[type="text"], input[type="number"], select {
      width: 100%;
      padding: 8px 12px;
      font-size: 13px;
      font-family: inherit;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    input:focus, select:focus {
      border-color: var(--vscode-focusBorder, #007acc);
    }
    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    /* Detected repo pill */
    .detected-repo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      background: color-mix(in srgb, var(--vscode-testing-iconPassed, #73c991) 12%, transparent);
      color: var(--vscode-testing-iconPassed, #73c991);
      margin-bottom: 8px;
    }

    /* ---- Warning banner ---- */
    .warning-banner {
      display: none;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 20px;
      background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 30%, transparent);
      color: var(--vscode-editorWarning-foreground, #cca700);
    }
    .warning-banner.show { display: block; }

    /* ---- Workspace selector ---- */
    .workspace-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.15s ease;
      background: var(--vscode-input-background, #1e1e1e);
    }
    .workspace-option:hover {
      border-color: var(--vscode-focusBorder, #007acc);
    }
    .workspace-option.selected {
      border-color: var(--vscode-focusBorder, #007acc);
      background: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 8%, var(--vscode-input-background, #1e1e1e));
    }
    .workspace-option .ws-radio {
      width: 16px; height: 16px;
      border-radius: 50%;
      border: 2px solid var(--vscode-input-border, #3c3c3c);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .workspace-option.selected .ws-radio {
      border-color: var(--vscode-focusBorder, #007acc);
    }
    .workspace-option.selected .ws-radio::after {
      content: '';
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--vscode-focusBorder, #007acc);
    }
    .ws-name { font-weight: 600; font-size: 13px; }
    .ws-path { font-size: 11px; color: var(--vscode-descriptionForeground); }

    /* ---- Buttons ---- */
    .btn-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 28px;
      gap: 12px;
    }
    .btn {
      padding: 8px 20px;
      font-size: 13px;
      font-family: inherit;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .btn-ghost {
      background: transparent;
      color: var(--vscode-descriptionForeground);
    }
    .btn-ghost:hover { color: var(--vscode-foreground); }

    /* ---- Progress / Install view ---- */
    .install-view {
      display: none;
      text-align: center;
      padding: 40px 0;
    }
    .install-view.visible { display: block; }

    .progress-ring {
      width: 80px; height: 80px;
      margin: 0 auto 20px;
      position: relative;
    }
    .progress-ring svg {
      transform: rotate(-90deg);
      width: 80px; height: 80px;
    }
    .progress-ring circle {
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
    }
    .progress-ring .track {
      stroke: var(--vscode-input-border, #3c3c3c);
    }
    .progress-ring .fill {
      stroke: var(--vscode-focusBorder, #007acc);
      stroke-dasharray: 226;
      stroke-dashoffset: 226;
      transition: stroke-dashoffset 0.4s ease;
    }
    .progress-percent {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 16px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .progress-step {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    /* ---- Success / Error ---- */
    .result-view {
      display: none;
      text-align: center;
      padding: 40px 0;
    }
    .result-view.visible { display: block; }
    .result-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .result-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .result-desc {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
      line-height: 1.5;
    }

    /* Summary table */
    .summary-table {
      text-align: left;
      margin: 16px auto;
      max-width: 360px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid var(--vscode-input-border, #3c3c3c);
      font-size: 13px;
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-key { color: var(--vscode-descriptionForeground); }
    .summary-val { font-weight: 600; }

    /* ---- GitHub section toggle ---- */
    .github-fields {
      display: none;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-input-border, #3c3c3c);
    }
    .github-fields.show { display: block; animation: fadeIn 0.2s ease; }

    /* ---- Visually hidden ---- */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      border: 0;
    }
  </style>
</head>
<body>
  <div class="wizard" id="wizardRoot">

    <!-- Header -->
    <div class="wizard-header">
      <h1>Initialize AgentX</h1>
      <p>Set up multi-agent orchestration for your project</p>
    </div>

    <!-- Stepper -->
    <div class="stepper" id="stepper">
      <div class="step-indicator">
        <div class="step-dot active" data-step="1">1</div>
        <span class="step-label active" data-step="1">Mode</span>
      </div>
      <div class="step-connector" data-after="1"></div>
      <div class="step-indicator">
        <div class="step-dot" data-step="2">2</div>
        <span class="step-label" data-step="2">Configure</span>
      </div>
      <div class="step-connector" data-after="2"></div>
      <div class="step-indicator">
        <div class="step-dot" data-step="3">3</div>
        <span class="step-label" data-step="3">Confirm</span>
      </div>
    </div>

    <!-- Warning: already initialized -->
    <div class="warning-banner" id="reinitWarning">
      AgentX is already initialized in this workspace. Continuing will reinstall
      framework files (your custom files are preserved).
    </div>

    <!-- Step 1: Mode Selection -->
    <div class="step-content visible" id="step1">
      <div class="card-grid">
        <div class="mode-card selected" data-mode="local" tabindex="0" role="radio" aria-checked="true">
          <span class="card-icon" aria-hidden="true">&#128193;</span>
          <div class="card-title">Local Mode</div>
          <div class="card-desc">
            Filesystem-based issue tracking.<br>No GitHub required.
          </div>
          <span class="badge badge-default">Default</span>
        </div>
        <div class="mode-card" data-mode="github" tabindex="0" role="radio" aria-checked="false">
          <span class="card-icon" aria-hidden="true">&#9729;</span>
          <div class="card-title">GitHub Mode</div>
          <div class="card-desc">
            Full integration with GitHub<br>Actions, PRs, and Projects.
          </div>
          <span class="badge badge-pro">Full</span>
        </div>
      </div>

      <!-- Workspace folder (shown only if multiple) -->
      <div id="workspacePicker" style="display:none;">
        <div class="form-group">
          <label>Workspace Folder</label>
          <div class="hint">Select which folder to initialize AgentX in</div>
          <div id="workspaceList"></div>
        </div>
      </div>
    </div>

    <!-- Step 2: Configure -->
    <div class="step-content" id="step2">
      <!-- Local mode: nothing extra needed -->
      <div id="localConfig">
        <p style="text-align:center; color:var(--vscode-descriptionForeground); padding: 24px 0;">
          Local mode requires no additional configuration.<br>
          You can switch to GitHub mode later by changing the
          <code>agentx.mode</code> setting.
        </p>
      </div>

      <!-- GitHub mode: repo + project -->
      <div class="github-fields" id="githubConfig">
        <div class="form-group">
          <label for="repoInput">GitHub Repository</label>
          <div class="hint">Format: owner/repo</div>
          <div id="detectedRepoBadge" class="detected-repo" style="display:none;">
            <span>Detected:</span> <strong id="detectedRepoName"></strong>
          </div>
          <input type="text" id="repoInput" placeholder="myorg/myproject" autocomplete="off" spellcheck="false">
        </div>
        <div class="form-group">
          <label for="projectInput">Project Number <span style="font-weight:normal; color:var(--vscode-descriptionForeground);">(optional)</span></label>
          <div class="hint">GitHub Projects V2 board number for status tracking</div>
          <input type="text" id="projectInput" placeholder="1" autocomplete="off" inputmode="numeric" pattern="[0-9]*">
        </div>
      </div>
    </div>

    <!-- Step 3: Confirm -->
    <div class="step-content" id="step3">
      <div class="summary-table" id="summaryTable">
        <div class="summary-row">
          <span class="summary-key">Mode</span>
          <span class="summary-val" id="sumMode">local</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Workspace</span>
          <span class="summary-val" id="sumWorkspace">-</span>
        </div>
        <div class="summary-row" id="sumRepoRow" style="display:none;">
          <span class="summary-key">Repository</span>
          <span class="summary-val" id="sumRepo">-</span>
        </div>
        <div class="summary-row" id="sumProjectRow" style="display:none;">
          <span class="summary-key">Project #</span>
          <span class="summary-val" id="sumProject">-</span>
        </div>
      </div>
      <p style="text-align:center; font-size:12px; color:var(--vscode-descriptionForeground); margin-top:12px;">
        This will download and install AgentX framework files into your workspace.<br>
        Existing customized files will not be overwritten.
      </p>
    </div>

    <!-- Navigation -->
    <div class="btn-row" id="navRow">
      <button class="btn btn-ghost" id="btnCancel">Cancel</button>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary" id="btnBack" style="display:none;">Back</button>
        <button class="btn btn-primary" id="btnNext">Next</button>
      </div>
    </div>
  </div>

  <!-- Install Progress -->
  <div class="install-view" id="installView">
    <div class="wizard-header">
      <h1>Installing AgentX</h1>
    </div>
    <div class="progress-ring">
      <svg viewBox="0 0 80 80">
        <circle class="track" cx="40" cy="40" r="36"></circle>
        <circle class="fill" id="progressCircle" cx="40" cy="40" r="36"></circle>
      </svg>
      <span class="progress-percent" id="progressPercent">0%</span>
    </div>
    <div class="progress-step" id="progressStep">Preparing...</div>
  </div>

  <!-- Result -->
  <div class="result-view" id="resultView">
    <div class="result-icon" id="resultIcon"></div>
    <div class="result-title" id="resultTitle"></div>
    <div class="result-desc" id="resultDesc"></div>
    <button class="btn btn-primary" id="btnClose">Close</button>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();

      // ----- State -----
      let currentStep = 1;
      const totalSteps = 3;
      let selectedMode = 'local';
      let selectedWorkspace = '';
      let detectedRepo = null;
      let workspaceFolders = [];
      let alreadyInitialized = false;

      // ----- DOM refs -----
      const $steps = [
        document.getElementById('step1'),
        document.getElementById('step2'),
        document.getElementById('step3'),
      ];
      const $btnNext = document.getElementById('btnNext');
      const $btnBack = document.getElementById('btnBack');
      const $btnCancel = document.getElementById('btnCancel');
      const $btnClose = document.getElementById('btnClose');
      const $wizardRoot = document.getElementById('wizardRoot');
      const $installView = document.getElementById('installView');
      const $resultView = document.getElementById('resultView');
      const $reinitWarning = document.getElementById('reinitWarning');
      const $progressCircle = document.getElementById('progressCircle');
      const $progressPercent = document.getElementById('progressPercent');
      const $progressStep = document.getElementById('progressStep');

      // ----- Stepper update -----
      function updateStepper() {
        document.querySelectorAll('.step-dot').forEach(dot => {
          const s = parseInt(dot.getAttribute('data-step'));
          dot.classList.toggle('active', s === currentStep);
          dot.classList.toggle('done', s < currentStep);
          dot.textContent = s < currentStep ? '\\u2713' : String(s);
        });
        document.querySelectorAll('.step-label').forEach(lbl => {
          const s = parseInt(lbl.getAttribute('data-step'));
          lbl.classList.toggle('active', s === currentStep);
        });
        document.querySelectorAll('.step-connector').forEach(conn => {
          const after = parseInt(conn.getAttribute('data-after'));
          conn.classList.toggle('done', after < currentStep);
        });
      }

      // ----- Show step -----
      function showStep(n) {
        currentStep = n;
        $steps.forEach((el, i) => {
          el.classList.toggle('visible', i === n - 1);
        });
        $btnBack.style.display = n > 1 ? '' : 'none';
        $btnNext.textContent = n === totalSteps ? 'Install' : 'Next';
        updateStepper();

        // Update step 2 visibility
        if (n === 2) {
          const $localCfg = document.getElementById('localConfig');
          const $githubCfg = document.getElementById('githubConfig');
          if (selectedMode === 'github') {
            $localCfg.style.display = 'none';
            $githubCfg.classList.add('show');
          } else {
            $localCfg.style.display = '';
            $githubCfg.classList.remove('show');
          }
        }

        // Update summary on step 3
        if (n === 3) {
          document.getElementById('sumMode').textContent = selectedMode;
          const wsFolder = workspaceFolders.find(f => f.path === selectedWorkspace);
          document.getElementById('sumWorkspace').textContent = wsFolder ? wsFolder.name : selectedWorkspace;
          const repoVal = document.getElementById('repoInput').value.trim();
          const projVal = document.getElementById('projectInput').value.trim();
          if (selectedMode === 'github') {
            document.getElementById('sumRepoRow').style.display = '';
            document.getElementById('sumRepo').textContent = repoVal || '(not set)';
            if (projVal) {
              document.getElementById('sumProjectRow').style.display = '';
              document.getElementById('sumProject').textContent = projVal;
            } else {
              document.getElementById('sumProjectRow').style.display = 'none';
            }
          } else {
            document.getElementById('sumRepoRow').style.display = 'none';
            document.getElementById('sumProjectRow').style.display = 'none';
          }
        }
      }

      // ----- Mode cards -----
      document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
          document.querySelectorAll('.mode-card').forEach(c => {
            c.classList.remove('selected');
            c.setAttribute('aria-checked', 'false');
          });
          card.classList.add('selected');
          card.setAttribute('aria-checked', 'true');
          selectedMode = card.getAttribute('data-mode');
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });

      // ----- Navigation -----
      $btnNext.addEventListener('click', () => {
        if (currentStep < totalSteps) {
          showStep(currentStep + 1);
        } else {
          startInstall();
        }
      });
      $btnBack.addEventListener('click', () => {
        if (currentStep > 1) { showStep(currentStep - 1); }
      });
      $btnCancel.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
      });
      $btnClose.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
      });

      // ----- Install -----
      function startInstall() {
        $wizardRoot.style.display = 'none';
        $installView.classList.add('visible');

        vscode.postMessage({
          type: 'submit',
          mode: selectedMode,
          workspaceFolder: selectedWorkspace,
          repoSlug: document.getElementById('repoInput').value.trim(),
          projectNumber: document.getElementById('projectInput').value.trim(),
        });
      }

      function setProgress(percent, step) {
        const circumference = 2 * Math.PI * 36; // ~226
        const offset = circumference - (percent / 100) * circumference;
        $progressCircle.style.strokeDashoffset = offset;
        $progressPercent.textContent = percent + '%';
        $progressStep.textContent = step;
      }

      function showResult(success, title, desc) {
        $installView.classList.remove('visible');
        $resultView.classList.add('visible');
        document.getElementById('resultIcon').textContent = success ? '\\u2713' : '!';
        document.getElementById('resultIcon').style.color = success
          ? 'var(--vscode-testing-iconPassed, #73c991)'
          : 'var(--vscode-errorForeground, #f44747)';
        document.getElementById('resultTitle').textContent = title;
        document.getElementById('resultDesc').textContent = desc;
      }

      // ----- Messages from extension -----
      window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.type) {
          case 'initData':
            workspaceFolders = msg.workspaceFolders;
            detectedRepo = msg.detectedRepo;
            alreadyInitialized = msg.alreadyInitialized;

            // Default to first workspace
            if (workspaceFolders.length > 0) {
              selectedWorkspace = workspaceFolders[0].path;
            }

            // Show workspace picker if multiple
            if (workspaceFolders.length > 1) {
              document.getElementById('workspacePicker').style.display = '';
              const $list = document.getElementById('workspaceList');
              $list.innerHTML = '';
              workspaceFolders.forEach((ws, i) => {
                const opt = document.createElement('div');
                opt.className = 'workspace-option' + (i === 0 ? ' selected' : '');
                opt.setAttribute('tabindex', '0');
                opt.setAttribute('role', 'radio');
                opt.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
                opt.innerHTML =
                  '<div class="ws-radio"></div>' +
                  '<div><div class="ws-name">' + escHtml(ws.name) + '</div>' +
                  '<div class="ws-path">' + escHtml(ws.path) + '</div></div>';
                opt.addEventListener('click', () => {
                  document.querySelectorAll('.workspace-option').forEach(o => {
                    o.classList.remove('selected');
                    o.setAttribute('aria-checked', 'false');
                  });
                  opt.classList.add('selected');
                  opt.setAttribute('aria-checked', 'true');
                  selectedWorkspace = ws.path;
                });
                $list.appendChild(opt);
              });
            }

            // Pre-fill detected repo
            if (detectedRepo) {
              document.getElementById('repoInput').value = detectedRepo;
              document.getElementById('detectedRepoBadge').style.display = '';
              document.getElementById('detectedRepoName').textContent = detectedRepo;
            }

            // Show reinstall warning
            if (alreadyInitialized) {
              $reinitWarning.classList.add('show');
            }
            break;

          case 'progress':
            setProgress(msg.percent, msg.step);
            break;

          case 'complete':
            if (msg.success) {
              showResult(true, 'Success!', msg.message);
            } else {
              showResult(false, 'Installation Failed', msg.message);
            }
            break;
        }
      });

      // ----- Helpers -----
      function escHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
      }

      // ----- Init -----
      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
  }
}

// -----------------------------------------------------------------------
// Utility functions (shared with initialize.ts)
// -----------------------------------------------------------------------

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

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

/** Download a file via HTTPS, following redirects. */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const https = require('https') as typeof import('https');
    const http = require('http') as typeof import('http');
    const fileStream = fs.createWriteStream(dest);
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
        res.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(); });
      }).on('error', (err: Error) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

/** Extract a zip file using platform tools. */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    await execShell(
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      path.dirname(zipPath),
      'pwsh',
    );
  } else {
    await execShell(
      `unzip -qo "${zipPath}" -d "${destDir}"`,
      path.dirname(zipPath),
      'bash',
    );
  }
}
