import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the AgentX: Open Dashboard command.
 *
 * Provides a single interactive webview that surfaces loop status, the
 * ready queue, agent states, recent learnings, and quick action buttons
 * that invoke common CLI commands without leaving the editor. Acts as a
 * lightweight portal so AgentX can be driven without typing CLI commands.
 */
export function registerDashboardCommand(
    context: vscode.ExtensionContext,
    agentx: AgentXContext
): void {
    const cmd = vscode.commands.registerCommand('agentx.openDashboard', async () => {
        if (!(await agentx.checkInitialized())) {
            vscode.window.showWarningMessage(
                'AgentX is not initialized. Run "AgentX: Initialize Local Runtime" first.'
            );
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'agentxDashboard',
            'AgentX - Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = buildDashboardHtml('Loading...', 'Loading...', 'Loading...', 'Loading...');

        const refresh = async () => {
            const [loop, ready, state, learnings] = await Promise.all([
                safeRunCli(agentx, 'loop', ['status']),
                safeRunCli(agentx, 'ready', []),
                safeRunCli(agentx, 'state', []),
                safeRunCli(agentx, 'learnings', ['list']),
            ]);
            panel.webview.html = buildDashboardHtml(loop, ready, state, learnings);
        };

        await refresh();

        panel.webview.onDidReceiveMessage(
            async (msg: { command?: string; args?: string[] }) => {
                if (!msg || !msg.command) {
                    return;
                }
                if (msg.command === 'refresh') {
                    await refresh();
                    return;
                }
                if (msg.command === 'run') {
                    const subcommand = (msg.args && msg.args[0]) || '';
                    const rest = (msg.args || []).slice(1);
                    if (!subcommand) {
                        return;
                    }
                    panel.webview.postMessage({ type: 'output', text: `> agentx ${subcommand} ${rest.join(' ')}\n` });
                    try {
                        const out = await agentx.runCli(subcommand, rest);
                        panel.webview.postMessage({ type: 'output', text: out + '\n' });
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        panel.webview.postMessage({ type: 'output', text: `[error] ${message}\n` });
                    }
                    await refresh();
                }
            },
            undefined,
            context.subscriptions
        );

        context.subscriptions.push(panel);
    });

    context.subscriptions.push(cmd);
}

async function safeRunCli(
    agentx: AgentXContext,
    subcommand: string,
    args: string[]
): Promise<string> {
    try {
        const out = await agentx.runCli(subcommand, args);
        return out && out.trim().length > 0 ? out : '(no output)';
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `(unavailable: ${message})`;
    }
}

function buildDashboardHtml(
    loopOut: string,
    readyOut: string,
    stateOut: string,
    learningsOut: string
): string {
    const loop = escapeHtml(loopOut);
    const ready = escapeHtml(readyOut);
    const state = escapeHtml(stateOut);
    const learnings = escapeHtml(learningsOut);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
:root { color-scheme: light dark; }
body {
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    padding: 16px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    margin: 0;
}
h1 { font-size: 1.4em; margin: 0 0 16px 0; }
h2 { font-size: 1.05em; margin: 0 0 8px 0; text-transform: uppercase; opacity: 0.75; letter-spacing: 0.5px; }
.grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 6px;
    padding: 12px 14px;
    background: var(--vscode-sideBar-background, transparent);
}
pre {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    margin: 0;
    max-height: 260px;
    overflow: auto;
}
.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
}
button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 4px;
    cursor: pointer;
}
button:hover { background: var(--vscode-button-hoverBackground); }
button.secondary {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #555);
}
#console {
    margin-top: 16px;
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 6px;
    padding: 12px;
    background: var(--vscode-terminal-background, #1e1e1e);
    color: var(--vscode-terminal-foreground, #d4d4d4);
}
#consoleOutput {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    max-height: 240px;
    overflow: auto;
    margin: 0;
}
.footer-note { margin-top: 12px; font-size: 11px; opacity: 0.6; }
</style>
</head>
<body>
<h1>AgentX Dashboard</h1>

<div class="actions">
    <button data-cmd="ready">Ready Queue</button>
    <button data-cmd="digest">Daily Digest</button>
    <button data-cmd="scan">Self-Scan</button>
    <button data-cmd="stocktake">Skill Stocktake</button>
    <button data-cmd="validate">Validate</button>
    <button data-cmd="tokens">Token Budget</button>
    <button data-cmd="diagnose">Diagnose</button>
    <button class="secondary" id="refreshBtn">Refresh</button>
</div>

<div class="grid">
    <div class="card">
        <h2>Loop Status</h2>
        <pre>${loop}</pre>
    </div>
    <div class="card">
        <h2>Ready Queue</h2>
        <pre>${ready}</pre>
    </div>
    <div class="card">
        <h2>Agent States</h2>
        <pre>${state}</pre>
    </div>
    <div class="card">
        <h2>Recent Learnings</h2>
        <pre>${learnings}</pre>
    </div>
</div>

<div id="console">
    <h2>Console</h2>
    <pre id="consoleOutput">Click an action above to run a CLI command. Output appears here.</pre>
</div>

<p class="footer-note">All actions invoke <code>agentx</code> CLI commands inside this workspace.</p>

<script>
const vscode = acquireVsCodeApi();
const out = document.getElementById('consoleOutput');

document.querySelectorAll('button[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (!cmd) { return; }
        vscode.postMessage({ command: 'run', args: [cmd] });
    });
});

document.getElementById('refreshBtn').addEventListener('click', () => {
    vscode.postMessage({ command: 'refresh' });
});

window.addEventListener('message', event => {
    const msg = event.data;
    if (msg && msg.type === 'output') {
        out.textContent += msg.text;
        out.scrollTop = out.scrollHeight;
    }
});
</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

