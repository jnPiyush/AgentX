import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { WorkTreeProvider } from './workTreeProvider';
import { StatusTreeProvider } from './statusTreeProvider';
import { TemplateTreeProvider } from './templateTreeProvider';
import { SkillTreeProvider } from './skillTreeProvider';

type RefreshableProvider = {
 refresh(): void;
};

const registeredSidebarViewIds = new Set<string>();

export interface SidebarProviders {
 readonly workTreeProvider: WorkTreeProvider;
 readonly statusTreeProvider: StatusTreeProvider;
 readonly templateProvider: TemplateTreeProvider;
 readonly skillProvider: SkillTreeProvider;
}

export function createSidebarProviders(agentx: FrontierContext): SidebarProviders {
 return {
  workTreeProvider: new WorkTreeProvider(agentx),
  statusTreeProvider: new StatusTreeProvider(agentx),
  templateProvider: new TemplateTreeProvider(agentx),
  skillProvider: new SkillTreeProvider(agentx),
 };
}

export function registerSidebarProviders(providers: SidebarProviders): void {
 const registrations = [
  ['frontier-work', providers.workTreeProvider],
  ['frontier-status', providers.statusTreeProvider],
  ['frontier-templates', providers.templateProvider],
  ['frontier-skills', providers.skillProvider],
 ] as const;
 for (const [viewId, provider] of registrations) {
  vscode.window.registerTreeDataProvider(viewId, provider);
  registeredSidebarViewIds.add(viewId);
 }
}

export function getRegisteredSidebarViewIds(): readonly string[] {
 return [...registeredSidebarViewIds];
}

export function refreshSidebarProviders(providers: SidebarProviders): void {
 const refreshableProviders: RefreshableProvider[] = [
  providers.workTreeProvider,
  providers.statusTreeProvider,
  providers.templateProvider,
  providers.skillProvider,
 ];

 for (const provider of refreshableProviders) {
  provider.refresh();
 }
}