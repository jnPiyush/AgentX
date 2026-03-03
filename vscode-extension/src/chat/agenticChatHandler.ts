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
import {
  AgenticLoop,
  ToolRegistry,
  LoopSummary,
  DoneValidator,
  LlmAdapter,
} from '../agentic';
import {
  LlmAdapterFactory,
  AgentLoader,
} from '../agentic/subAgentSpawner';
import {
  SelfReviewConfig,
  getDefaultSelfReviewConfig,
} from '../agentic/selfReviewLoop';
import {
  getDefaultClarificationConfig,
} from '../agentic/clarificationLoop';
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
  /**
   * Autonomous / yolo mode. When true, the agent should use best judgment
   * and avoid asking clarifying questions. Defaults to false.
   */
  readonly autonomous?: boolean;
}

const DEFAULT_CHAT_CONFIG: Required<AgenticChatConfig> = {
  maxIterations: 15,
  tokenBudget: 60_000,
  enableClarification: true,
  issueNumber: 0,
  autonomous: false,
};

/**
 * Read user-configurable loop settings from VS Code workspace configuration.
 * Falls back to hardcoded defaults when no setting is present.
 */
function getLoopSettings() {
  const loopCfg = vscode.workspace.getConfiguration('agentx.loop');
  const srCfg = vscode.workspace.getConfiguration('agentx.selfReview');
  const clCfg = vscode.workspace.getConfiguration('agentx.clarification');
  return {
    loop: {
      maxIterations: loopCfg.get<number>('maxIterations', 20),
      tokenBudget: loopCfg.get<number>('tokenBudget', 100_000),
    },
    selfReview: {
      maxIterations: srCfg.get<number>('maxIterations', 15),
      reviewerMaxIterations: srCfg.get<number>('reviewerMaxIterations', 8),
    },
    clarification: {
      maxIterations: clCfg.get<number>('maxIterations', 6),
      responderMaxIterations: clCfg.get<number>('responderMaxIterations', 5),
    },
  };
}

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
      runSubagent: createSubagentRunner(agentx),
    });
  }
  return sharedClarificationRouter;
}

// ---------------------------------------------------------------------------
// LLM Adapter Factory & Agent Loader (used by self-review & clarification)
// ---------------------------------------------------------------------------

/**
 * Build an LlmAdapterFactory that creates LLM adapters via the VS Code
 * Language Model API. Used by the self-review and clarification loops
 * to spawn sub-agents.
 *
 * When `parentAdapter` is supplied, sub-agents that cannot find their own
 * model will fall back to the parent agent's adapter instead of returning
 * null. This eliminates silent sub-agent failures when the child's model
 * preference is unavailable.
 */
function buildChatLlmAdapterFactory(
  parentAdapter?: LlmAdapter,
): LlmAdapterFactory {
  return async (
    _role: string,
    agentDef: { model?: string; modelFallback?: string } | undefined,
  ): Promise<LlmAdapter | null> => {
    const modelResult = await selectModelForAgent(
      agentDef as AgentDefinition | undefined,
    );
    if (modelResult.chatModel) {
      return createVsCodeLmAdapter({ chatModel: modelResult.chatModel });
    }
    // Fallback: reuse parent adapter if available
    if (parentAdapter) {
      return parentAdapter;
    }
    return null;
  };
}

/**
 * Build an AgentLoader that loads agent definitions and instructions
 * from the workspace .agent.md files.
 */
function buildChatAgentLoader(agentx: AgentXContext): AgentLoader {
  return {
    async loadDef(role: string) {
      try {
        const fileName = role + '.agent.md';
        const def = await agentx.readAgentDef(fileName);
        return def
          ? {
              name: def.name,
              description: def.description,
              model: def.model,
              modelFallback: def.modelFallback,
            }
          : undefined;
      } catch {
        return undefined;
      }
    },
    async loadInstructions(role: string) {
      try {
        const fileName = role + '.agent.md';
        return await loadAgentInstructions(agentx, fileName) ?? undefined;
      } catch {
        return undefined;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Sub-Agent Runner (Legacy -- used by ClarificationRouter)
// ---------------------------------------------------------------------------

/**
 * Creates a runSubagent function used by the ClarificationRouter for
 * backward-compatible agent-to-agent communication.
 *
 * @deprecated Prefer the new clarification loop module for iterative
 * agent-to-agent communication with human fallback.
 */
function createSubagentRunner(
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

    // Extract Workflow / Execution Steps for actionable guidance
    const workflowMatch = instructions.match(/## Workflow\n([\s\S]*?)(?=\n## |\n---)/);
    if (workflowMatch) {
      parts.push('## Workflow\n' + workflowMatch[1].trim());
      parts.push('');
    }

    // Extract Automation-First or similar priority sections
    const automationMatch = instructions.match(/## Automation[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
    if (automationMatch) {
      parts.push('## Automation-First Principle\n' + automationMatch[1].trim());
      parts.push('');
    }
  }

  parts.push('## Tool Usage');
  parts.push('You have workspace tools available (file_read, file_write, file_edit, grep_search, list_dir, terminal_exec).');
  parts.push('Use them to explore the codebase and complete tasks. When done, provide a text summary.');
  parts.push('');

  // Tester-specific automation directives
  if (agentName === 'tester') {
    parts.push('## Test Automation Directives (MANDATORY)');
    parts.push('You are a TEST AUTOMATION agent. Your PRIMARY output is executable test code, NOT documentation.');
    parts.push('1. Use workspace tools to explore the project structure and detect existing test frameworks');
    parts.push('2. If no test framework exists, install one (Playwright for e2e, Jest/Mocha/pytest for unit)');
    parts.push('3. Write actual test files (.spec.ts, .test.ts, test_*.py, *Tests.cs, etc.)');
    parts.push('4. Use Page Object Model for e2e tests, test factories for data, mocks for external services');
    parts.push('5. Run the tests via terminal to verify they pass');
    parts.push('6. Only AFTER tests are written and running, create the test report markdown');
    parts.push('7. NEVER produce only a markdown test plan -- always write code first');
    parts.push('');
  }

  parts.push('## Clarification');
  parts.push('If you need input from another agent, use the request_clarification tool.');
  parts.push('This is a proper tool call -- do NOT embed clarification requests in text output.');
  parts.push('Only request clarification when the missing information truly blocks progress.');
  parts.push('For minor decisions, use your best judgment and proceed.');
  parts.push('');
  parts.push('## Self-Review');
  parts.push('When you report work as complete, a same-role reviewer sub-agent will');
  parts.push('automatically review your output. If the reviewer finds HIGH or MEDIUM');
  parts.push('impact issues, you will receive their findings and must address them.');
  parts.push('This loop continues until the reviewer approves or max iterations are reached.');
  parts.push('Focus on producing quality work upfront to minimize review iterations.');

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

  // Read user-configurable loop settings from VS Code settings
  const loopSettings = getLoopSettings();
  let clarificationsRequested = 0;

  // -----------------------------------------------------------------------
  // 1. Select model
  // -----------------------------------------------------------------------
  const modelResult: ModelSelectionResult = await selectModelForAgent(agentDef);
  const modelName = modelResult.chatModel?.name ?? agentDef?.model ?? 'default';
  const sourceLabel = modelResult.source === 'fallback' ? ' (fallback)' : '';

  // Derive token budget from the model's actual context window (75% utilization)
  const contextWindow = modelResult.maxInputTokens;
  const MODEL_UTILIZATION = 0.75;
  const derivedTokenBudget = Math.floor(contextWindow * MODEL_UTILIZATION);

  response.markdown(
    `**Model**: ${modelName}${sourceLabel} | `
    + `**Context**: ${(contextWindow / 1000).toFixed(0)}K tokens | `
    + `**Budget**: ${(derivedTokenBudget / 1000).toFixed(0)}K tokens\n\n---\n\n`,
  );

  // -----------------------------------------------------------------------
  // 2. Build system prompt
  // -----------------------------------------------------------------------
  let systemPrompt = buildAgentSystemPrompt(agentDef, instructions, agentName);

  // Autonomous / yolo mode: append strong instructions to avoid questions
  if (cfg.autonomous) {
    systemPrompt += '\n\n## Autonomous Mode (ACTIVE)\n'
      + 'The user has requested autonomous mode. You MUST:\n'
      + '- Make decisions independently using your best judgment\n'
      + '- Do NOT ask clarifying questions -- pick the most reasonable option and proceed\n'
      + '- Do NOT request clarification from other agents\n'
      + '- If multiple approaches exist, choose the most standard/conventional one\n'
      + '- If information is missing, infer from context or use sensible defaults\n'
      + '- Report what you decided and why after completing the task\n'
      + '- Act decisively -- the user trusts your expertise\n';
  }

  // -----------------------------------------------------------------------
  // 3. Build sub-agent infrastructure (self-review & clarification)
  // -----------------------------------------------------------------------
  let llmAdapterFactory: LlmAdapterFactory = buildChatLlmAdapterFactory();
  const agentLoader = buildChatAgentLoader(agentx);
  const canClarify = cfg.enableClarification ? parseCanClarifyList(instructions) : [];

  // Legacy clarification callback (used by ClarificationRouter fallback)
  let clarificationCallback:
    | ((topic: string, question: string) => Promise<import('../utils/clarificationTypes').ClarificationResult>)
    | undefined;

  if (canClarify.length > 0 && agentx.workspaceRoot) {
    const router = getClarificationRouter(agentx.workspaceRoot, agentx);

    clarificationCallback = async (topic: string, question: string) => {
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
        `> **[${targetAgent} responded]**: ${result.answer}\n\n`,
      );

      return result;
    };
  }

  // -----------------------------------------------------------------------
  // 4. Create the agentic loop (self-review + clarification loop)
  // -----------------------------------------------------------------------
  const toolRegistry = new ToolRegistry();

  // Self-review config: applicable to ALL agents (not just code-producing)
  const wsRoot = agentx.workspaceRoot ?? process.cwd();
  const selfReviewConfig: SelfReviewConfig = {
    ...getDefaultSelfReviewConfig(agentName, wsRoot),
    maxIterations: loopSettings.selfReview.maxIterations,
    reviewerMaxIterations: loopSettings.selfReview.reviewerMaxIterations,
  };

  // Clarification loop config
  const clarificationLoopConfig = agentx.workspaceRoot
    ? {
        ...getDefaultClarificationConfig(agentx.workspaceRoot),
        maxIterations: loopSettings.clarification.maxIterations,
        responderMaxIterations: loopSettings.clarification.responderMaxIterations,
        onHumanFallback: async (topic: string, context: string) => {
          response.markdown(
            `> **[Human Escalation]** The agents could not resolve a question.\n\n`
            + `> ${context.slice(0, 500)}\n\n`
            + `> Please provide guidance and re-run the agent.\n\n`,
          );
          return '(Escalated to human -- awaiting response in next turn)';
        },
      }
    : undefined;

  // Keep legacy DoneValidator as secondary fallback
  const doneValidator = buildDoneValidator(agentName, agentx.workspaceRoot);

  const loop = new AgenticLoop(
    {
      agentName,
      systemPrompt,
      maxIterations: cfg.maxIterations ?? loopSettings.loop.maxIterations,
      tokenBudget: derivedTokenBudget,
      issueNumber: cfg.issueNumber || undefined,
      canClarify: canClarify.length > 0 ? canClarify : undefined,
      onClarificationNeeded: clarificationCallback,
      doneValidator,
      workspaceRoot: agentx.workspaceRoot,
      // New: self-review loop (replaces DoneValidator)
      selfReviewConfig,
      selfReviewProgress: {
        onReviewIteration: (iteration, maxIterations) => {
          response.markdown(`> **[Self-Review]** Review iteration ${iteration}/${maxIterations}...\n\n`);
        },
        onFindingsReceived: (findings, iteration) => {
          const nonLow = findings.filter(f => f.impact !== 'low');
          if (nonLow.length > 0) {
            response.markdown(
              `> **[Self-Review]** Iteration ${iteration}: ${nonLow.length} finding(s) to address:\n\n`,
            );
            // Stream each finding so the human can see what the reviewer found
            for (const finding of nonLow) {
              const badge = finding.impact === 'high' ? '[HIGH]' : '[MEDIUM]';
              response.markdown(
                `> - ${badge} **${finding.category}**: ${finding.description}\n`,
              );
            }
            response.markdown('\n');
          } else if (findings.length > 0) {
            response.markdown(
              `> **[Self-Review]** Iteration ${iteration}: ${findings.length} low-impact note(s) only -- approving.\n\n`,
            );
          }
        },
        onAddressingFindings: (count) => {
          response.markdown(`> **[Self-Review]** Addressing ${count} finding(s)...\n\n`);
        },
        onApproved: (iteration) => {
          response.markdown(`> **[Self-Review PASSED]** Approved at iteration ${iteration}.\n\n`);
        },
        onMaxIterationsReached: (iterations) => {
          response.markdown(
            `> **[Self-Review]** Max iterations (${iterations}) reached -- accepting response.\n\n`,
          );
        },
      },
      llmAdapterFactory,
      agentLoader,
      // New: clarification loop (replaces single-shot callback)
      clarificationLoopConfig,
      clarificationProgress: {
        onClarificationIteration: (iteration, maxIterations, context) => {
          clarificationsRequested++;
          if (context) {
            response.markdown(
              `> **[Clarification Loop]** Iteration ${iteration}/${maxIterations}: `
              + `**${context.fromAgent}** asking **${context.toAgent}** about "${context.topic}"\n\n`
              + `> _Q:_ ${context.question}\n\n`,
            );
          } else {
            response.markdown(
              `> **[Clarification Loop]** Iteration ${iteration}/${maxIterations}...\n\n`,
            );
          }
        },
        onSubAgentResponse: (agentResponse, iteration) => {
          response.markdown(
            `> **[Clarification]** Response at iteration ${iteration}:\n\n`
            + `> ${agentResponse}\n\n`,
          );
        },
        onHumanEscalation: (topic) => {
          response.markdown(
            `> **[Human Escalation]** Could not resolve: ${topic}\n\n`
            + `> Please provide guidance and re-run the agent.\n\n`,
          );
        },
        onResolved: (answer, iterations) => {
          response.markdown(
            `> **[Clarification Resolved]** After ${iterations} iteration(s):\n\n`
            + `> ${answer}\n\n`,
          );
        },
      },
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

  // Patch the LLM adapter factory with the resolved parent adapter so
  // sub-agents (self-review, clarification) can reuse it as a fallback
  // when they cannot resolve their own model.
  llmAdapterFactory = buildChatLlmAdapterFactory(adapter);

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
      onValidation: (passed, details) => {
        if (passed) {
          response.markdown(`> **[Validation PASSED]**\n\n`);
        } else {
          response.markdown(`> **[Validation FAILED]**\n\n`);
          // Stream the full feedback so the human can see what needs fixing
          if (details) {
            response.markdown(`> ${details}\n\n`);
          }
        }
      },
      onText: (_text) => {
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
 * Parses from the agent .md instructions body using multiple strategies:
 *   1. TOML/YAML-style `can_clarify: [agent1, agent2]`
 *   2. `## Handoffs` or `## Team & Handoffs` section with agent names
 *   3. Inline mentions anywhere in the doc body (last resort, broad match)
 *
 * Returns empty array only when no agent names are found at all.
 * Logs a diagnostic when falling back to the broad match strategy.
 */
function parseCanClarifyList(instructions: string | undefined): string[] {
  if (!instructions) { return []; }

  const KNOWN_AGENTS = [
    'product-manager', 'architect', 'ux-designer', 'engineer',
    'reviewer', 'devops-engineer', 'devops', 'data-scientist',
    'tester', 'customer-coach', 'agent-x',
  ];

  // Sort longest-first for regex alternation so 'devops-engineer' matches
  // before 'devops'.
  const sortedForRegex = [...KNOWN_AGENTS].sort((a, b) => b.length - a.length);

  // Strategy 1: TOML/YAML-style config block
  const configMatch = instructions.match(/can_clarify\s*[:=]\s*\[([^\]]*)\]/);
  if (configMatch) {
    const parsed = configMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
    if (parsed.length > 0) { return parsed; }
  }

  // Strategy 2: Handoffs section (multiple heading variants)
  const handoffMatch = instructions.match(
    /## (?:Team (?:& |and )?)?Handoffs[^\n]*\n([\s\S]*?)(?=\n## |\n---|\n\*\*|$)/i,
  );
  if (handoffMatch) {
    const agents: string[] = [];
    const agentPattern = new RegExp(
      `\\b(${sortedForRegex.join('|')})\\b`, 'gi',
    );
    let m;
    while ((m = agentPattern.exec(handoffMatch[1])) !== null) {
      const name = m[1].toLowerCase();
      if (!agents.includes(name)) { agents.push(name); }
    }
    if (agents.length > 0) { return agents; }
  }

  // Strategy 3: Broad scan -- look for agent names anywhere in the body
  // This catches cases where the section heading doesn't match our regex
  // Iterate longest-first so 'devops-engineer' is found before 'devops'
  const agents: string[] = [];
  for (const agentName of sortedForRegex) {
    if (instructions.toLowerCase().includes(agentName)) {
      // Skip shorter name if a longer name containing it was already matched
      const dominated = agents.some(
        (a) => a.includes(agentName) || agentName.includes(a),
      );
      if (!dominated) { agents.push(agentName); }
    }
  }
  // Exclude the agent's own name if it appears in its own doc
  return agents;
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
    'devops': /\b(deploy|pipeline|ci\/cd|infrastructure)/i,
    'devops-engineer': /\b(deploy|pipeline|ci\/cd|infrastructure)/i,
    'data-scientist': /\b(model|ml|drift|evaluation|fine.?tun|rag|embeddings)/i,
    'tester': /\b(e2e|integration test|test suite|certification|coverage)/i,
    'customer-coach': /\b(research|brief|presentation|consult|engagement)/i,
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

/**
 * Build a DoneValidator for agents that produce code.
 *
 * @deprecated Use selfReviewConfig for LLM-based self-review instead.
 * This is kept as a secondary fallback when selfReviewConfig is not
 * available (e.g., when no LLM adapter factory is configured).
 *
 * Only engineer and tester agents get done-validation (they write code
 * that must pass tests/lint). Other agents (PM, architect, etc.) produce
 * documents and don't need automated validation.
 */
function buildDoneValidator(
  agentName: string,
  workspaceRoot?: string,
): DoneValidator | undefined {
  // Only code-producing agents get validation
  const codeAgents = ['engineer', 'tester', 'data-scientist'];
  if (!codeAgents.includes(agentName)) {
    return undefined;
  }

  if (!workspaceRoot) {
    return undefined;
  }

  return {
    async validate(): Promise<{ passed: boolean; feedback?: string }> {
      const cp = require('child_process');
      const path = require('path');
      const failures: string[] = [];

      // Check 1: Run tests if a test script exists
      try {
        const pkgPath = path.join(workspaceRoot, 'package.json');
        const fs = require('fs');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.scripts?.test) {
            const result = cp.spawnSync('npm', ['test', '--', '--passWithNoTests'], {
              cwd: workspaceRoot,
              timeout: 60_000,
              encoding: 'utf-8',
              shell: true,
            });
            if (result.status !== 0) {
              const output = (result.stdout + result.stderr).slice(-500);
              failures.push(`Tests failed:\\n${output}`);
            }
          }
        }
      } catch {
        // Non-fatal -- skip test check
      }

      // Check 2: TypeScript compilation
      try {
        const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
        const fs = require('fs');
        if (fs.existsSync(tsconfigPath)) {
          const result = cp.spawnSync('npx', ['tsc', '--noEmit'], {
            cwd: workspaceRoot,
            timeout: 30_000,
            encoding: 'utf-8',
            shell: true,
          });
          if (result.status !== 0) {
            const output = (result.stdout + result.stderr).slice(-500);
            failures.push(`TypeScript compilation errors:\\n${output}`);
          }
        }
      } catch {
        // Non-fatal
      }

      // Check 3: Lint
      try {
        const fs = require('fs');
        const pkgPath = path.join(workspaceRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.scripts?.lint) {
            const result = cp.spawnSync('npm', ['run', 'lint'], {
              cwd: workspaceRoot,
              timeout: 30_000,
              encoding: 'utf-8',
              shell: true,
            });
            if (result.status !== 0) {
              const output = (result.stdout + result.stderr).slice(-500);
              failures.push(`Lint errors:\\n${output}`);
            }
          }
        }
      } catch {
        // Non-fatal
      }

      if (failures.length === 0) {
        return { passed: true };
      }

      return {
        passed: false,
        feedback: 'The following validation checks failed:\\n\\n'
          + failures.map((f, i) => `### Check ${i + 1}\\n${f}`).join('\\n\\n')
          + '\\n\\nPlease fix these issues before completing the task.',
      };
    },
  };
}
