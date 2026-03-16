import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { SidebarTreeItem } from './sidebarTreeItem';
import {
 buildActionChildren,
 buildIssueChildren,
 getLocalIssues,
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

 async getChildren(element?: SidebarTreeItem): Promise<SidebarTreeItem[]> {
  if (element) {
   return element.children ?? [];
  }

  const root = this.agentx.workspaceRoot;
  if (!root) {
   return [SidebarTreeItem.info('Open a workspace folder to see current work.')];
  }

  const localIssues = getLocalIssues(root);
  const openIssues = localIssues.filter((issue) => (issue.state ?? 'open') !== 'closed');

  const issueChildren = buildIssueChildren(openIssues);
  const actionChildren = buildActionChildren();

  return [
   SidebarTreeItem.section('Open issues', 'issues', issueChildren, String(openIssues.length)),
   SidebarTreeItem.section('Actions', 'tools', actionChildren),
  ];
 }
}