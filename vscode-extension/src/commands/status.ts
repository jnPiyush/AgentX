import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Register the AgentX: Show Agent Status command.
 * Displays a summary of all agents, their models, and current state.
 */
export function registerStatusCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.showStatus', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized. Run "AgentX: Initialize Project" first.');
 return;
 }

 try {
 // Try CLI state command first
 const output = await agentx.runCli('state');
 const panel = vscode.window.createWebviewPanel(
 'agentxStatus',
 'AgentX - Agent Status',
 vscode.ViewColumn.One,
 { enableScripts: false }
 );
 panel.webview.html = buildStatusHtml(output);
 } catch {
 // Fallback: list agents from definitions
 const agents = await agentx.listAgents();
 if (agents.length === 0) {
 vscode.window.showInformationMessage('No agents found.');
 return;
 }

 const panel = vscode.window.createWebviewPanel(
 'agentxStatus',
 'AgentX - Agent Status',
 vscode.ViewColumn.One,
 { enableScripts: false }
 );
 panel.webview.html = buildAgentListHtml(agents);
 }
 });

 context.subscriptions.push(cmd);
}

function buildStatusHtml(cliOutput: string): string {
 const lines = cliOutput.split('\n').map(l => escapeHtml(l)).join('<br/>');
 return `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <style>
 body { font-family: var(--vscode-font-family, 'Segoe UI', sans-serif); padding: 16px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
 h1 { font-size: 1.4em; margin-bottom: 16px; }
 pre { font-family: var(--vscode-editor-font-family, monospace); font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
 </style>
</head>
<body>
 <h1> AgentX - Agent Status</h1>
 <pre>${lines}</pre>
</body>
</html>`;
}

function buildAgentListHtml(agents: { name: string; model: string; maturity: string; mode: string }[]): string {
 const icons: Record<string, string> = {
 'Agent X (Auto)': '',
 'Product Manager': '',
 'UX Designer': '',
 'Architect': '',
 'Engineer': '',
 'Reviewer': '',
 'Reviewer (Auto-Fix)': '',
 'DevOps Engineer': '',
 };

 const rows = agents.map(a => {
 const icon = icons[a.name] || '';
 const badge = a.maturity === 'stable'
 ? '<span style="color:#22c55e;">(*) stable</span>'
 : '<span style="color:#f59e0b;">(*) preview</span>';
 return `<tr>
 <td>${icon} <strong>${escapeHtml(a.name)}</strong></td>
 <td>${escapeHtml(a.model)}</td>
 <td>${badge}</td>
 <td>${escapeHtml(a.mode)}</td>
 </tr>`;
 }).join('\n');

 return `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <style>
 body { font-family: var(--vscode-font-family, 'Segoe UI', sans-serif); padding: 16px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
 h1 { font-size: 1.4em; margin-bottom: 16px; }
 table { border-collapse: collapse; width: 100%; }
 th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
 th { opacity: 0.7; font-size: 0.85em; text-transform: uppercase; }
 </style>
</head>
<body>
 <h1> AgentX - Agents (${agents.length})</h1>
 <table>
 <thead><tr><th>Agent</th><th>Model</th><th>Maturity</th><th>Mode</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
 return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
