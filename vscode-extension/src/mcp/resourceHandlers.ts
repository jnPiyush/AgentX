// ---------------------------------------------------------------------------
// AgentX -- MCP Server: Resource Handlers
// ---------------------------------------------------------------------------
//
// Handler functions for MCP resource URIs.
// Each handler reads state from disk and returns structured JSON.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 5.2.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe } from '../utils/fileLock';
import {
  type ReadyQueueItem,
  type AgentStateItem,
} from './mcpTypes';

// ---------------------------------------------------------------------------
// Resource result envelope
// ---------------------------------------------------------------------------

export interface ResourceResult {
  readonly uri: string;
  readonly mimeType: string;
  readonly text: string;
}

// ---------------------------------------------------------------------------
// agentx://ready-queue
// ---------------------------------------------------------------------------

export function handleReadyQueue(agentxDir: string): ResourceResult {
  const issuesDir = path.join(agentxDir, 'issues');
  const items: ReadyQueueItem[] = [];

  if (fs.existsSync(issuesDir)) {
    const files = fs.readdirSync(issuesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const issue = readJsonSafe<{
        number: number; title: string; type: string;
        priority: string | null; status: string; labels: string[];
        createdAt: string;
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
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { 'priority:p0': 0, 'priority:p1': 1, 'priority:p2': 2, 'priority:p3': 3, p0: 0, p1: 1, p2: 2, p3: 3 };
  items.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));

  return {
    uri: 'agentx://ready-queue',
    mimeType: 'application/json',
    text: JSON.stringify(items, null, 2),
  };
}

// ---------------------------------------------------------------------------
// agentx://agent-states
// ---------------------------------------------------------------------------

export function handleAgentStates(agentxDir: string): ResourceResult {
  const stateDir = path.join(agentxDir, 'state');
  const items: AgentStateItem[] = [];

  if (fs.existsSync(stateDir)) {
    const files = fs.readdirSync(stateDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const state = readJsonSafe<{
        agent: string; state: string;
        issueNumber?: number; updatedAt?: string;
        lastAction?: string;
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
  }

  return {
    uri: 'agentx://agent-states',
    mimeType: 'application/json',
    text: JSON.stringify(items, null, 2),
  };
}

// ---------------------------------------------------------------------------
// agentx://health
// ---------------------------------------------------------------------------

export function handleHealth(memoryDir: string): ResourceResult {
  const report: {
    status: 'healthy' | 'degraded' | 'error';
    stores: Record<string, { exists: boolean; entryCount: number }>;
    timestamp: string;
  } = {
    status: 'healthy',
    stores: {},
    timestamp: new Date().toISOString(),
  };

  // Check observations
  const obsManifest = readJsonSafe<{ entries: unknown[] }>(path.join(memoryDir, 'manifest.json'));
  report.stores['observations'] = {
    exists: obsManifest !== null,
    entryCount: obsManifest?.entries?.length ?? 0,
  };

  // Check outcomes
  const outManifest = readJsonSafe<{ entries: unknown[] }>(path.join(memoryDir, 'outcomes', 'outcome-manifest.json'));
  report.stores['outcomes'] = {
    exists: outManifest !== null,
    entryCount: outManifest?.entries?.length ?? 0,
  };

  // Check sessions
  const sesManifest = readJsonSafe<{ entries: unknown[] }>(path.join(memoryDir, 'sessions', 'session-manifest.json'));
  report.stores['sessions'] = {
    exists: sesManifest !== null,
    entryCount: sesManifest?.entries?.length ?? 0,
  };

  // Check synapse
  const synManifest = readJsonSafe<{ links: unknown[] }>(path.join(memoryDir, 'synapse-manifest.json'));
  report.stores['synapse'] = {
    exists: synManifest !== null,
    entryCount: synManifest?.links?.length ?? 0,
  };

  if (!obsManifest && !outManifest && !sesManifest) {
    report.status = 'error';
  }

  return {
    uri: 'agentx://health',
    mimeType: 'application/json',
    text: JSON.stringify(report, null, 2),
  };
}

// ---------------------------------------------------------------------------
// agentx://outcomes
// ---------------------------------------------------------------------------

export function handleOutcomes(memoryDir: string): ResourceResult {
  const outManifest = readJsonSafe<{ entries: Array<{ id: string; issueNumber?: number; result?: string; lesson?: string; timestamp?: string }> }>(
    path.join(memoryDir, 'outcomes', 'outcome-manifest.json'),
  );

  const entries = outManifest?.entries ?? [];
  const recent = entries.slice(-50); // Last 50

  return {
    uri: 'agentx://outcomes',
    mimeType: 'application/json',
    text: JSON.stringify(recent, null, 2),
  };
}

// ---------------------------------------------------------------------------
// agentx://sessions
// ---------------------------------------------------------------------------

export function handleSessions(memoryDir: string): ResourceResult {
  const sesManifest = readJsonSafe<{ entries: Array<{ id: string; issueNumber?: number; agent?: string; startedAt?: string; description?: string }> }>(
    path.join(memoryDir, 'sessions', 'session-manifest.json'),
  );

  const entries = sesManifest?.entries ?? [];
  const recent = entries.slice(-30); // Last 30

  return {
    uri: 'agentx://sessions',
    mimeType: 'application/json',
    text: JSON.stringify(recent, null, 2),
  };
}

// ---------------------------------------------------------------------------
// agentx://synapse-links
// ---------------------------------------------------------------------------

export function handleSynapseLinks(memoryDir: string): ResourceResult {
  const synManifest = readJsonSafe<{ links: unknown[] }>(
    path.join(memoryDir, 'synapse-manifest.json'),
  );

  return {
    uri: 'agentx://synapse-links',
    mimeType: 'application/json',
    text: JSON.stringify(synManifest?.links ?? [], null, 2),
  };
}

// ---------------------------------------------------------------------------
// agentx://knowledge
// ---------------------------------------------------------------------------

export function handleKnowledge(knowledgeDir: string): ResourceResult {
  const gkManifest = readJsonSafe<{ entries: unknown[] }>(
    path.join(knowledgeDir, 'global-manifest.json'),
  );

  return {
    uri: 'agentx://knowledge',
    mimeType: 'application/json',
    text: JSON.stringify(gkManifest?.entries ?? [], null, 2),
  };
}
