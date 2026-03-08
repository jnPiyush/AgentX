/**
 * Agent Runner Integration Test Helpers
 *
 * Provides utilities for testing agent routing, handoff, and constraint enforcement
 * in an integrated environment (without mocking the agent definitions).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Minimal parsed agent definition */
interface AgentDef {
  name: string;
  description: string;
  model: string;
  tools: string[];
  agents: string[];
  filePath: string;
}

/** Test result for a single agent check */
interface AgentCheckResult {
  agent: string;
  check: string;
  passed: boolean;
  detail: string;
}

/**
 * Load and parse all agent definitions from the agents directory.
 */
export function loadAgentDefinitions(agentsDir: string): AgentDef[] {
  const agents: AgentDef[] = [];
  const files = findAgentFiles(agentsDir);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(content);
    if (frontmatter) {
      agents.push({
        name: (frontmatter.name as string) || path.basename(filePath, '.agent.md'),
        description: (frontmatter.description as string) || '',
        model: (frontmatter.model as string) || '',
        tools: Array.isArray(frontmatter.tools) ? frontmatter.tools : [],
        agents: Array.isArray(frontmatter.agents) ? frontmatter.agents : [],
        filePath,
      });
    }
  }

  return agents;
}

/**
 * Validate that all agent cross-references resolve to actual agent files.
 */
export function validateAgentReferences(agents: AgentDef[]): AgentCheckResult[] {
  const results: AgentCheckResult[] = [];
  const knownNames = new Set(agents.map((a) => a.name));

  for (const agent of agents) {
    for (const ref of agent.agents) {
      const passed = knownNames.has(ref);
      results.push({
        agent: agent.name,
        check: 'agent-reference',
        passed,
        detail: passed
          ? `Reference to '${ref}' resolves`
          : `Reference to '${ref}' NOT found in agent definitions`,
      });
    }
  }

  return results;
}

/**
 * Check that no agent definition exceeds the token budget.
 */
export function validateTokenBudgets(
  agents: AgentDef[],
  externalLimit: number = 6000,
  internalLimit: number = 4000
): AgentCheckResult[] {
  const results: AgentCheckResult[] = [];

  for (const agent of agents) {
    const content = fs.readFileSync(agent.filePath, 'utf8');
    const tokens = Math.ceil(content.length / 4);
    const isInternal = agent.filePath.includes('internal');
    const limit = isInternal ? internalLimit : externalLimit;
    const passed = tokens <= limit;

    results.push({
      agent: agent.name,
      check: 'token-budget',
      passed,
      detail: `${tokens} tokens (limit: ${limit})${passed ? '' : ' EXCEEDS LIMIT'}`,
    });
  }

  return results;
}

/**
 * Verify that Agent X does not have implementation tools (coding, file creation).
 */
export function validateAgentXDelegationOnly(agents: AgentDef[]): AgentCheckResult[] {
  const results: AgentCheckResult[] = [];
  const agentX = agents.find((a) => a.name.toLowerCase().includes('agent-x'));

  if (!agentX) {
    results.push({
      agent: 'agent-x',
      check: 'delegation-only',
      passed: false,
      detail: 'Agent X definition not found',
    });
    return results;
  }

  // Agent X should not have file-editing tools
  const forbiddenTools = ['editFiles', 'createFile', 'runTerminal'];
  for (const tool of forbiddenTools) {
    const hasTool = agentX.tools.some(
      (t) => t.toLowerCase().includes(tool.toLowerCase())
    );
    results.push({
      agent: agentX.name,
      check: 'no-implementation-tools',
      passed: !hasTool,
      detail: hasTool
        ? `Agent X has forbidden tool: ${tool}`
        : `Correctly excludes ${tool}`,
    });
  }

  return results;
}

// -- Internal helpers --

function findAgentFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAgentFiles(full));
    } else if (entry.name.endsWith('.agent.md')) {
      results.push(full);
    }
  }
  return results;
}

function parseFrontmatter(
  content: string
): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let value: unknown = line.substring(colonIdx + 1).trim();

    // Handle simple arrays (- item format handled below)
    if (typeof value === 'string' && value.startsWith('[')) {
      try {
        value = JSON.parse((value as string).replace(/'/g, '"'));
      } catch {
        // keep as string
      }
    }
    if (key && value !== '') {
      result[key] = value;
    }
  }

  return result;
}
