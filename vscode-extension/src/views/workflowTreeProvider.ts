import * as vscode from 'vscode';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { readHarnessState, getHarnessStatusDisplay } from '../utils/harnessState';
import { getLoopStatusDisplay } from '../utils/loopStateChecker';
import { SidebarTreeItem } from './sidebarTreeItem';
import { WORKFLOW_OPTIONS } from '../commands/workflow';

export class WorkflowTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
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
   return [SidebarTreeItem.info('Open a workspace folder to inspect workflow state.')];
  }

  const harnessState = readHarnessState(root);
  const activeThread = harnessState.threads.find((thread) => thread.status === 'active');
  const plans = this.agentx.listExecutionPlanFiles();

  const currentChildren = [
   SidebarTreeItem.detail('Loop', 'sync', getLoopStatusDisplay(root)),
   SidebarTreeItem.detail('Harness', 'pulse', getHarnessStatusDisplay(root)),
   SidebarTreeItem.detail('Active workflow', 'run-all', activeThread?.taskType ?? 'none'),
   SidebarTreeItem.detail('Execution plans', 'repo', String(plans.length)),
   ...plans.slice(0, 5).map((planPath) => SidebarTreeItem.action(
    `Open ${path.basename(planPath)}`,
    'go-to-file',
    'vscode.open',
    'Open Execution Plan',
    [vscode.Uri.file(path.join(root, planPath))],
    planPath,
   )),
  ];

  const catalogChildren = WORKFLOW_OPTIONS.map((workflow) => SidebarTreeItem.action(
   workflow.label,
   'play-circle',
   'agentx.runWorkflowType',
   'Run Workflow Type',
   [workflow.label],
   workflow.description,
  ));

  return [
   SidebarTreeItem.section('Current state', 'git-pull-request', currentChildren),
   SidebarTreeItem.section('Workflow catalog', 'symbol-class', catalogChildren, String(catalogChildren.length)),
  ];
 }
}