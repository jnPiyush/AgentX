import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { stripAnsi } from '../utils/stripAnsi';

/**
 * Shape of an issue object returned by the CLI in JSON mode.
 */
interface ReadyIssue {
 number: number;
 title: string;
 labels?: string[];
 status?: string;
 state?: string;
 body?: string;
}

/**
 * Tree data provider for the Ready Queue sidebar view.
 * Shows priority-sorted unblocked work items.
 */
export class ReadyQueueTreeProvider implements vscode.TreeDataProvider<ReadyItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<ReadyItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 private items: ReadyItem[] = [];

 constructor(private agentx: AgentXContext) {}

 /**
  * Clear cached items and trigger a tree refresh.
  * Optionally accepts pre-fetched JSON issues to avoid a redundant CLI call.
  */
 refresh(prefetchedIssues?: ReadyIssue[]): void {
  if (prefetchedIssues) {
   this.items = ReadyQueueTreeProvider.issuesToItems(prefetchedIssues, this.agentx);
  } else {
   this.items = [];
  }
  this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: ReadyItem): vscode.TreeItem {
  return element;
 }

 async getChildren(): Promise<ReadyItem[]> {
  const initialized = await this.agentx.checkInitialized();
  if (!initialized) {
   return [new ReadyItem('AgentX not initialized', '', 'info')];
  }

  if (this.items.length > 0) {
   return this.items;
  }

  try {
   const output = await this.agentx.runCli('ready', ['--json']);
   const cleaned = stripAnsi(output).trim();

   if (!cleaned || /^no\s+(ready|work|issues|unblocked)/i.test(cleaned)) {
    return [new ReadyItem('No unblocked work', '', 'info')];
   }

   // Try structured JSON parse first
   try {
    const issues: ReadyIssue[] = JSON.parse(cleaned);
    if (Array.isArray(issues) && issues.length > 0) {
     this.items = ReadyQueueTreeProvider.issuesToItems(issues, this.agentx);
     return this.items;
    }
    return [new ReadyItem('No unblocked work', '', 'info')];
   } catch {
    // Fallback: parse human-readable text (strip headers/separators)
    this.items = ReadyQueueTreeProvider.parseTextOutput(cleaned, this.agentx);
    return this.items.length > 0
     ? this.items
     : [new ReadyItem('No unblocked work', '', 'info')];
   }
  } catch {
   return [new ReadyItem('Run "AgentX: Show Ready Queue" to load', '', 'info')];
  }
 }

 /**
  * Convert structured issue objects into tree items.
  */
 static issuesToItems(issues: ReadyIssue[], agentx: AgentXContext): ReadyItem[] {
  return issues.map(issue => {
   const num = String(issue.number);
   const labels = issue.labels ?? [];
   const priority = ReadyQueueTreeProvider.extractPriority(labels);
   const type = ReadyQueueTreeProvider.extractType(labels);
   const pLabel = priority < 9 ? `P${priority}` : '';

   // Check if issue has a pending clarification file.
   const hasClarification = ReadyQueueTreeProvider.hasPendingClarification(num, agentx);

   const label = pLabel
    ? `[${pLabel}] #${num} (${type}) ${issue.title}`
    : `#${num} (${type}) ${issue.title}`;

   return new ReadyItem(
    label,
    num,
    hasClarification ? 'blocked-clarification' : 'ready',
    issue.title,
    type,
    pLabel
   );
  });
 }

 /**
  * Fallback parser for human-readable CLI output.
  * Filters out header lines, separator lines, and empty lines.
  */
 static parseTextOutput(output: string, _agentx: AgentXContext): ReadyItem[] {
  const lines = output.split('\n')
   .map(l => l.trim())
   .filter(l =>
    l.length > 0
    && !l.startsWith('---')
    && !/^Ready\s+Work/i.test(l)
    && !/^=+$/.test(l)
    && !/^-+$/.test(l)
   );

  return lines
   .filter(line => /#\d+/.test(line))
   .map(line => {
    const issueMatch = line.match(/#(\d+)/);
    const issueNum = issueMatch ? issueMatch[1] : '';
    const isClarificationBlocked = /BLOCKED.*clarif/i.test(line);
    return new ReadyItem(line, issueNum, isClarificationBlocked ? 'blocked-clarification' : 'ready');
   });
 }

 /**
  * Extract numeric priority from labels (e.g. 'priority:p0' -> 0).
  */
 private static extractPriority(labels: string[]): number {
  for (const l of labels) {
   const m = l.match(/priority:p(\d)/i);
   if (m) { return parseInt(m[1], 10); }
  }
  return 9;
 }

 /**
  * Extract issue type from labels (e.g. 'type:story' -> 'story').
  */
 private static extractType(labels: string[]): string {
  for (const l of labels) {
   const m = l.match(/type:(\w+)/i);
   if (m) { return m[1]; }
  }
  return 'story';
 }

 /**
  * Check whether a clarification file with pending entries exists for the issue.
  */
 private static hasPendingClarification(issueNum: string, agentx: AgentXContext): boolean {
  try {
   const root = agentx.workspaceRoot;
   if (!root) { return false; }
   const fs = require('fs');
   const path = require('path');
   const clarFile = path.join(root, '.agentx', 'state', 'clarifications', `issue-${issueNum}.json`);
   if (!fs.existsSync(clarFile)) { return false; }
   const ledger = JSON.parse(fs.readFileSync(clarFile, 'utf-8'));
   if (ledger.clarifications && Array.isArray(ledger.clarifications)) {
    return ledger.clarifications.some(
     (c: any) => c.status === 'pending' || c.status === 'stale'
    );
   }
  } catch { /* ignore */ }
  return false;
 }
}

class ReadyItem extends vscode.TreeItem {
 constructor(
  label: string,
  public readonly issueNumber: string,
  type: 'ready' | 'blocked-clarification' | 'info',
  title?: string,
  issueType?: string,
  priority?: string
 ) {
  super(label, vscode.TreeItemCollapsibleState.None);

  if (type === 'ready') {
   this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
   this.contextValue = 'readyItem';
   if (title) {
    this.tooltip = `#${issueNumber} ${title}${issueType ? ` (${issueType})` : ''}${priority ? ` [${priority}]` : ''}`;
   }
   // Click to show issue detail in output channel
   if (issueNumber) {
    this.command = {
     command: 'agentx.showIssue',
     title: 'Show Issue',
     arguments: [issueNumber],
    };
   }
  } else if (type === 'blocked-clarification') {
   this.iconPath = new vscode.ThemeIcon(
    'warning',
    new vscode.ThemeColor('notificationsWarningIcon.foreground')
   );
   this.description = 'BLOCKED: Clarification pending';
   this.contextValue = 'blockedClarificationItem';
   if (title) {
    this.tooltip = `#${issueNumber} ${title} -- BLOCKED: awaiting clarification`;
   }
   if (issueNumber) {
    this.command = {
     command: 'agentx.showIssue',
     title: 'Show Issue',
     arguments: [issueNumber],
    };
   }
  } else {
   this.iconPath = new vscode.ThemeIcon('info');
   this.contextValue = 'infoItem';
  }
 }
}
