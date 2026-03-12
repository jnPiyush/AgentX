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

export const REQUIRED_AGENT_TOOLS = [
  'codebase',
  'editFiles',
  'search',
  'changes',
  'runCommands',
  'problems',
  'usages',
  'fetch',
  'think',
  'github/*',
] as const;

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
 * Verify that Agent X is equipped for autonomous orchestration and direct execution.
 */
export function validateAgentXAutonomous(agents: AgentDef[]): AgentCheckResult[] {
  const results: AgentCheckResult[] = [];
  const agentX = agents.find((a) => {
    const normalized = a.name.toLowerCase();
    return normalized.includes('agent-x') || normalized.includes('agentx auto');
  });

  if (!agentX) {
    results.push({
      agent: 'agent-x',
      check: 'autonomous-capability',
      passed: false,
      detail: 'AgentX Auto definition not found',
    });
    return results;
  }

  // Agent X should have the core tools required for direct execution.
  const requiredTools = ['editFiles', 'runCommands'];
  for (const tool of requiredTools) {
    const hasTool = agentX.tools.some(
      (t) => t.toLowerCase().includes(tool.toLowerCase())
    );
    results.push({
      agent: agentX.name,
      check: 'autonomous-tools',
      passed: hasTool,
      detail: hasTool
        ? `AgentX Auto includes required tool: ${tool}`
        : `AgentX Auto is missing required tool: ${tool}`,
    });
  }

  return results;
}

/**
 * Verify that every agent definition includes the standard minimum tool baseline.
 */
export function validateMinimumTooling(
  agents: AgentDef[],
  requiredTools: readonly string[] = REQUIRED_AGENT_TOOLS
): AgentCheckResult[] {
  return agents.map((agent) => {
    const toolSet = new Set(agent.tools.map((tool) => tool.toLowerCase()));
    const missing = requiredTools.filter((tool) => !toolSet.has(tool.toLowerCase()));

    return {
      agent: agent.name,
      check: 'minimum-tooling',
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? 'Agent includes the standard minimum tool set'
          : `Missing tools: ${missing.join(', ')}`,
    };
  });
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
  let currentArrayKey: string | null = null;

  for (const rawLine of yaml.split(/\r?\n/)) {
    const arrayItemMatch = rawLine.match(/^\s+-\s+(.*)$/);
    if (arrayItemMatch && currentArrayKey) {
      const currentValue = result[currentArrayKey];
      if (Array.isArray(currentValue)) {
        currentValue.push(stripQuotes(arrayItemMatch[1].trim()));
      }
      continue;
    }

    const keyValueMatch = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!keyValueMatch) {
      currentArrayKey = null;
      continue;
    }

    const key = keyValueMatch[1].trim();
    const rawValue = keyValueMatch[2].trim();

    if (rawValue === '') {
      if (key === 'tools' || key === 'agents' || key === 'constraints') {
        result[key] = [];
        currentArrayKey = key;
      } else {
        currentArrayKey = null;
      }
      continue;
    }

    currentArrayKey = null;
    result[key] = parseScalarValue(rawValue);
  }

  return result;
}

function parseScalarValue(value: string): unknown {
  if (value === '[]') {
    return [];
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => stripQuotes(item.trim()))
      .filter((item) => item.length > 0);
  }

  return stripQuotes(value);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
