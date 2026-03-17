import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { getAzureCompanionState } from '../utils/companionExtensions';
import { SidebarTreeItem } from './sidebarTreeItem';

interface VersionStamp {
 readonly version?: string;
 readonly mode?: string;
 readonly integration?: string;
}

function readJsonFile<T>(filePath: string): T | undefined {
 try {
  if (!fs.existsSync(filePath)) {
   return undefined;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
 } catch {
  return undefined;
 }
}

function formatConnection(value: boolean): string {
 return value ? 'connected' : 'not connected';
}

export class StatusTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
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

  // Overview is always shown — workspace + integration state
  const versionInfo = root
   ? readJsonFile<VersionStamp>(path.join(root, '.agentx', 'version.json'))
   : undefined;
  const configInfo = root
   ? readJsonFile<VersionStamp>(path.join(root, '.agentx', 'config.json'))
   : undefined;
  const azureCompanionState = getAzureCompanionState(root);
  const azureCompanionDescription =
   azureCompanionState === 'installed' ? 'installed' :
   azureCompanionState === 'legacy' ? 'upgrade recommended' :
   azureCompanionState === 'recommended' ? 'recommended' : 'not needed';
  const azureCompanionIcon =
   azureCompanionState === 'installed' ? 'extensions' :
   azureCompanionState === 'not-needed' ? 'circle-slash' : 'warning';

  const overviewChildren = [
   SidebarTreeItem.detail('Workspace', 'root-folder', root ? 'ready' : 'none'),
   SidebarTreeItem.detail('Version', 'versions', versionInfo?.version ?? 'not installed'),
   SidebarTreeItem.detail('Mode', 'server-environment', configInfo?.mode ?? configInfo?.integration ?? versionInfo?.mode ?? 'workspace only'),
   SidebarTreeItem.detail('GitHub MCP', 'github', formatConnection(this.agentx.githubConnected)),
   SidebarTreeItem.detail('ADO MCP', 'repo', formatConnection(this.agentx.adoConnected)),
   SidebarTreeItem.detail('Azure skills', azureCompanionIcon, azureCompanionDescription),
  ];

  if (!root) {
   return [SidebarTreeItem.section('Overview', 'plug', overviewChildren)];
  }

  return [
   SidebarTreeItem.section('Overview', 'plug', overviewChildren),
  ];
 }
}
