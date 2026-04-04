import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { SidebarTreeItem } from './sidebarTreeItem';
import {
 buildIssueChildren,
 buildOverviewChildren,
 getLocalIssues,
 normalizeIssues,
} from './workTreeProviderInternals';

export class WorkTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
 private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SidebarTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

 constructor(private readonly agentx: AgentXContext) {}

 refresh(): void {
  this.onDidChangeTreeDataEmitter.fire();
 }

 getTreeItem(element: SidebarTreeItem): vscode.TreeItem {
  return element;
 }

 private async getOpenIssues(root: string) {
  try {
   const output = await this.agentx.runCli('issue', ['list', '--json']);
   return normalizeIssues(JSON.parse(output)).filter((issue) => (issue.state ?? 'open') !== 'closed');
  } catch {
   const localIssues = getLocalIssues(root);
   return localIssues.filter((issue) => (issue.state ?? 'open') !== 'closed');
  }
 }

 async getChildren(element?: SidebarTreeItem): Promise<SidebarTreeItem[]> {
  if (element) {
   return element.children ?? [];
  }

  const root = this.agentx.workspaceRoot;
  if (!root) {
   return [SidebarTreeItem.info('Open a workspace folder to see current work.')];
  }

  const pending = await this.agentx.getPendingClarification();
    const openIssues = await this.getOpenIssues(root);

  return [
   SidebarTreeItem.section('Overview', 'home', buildOverviewChildren(root, pending, openIssues.length)),
   SidebarTreeItem.section('Open issues', 'issues', buildIssueChildren(openIssues), String(openIssues.length)),
  ];
 }
}