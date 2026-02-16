import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Tree data provider for the Ready Queue sidebar view.
 * Shows priority-sorted unblocked work items.
 */
export class ReadyQueueTreeProvider implements vscode.TreeDataProvider<ReadyItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<ReadyItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 private items: ReadyItem[] = [];

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
 this.items = [];
 this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: ReadyItem): vscode.TreeItem {
 return element;
 }

 async getChildren(): Promise<ReadyItem[]> {
 const initialized = await this.agentx.checkInitialized();
 if (!initialized) {
 return [new ReadyItem('AgentX not initialized', '', 'info')];
 }

 if (this.items.length > 0) {
 return this.items;
 }

 try {
 const output = await this.agentx.runCli('ready');
 if (!output || output.includes('No ')) {
 return [new ReadyItem('No unblocked work', '', 'info')];
 }

 // Parse CLI output lines into tree items
 const lines = output.split('\n').filter(l => l.trim());
 this.items = lines.map(line => {
 const issueMatch = line.match(/#(\d+)/);
 const issueNum = issueMatch ? issueMatch[1] : '';
 return new ReadyItem(line.trim(), issueNum, 'ready');
 });

 return this.items;
 } catch {
 return [new ReadyItem('Run "AgentX: Show Ready Queue" to load', '', 'info')];
 }
 }
}

class ReadyItem extends vscode.TreeItem {
 constructor(
 label: string,
 public readonly issueNumber: string,
 type: 'ready' | 'info'
 ) {
 super(label, vscode.TreeItemCollapsibleState.None);

 if (type === 'ready') {
 this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
 this.contextValue = 'readyItem';
 } else {
 this.iconPath = new vscode.ThemeIcon('info');
 this.contextValue = 'infoItem';
 }
 }
}
