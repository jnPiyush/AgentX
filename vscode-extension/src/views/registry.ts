import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { WorkTreeProvider } from './workTreeProvider';
import { StatusTreeProvider } from './statusTreeProvider';
import { TemplateTreeProvider } from './templateTreeProvider';

type RefreshableProvider = {
 refresh(): void;
};

export interface SidebarProviders {
 readonly workTreeProvider: WorkTreeProvider;
 readonly statusTreeProvider: StatusTreeProvider;
 readonly templateProvider: TemplateTreeProvider;
}

export function createSidebarProviders(agentx: AgentXContext): SidebarProviders {
 return {
  workTreeProvider: new WorkTreeProvider(agentx),
  statusTreeProvider: new StatusTreeProvider(agentx),
  templateProvider: new TemplateTreeProvider(agentx),
 };
}

export function registerSidebarProviders(providers: SidebarProviders): void {
 vscode.window.registerTreeDataProvider('agentx-work', providers.workTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-status', providers.statusTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-templates', providers.templateProvider);
}

export function refreshSidebarProviders(providers: SidebarProviders): void {
 const refreshableProviders: RefreshableProvider[] = [
  providers.workTreeProvider,
  providers.statusTreeProvider,
  providers.templateProvider,
 ];

 for (const provider of refreshableProviders) {
  provider.refresh();
 }
}