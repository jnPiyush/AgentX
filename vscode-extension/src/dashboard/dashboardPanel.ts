// ---------------------------------------------------------------------------
// AgentX -- Dashboard: Webview Panel
// ---------------------------------------------------------------------------
//
// VS Code Webview panel that displays the AgentX dashboard.
// Uses a self-contained HTML page with inline CSS/JS -- no React or
// external build tools required.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 6.
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import { DashboardDataProvider } from './dashboardDataProvider';
import { type DashboardData } from './dashboardTypes';

// ---------------------------------------------------------------------------
// DashboardPanel
// ---------------------------------------------------------------------------

/**
 * Manages the AgentX Dashboard Webview panel lifecycle.
 * Singleton -- only one dashboard can be open at a time.
 */
export class DashboardPanel {
  public static readonly viewType = 'agentx.dashboard';
  private static currentPanel: DashboardPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly dataProvider: DashboardDataProvider;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    dataProvider: DashboardDataProvider,
    autoRefreshMs: number,
  ) {
    this.panel = panel;
    this.dataProvider = dataProvider;

    // Set the initial HTML
    void this.refresh();

    // Auto-refresh
    if (autoRefreshMs > 0) {
      this.refreshTimer = setInterval(() => void this.refresh(), autoRefreshMs);
    }

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (msg: { command: string }) => {
        if (msg.command === 'refresh') {
          await this.refresh();
        }
      },
      undefined,
      this.disposables,
    );

    // Dispose resources on close
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  /**
   * Create or reveal the dashboard panel.
   */
  static createOrShow(
    agentxDir: string,
    memoryDir: string,
    autoRefreshMs?: number,
  ): DashboardPanel {
    const column = vscode.ViewColumn.Two;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'AgentX Dashboard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const dataProvider = new DashboardDataProvider(agentxDir, memoryDir);
    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      dataProvider,
      autoRefreshMs ?? 30_000,
    );

    return DashboardPanel.currentPanel;
  }

  // -----------------------------------------------------------------------
  // Refresh
  // -----------------------------------------------------------------------

  private async refresh(): Promise<void> {
    try {
      const data = await this.dataProvider.getData();
      this.panel.webview.html = generateDashboardHtml(data);
    } catch {
      // Silently fail -- dashboard is non-critical
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  private dispose(): void {
    DashboardPanel.currentPanel = undefined;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function generateDashboardHtml(data: DashboardData): string {
  const agentRows = data.agentStates
    .map((a) => {
      const stateClass = a.state === 'working' ? 'state-working'
        : a.state === 'blocked' ? 'state-blocked'
        : a.state === 'error' ? 'state-error'
        : 'state-idle';
      return `<tr>
        <td>${escapeHtml(a.agent)}</td>
        <td><span class="badge ${stateClass}">${escapeHtml(a.state)}</span></td>
        <td>${a.issueNumber ? `#${a.issueNumber}` : '-'}</td>
        <td>${escapeHtml(timeSince(a.since))}</td>
      </tr>`;
    })
    .join('\n');

  const queueRows = data.readyQueue
    .slice(0, 15)
    .map((q) => `<tr>
      <td>#${q.issueNumber}</td>
      <td>${escapeHtml(q.title)}</td>
      <td><span class="badge badge-type">${escapeHtml(q.type)}</span></td>
      <td>${escapeHtml(q.priority)}</td>
      <td>${escapeHtml(q.status)}</td>
    </tr>`)
    .join('\n');

  const sessionRows = data.recentSessions
    .slice(-5)
    .reverse()
    .map((s) => `<tr>
      <td>${escapeHtml(s.id)}</td>
      <td>${s.issueNumber ? `#${s.issueNumber}` : '-'}</td>
      <td>${escapeHtml(s.summaryPreview ?? '')}</td>
    </tr>`)
    .join('\n');

  const workflowRows = data.activeWorkflows
    .map((w) => {
      const progress = Math.round((w.currentStep / w.totalSteps) * 100);
      return `<tr>
        <td>#${w.issueNumber}</td>
        <td>${escapeHtml(w.workflowType)}</td>
        <td>${escapeHtml(w.agent)}</td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          <span class="progress-text">${w.currentStep}/${w.totalSteps}</span>
        </td>
        <td><span class="badge ${w.status === 'blocked' ? 'state-blocked' : 'state-working'}">${escapeHtml(w.status)}</span></td>
      </tr>`;
    })
    .join('\n');

  const healthStatus = data.healthReport?.overallStatus ?? 'unknown';
  const healthClass = healthStatus === 'healthy' ? 'health-ok'
    : healthStatus === 'degraded' ? 'health-warn'
    : 'health-error';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentX Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --border: var(--vscode-panel-border, #333);
      --accent: var(--vscode-textLink-foreground, #3794ff);
      --card-bg: var(--vscode-editorWidget-background, #252526);
      --success: #4caf50;
      --warning: #ff9800;
      --error: #f44336;
      --info: #2196f3;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      padding: 16px;
    }

    h1 {
      font-size: 1.4em;
      margin-bottom: 4px;
      color: var(--accent);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .health-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
    }

    .health-ok { background: var(--success); color: #fff; }
    .health-warn { background: var(--warning); color: #000; }
    .health-error { background: var(--error); color: #fff; }

    .timestamp { color: #888; font-size: 0.85em; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
    }

    .card-full { grid-column: 1 / -1; }

    .card h2 {
      font-size: 1em;
      margin-bottom: 8px;
      color: var(--accent);
    }

    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid var(--border);
      font-size: 0.9em;
    }
    th { color: #888; font-weight: 600; }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.8em;
      font-weight: 600;
    }

    .state-idle { background: #555; color: #ccc; }
    .state-working { background: var(--info); color: #fff; }
    .state-blocked { background: var(--warning); color: #000; }
    .state-error { background: var(--error); color: #fff; }
    .badge-type { background: #363; color: #9f9; }

    .progress-bar {
      display: inline-block;
      width: 80px;
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
      vertical-align: middle;
    }

    .progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 4px;
    }

    .progress-text {
      font-size: 0.8em;
      margin-left: 4px;
      color: #888;
    }

    .btn-refresh {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }

    .btn-refresh:hover { opacity: 0.8; }

    .empty-state {
      color: #666;
      font-style: italic;
      padding: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>AgentX Dashboard</h1>
      <span class="timestamp">Last updated: ${escapeHtml(formatTime(data.lastUpdated))}</span>
    </div>
    <div class="header-right">
      <span class="health-badge ${healthClass}">${escapeHtml(healthStatus.toUpperCase())}</span>
      <button class="btn-refresh" onclick="refresh()">Refresh</button>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Agent States</h2>
      ${agentRows
        ? `<table>
            <thead><tr><th>Agent</th><th>State</th><th>Issue</th><th>Since</th></tr></thead>
            <tbody>${agentRows}</tbody>
          </table>`
        : '<div class="empty-state">No agent states recorded</div>'}
    </div>

    <div class="card">
      <h2>Active Workflows</h2>
      ${workflowRows
        ? `<table>
            <thead><tr><th>Issue</th><th>Type</th><th>Agent</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>${workflowRows}</tbody>
          </table>`
        : '<div class="empty-state">No active workflows</div>'}
    </div>

    <div class="card card-full">
      <h2>Ready Queue</h2>
      ${queueRows
        ? `<table>
            <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>${queueRows}</tbody>
          </table>`
        : '<div class="empty-state">No items in ready queue</div>'}
    </div>

    <div class="card card-full">
      <h2>Recent Sessions</h2>
      ${sessionRows
        ? `<table>
            <thead><tr><th>ID</th><th>Issue</th><th>Description</th></tr></thead>
            <tbody>${sessionRows}</tbody>
          </table>`
        : '<div class="empty-state">No sessions recorded</div>'}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function refresh() { vscode.postMessage({ command: 'refresh' }); }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function timeSince(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) { return 'just now'; }
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) { return 'just now'; }
    if (minutes < 60) { return `${minutes}m ago`; }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) { return `${hours}h ago`; }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'unknown';
  }
}
