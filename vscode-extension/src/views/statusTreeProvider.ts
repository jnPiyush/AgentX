import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import {
 getAttributionSummary,
 getAttributionTooltip,
 getCoverageSummary,
 getCoverageTooltip,
 getEvaluationSummary,
 getEvaluationTooltip,
} from '../eval/harnessEvaluator';
import {
 getAgentNativeGapSummary,
 getAgentNativeGapTooltip,
 getAgentNativeReviewSummary,
 getAgentNativeReviewTooltip,
} from '../review/agent-native-review';
import {
 getPromotableFindingSummary,
 getPromotableFindingTooltip,
 getReviewFindingSummary,
 getReviewFindingTooltip,
} from '../review/review-findings';
import { getHarnessStatusDisplay, readHarnessState } from '../utils/harnessState';
import { checkHandoffGate, getLoopStatusDisplay } from '../utils/loopStateChecker';
import { getAzureCompanionState } from '../utils/companionExtensions';
import { WORKFLOW_OPTIONS } from '../commands/workflow';
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

  // State section — loop, harness, active work, execution plans
  const harnessState = readHarnessState(root);
  const activeThread = harnessState.threads.find((t) => t.status === 'active');
  const plans = this.agentx.listExecutionPlanFiles();

  const stateChildren = [
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

  // Quality section — signals + handoff gate
  const handoff = checkHandoffGate(root);
  const gateIcon = handoff.allowed ? 'pass-filled' : 'warning';
  const gateState = handoff.allowed ? 'ready' : 'blocked';

  const qualityChildren = [
   SidebarTreeItem.detail('Evaluation', handoff.allowed ? 'graph' : 'warning', getEvaluationSummary(this.agentx), getEvaluationTooltip(this.agentx)),
   SidebarTreeItem.detail('Coverage', 'layers', getCoverageSummary(this.agentx), getCoverageTooltip(this.agentx)),
   SidebarTreeItem.detail('Attribution', 'symbol-key', getAttributionSummary(this.agentx), getAttributionTooltip(this.agentx)),
   SidebarTreeItem.detail('Agent-native review', 'symbol-interface', getAgentNativeReviewSummary(this.agentx), getAgentNativeReviewTooltip(this.agentx)),
   SidebarTreeItem.detail('Parity gaps', 'warning', getAgentNativeGapSummary(this.agentx), getAgentNativeGapTooltip(this.agentx)),
   SidebarTreeItem.detail('Review findings', 'comment-discussion', getReviewFindingSummary(this.agentx), getReviewFindingTooltip(this.agentx)),
   SidebarTreeItem.detail('Promotable findings', 'repo-push', getPromotableFindingSummary(this.agentx), getPromotableFindingTooltip(this.agentx)),
   SidebarTreeItem.detail('Reviewer handoff', gateIcon, gateState, handoff.reason),
  ];

  // Workflows section — runnable workflow types
  const workflowChildren = WORKFLOW_OPTIONS.map((workflow) => SidebarTreeItem.action(
   workflow.label,
   'play-circle',
   'agentx.runWorkflowType',
   'Run Workflow Type',
   [workflow.label],
   workflow.description,
  ));

  // Actions section — deduplicated across all former panels
  const actionsChildren = [
   SidebarTreeItem.action('Loop status', 'history', 'agentx.loopStatus', 'Loop Status'),
   SidebarTreeItem.action('Start loop', 'play', 'agentx.loopStart', 'Loop Start'),
   SidebarTreeItem.action('Complete loop', 'check', 'agentx.loopComplete', 'Loop Complete'),
   SidebarTreeItem.action('Compound loop', 'layers', 'agentx.showCompoundLoop', 'Compound Loop'),
   SidebarTreeItem.action('Create learning capture', 'new-file', 'agentx.createLearningCapture', 'Create Learning Capture'),
   SidebarTreeItem.action('Agent-native review', 'symbol-interface', 'agentx.showAgentNativeReview', 'Agent-Native Review'),
   SidebarTreeItem.action('Review findings', 'comment-discussion', 'agentx.showReviewFindings', 'Review Findings'),
   SidebarTreeItem.action('Promote review finding', 'repo-push', 'agentx.promoteReviewFinding', 'Promote Review Finding'),
   SidebarTreeItem.action('Add integration', 'plug', 'agentx.initialize', 'Add Integration'),
   SidebarTreeItem.action('Check environment', 'beaker', 'agentx.checkEnvironment', 'Check Environment'),
  ];

  return [
   SidebarTreeItem.section('Overview', 'plug', overviewChildren),
   SidebarTreeItem.section('State', 'git-pull-request', stateChildren),
   SidebarTreeItem.section('Quality', 'checklist', qualityChildren),
   SidebarTreeItem.section('Workflows', 'symbol-class', workflowChildren, String(workflowChildren.length)),
   SidebarTreeItem.section('Actions', 'tools', actionsChildren),
  ];
 }
}
