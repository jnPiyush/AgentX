import { AgentXContext } from '../agentxContext';
/**
 * Load the markdown body (instructions) from an agent definition file.
 * Returns content after the YAML frontmatter closing '---', or undefined
 * if the file does not exist.
 */
export declare function loadAgentInstructions(agentx: AgentXContext, agentFileName: string): Promise<string | undefined>;
/**
 * Load all agent summaries (name + description + fileName).
 */
export declare function loadAllAgentSummaries(agentx: AgentXContext): Promise<Array<{
    name: string;
    description: string;
    fileName: string;
}>>;
/**
 * Clear the instruction cache. Call after refresh or reinitialization.
 */
export declare function clearInstructionCache(): void;
//# sourceMappingURL=agentContextLoader.d.ts.map