// ---------------------------------------------------------------------------
// AgentX -- Agentic Chat Handler
// ---------------------------------------------------------------------------
//
// The bridge between the VS Code Chat Participant and the AgenticLoop.
// Replaces the old "classify + show markdown" flow with a real LLM <-> Tool
// execution cycle using the selected Copilot model.
//
// Also integrates:
//   - Agent-to-agent communication via ClarificationRouter
//   - Model fallback selection via modelSelector
//   - Session persistence for multi-turn conversations
//   - Quality gate enforcement for handoffs
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import { AgentXContext, AgentDefinition } from '../agentxContext';
import { AgenticLoop, ToolRegistry, LoopSummary } from '../agentic';
import { createVsCodeLmAdapter } from './vscodeLmAdapter';
import { loadAgentInstructions } from './agentContextLoader';
import { selectModelForAgent, ModelSelectionResult } from '../utils/modelSelector';
import { ClarificationRouter } from '../utils/clarificationRouter';
import { AgentEventBus } from '../utils/eventBus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgenticChatResult {
  readonly summary: LoopSummary;
  readonly agentName: string;
  readonly modelUsed: string;
  readonly clarificationsRequested: number;
}

export interface AgenticChatConfig {
  /** Maximum agentic loop iterations (default 15). */
  readonly maxIterations?: number;
  /** Token budget for the session (default 60_000). */
  readonly tokenBudget?: number;
  /** Whether to enable agent-to-agent clarification (default true). */
  readonly enableClarification?: boolean;
  /** Issue number for traceability (optional). */
  readonly issueNumber?: number;
}

const DEFAULT_CHAT_CONFIG: Required<AgenticChatConfig> = {
  maxIterations: 15,
  tokenBudget: 60_000,
  enableClarification: true,
  issueNumber: 0,
};

// ---------------------------------------------------------------------------
// Singleton Components
// ---------------------------------------------------------------------------

let sharedEventBus: AgentEventBus | undefined;
let sharedClarificationRouter: ClarificationRouter | undefined;

function getEventBus(): AgentEventBus {
  if (!sharedEventBus) {
    sharedEventBus = new AgentEventBus();
  }
  return sharedEventBus;
}

function getClarificationRouter(workspaceRoot: string, agentx: AgentXContext): ClarificationRouter {
  if (!sharedClarificationRouter) {
    sharedClarificationRouter = new ClarificationRouter({
      workspaceRoot,
      eventBus: getEventBus(),
      runSubagent: createSubagentRunner(workspaceRoot, agentx),
    });
  }
  return sharedClarificationRouter;
}

// ---------------------------------------------------------------------------
// Sub-Agent Runner (Agent-to-Agent Communication)
// ---------------------------------------------------------------------------

/**
 * Creates a runSubagent function that invokes a target agent through the
 * VS Code Language Model API. This enables real inter-agent communication
 * in the Copilot Chat experience.
 *
 * When Agent A needs clarification from Agent B:
 *   1. ClarificationRouter calls this function
 *   2. We load Agent B's definition and instructions
 *   3. We select Agent B's preferred model
 *   4. We run a mini agentic loop with Agent B's persona
 *   5. We return Agent B's response text
 */
function createSubagentRunner(
  workspaceRoot: string,
  agentx: AgentXContext,
): (agentName: string, prompt: string) => Promise<string> {
  return async (agentName: string, prompt: string): Promise<string> => {
    // Build a lightweight AgentXContext for the sub-agent
    const agentFileName = agentName + '.agent.md';

    // Load target agent definition
    const agentDef = await agentx.readAgentDef(agentFileName);
    const instructions = await loadAgentInstructions(agentx, agentFileName);

    // Select the model for this sub-agent
    const modelResult = await selectModelForAgent(agentDef);

    // Build system prompt from agent instructions
    const systemPrompt = buildAgentSystemPrompt(agentDef, instructions, agentName);

    // If we have a real model, run through the agentic loop
    if (modelResult.chatModel) {
      const adapter = createVsCodeLmAdapter({
        chatModel: modelResult.chatModel,
      });

      const loop = new AgenticLoop(
        {
          agentName,
          systemPrompt,
          maxIterations: 5, // Sub-agents get fewer iterations
          tokenBudget: 20_000,
        },
        new ToolRegistry(),
      );

      const abortController = new AbortController();
      const summary = await loop.run(prompt, adapter, abortController.signal);
      return summary.finalText || '(No response from agent)';
    }

    // Fallback: return instructions-based stub response
    return `[${agentName}] I would handle this request based on my role. `
      + `(Model not available -- returning guidance.)\n\n`
      + (instructions?.slice(0, 500) ?? 'No instructions available.');
  };
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

function buildAgentSystemPrompt(
  agentDef: AgentDefinition | undefined,
  instructions: string | undefined,
  agentName: string,
): string {
  const parts: string[] = [];

  parts.push(`You are the ${agentDef?.name ?? agentName} agent in the AgentX framework.`);
  parts.push('You are working inside a VS Code workspace via Copilot Chat.');
  parts.push('');

  if (agentDef?.description) {
    parts.push(`## Role\n${agentDef.description}`);
    parts.push('');
  }

  if (instructions) {
    // Extract key sections from the .agent.md body
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

  parts.push('## Tool Usage');
  parts.push('You have workspace tools available (file_read, file_write, file_edit, grep_search, list_dir, terminal_exec).');
  parts.push('Use them to explore the codebase and complete tasks. When done, provide a text summary.');
  parts.push('');
  parts.push('## Clarification');
  parts.push('If you need input from another agent, state clearly: "I need clarification from [agent-name] about [topic]".');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

/**
 * Execute a full agentic chat session for a routed agent request.
 *
 * This replaces the old agenticAdapter stub with a real LLM-powered loop
 * that can:
 *   1. Call workspace tools (read/write files, search, run commands)
 *   2. Request clarification from other agents
 *   3. Stream progress to the VS Code Chat response
 *   4. Persist session state for multi-turn conversations
 */
export async function runAgenticChat(
  agentName: string,
  agentDef: AgentDefinition | undefined,
  instructions: string | undefined,
  prompt: string,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  agentx: AgentXContext,
  config?: AgenticChatConfig,
): Promise<AgenticChatResult> {
  const cfg = { ...DEFAULT_CHAT_CONFIG, ...config };
  let clarificationsRequested = 0;

  // -----------------------------------------------------------------------
  // 1. Select model
  // -----------------------------------------------------------------------
  const modelResult: ModelSelectionResult = await selectModelForAgent(agentDef);
  const modelName = modelResult.chatModel?.name ?? agentDef?.model ?? 'default';
  const sourceLabel = modelResult.source === 'fallback' ? ' (fallback)' : '';

  response.markdown(`**Model**: ${modelName}${sourceLabel}\n\n---\n\n`);

  // -----------------------------------------------------------------------
  // 2. Build system prompt
  // -----------------------------------------------------------------------
  const systemPrompt = buildAgentSystemPrompt(agentDef, instructions, agentName);

  // -----------------------------------------------------------------------
  // 3. Set up clarification callback (agent-to-agent communication)
  // -----------------------------------------------------------------------
  let clarificationCallback:
    | ((topic: string, question: string) => Promise<import('../utils/clarificationTypes').ClarificationResult>)
    | undefined;

  if (cfg.enableClarification && agentx.workspaceRoot) {
    const router = getClarificationRouter(agentx.workspaceRoot, agentx);

    // Parse which agents this agent can clarify with from instructions
    const canClarify = parseCanClarifyList(instructions);

    if (canClarify.length > 0) {
      clarificationCallback = async (topic: string, question: string) => {
        // Determine target agent from the question context
        const targetAgent = detectTargetAgent(question, canClarify);
        clarificationsRequested++;

        response.markdown(
          `> **[Clarification]** Asking **${targetAgent}** about: ${topic}\n\n`,
        );

        const issueNum = cfg.issueNumber || 0;
        const result = await router.requestClarification(
          {
            issueNumber: issueNum,
            fromAgent: agentName,
            toAgent: targetAgent,
            topic,
            question,
            blocking: true,
          },
          canClarify,
        );

        response.markdown(
          `> **[${targetAgent} responded]**: ${result.answer.slice(0, 200)}${result.answer.length > 200 ? '...' : ''}\n\n`,
        );

        return result;
      };
    }
  }

  // -----------------------------------------------------------------------
  // 4. Create the agentic loop
  // -----------------------------------------------------------------------
  const toolRegistry = new ToolRegistry();

  const loop = new AgenticLoop(
    {
      agentName,
      systemPrompt,
      maxIterations: cfg.maxIterations,
      tokenBudget: cfg.tokenBudget,
      issueNumber: cfg.issueNumber || undefined,
      canClarify: cfg.enableClarification ? parseCanClarifyList(instructions) : undefined,
      onClarificationNeeded: clarificationCallback,
    },
    toolRegistry,
  );

  // -----------------------------------------------------------------------
  // 5. Create LLM adapter (real VS Code LM or fallback)
  // -----------------------------------------------------------------------
  let adapter;
  if (modelResult.chatModel) {
    adapter = createVsCodeLmAdapter({
      chatModel: modelResult.chatModel,
      toolSchemas: toolRegistry.toFunctionSchemas(),
    });
  } else {
    // Fallback: use the local pattern-matching adapter
    const { createLocalAgenticAdapter } = await import('./agenticAdapter');
    adapter = createLocalAgenticAdapter(agentName, `Routing to ${agentName}`);
  }

  // -----------------------------------------------------------------------
  // 6. Run the loop with streaming progress
  // -----------------------------------------------------------------------
  const abortController = new AbortController();
  const cancellationSub = token.onCancellationRequested(() => {
    abortController.abort();
  });

  let summary: LoopSummary;
  try {
    summary = await loop.run(prompt, adapter, abortController.signal, {
      onIteration: (iter, max) => {
        response.progress(`Iteration ${iter}/${max}...`);
      },
      onToolCall: (toolName, params) => {
        const paramSummary = Object.keys(params).slice(0, 2).join(', ');
        response.progress(`Tool: ${toolName}(${paramSummary})...`);
      },
      onToolResult: (toolName, result) => {
        if (result.isError) {
          response.markdown(`> **[Tool Error]** ${toolName}: ${result.content[0]?.text.slice(0, 100)}\n\n`);
        }
      },
      onLoopWarning: (detection) => {
        response.markdown(`> **[Loop Warning]** ${detection.message}\n\n`);
      },
      onText: (text) => {
        // Final text streamed at the end
      },
    });

    // Stream the final response
    if (summary.finalText) {
      response.markdown(summary.finalText + '\n\n');
    }

    // Summary footer
    response.markdown(
      `---\n*Loop: ${summary.iterations} iterations, `
      + `${summary.toolCallsExecuted} tool calls, `
      + `exit: ${summary.exitReason}`
      + (clarificationsRequested > 0 ? `, ${clarificationsRequested} clarifications` : '')
      + `*\n`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown(`**Agentic loop error**: ${message}\n\n`);
    summary = {
      sessionId: '',
      iterations: 0,
      toolCallsExecuted: 0,
      finalText: message,
      exitReason: 'error',
      loopDetection: null,
      totalTokensEstimate: 0,
      durationMs: 0,
    };
  } finally {
    cancellationSub.dispose();
  }

  return {
    summary,
    agentName,
    modelUsed: modelName,
    clarificationsRequested,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the list of agents this agent can request clarification from.
 * Parses from the agent .md instructions body.
 */
function parseCanClarifyList(instructions: string | undefined): string[] {
  if (!instructions) { return []; }

  // Look for can_clarify in TOML-style config or markdown
  const match = instructions.match(/can_clarify\s*[:=]\s*\[([^\]]*)\]/);
  if (match) {
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
  }

  // Look for "Handoffs" section listing agent names
  const handoffMatch = instructions.match(/## (?:Team & )?Handoffs[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
  if (handoffMatch) {
    const agents: string[] = [];
    const agentPattern = /\b(product-manager|architect|ux-designer|engineer|reviewer|devops-engineer|customer-coach|agent-x)\b/gi;
    let m;
    while ((m = agentPattern.exec(handoffMatch[1])) !== null) {
      const name = m[1].toLowerCase();
      if (!agents.includes(name)) { agents.push(name); }
    }
    return agents;
  }

  return [];
}

/**
 * Detect which target agent a clarification question is directed at.
 */
function detectTargetAgent(question: string, canClarify: string[]): string {
  const lower = question.toLowerCase();
  for (const agent of canClarify) {
    if (lower.includes(agent)) {
      return agent;
    }
  }

  // Heuristic: match by keyword
  const keywordMap: Record<string, RegExp> = {
    'product-manager': /\b(requirement|prd|scope|priority|user stor)/i,
    'architect': /\b(architecture|design|adr|pattern|scalab)/i,
    'ux-designer': /\b(ux|ui|wireframe|prototype|user flow)/i,
    'engineer': /\b(implement|code|build|test|function)/i,
    'reviewer': /\b(review|quality|approval|merge)/i,
    'devops-engineer': /\b(deploy|pipeline|ci\/cd|infrastructure)/i,
  };

  for (const agent of canClarify) {
    const pattern = keywordMap[agent];
    if (pattern && pattern.test(lower)) {
      return agent;
    }
  }

  // Default to first available
  return canClarify[0] ?? 'agent-x';
}
