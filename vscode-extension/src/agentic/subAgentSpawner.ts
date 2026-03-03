// ---------------------------------------------------------------------------
// AgentX -- Sub-Agent Spawner
// ---------------------------------------------------------------------------
//
// Generalized module for spawning sub-agents. A sub-agent is a lightweight
// agentic loop that runs with a specific role's persona, loaded from its
// .agent.md definition file.
//
// Both the SelfReviewLoop and ClarificationLoop depend on this module to
// create sub-agents. It abstracts the differences between:
//   - Chat mode: VS Code Language Model API (Copilot Chat experience)
//   - CLI mode: GitHub Models API / Copilot API (agentic-runner.ps1)
//
// Sub-agents get their own ToolRegistry, session, and loop-detection,
// but share the same workspace root for tool execution.
// ---------------------------------------------------------------------------

import { AgenticLoop, AgenticLoopConfig, LlmAdapter, LoopSummary, LoopExitReason } from './agenticLoop';
import { ToolRegistry } from './toolEngine';
import { SessionMessage } from './sessionState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for spawning a sub-agent. */
export interface SubAgentConfig {
  /** Role name of the sub-agent (e.g., 'engineer', 'architect'). */
  readonly role: string;
  /** Maximum iterations for the sub-agent's internal loop. Default: 5. */
  readonly maxIterations?: number;
  /** Token budget for the sub-agent. Default: 20_000. */
  readonly tokenBudget?: number;
  /** Custom system prompt override. If not set, built from .agent.md. */
  readonly systemPromptOverride?: string;
  /** Workspace root for tool access. */
  readonly workspaceRoot: string;
  /** Whether to include workspace tools in the sub-agent. Default: true. */
  readonly includeTools?: boolean;
}

/** Result from a sub-agent execution. */
export interface SubAgentResult {
  /** The sub-agent's final response text. */
  readonly response: string;
  /** Number of iterations used. */
  readonly iterations: number;
  /** How the sub-agent loop exited. */
  readonly exitReason: LoopExitReason;
  /** Total tool calls made by the sub-agent. */
  readonly toolCalls: number;
  /** Duration in milliseconds. */
  readonly durationMs: number;
}

/**
 * Factory for creating LLM adapters. Abstracts Chat mode vs CLI mode.
 * - Chat mode: Uses VS Code LM API via selectModelForAgent
 * - CLI mode: Uses GitHub Models API / Copilot API
 *
 * Returns null if no model is available (sub-agent will return a stub).
 */
export type LlmAdapterFactory = (
  role: string,
  agentDef: AgentDefLike | undefined,
) => Promise<LlmAdapter | null>;

/**
 * Minimal agent definition interface so the spawner doesn't depend on
 * AgentXContext directly (makes it testable and CLI-compatible).
 */
export interface AgentDefLike {
  readonly name: string;
  readonly description: string;
  readonly model: string;
  readonly modelFallback?: string;
}

/**
 * Loader interface for loading agent definitions and instructions.
 * In Chat mode, this wraps AgentXContext + agentContextLoader.
 * In CLI mode, this wraps the PowerShell Read-AgentDef equivalent.
 */
export interface AgentLoader {
  /** Load parsed agent definition from .agent.md frontmatter. */
  loadDef(role: string): Promise<AgentDefLike | undefined>;
  /** Load the markdown body (instructions) from .agent.md. */
  loadInstructions(role: string): Promise<string | undefined>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const SUB_AGENT_DEFAULTS = {
  maxIterations: 5,
  tokenBudget: 20_000,
  includeTools: true,
} as const;

// ---------------------------------------------------------------------------
// System Prompt Builder (for sub-agents)
// ---------------------------------------------------------------------------

/**
 * Build a system prompt for a sub-agent from its role definition and
 * instructions. Extracts Role, Constraints, and Boundaries sections.
 */
export function buildSubAgentSystemPrompt(
  agentDef: AgentDefLike | undefined,
  instructions: string | undefined,
  role: string,
  contextOverride?: string,
): string {
  const parts: string[] = [];

  parts.push(`You are the ${agentDef?.name ?? role} agent in the AgentX framework.`);
  parts.push('You are operating as a sub-agent within another agent\'s workflow.');
  parts.push('');

  if (agentDef?.description) {
    parts.push(`## Role\n${agentDef.description}`);
    parts.push('');
  }

  if (instructions) {
    const roleMatch = instructions.match(/## Role\n([\s\S]*?)(?=\n## |\n---)/);
    if (roleMatch) {
      parts.push('## Detailed Role\n' + roleMatch[1].trim());
      parts.push('');
    }

    const constraintMatch = instructions.match(/## Constraints[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
    if (constraintMatch) {
      parts.push('## Constraints\n' + constraintMatch[1].trim());
      parts.push('');
    }

    const boundaryMatch = instructions.match(/## Boundaries[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
    if (boundaryMatch) {
      parts.push('## Boundaries\n' + boundaryMatch[1].trim());
      parts.push('');
    }
  }

  if (contextOverride) {
    parts.push(contextOverride);
    parts.push('');
  }

  parts.push('## Tool Usage');
  parts.push('You have workspace tools available (file_read, file_write, file_edit, grep_search, list_dir, terminal_exec).');
  parts.push('Use them to explore the codebase and complete tasks. When done, provide a text summary.');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Sub-Agent Spawner
// ---------------------------------------------------------------------------

/**
 * Spawn a sub-agent with a specific role persona and run it against a prompt.
 *
 * This is the core building block used by both SelfReviewLoop and
 * ClarificationLoop. It:
 *   1. Loads the role's agent definition and instructions
 *   2. Builds a system prompt from the role's .agent.md
 *   3. Creates a mini AgenticLoop with the role's persona
 *   4. Runs the loop against the given prompt
 *   5. Returns the sub-agent's response
 *
 * @param config - Sub-agent configuration
 * @param prompt - The prompt/task for the sub-agent
 * @param llmFactory - Factory to create an LLM adapter for the sub-agent
 * @param agentLoader - Loader for agent definitions and instructions
 * @param abortSignal - Abort signal for cancellation
 * @returns The sub-agent's result
 */
export async function spawnSubAgent(
  config: SubAgentConfig,
  prompt: string,
  llmFactory: LlmAdapterFactory,
  agentLoader: AgentLoader,
  abortSignal: AbortSignal,
): Promise<SubAgentResult> {
  const maxIter = config.maxIterations ?? SUB_AGENT_DEFAULTS.maxIterations;
  const tokenBudget = config.tokenBudget ?? SUB_AGENT_DEFAULTS.tokenBudget;
  const includeTools = config.includeTools ?? SUB_AGENT_DEFAULTS.includeTools;

  // 1. Load role definition and instructions
  const agentDef = await agentLoader.loadDef(config.role);
  const instructions = await agentLoader.loadInstructions(config.role);

  // 2. Build system prompt
  const systemPrompt = config.systemPromptOverride
    ?? buildSubAgentSystemPrompt(agentDef, instructions, config.role);

  // 3. Get LLM adapter
  const adapter = await llmFactory(config.role, agentDef);

  if (!adapter) {
    // No model available -- return a stub response based on instructions.
    // This should be rare now that the parent adapter is passed as fallback.
    console.warn(
      `[AgentX] Sub-agent "${config.role}" could not obtain an LLM adapter. `
      + 'Returning degraded stub response.',
    );
    return {
      response: `[${config.role}] Model not available. `
        + `Based on role definition:\n\n${instructions?.slice(0, 500) ?? 'No instructions available.'}`,
      iterations: 0,
      exitReason: 'error',
      toolCalls: 0,
      durationMs: 0,
    };
  }

  // 4. Create a mini agentic loop
  const toolRegistry = includeTools ? new ToolRegistry() : createMinimalToolRegistry();

  const loopConfig: Partial<AgenticLoopConfig> = {
    agentName: `sub:${config.role}`,
    systemPrompt,
    maxIterations: maxIter,
    tokenBudget,
    workspaceRoot: config.workspaceRoot,
  };

  const loop = new AgenticLoop(loopConfig, toolRegistry);

  // 5. Run the loop
  const summary: LoopSummary = await loop.run(prompt, adapter, abortSignal);

  return {
    response: summary.finalText || '(No response from sub-agent)',
    iterations: summary.iterations,
    exitReason: summary.exitReason,
    toolCalls: summary.toolCallsExecuted,
    durationMs: summary.durationMs,
  };
}

/**
 * Create a minimal ToolRegistry with only read-only tools.
 * Used when sub-agents should not mutate workspace files.
 */
function createMinimalToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  // Unregister mutating tools -- keep only read tools
  registry.unregister('file_write');
  registry.unregister('file_edit');
  registry.unregister('terminal_exec');
  registry.unregister('request_clarification');
  registry.unregister('validate_done');
  return registry;
}

/**
 * Spawn a sub-agent with a multi-turn conversation instead of a single prompt.
 * Used internally by the self-review and clarification loops for iterative
 * back-and-forth exchanges.
 *
 * @param config - Sub-agent configuration
 * @param messages - Conversation messages to seed (excluding system prompt)
 * @param llmFactory - Factory to create an LLM adapter for the sub-agent
 * @param agentLoader - Loader for agent definitions and instructions
 * @param abortSignal - Abort signal for cancellation
 * @returns The sub-agent's result
 */
export async function spawnSubAgentWithHistory(
  config: SubAgentConfig,
  messages: readonly SessionMessage[],
  llmFactory: LlmAdapterFactory,
  agentLoader: AgentLoader,
  abortSignal: AbortSignal,
): Promise<SubAgentResult> {
  const maxIter = config.maxIterations ?? SUB_AGENT_DEFAULTS.maxIterations;
  const tokenBudget = config.tokenBudget ?? SUB_AGENT_DEFAULTS.tokenBudget;
  const includeTools = config.includeTools ?? SUB_AGENT_DEFAULTS.includeTools;

  // 1. Load role definition and instructions
  const agentDef = await agentLoader.loadDef(config.role);
  const instructions = await agentLoader.loadInstructions(config.role);

  // 2. Build system prompt
  const systemPrompt = config.systemPromptOverride
    ?? buildSubAgentSystemPrompt(agentDef, instructions, config.role);

  // 3. Get LLM adapter
  const adapter = await llmFactory(config.role, agentDef);

  if (!adapter) {
    console.warn(
      `[AgentX] Sub-agent "${config.role}" (with history) could not obtain an LLM adapter. `
      + 'Returning degraded stub response.',
    );
    return {
      response: `[${config.role}] Model not available.`,
      iterations: 0,
      exitReason: 'error',
      toolCalls: 0,
      durationMs: 0,
    };
  }

  // 4. Create the loop and seed history
  const toolRegistry = includeTools ? new ToolRegistry() : createMinimalToolRegistry();

  const loopConfig: Partial<AgenticLoopConfig> = {
    agentName: `sub:${config.role}`,
    systemPrompt,
    maxIterations: maxIter,
    tokenBudget,
    workspaceRoot: config.workspaceRoot,
  };

  const loop = new AgenticLoop(loopConfig, toolRegistry);

  // Use the first user message as the prompt, seed remaining as history
  // The run() method adds system + user prompt automatically
  const userMessages = messages.filter(m => m.role === 'user');
  const firstUserMsg = userMessages[0]?.content ?? '';

  const summary: LoopSummary = await loop.run(firstUserMsg, adapter, abortSignal);

  return {
    response: summary.finalText || '(No response from sub-agent)',
    iterations: summary.iterations,
    exitReason: summary.exitReason,
    toolCalls: summary.toolCallsExecuted,
    durationMs: summary.durationMs,
  };
}
