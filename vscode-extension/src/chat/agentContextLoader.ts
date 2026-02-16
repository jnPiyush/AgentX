import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

/**
 * Cache of loaded agent instructions (markdown body, without frontmatter).
 * Keyed by agent filename. Cleared on refresh.
 */
const instructionCache = new Map<string, string>();

/**
 * Load the markdown body (instructions) from an agent definition file.
 * Returns content after the YAML frontmatter closing '---', or undefined
 * if the file does not exist.
 */
export async function loadAgentInstructions(
  agentx: AgentXContext,
  agentFileName: string
): Promise<string | undefined> {
  if (instructionCache.has(agentFileName)) {
    return instructionCache.get(agentFileName);
  }

  const root = agentx.workspaceRoot;
  if (!root) { return undefined; }

  const filePath = path.join(root, '.github', 'agents', agentFileName);
  if (!fs.existsSync(filePath)) { return undefined; }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract everything after the closing frontmatter delimiter
  const firstDelim = content.indexOf('---');
  if (firstDelim === -1) { return undefined; }
  const fmEnd = content.indexOf('\n---', firstDelim + 3);
  if (fmEnd === -1) { return undefined; }

  const body = content.substring(fmEnd + 4).trim();
  instructionCache.set(agentFileName, body);
  return body;
}

/**
 * Load all agent summaries (name + description + fileName).
 */
export async function loadAllAgentSummaries(
  agentx: AgentXContext
): Promise<Array<{ name: string; description: string; fileName: string }>> {
  const agents = await agentx.listAgents();
  return agents.map(a => ({
    name: a.name,
    description: a.description,
    fileName: a.fileName,
  }));
}

/**
 * Clear the instruction cache. Call after refresh or reinitialization.
 */
export function clearInstructionCache(): void {
  instructionCache.clear();
}
