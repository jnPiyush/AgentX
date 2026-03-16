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
import { checkHandoffGate } from '../utils/loopStateChecker';
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

  return [
   SidebarTreeItem.section('Overview', 'plug', overviewChildren),
   SidebarTreeItem.section('Quality', 'checklist', qualityChildren),
  ];
 }
}
