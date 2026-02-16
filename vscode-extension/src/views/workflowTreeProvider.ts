import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

/**
 * Tree data provider for the Workflows sidebar view.
 * Shows available TOML workflow templates.
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
 const root = this.agentx.workspaceRoot;
 if (!root) { return []; }

 const workflowsDir = path.join(root, '.agentx', 'workflows');
 if (!fs.existsSync(workflowsDir)) {
 return [new WorkflowItem('No workflows found', '', 'info')];
 }

 const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.toml'));
 if (files.length === 0) {
 return [new WorkflowItem('No workflows found', '', 'info')];
 }

 const icons: Record<string, string> = {
 feature: 'git-pull-request',
 epic: 'layers',
 story: 'note',
 bug: 'bug',
 spike: 'beaker',
 devops: 'server-process',
 docs: 'book',
 };

 return files.map(f => {
 const name = f.replace('.toml', '');
 const iconId = icons[name] || 'file';
 const filePath = path.join(workflowsDir, f);
 return new WorkflowItem(name, filePath, 'workflow', iconId);
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
