import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { SidebarTreeItem } from './sidebarTreeItem';

interface VersionStamp {
 readonly version?: string;
 readonly mode?: string;
 readonly integration?: string;
 readonly updatedAt?: string;
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

function formatValue(value: boolean): string {
 return value ? 'connected' : 'not connected';
}

export class IntegrationTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
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

  const workspaceRoot = this.agentx.workspaceRoot;
  const versionInfo = workspaceRoot
   ? readJsonFile<VersionStamp>(path.join(workspaceRoot, '.agentx', 'version.json'))
   : undefined;
  const configInfo = workspaceRoot
   ? readJsonFile<VersionStamp>(path.join(workspaceRoot, '.agentx', 'config.json'))
   : undefined;
  const azureCompanionInstalled = !!vscode.extensions.getExtension(
   'ms-azuretools.vscode-azure-github-copilot',
  );

  const overviewChildren = [
   SidebarTreeItem.detail('Workspace ready', 'root-folder', workspaceRoot ? 'yes' : 'no'),
   SidebarTreeItem.detail('AgentX version', 'versions', versionInfo?.version ?? 'not installed'),
   SidebarTreeItem.detail(
    'Mode',
    'server-environment',
    configInfo?.mode ?? configInfo?.integration ?? versionInfo?.mode ?? 'workspace only',
   ),
  ];

  const providerChildren = [
   SidebarTreeItem.detail('GitHub MCP', 'github', formatValue(this.agentx.githubConnected)),
   SidebarTreeItem.detail('Azure DevOps MCP', 'repo', formatValue(this.agentx.adoConnected)),
   SidebarTreeItem.detail(
    'Azure companion',
    azureCompanionInstalled ? 'extensions' : 'warning',
    azureCompanionInstalled ? 'installed' : 'missing',
   ),
  ];

  const actionChildren = [
   SidebarTreeItem.action('Add integration', 'plug', 'agentx.initialize', 'Add Integration'),
   SidebarTreeItem.action('Check environment', 'beaker', 'agentx.checkEnvironment', 'Check Environment'),
  ];

  return [
   SidebarTreeItem.section('Overview', 'plug', overviewChildren),
   SidebarTreeItem.section('Providers', 'cloud', providerChildren),
   SidebarTreeItem.section('Actions', 'tools', actionChildren),
  ];
 }
}