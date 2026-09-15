import * as fs from 'fs';
import * as path from 'path';
import { resolveFrontierStatePath } from '../utils/frontierPaths';
import * as vscode from 'vscode';
import { WorkflowGuidanceSnapshot } from '../utils/workflowGuidance';
import { SidebarTreeItem } from './sidebarTreeItem';

export interface AgentStatusEntry {
 readonly status?: string;
 readonly issue?: number | string | null;
 readonly lastActivity?: string | null;
}

export interface LocalIssue {
 readonly number?: number;
 readonly title?: string;
 readonly status?: string;
 readonly state?: string;
}

export function normalizeIssues(value: unknown): LocalIssue[] {
 if (!Array.isArray(value)) {
  return [];
 }

 return value
  .filter((issue): issue is Record<string, unknown> => !!issue && typeof issue === 'object')
  .filter((issue) => typeof issue.number === 'number')
  .map((issue) => ({
   number: typeof issue.number === 'number' ? issue.number : undefined,
   title: typeof issue.title === 'string' ? issue.title : undefined,
   status: typeof issue.status === 'string' ? issue.status : undefined,
   state: typeof issue.state === 'string' ? issue.state : undefined,
  }))
  .sort((left, right) => (left.number ?? 0) - (right.number ?? 0));
}

export function readJsonFile<T>(filePath: string): T | undefined {
 try {
  if (!fs.existsSync(filePath)) {
   return undefined;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
 } catch {
  return undefined;
 }
}

export function formatTimestamp(value: string | null | undefined): string | undefined {
 if (!value) {
  return undefined;
 }

 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
  return value;
 }

 return date.toLocaleString();
}

export function getLocalIssues(root: string): LocalIssue[] {
 const issuesDir = resolveFrontierStatePath(root, 'issues');
 if (!fs.existsSync(issuesDir)) {
  return [];
 }

 return normalizeIssues(fs.readdirSync(issuesDir)
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => readJsonFile<LocalIssue>(path.join(issuesDir, entry)))
  .filter((issue): issue is LocalIssue => !!issue));
}

export function buildOverviewChildren(
 root: string,
 pendingClarification: { agentName?: string } | undefined,
 openIssueCount: number,
): SidebarTreeItem[] {
 return [
  SidebarTreeItem.detail('Workspace', 'root-folder', path.basename(root), root),
  pendingClarification
   ? SidebarTreeItem.action(
    'Pending clarification',
    'comment-discussion',
    'frontier.showPendingClarification',
    'Show Pending Clarification',
    [],
    pendingClarification.agentName,
   )
   : SidebarTreeItem.detail('Pending clarification', 'comment-discussion', 'none'),
  SidebarTreeItem.detail('Open issues', 'issues', String(openIssueCount)),
 ];
}

export function buildActiveThreadChildren(
 root: string,
 activeThread: {
  title: string;
  taskType: string;
  status: string;
  issueNumber?: number | null;
  updatedAt: string;
  planPath?: string;
 } | undefined,
 activeTurnSequence: number | undefined,
): SidebarTreeItem[] {
 if (!activeThread) {
  return [SidebarTreeItem.info('No active harness thread.')];
 }

 return [
  SidebarTreeItem.detail('Task type', 'symbol-event', activeThread.taskType),
  SidebarTreeItem.detail('Status', 'pulse', activeThread.status),
  SidebarTreeItem.detail('Current turn', 'history', String(activeTurnSequence ?? 0)),
  SidebarTreeItem.detail(
   'Issue',
   'issue-opened',
   activeThread.issueNumber ? `#${activeThread.issueNumber}` : 'none',
  ),
  SidebarTreeItem.detail('Updated', 'calendar', formatTimestamp(activeThread.updatedAt)),
  ...(activeThread.planPath
   ? [SidebarTreeItem.action(
    'Open execution plan',
    'go-to-file',
    'vscode.open',
    'Open Execution Plan',
    [vscode.Uri.file(path.join(root, activeThread.planPath))],
    activeThread.planPath,
   )]
   : []),
  ...(activeThread.issueNumber
   ? [
    SidebarTreeItem.action(
     'Open linked issue',
     'issue-opened',
     'frontier.showIssue',
     'Show Issue',
     [String(activeThread.issueNumber)],
     `#${activeThread.issueNumber}`,
    ),
    SidebarTreeItem.action(
     'Check linked issue dependencies',
     'git-merge',
     'frontier.checkDeps',
     'Check Dependencies',
     [String(activeThread.issueNumber)],
    ),
   ]
   : []),
  SidebarTreeItem.action('Loop status', 'history', 'frontier.loopStatus', 'Loop Status'),
 ];
}

export function buildActiveAgentChildren(
 activeAgents: ReadonlyArray<[string, AgentStatusEntry]>,
): SidebarTreeItem[] {
 return activeAgents.length > 0
  ? activeAgents.map(([agentName, status]) => SidebarTreeItem.action(
   agentName,
   'person',
   status.issue ? 'frontier.showIssue' : 'frontier.showStatus',
   status.issue ? 'Show Issue' : 'Show Agent Status',
   status.issue ? [String(status.issue)] : [],
   `${status.status}${status.issue ? ` | issue #${status.issue}` : ''}`,
  ))
  : [SidebarTreeItem.info('No agents are actively working.')];
}

export function buildIssueChildren(openIssues: ReadonlyArray<LocalIssue>): SidebarTreeItem[] {
 return openIssues.length > 0
  ? openIssues.slice(0, 5).map((issue) => SidebarTreeItem.action(
   `#${issue.number ?? '?'} ${issue.title ?? 'Untitled issue'}`,
   'issue-opened',
   'frontier.showIssue',
   'Show Issue',
   [String(issue.number ?? '')],
   issue.status ?? issue.state ?? 'open',
  ))
  : [SidebarTreeItem.info('No open issues found.')];
}

export function buildActionChildren(): SidebarTreeItem[] {
 return [
  SidebarTreeItem.action('Show workflow steps', 'play', 'frontier.runWorkflow', 'Show Workflow Steps'),
  SidebarTreeItem.action('Workflow next step', 'debug-step-over', 'frontier.showWorkflowNextStep', 'Show Workflow Next Step'),
  SidebarTreeItem.action('Brainstorm', 'lightbulb', 'frontier.showBrainstormGuide', 'Brainstorm'),
  SidebarTreeItem.action('Planning learnings', 'book', 'frontier.showPlanningLearnings', 'Planning Learnings'),
  SidebarTreeItem.action('Review learnings', 'checklist', 'frontier.showReviewLearnings', 'Review Learnings'),
  SidebarTreeItem.action('Compound loop', 'layers', 'frontier.showCompoundLoop', 'Compound Loop'),
  SidebarTreeItem.action('Create learning capture', 'new-file', 'frontier.createLearningCapture', 'Create Learning Capture'),
  SidebarTreeItem.action('Rollout scorecard', 'graph', 'frontier.showWorkflowRolloutScorecard', 'Show Workflow Rollout Scorecard'),
  SidebarTreeItem.action('Operator checklist', 'checklist', 'frontier.showOperatorEnablementChecklist', 'Show Operator Enablement Checklist'),
  SidebarTreeItem.action('Capture guidance', 'archive', 'frontier.showKnowledgeCaptureGuidance', 'Knowledge Capture Guidance'),
  SidebarTreeItem.action('Review findings', 'comment-discussion', 'frontier.showReviewFindings', 'Review Findings'),
  SidebarTreeItem.action('Promote review finding', 'repo-push', 'frontier.promoteReviewFinding', 'Promote Review Finding'),
  SidebarTreeItem.action('Show agent status', 'organization', 'frontier.showStatus', 'Show Agent Status'),
  SidebarTreeItem.action('Check environment', 'beaker', 'frontier.checkEnvironment', 'Check Environment'),
  SidebarTreeItem.action('Generate digest', 'notebook', 'frontier.generateDigest', 'Generate Digest'),
 ];
}

export function buildWorkflowGuidanceChildren(snapshot: WorkflowGuidanceSnapshot | undefined): SidebarTreeItem[] {
 if (!snapshot) {
  return [SidebarTreeItem.info('Open a workspace folder to resolve workflow guidance.')];
 }

 const children: SidebarTreeItem[] = [
  SidebarTreeItem.detail('Current checkpoint', 'milestone', snapshot.currentCheckpoint),
  SidebarTreeItem.detail('Why now', 'comment', snapshot.rationale),
 ];

 if (snapshot.recommendedCommand && snapshot.recommendedCommandTitle) {
  children.unshift(
   SidebarTreeItem.action(
    snapshot.recommendedAction,
    'play-circle',
    snapshot.recommendedCommand,
    snapshot.recommendedCommandTitle,
   ),
  );
 } else {
  children.unshift(SidebarTreeItem.detail('Recommended action', 'play-circle', snapshot.recommendedAction));
 }

 if (snapshot.planDeepening.allowed) {
  children.push(SidebarTreeItem.action('Deepen plan', 'notebook', 'frontier.deepenPlan', 'Deepen Plan'));
 }
 if (snapshot.reviewKickoff.allowed) {
  children.push(SidebarTreeItem.action('Kick off review', 'comment-discussion', 'frontier.kickoffReview', 'Kick Off Review'));
 }

  if (snapshot.activeContractPath) {
    children.push(
      SidebarTreeItem.detail('Active contract', 'note', snapshot.activeContractPath, snapshot.activeContractStatus ?? 'unknown'),
    );
    if (snapshot.activeContractNextAction) {
      children.push(SidebarTreeItem.detail('Slice next action', 'debug-step-over', snapshot.activeContractNextAction));
    }
    if (snapshot.activeContractFindingCount > 0) {
      children.push(
        SidebarTreeItem.detail(
          'Slice findings',
          'warning',
          String(snapshot.activeContractFindingCount),
          snapshot.activeContractFindingSummary,
        ),
      );
    }
  }

 for (const blocker of snapshot.blockers) {
  children.push(SidebarTreeItem.detail('Blocker', 'warning', blocker));
 }

 children.push(
  SidebarTreeItem.action('Show rollout scorecard', 'graph', 'frontier.showWorkflowRolloutScorecard', 'Show Workflow Rollout Scorecard'),
  SidebarTreeItem.action('Show operator checklist', 'checklist', 'frontier.showOperatorEnablementChecklist', 'Show Operator Enablement Checklist'),
 );

 return children;
}