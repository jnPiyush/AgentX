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
 const item = new AgentTreeItem(
 agent.name,
 vscode.TreeItemCollapsibleState.Collapsed,
 agent
 );

 item.tooltip = agent.description;
 item.contextValue = 'agent';

 // Icon driven by runtime status (clarifying / blocked-clarification / working / idle).
 item.iconPath = this.statusIcon(agent.runtimeStatus);

 // Children with details
 const children = [
 new AgentTreeItem(`Model: ${agent.model}`, vscode.TreeItemCollapsibleState.None),
 ];
 if (agent.modelFallback) {
 children.push(
  new AgentTreeItem(`Fallback: ${agent.modelFallback}`, vscode.TreeItemCollapsibleState.None),
 );
 }
 children.push(
 new AgentTreeItem(`Maturity: ${agent.maturity}`, vscode.TreeItemCollapsibleState.None),
 new AgentTreeItem(`Mode: ${agent.mode}`, vscode.TreeItemCollapsibleState.None),
 );
 item.children = children;

 return item;
 }

 /**
  * Returns a ThemeIcon that represents the agent's live runtime status.
  *
  * | runtimeStatus           | Icon               | Meaning                         |
  * |-------------------------|--------------------|---------------------------------|
  * | 'clarifying'            | sync~spin          | Waiting for a clarification     |
  * | 'blocked-clarification' | warning (yellow)   | Blocked on unresolved request   |
  * | 'working'               | loading~spin       | Normal active work              |
  * | 'idle' / undefined      | circle-outline     | No work in progress             |
  */
 private statusIcon(status?: string): vscode.ThemeIcon {
 switch (status) {
 case 'clarifying':
 return new vscode.ThemeIcon('sync~spin');
 case 'blocked-clarification':
 return new vscode.ThemeIcon(
 'warning',
 new vscode.ThemeColor('notificationsWarningIcon.foreground')
 );
 case 'working':
 return new vscode.ThemeIcon('loading~spin');
 default:
 return new vscode.ThemeIcon('circle-outline');
 }
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
