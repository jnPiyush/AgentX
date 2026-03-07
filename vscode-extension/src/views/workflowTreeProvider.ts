import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentXContext } from '../agentxContext';

/**
 * Tree data provider for the Workflows sidebar view.
 * Shows agent handoff chains derived from .agent.md frontmatter.
 */
export class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<WorkflowItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
 this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: WorkflowItem): vscode.TreeItem {
 return element;
 }

 async getChildren(): Promise<WorkflowItem[]> {
  const agents = await this.agentx.listVisibleAgents();
 if (agents.length === 0) {
 return [new WorkflowItem('No agents found', '', 'info')];
 }

 const icons: Record<string, string> = {
 'agent-x': 'hubot',
 'engineer': 'code',
 'architect': 'symbol-structure',
 'reviewer': 'eye',
 'reviewer-auto': 'eye',
 'product-manager': 'notebook',
 'ux-designer': 'paintcan',
 'devops': 'server-process',
 'data-scientist': 'graph',
 'tester': 'beaker',
 'customer-coach': 'comment-discussion',
 'powerbi-analyst': 'graph-line',
 'github-ops': 'github',
 'ado-ops': 'organization',
 'agile-coach': 'comment',
 };

 return agents.map(a => {
 const stem = a.fileName.replace('.agent.md', '');
 const displayName = a.name || stem;
 const iconId = icons[stem] || 'file';
 const root = this.agentx.workspaceRoot;
 const wsPath = root ? path.join(root, '.github', 'agents', a.fileName) : '';
 const wsInternalPath = root ? path.join(root, '.github', 'agents', 'internal', a.fileName) : '';
 const filePath = (wsPath && fs.existsSync(wsPath)) ? wsPath
  : (wsInternalPath && fs.existsSync(wsInternalPath)) ? wsInternalPath : wsPath;
 return new WorkflowItem(displayName, filePath, 'workflow', iconId);
 });
 }
}

class WorkflowItem extends vscode.TreeItem {
 constructor(
 label: string,
 filePath: string,
 type: 'workflow' | 'info',
 iconId?: string
 ) {
 super(label, vscode.TreeItemCollapsibleState.None);

 if (type === 'workflow') {
 this.iconPath = new vscode.ThemeIcon(iconId || 'file');
 this.contextValue = 'workflowItem';
 this.command = {
 command: 'vscode.open',
 title: 'Open Workflow',
 arguments: [vscode.Uri.file(filePath)],
 };
 this.tooltip = `Open ${label} workflow`;
 } else {
 this.iconPath = new vscode.ThemeIcon('info');
 }
 }
}
