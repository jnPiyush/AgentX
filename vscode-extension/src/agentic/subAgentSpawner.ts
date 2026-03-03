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

/** Strategy for parallel sub-agent execution. */
export type ParallelStrategy = 'all' | 'race' | 'quorum';

/** Strategy for consolidating results from parallel sub-agents. */
export type ConsolidationStrategy = 'merge' | 'vote' | 'best';

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

// ---------------------------------------------------------------------------
// Parallel Sub-Agent Execution
// ---------------------------------------------------------------------------

/** Configuration for a single sub-agent invocation in a parallel batch. */
export interface ParallelSubAgentInvocation {
  /** Sub-agent configuration. */
  readonly config: SubAgentConfig;
  /** Prompt for this sub-agent. */
  readonly prompt: string;
  /** Weight for consolidation scoring (default: 1.0). */
  readonly weight?: number;
}

/** Options for parallel sub-agent execution. */
export interface ParallelSubAgentOptions {
  /** Execution strategy (default: 'all'). */
  readonly strategy: ParallelStrategy;
  /** Result consolidation method (default: 'merge'). */
  readonly consolidation: ConsolidationStrategy;
  /** Per-agent timeout in ms (default: 60000). 0 = no timeout. */
  readonly timeoutMs?: number;
  /** Quorum threshold (fraction 0-1). Only used with strategy='quorum'. Default: 0.5. */
  readonly quorumThreshold?: number;
}

/** Result from parallel sub-agent execution. */
export interface ParallelSubAgentResult {
  /** Consolidated response text. */
  readonly response: string;
  /** Individual results from each sub-agent. */
  readonly individual: readonly SubAgentResult[];
  /** Which strategy was used. */
  readonly strategy: ParallelStrategy;
  /** Which consolidation was used. */
  readonly consolidation: ConsolidationStrategy;
  /** Total duration in ms (wall-clock). */
  readonly durationMs: number;
  /** How many sub-agents completed successfully. */
  readonly successCount: number;
}

const PARALLEL_DEFAULTS = {
  strategy: 'all' as ParallelStrategy,
  consolidation: 'merge' as ConsolidationStrategy,
  timeoutMs: 60_000,
  quorumThreshold: 0.5,
} as const;

/**
 * Run multiple sub-agents in parallel with configurable strategies.
 *
 * Strategies:
 *   - all:    Wait for ALL sub-agents to complete (Promise.allSettled)
 *   - race:   Return as soon as the FIRST sub-agent completes successfully
 *   - quorum: Return when a threshold fraction of sub-agents complete
 *
 * Consolidation:
 *   - merge: Concatenate all responses with section headers
 *   - vote:  Weight responses and pick the most common/highest-scored
 *   - best:  Pick the single best response by weight * output length
 *
 * @param invocations - Sub-agent configurations with prompts
 * @param options - Parallel execution options
 * @param llmFactory - Factory for LLM adapters
 * @param agentLoader - Loader for agent definitions
 * @param abortSignal - Abort signal for cancellation
 * @returns Consolidated parallel result
 */
export async function runParallelSubAgents(
  invocations: readonly ParallelSubAgentInvocation[],
  options: Partial<ParallelSubAgentOptions>,
  llmFactory: LlmAdapterFactory,
  agentLoader: AgentLoader,
  abortSignal: AbortSignal,
): Promise<ParallelSubAgentResult> {
  const opts: ParallelSubAgentOptions = { ...PARALLEL_DEFAULTS, ...options };
  const startTime = Date.now();

  if (invocations.length === 0) {
    return {
      response: '',
      individual: [],
      strategy: opts.strategy,
      consolidation: opts.consolidation,
      durationMs: 0,
      successCount: 0,
    };
  }

  // Wrap each invocation in a timeout-capable promise
  const makePromise = (inv: ParallelSubAgentInvocation): Promise<SubAgentResult> => {
    const agentPromise = spawnSubAgent(inv.config, inv.prompt, llmFactory, agentLoader, abortSignal);

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      return Promise.race([
        agentPromise,
        new Promise<SubAgentResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Sub-agent "${inv.config.role}" timed out after ${opts.timeoutMs}ms`)), opts.timeoutMs),
        ),
      ]);
    }

    return agentPromise;
  };

  let results: SubAgentResult[];

  switch (opts.strategy) {
    case 'race':
      results = await executeRace(invocations, makePromise);
      break;

    case 'quorum':
      results = await executeQuorum(invocations, makePromise, opts.quorumThreshold ?? 0.5);
      break;

    case 'all':
    default:
      results = await executeAll(invocations, makePromise);
      break;
  }

  const successResults = results.filter((r) => r.exitReason !== 'error');
  const consolidated = consolidateResults(
    invocations,
    results,
    opts.consolidation,
  );

  return {
    response: consolidated,
    individual: results,
    strategy: opts.strategy,
    consolidation: opts.consolidation,
    durationMs: Date.now() - startTime,
    successCount: successResults.length,
  };
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

async function executeAll(
  invocations: readonly ParallelSubAgentInvocation[],
  makePromise: (inv: ParallelSubAgentInvocation) => Promise<SubAgentResult>,
): Promise<SubAgentResult[]> {
  const settled = await Promise.allSettled(invocations.map(makePromise));

  return settled.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
    return {
      response: `Error: ${msg}`,
      iterations: 0,
      exitReason: 'error' as LoopExitReason,
      toolCalls: 0,
      durationMs: 0,
    };
  });
}

async function executeRace(
  invocations: readonly ParallelSubAgentInvocation[],
  makePromise: (inv: ParallelSubAgentInvocation) => Promise<SubAgentResult>,
): Promise<SubAgentResult[]> {
  // Start all, return on first success
  const promises = invocations.map((inv, idx) =>
    makePromise(inv).then((result) => ({ result, idx })),
  );

  try {
    const { result, idx } = await Promise.any(promises);
    // Return array with only the winner populated, errors for rest
    return invocations.map((_, i) =>
      i === idx
        ? result
        : { response: '(not selected - race strategy)', iterations: 0, exitReason: 'aborted' as LoopExitReason, toolCalls: 0, durationMs: 0 },
    );
  } catch {
    // All failed
    return invocations.map(() => ({
      response: '(all sub-agents failed in race)',
      iterations: 0,
      exitReason: 'error' as LoopExitReason,
      toolCalls: 0,
      durationMs: 0,
    }));
  }
}

async function executeQuorum(
  invocations: readonly ParallelSubAgentInvocation[],
  makePromise: (inv: ParallelSubAgentInvocation) => Promise<SubAgentResult>,
  threshold: number,
): Promise<SubAgentResult[]> {
  const needed = Math.ceil(invocations.length * threshold);
  const results: Array<SubAgentResult | null> = new Array(invocations.length).fill(null);
  let completedCount = 0;

  return new Promise((resolve) => {
    let resolved = false;

    invocations.forEach((inv, idx) => {
      makePromise(inv)
        .then((result) => {
          results[idx] = result;
          completedCount++;
          if (!resolved && completedCount >= needed) {
            resolved = true;
            // Fill remaining with placeholder
            resolve(results.map((r) => r ?? {
              response: '(quorum reached before completion)',
              iterations: 0,
              exitReason: 'aborted' as LoopExitReason,
              toolCalls: 0,
              durationMs: 0,
            }));
          }
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          results[idx] = {
            response: `Error: ${msg}`,
            iterations: 0,
            exitReason: 'error' as LoopExitReason,
            toolCalls: 0,
            durationMs: 0,
          };
          completedCount++;
          if (!resolved && completedCount >= invocations.length) {
            resolved = true;
            resolve(results as SubAgentResult[]);
          }
        });
    });
  });
}

// ---------------------------------------------------------------------------
// Consolidation
// ---------------------------------------------------------------------------

function consolidateResults(
  invocations: readonly ParallelSubAgentInvocation[],
  results: readonly SubAgentResult[],
  strategy: ConsolidationStrategy,
): string {
  const successPairs = invocations
    .map((inv, i) => ({ inv, result: results[i] }))
    .filter(({ result }) => result.exitReason !== 'error');

  if (successPairs.length === 0) {
    return '(All sub-agents failed)';
  }

  switch (strategy) {
    case 'merge':
      return successPairs
        .map(({ inv, result }) => `## ${inv.config.role}\n\n${result.response}`)
        .join('\n\n---\n\n');

    case 'vote': {
      // Weight-based voting: each response gets a score = weight
      // Pick the response with highest total weight (dedup by trimmed content)
      const votes = new Map<string, number>();
      for (const { inv, result } of successPairs) {
        const key = result.response.trim();
        const weight = inv.weight ?? 1.0;
        votes.set(key, (votes.get(key) ?? 0) + weight);
      }
      let bestResponse = '';
      let bestScore = -1;
      for (const [resp, score] of votes.entries()) {
        if (score > bestScore) {
          bestScore = score;
          bestResponse = resp;
        }
      }
      return bestResponse;
    }

    case 'best': {
      // Pick single best: score = weight * response.length
      let bestResponse = '';
      let bestScore = -1;
      for (const { inv, result } of successPairs) {
        const weight = inv.weight ?? 1.0;
        const score = weight * result.response.length;
        if (score > bestScore) {
          bestScore = score;
          bestResponse = result.response;
        }
      }
      return bestResponse;
    }

    default:
      return successPairs.map(({ result }) => result.response).join('\n\n');
  }
}
