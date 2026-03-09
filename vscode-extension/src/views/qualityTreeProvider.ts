import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { getHarnessStatusDisplay } from '../utils/harnessState';
import {
 checkHandoffGate,
 getLoopStatusDisplay,
} from '../utils/loopStateChecker';
import { SidebarTreeItem } from './sidebarTreeItem';

export class QualityTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
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
   return [SidebarTreeItem.info('Open a workspace folder to inspect quality gates.')];
  }

  const handoff = checkHandoffGate(root);
  const gateIcon = handoff.allowed ? 'pass-filled' : 'warning';
  const gateState = handoff.allowed ? 'ready' : 'blocked';

  const summaryChildren = [
   SidebarTreeItem.detail('Loop', 'sync', getLoopStatusDisplay(root)),
   SidebarTreeItem.detail('Harness', 'pulse', getHarnessStatusDisplay(root)),
   SidebarTreeItem.detail('Reviewer handoff', gateIcon, gateState, handoff.reason),
  ];

  const actionsChildren = [
   SidebarTreeItem.action('Loop status', 'history', 'agentx.loopStatus', 'Loop Status'),
   SidebarTreeItem.action('Start loop', 'play', 'agentx.loopStart', 'Loop Start'),
   SidebarTreeItem.action('Complete loop', 'check', 'agentx.loopComplete', 'Loop Complete'),
   SidebarTreeItem.action('Check environment', 'beaker', 'agentx.checkEnvironment', 'Check Environment'),
  ];

  return [
   SidebarTreeItem.section('Quality summary', 'checklist', summaryChildren),
   SidebarTreeItem.section('Actions', 'tools', actionsChildren),
  ];
 }
}