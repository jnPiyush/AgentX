import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { AgentTreeItem, createAgentTreeItem } from './agentTreeProviderInternals';

/**
 * Tree data provider for the Agents sidebar view.
 * Shows all agent definitions with their model and handoffs.
 */
export class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: FrontierContext) {}

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

 private createAgentItem(agent: Parameters<typeof createAgentTreeItem>[0]): AgentTreeItem {
  return createAgentTreeItem(agent, this.agentx);
 }
}

export { AgentTreeItem };
