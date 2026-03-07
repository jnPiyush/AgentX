import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentXContext, AgentDefinition } from '../agentxContext';

/**
 * Tree data provider for the Agents sidebar view.
 * Shows all agent definitions with their model and handoffs.
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

 // Always show agents (bundled in extension), even without workspace init
  const agents = await this.agentx.listVisibleAgents();
 if (agents.length === 0) { return []; }
 return agents.map(a => this.createAgentItem(a));
 }

 private createAgentItem(agent: AgentDefinition): AgentTreeItem {
 const label = agent.name || agent.fileName.replace('.agent.md', '');
 const item = new AgentTreeItem(
 label,
 vscode.TreeItemCollapsibleState.Collapsed,
 agent
 );

 // Build full file path for click-to-open (workspace first, then bundled; check internal/ too)
 if (agent.fileName) {
  const root = this.agentx.workspaceRoot;
  const wsPath = root ? path.join(root, '.github', 'agents', agent.fileName) : '';
  const wsInternalPath = root ? path.join(root, '.github', 'agents', 'internal', agent.fileName) : '';
  const bundledPath = path.join(this.agentx.extensionContext.extensionPath, '.github', 'agentx', 'agents', agent.fileName);
  const bundledInternalPath = path.join(this.agentx.extensionContext.extensionPath, '.github', 'agentx', 'agents', 'internal', agent.fileName);
  const filePath = (wsPath && fs.existsSync(wsPath)) ? wsPath
  : (wsInternalPath && fs.existsSync(wsInternalPath)) ? wsInternalPath
  : fs.existsSync(bundledPath) ? bundledPath
  : bundledInternalPath;
  item.command = {
  command: 'vscode.open',
  title: 'Open Agent Definition',
  arguments: [vscode.Uri.file(filePath)],
  };
 }

 item.tooltip = agent.description;
 item.contextValue = 'agent';
 item.iconPath = new vscode.ThemeIcon('circle-outline');

 // Children with details
 const children: AgentTreeItem[] = [];

 // Description
 if (agent.description) {
 children.push(AgentTreeItem.detail('info', agent.description));
 }

 // Model
 if (agent.model) {
 children.push(AgentTreeItem.detail('symbol-method', `Model: ${agent.model}`));
 }

 // Constraints
 if (agent.constraints && agent.constraints.length > 0) {
 const constraintGroup = new AgentTreeItem(
  `Constraints (${agent.constraints.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 constraintGroup.iconPath = new vscode.ThemeIcon('shield');
 constraintGroup.children = agent.constraints.map(c => AgentTreeItem.detail('circle-small', c));
 children.push(constraintGroup);
 }

 // Boundaries
 if (agent.boundaries) {
 const boundaryGroup = new AgentTreeItem(
  'Boundaries',
  vscode.TreeItemCollapsibleState.Collapsed
 );
 boundaryGroup.iconPath = new vscode.ThemeIcon('lock');
 const bChildren: AgentTreeItem[] = [];
 if (agent.boundaries.canModify.length > 0) {
  const canMod = new AgentTreeItem(`Can modify (${agent.boundaries.canModify.length})`, vscode.TreeItemCollapsibleState.Collapsed);
  canMod.iconPath = new vscode.ThemeIcon('check');
  canMod.children = agent.boundaries.canModify.map(p => AgentTreeItem.detail('file', p));
  bChildren.push(canMod);
 }
 if (agent.boundaries.cannotModify.length > 0) {
  const cannotMod = new AgentTreeItem(`Cannot modify (${agent.boundaries.cannotModify.length})`, vscode.TreeItemCollapsibleState.Collapsed);
  cannotMod.iconPath = new vscode.ThemeIcon('close');
  cannotMod.children = agent.boundaries.cannotModify.map(p => AgentTreeItem.detail('file', p));
  bChildren.push(cannotMod);
 }
 boundaryGroup.children = bChildren;
 children.push(boundaryGroup);
 }

 // Agents (delegation scope)
 if (agent.agents && agent.agents.length > 0) {
 const agentsGroup = new AgentTreeItem(
  `Delegates to (${agent.agents.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 agentsGroup.iconPath = new vscode.ThemeIcon('organization');
 agentsGroup.children = agent.agents.map(a => AgentTreeItem.detail('person', a));
 children.push(agentsGroup);
 }

 // Handoffs
 if (agent.handoffs && agent.handoffs.length > 0) {
 const handoffGroup = new AgentTreeItem(
  `Handoffs (${agent.handoffs.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 handoffGroup.iconPath = new vscode.ThemeIcon('arrow-right');
 handoffGroup.children = agent.handoffs.map(h =>
  AgentTreeItem.detail('arrow-right', `${h.label} -> ${h.agent}`)
 );
 children.push(handoffGroup);
 }

 // Tools
 if (agent.tools && agent.tools.length > 0) {
 const toolGroup = new AgentTreeItem(
  `Tools (${agent.tools.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 toolGroup.iconPath = new vscode.ThemeIcon('tools');
 toolGroup.children = agent.tools.map(t => AgentTreeItem.detail('wrench', t));
 children.push(toolGroup);
 }

 item.children = children;

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

 /**
  * Create a non-collapsible detail child item with an icon.
  */
 static detail(iconId: string, text: string): AgentTreeItem {
 const item = new AgentTreeItem(text, vscode.TreeItemCollapsibleState.None);
 item.iconPath = new vscode.ThemeIcon(iconId);
 return item;
 }
}
