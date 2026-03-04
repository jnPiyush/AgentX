// ---------------------------------------------------------------------------
// AgentX -- Dashboard: Data Provider
// ---------------------------------------------------------------------------
//
// Aggregates data from all AgentX subsystems into a single DashboardData
// payload for rendering in the VS Code Webview panel.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 6.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe } from '../utils/fileLock';
import {
  type DashboardData,
  type DashboardHealthReport,
  type DashboardSubsystemHealth,
  type OutcomeTrendPoint,
  type WorkflowStatus,
} from './dashboardTypes';
import { type AgentStateItem, type ReadyQueueItem } from '../mcp/mcpTypes';
import { type SessionIndex } from '../memory/sessionTypes';

// ---------------------------------------------------------------------------
// DashboardDataProvider
// ---------------------------------------------------------------------------

/**
 * Collects data from all AgentX subsystems and returns a unified
 * `DashboardData` payload for the webview.
 */
export class DashboardDataProvider {
  private readonly agentxDir: string;
  private readonly memoryDir: string;

  constructor(agentxDir: string, memoryDir: string) {
    this.agentxDir = agentxDir;
    this.memoryDir = memoryDir;
  }

  /**
   * Collect all dashboard data in a single call.
   */
  async getData(): Promise<DashboardData> {
    const [agentStates, readyQueue, outcomeTrends, recentSessions, healthReport, activeWorkflows] =
      await Promise.all([
        this.getAgentStates(),
        this.getReadyQueue(),
        this.getOutcomeTrends(),
        this.getRecentSessions(),
        this.getHealthReport(),
        this.getActiveWorkflows(),
      ]);

    return {
      agentStates,
      readyQueue,
      outcomeTrends,
      recentSessions,
      healthReport,
      activeWorkflows,
      lastUpdated: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Agent States
  // -----------------------------------------------------------------------

  private async getAgentStates(): Promise<AgentStateItem[]> {
    const stateDir = path.join(this.agentxDir, 'state');
    if (!fs.existsSync(stateDir)) { return []; }

    const items: AgentStateItem[] = [];
    const files = fs.readdirSync(stateDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const state = readJsonSafe<{
        agent: string; state: string;
        issueNumber?: number; updatedAt?: string; lastAction?: string;
      }>(path.join(stateDir, file));

      if (state) {
        items.push({
          agent: state.agent,
          state: (state.state as AgentStateItem['state']) ?? 'idle',
          issueNumber: state.issueNumber ?? null,
          since: state.updatedAt ?? new Date().toISOString(),
          lastAction: state.lastAction ?? null,
        });
      }
    }

    return items;
  }

  // -----------------------------------------------------------------------
  // Ready Queue
  // -----------------------------------------------------------------------

  private async getReadyQueue(): Promise<ReadyQueueItem[]> {
    const issuesDir = path.join(this.agentxDir, 'issues');
    if (!fs.existsSync(issuesDir)) { return []; }

    const items: ReadyQueueItem[] = [];
    const files = fs.readdirSync(issuesDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const issue = readJsonSafe<{
        number: number; title: string; type: string;
        priority: string | null; status: string; createdAt: string;
      }>(path.join(issuesDir, file));

      if (issue && issue.status !== 'Done') {
        items.push({
          issueNumber: issue.number,
          title: issue.title,
          type: issue.type ?? 'type:story',
          priority: issue.priority ?? 'p3',
          status: issue.status,
          assignedAgent: null,
          blockedBy: [],
          createdAt: issue.createdAt,
        });
      }
    }

    const priorityOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3, 'priority:p0': 0, 'priority:p1': 1, 'priority:p2': 2, 'priority:p3': 3 };
    items.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));

    return items;
  }

  // -----------------------------------------------------------------------
  // Outcome Trends (last 14 days)
  // -----------------------------------------------------------------------

  private async getOutcomeTrends(): Promise<OutcomeTrendPoint[]> {
    const manifestPath = path.join(this.memoryDir, 'outcomes', 'outcome-manifest.json');
    const manifest = readJsonSafe<{
      entries: Array<{ result?: string; timestamp?: string }>
    }>(manifestPath);

    if (!manifest?.entries) { return []; }

    const now = new Date();
    const dayMap = new Map<string, { pass: number; fail: number; partial: number }>();

    // Initialize last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0]!;
      dayMap.set(key, { pass: 0, fail: 0, partial: 0 });
    }

    for (const entry of manifest.entries) {
      if (!entry.timestamp) { continue; }
      const day = entry.timestamp.split('T')[0]!;
      const bucket = dayMap.get(day);
      if (!bucket) { continue; }

      if (entry.result === 'success') { bucket.pass++; }
      else if (entry.result === 'failure') { bucket.fail++; }
      else if (entry.result === 'partial') { bucket.partial++; }
    }

    return Array.from(dayMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }

  // -----------------------------------------------------------------------
  // Recent Sessions
  // -----------------------------------------------------------------------

  private async getRecentSessions(): Promise<SessionIndex[]> {
    const manifestPath = path.join(this.memoryDir, 'sessions', 'session-manifest.json');
    const manifest = readJsonSafe<{
      entries: SessionIndex[]
    }>(manifestPath);

    if (!manifest?.entries) { return []; }
    return manifest.entries.slice(-10);
  }

  // -----------------------------------------------------------------------
  // Health Report
  // -----------------------------------------------------------------------

  private async getHealthReport(): Promise<DashboardHealthReport | null> {
    // Build a lightweight health report by checking manifest existence
    const subsystems: DashboardSubsystemHealth[] = [];

    const checks: Array<{ name: string; path: string }> = [
      { name: 'observations', path: path.join(this.memoryDir, 'manifest.json') },
      { name: 'outcomes', path: path.join(this.memoryDir, 'outcomes', 'outcome-manifest.json') },
      { name: 'sessions', path: path.join(this.memoryDir, 'sessions', 'session-manifest.json') },
      { name: 'synapse', path: path.join(this.memoryDir, 'synapse-manifest.json') },
    ];

    for (const check of checks) {
      const exists = fs.existsSync(check.path);
      subsystems.push({
        name: check.name,
        status: exists ? 'healthy' : 'missing',
        issues: exists ? [] : [`Manifest not found: ${check.name}`],
        lastChecked: new Date().toISOString(),
      });
    }

    const hasIssues = subsystems.some((s) => s.status !== 'healthy');

    return {
      overallStatus: hasIssues ? 'degraded' : 'healthy',
      subsystems,
      totalSizeBytes: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Active Workflows
  // -----------------------------------------------------------------------

  private async getActiveWorkflows(): Promise<WorkflowStatus[]> {
    const workflowDir = path.join(this.agentxDir, 'workflows');
    if (!fs.existsSync(workflowDir)) { return []; }

    const items: WorkflowStatus[] = [];
    const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const wf = readJsonSafe<{
        issueNumber: number; workflowType: string;
        currentStep?: number; totalSteps?: number;
        agent?: string; iterationCount?: number; status?: string;
      }>(path.join(workflowDir, file));

      if (wf && wf.status !== 'completed') {
        items.push({
          issueNumber: wf.issueNumber,
          workflowType: wf.workflowType,
          currentStep: wf.currentStep ?? 1,
          totalSteps: wf.totalSteps ?? 5,
          agent: wf.agent ?? 'unknown',
          iterationCount: wf.iterationCount ?? 0,
          status: (wf.status as WorkflowStatus['status']) ?? 'running',
        });
      }
    }

    return items;
  }
}
