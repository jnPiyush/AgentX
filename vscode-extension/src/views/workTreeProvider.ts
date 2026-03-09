import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { readHarnessState } from '../utils/harnessState';
import { SidebarTreeItem } from './sidebarTreeItem';

interface AgentStatusEntry {
 readonly status?: string;
 readonly issue?: number | string | null;
 readonly lastActivity?: string | null;
}

interface LocalIssue {
 readonly number?: number;
 readonly title?: string;
 readonly status?: string;
 readonly state?: string;
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

function formatTimestamp(value: string | null | undefined): string | undefined {
 if (!value) {
  return undefined;
 }

 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
  return value;
 }

 return date.toLocaleString();
}

function getLocalIssues(root: string): LocalIssue[] {
 const issuesDir = path.join(root, '.agentx', 'issues');
 if (!fs.existsSync(issuesDir)) {
  return [];
 }

 return fs.readdirSync(issuesDir)
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => readJsonFile<LocalIssue>(path.join(issuesDir, entry)))
  .filter((issue): issue is LocalIssue => !!issue)
  .sort((left, right) => (left.number ?? 0) - (right.number ?? 0));
}

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

  const pendingClarification = await this.agentx.getPendingClarification();
  const harnessState = readHarnessState(root);
  const activeThread = harnessState.threads.find((thread) => thread.status === 'active');
  const activeTurn = activeThread
   ? harnessState.turns.find((turn) => turn.id === activeThread.currentTurnId)
   : undefined;
  const agentStatuses = readJsonFile<Record<string, AgentStatusEntry>>(
   path.join(root, '.agentx', 'state', 'agent-status.json'),
  ) ?? {};
  const activeAgents = Object.entries(agentStatuses)
   .filter(([, value]) => value.status && value.status !== 'idle')
   .sort(([left], [right]) => left.localeCompare(right));
  const localIssues = getLocalIssues(root);
  const openIssues = localIssues.filter((issue) => (issue.state ?? 'open') !== 'closed');

  const overviewChildren = [
   SidebarTreeItem.detail('Workspace', 'root-folder', path.basename(root), root),
   pendingClarification
    ? SidebarTreeItem.action(
     'Pending clarification',
     'comment-discussion',
     'agentx.showPendingClarification',
     'Show Pending Clarification',
     [],
     pendingClarification.agentName,
    )
    : SidebarTreeItem.detail('Pending clarification', 'comment-discussion', 'none'),
   SidebarTreeItem.detail('Open local issues', 'issues', String(openIssues.length)),
  ];

  const activeThreadChildren = activeThread
   ? [
    SidebarTreeItem.detail('Task type', 'symbol-event', activeThread.taskType),
    SidebarTreeItem.detail('Status', 'pulse', activeThread.status),
    SidebarTreeItem.detail('Current turn', 'history', String(activeTurn?.sequence ?? 0)),
    SidebarTreeItem.detail(
     'Issue',
     'issue-opened',
     activeThread.issueNumber ? `#${activeThread.issueNumber}` : 'none',
    ),
    SidebarTreeItem.detail(
     'Updated',
     'calendar',
     formatTimestamp(activeThread.updatedAt),
    ),
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
       'agentx.showIssue',
       'Show Issue',
       [String(activeThread.issueNumber)],
       `#${activeThread.issueNumber}`,
      ),
      SidebarTreeItem.action(
       'Check linked issue dependencies',
       'git-merge',
       'agentx.checkDeps',
       'Check Dependencies',
       [String(activeThread.issueNumber)],
      ),
     ]
     : []),
    SidebarTreeItem.action('Loop status', 'history', 'agentx.loopStatus', 'Loop Status'),
   ]
   : [SidebarTreeItem.info('No active harness thread.')];

  const activeAgentChildren = activeAgents.length > 0
   ? activeAgents.map(([agentName, status]) => SidebarTreeItem.action(
    agentName,
    'person',
    status.issue ? 'agentx.showIssue' : 'agentx.showStatus',
    status.issue ? 'Show Issue' : 'Show Agent Status',
    status.issue ? [String(status.issue)] : [],
    `${status.status}${status.issue ? ` | issue #${status.issue}` : ''}`,
   ))
   : [SidebarTreeItem.info('No agents are actively working.')];

  const issueChildren = openIssues.length > 0
   ? openIssues.slice(0, 5).map((issue) => SidebarTreeItem.action(
    `#${issue.number ?? '?'} ${issue.title ?? 'Untitled issue'}`,
    'issue-opened',
    'agentx.showIssue',
    'Show Issue',
    [String(issue.number ?? '')],
    issue.status ?? issue.state ?? 'open',
   ))
   : [SidebarTreeItem.info('No open local issues found.')];

  const actionChildren = [
   SidebarTreeItem.action('Run workflow', 'play', 'agentx.runWorkflow', 'Run Workflow'),
   SidebarTreeItem.action('Show agent status', 'organization', 'agentx.showStatus', 'Show Agent Status'),
    SidebarTreeItem.action('Check environment', 'beaker', 'agentx.checkEnvironment', 'Check Environment'),
   SidebarTreeItem.action('Generate digest', 'notebook', 'agentx.generateDigest', 'Generate Digest'),
  ];

  return [
   SidebarTreeItem.section('Overview', 'dashboard', overviewChildren),
   SidebarTreeItem.section(
    activeThread ? activeThread.title : 'Active thread',
    'run-all',
    activeThreadChildren,
    activeThread ? activeThread.status : 'idle',
   ),
   SidebarTreeItem.section('Active agents', 'organization', activeAgentChildren, String(activeAgents.length)),
   SidebarTreeItem.section('Open issues', 'issues', issueChildren, String(openIssues.length)),
   SidebarTreeItem.section('Actions', 'tools', actionChildren),
  ];
 }
}