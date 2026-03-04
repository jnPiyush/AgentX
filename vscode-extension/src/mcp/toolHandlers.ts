// ---------------------------------------------------------------------------
// AgentX -- MCP Server: Tool Handlers
// ---------------------------------------------------------------------------
//
// Self-contained handler functions for each MCP tool.
// Each handler receives typed input and returns a string result.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 5.1.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe } from '../utils/fileLock';
import {
  type SetAgentStateInput,
  type CreateIssueInput,
  type TriggerWorkflowInput,
  type MemorySearchInput,
  VALID_AGENTS,
  VALID_STATES,
  VALID_ISSUE_TYPES,
  VALID_PRIORITIES,
  VALID_WORKFLOW_TYPES,
  VALID_SEARCH_STORES,
} from './mcpTypes';

// ---------------------------------------------------------------------------
// Tool result type
// ---------------------------------------------------------------------------

export interface ToolResult {
  readonly success: boolean;
  readonly message: string;
  readonly data?: unknown;
}

// ---------------------------------------------------------------------------
// set-agent-state
// ---------------------------------------------------------------------------

export function handleSetAgentState(
  input: SetAgentStateInput,
  agentxDir: string,
): ToolResult {
  // Validate
  if (!VALID_AGENTS.includes(input.agent)) {
    return { success: false, message: `Invalid agent: ${input.agent}. Valid: ${VALID_AGENTS.join(', ')}` };
  }
  if (!VALID_STATES.includes(input.state)) {
    return { success: false, message: `Invalid state: ${input.state}. Valid: ${VALID_STATES.join(', ')}` };
  }

  const stateDir = path.join(agentxDir, 'state');
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  const stateFile = path.join(stateDir, `${input.agent}.json`);
  const stateData = {
    agent: input.agent,
    state: input.state,
    issueNumber: input.issueNumber ?? null,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');

  return {
    success: true,
    message: `Agent ${input.agent} state set to ${input.state}${input.issueNumber ? ` for issue #${input.issueNumber}` : ''}`,
    data: stateData,
  };
}

// ---------------------------------------------------------------------------
// create-issue (local mode)
// ---------------------------------------------------------------------------

export function handleCreateIssue(
  input: CreateIssueInput,
  agentxDir: string,
): ToolResult {
  // Validate type
  if (!VALID_ISSUE_TYPES.includes(input.type)) {
    return { success: false, message: `Invalid issue type: ${input.type}. Valid: ${VALID_ISSUE_TYPES.join(', ')}` };
  }
  if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
    return { success: false, message: `Invalid priority: ${input.priority}. Valid: ${VALID_PRIORITIES.join(', ')}` };
  }

  const issuesDir = path.join(agentxDir, 'issues');
  if (!fs.existsSync(issuesDir)) {
    fs.mkdirSync(issuesDir, { recursive: true });
  }

  // Find next issue number
  let nextNumber = 1;
  const existing = fs.readdirSync(issuesDir).filter((f) => f.endsWith('.json'));
  for (const file of existing) {
    const num = parseInt(file.replace('.json', ''), 10);
    if (!isNaN(num) && num >= nextNumber) {
      nextNumber = num + 1;
    }
  }

  const issue = {
    number: nextNumber,
    title: input.title,
    type: `type:${input.type}`,
    priority: input.priority ? `priority:${input.priority}` : null,
    status: 'Backlog',
    description: input.description ?? '',
    labels: [
      `type:${input.type}`,
      ...(input.priority ? [`priority:${input.priority}`] : []),
      ...(input.labels ?? []),
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const issuePath = path.join(issuesDir, `${nextNumber}.json`);
  fs.writeFileSync(issuePath, JSON.stringify(issue, null, 2), 'utf-8');

  return {
    success: true,
    message: `Issue #${nextNumber} created: ${input.title}`,
    data: issue,
  };
}

// ---------------------------------------------------------------------------
// trigger-workflow
// ---------------------------------------------------------------------------

export function handleTriggerWorkflow(
  input: TriggerWorkflowInput,
  agentxDir: string,
): ToolResult {
  if (!VALID_WORKFLOW_TYPES.includes(input.workflowType)) {
    return { success: false, message: `Invalid workflow type: ${input.workflowType}. Valid: ${VALID_WORKFLOW_TYPES.join(', ')}` };
  }

  // Check issue exists
  const issuesDir = path.join(agentxDir, 'issues');
  const issuePath = path.join(issuesDir, `${input.issueNumber}.json`);
  if (!fs.existsSync(issuePath)) {
    return { success: false, message: `Issue #${input.issueNumber} not found` };
  }

  // Record workflow trigger
  const workflowDir = path.join(agentxDir, 'workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }

  const trigger = {
    issueNumber: input.issueNumber,
    workflowType: input.workflowType,
    triggeredAt: new Date().toISOString(),
    status: 'triggered',
  };

  const triggerPath = path.join(workflowDir, `workflow-${input.issueNumber}.json`);
  fs.writeFileSync(triggerPath, JSON.stringify(trigger, null, 2), 'utf-8');

  return {
    success: true,
    message: `Workflow '${input.workflowType}' triggered for issue #${input.issueNumber}`,
    data: trigger,
  };
}

// ---------------------------------------------------------------------------
// memory-search
// ---------------------------------------------------------------------------

export function handleMemorySearch(
  input: MemorySearchInput,
  memoryDir: string,
): ToolResult {
  const store = input.store ?? 'all';
  if (!VALID_SEARCH_STORES.includes(store)) {
    return { success: false, message: `Invalid store: ${store}. Valid: ${VALID_SEARCH_STORES.join(', ')}` };
  }

  const limit = input.limit ?? 10;
  const query = input.query.toLowerCase();
  const results: Array<{ store: string; id: string; summary: string }> = [];

  // Search observations
  if (store === 'all' || store === 'observations') {
    const manifestPath = path.join(memoryDir, 'manifest.json');
    const manifest = readJsonSafe<{ entries: Array<{ id: string; summary: string }> }>(manifestPath);
    if (manifest?.entries) {
      for (const entry of manifest.entries) {
        if (entry.summary.toLowerCase().includes(query)) {
          results.push({ store: 'observations', id: entry.id, summary: entry.summary });
        }
      }
    }
  }

  // Search outcomes
  if (store === 'all' || store === 'outcomes') {
    const outManifestPath = path.join(memoryDir, 'outcomes', 'outcome-manifest.json');
    const outManifest = readJsonSafe<{ entries: Array<{ id: string; lesson: string }> }>(outManifestPath);
    if (outManifest?.entries) {
      for (const entry of outManifest.entries) {
        if (entry.lesson?.toLowerCase().includes(query)) {
          results.push({ store: 'outcomes', id: entry.id, summary: entry.lesson });
        }
      }
    }
  }

  // Search sessions
  if (store === 'all' || store === 'sessions') {
    const sesManifestPath = path.join(memoryDir, 'sessions', 'session-manifest.json');
    const sesManifest = readJsonSafe<{ entries: Array<{ id: string; description: string }> }>(sesManifestPath);
    if (sesManifest?.entries) {
      for (const entry of sesManifest.entries) {
        if (entry.description?.toLowerCase().includes(query)) {
          results.push({ store: 'sessions', id: entry.id, summary: entry.description });
        }
      }
    }
  }

  // Trim to limit
  const trimmed = results.slice(0, limit);

  return {
    success: true,
    message: `Found ${trimmed.length} result(s) for "${input.query}"`,
    data: trimmed,
  };
}
