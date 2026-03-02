import * as vscode from 'vscode';
import * as path from 'path';
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

 // Build full file path for click-to-open
 const root = this.agentx.workspaceRoot;
 if (root && agent.fileName) {
  const filePath = path.join(root, '.github', 'agents', agent.fileName);
  item.command = {
  command: 'vscode.open',
  title: 'Open Agent Definition',
  arguments: [vscode.Uri.file(filePath)],
  };
 }

 item.tooltip = agent.description;
 item.contextValue = 'agent';

 // Description shown inline after the label
 item.description = agent.maturity ? `(${agent.maturity})` : '';

 // Icon driven by runtime status (clarifying / blocked-clarification / working / idle).
 item.iconPath = this.statusIcon(agent.runtimeStatus);

 // Children with details
 const children: AgentTreeItem[] = [];

 // Description
 if (agent.description) {
 children.push(
  AgentTreeItem.detail('info', `${agent.description}`)
 );
 }

 // Model info
 children.push(AgentTreeItem.detail('symbol-method', `Model: ${agent.model}`));
 if (agent.modelFallback) {
 children.push(AgentTreeItem.detail('symbol-method', `Fallback: ${agent.modelFallback}`));
 }

 // Maturity & Mode
 children.push(AgentTreeItem.detail('verified', `Maturity: ${agent.maturity}`));
 children.push(AgentTreeItem.detail('gear', `Mode: ${agent.mode}`));

 // Constraints
 if (agent.constraints && agent.constraints.length > 0) {
 const constraintGroup = new AgentTreeItem(
  `Constraints (${agent.constraints.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 constraintGroup.iconPath = new vscode.ThemeIcon('shield');
 constraintGroup.children = agent.constraints.map(c => {
  const isPositive = c.startsWith('MUST') && !c.startsWith('MUST NOT');
  const icon = isPositive ? 'pass' : 'error';
  return AgentTreeItem.detail(icon, c);
 });
 children.push(constraintGroup);
 }

 // Boundaries - Can Modify
 if (agent.canModify && agent.canModify.length > 0) {
 const canGroup = new AgentTreeItem(
  `Can Modify (${agent.canModify.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 canGroup.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
 canGroup.children = agent.canModify.map(p => AgentTreeItem.detail('file-directory', p));
 children.push(canGroup);
 }

 // Boundaries - Cannot Modify
 if (agent.cannotModify && agent.cannotModify.length > 0) {
 const cannotGroup = new AgentTreeItem(
  `Cannot Modify (${agent.cannotModify.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 cannotGroup.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('errorForeground'));
 cannotGroup.children = agent.cannotModify.map(p => AgentTreeItem.detail('file-directory', p));
 children.push(cannotGroup);
 }

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

 /**
  * Create a non-collapsible detail child item with an icon.
  */
 static detail(iconId: string, text: string): AgentTreeItem {
 const item = new AgentTreeItem(text, vscode.TreeItemCollapsibleState.None);
 item.iconPath = new vscode.ThemeIcon(iconId);
 return item;
 }
}
