import * as vscode from 'vscode';
import { AgentXContext, AgentDefinition } from '../agentxContext';

/**
 * Tree data provider for the Agents sidebar view.
 * Shows all agent definitions with their model, maturity, and status.
 */
export class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
 this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: AgentTreeItem): vscode.TreeItem {
 return element;
 }

 async getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]> {
 if (element) {
 // Child items: show details
 return element.children || [];
 }

 const initialized = await this.agentx.checkInitialized();
 if (!initialized) {
 return [];
 }

 const agents = await this.agentx.listAgents();
 return agents.map(a => this.createAgentItem(a));
 }

 private createAgentItem(agent: AgentDefinition): AgentTreeItem {
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
 const icon = icons[agent.name] || '';

 const item = new AgentTreeItem(
 `${icon} ${agent.name}`,
 vscode.TreeItemCollapsibleState.Collapsed,
 agent
 );

 item.tooltip = agent.description;
 item.contextValue = 'agent';

 // Children with details
 item.children = [
 new AgentTreeItem(`Model: ${agent.model}`, vscode.TreeItemCollapsibleState.None),
 new AgentTreeItem(`Maturity: ${agent.maturity}`, vscode.TreeItemCollapsibleState.None),
 new AgentTreeItem(`Mode: ${agent.mode}`, vscode.TreeItemCollapsibleState.None),
 ];

 return item;
 }
}

export class AgentTreeItem extends vscode.TreeItem {
 children?: AgentTreeItem[];

 constructor(
 public readonly label: string,
 public readonly collapsibleState: vscode.TreeItemCollapsibleState,
 public readonly agent?: AgentDefinition
 ) {
 super(label, collapsibleState);
 }
}
