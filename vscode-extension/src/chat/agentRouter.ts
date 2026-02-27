import * as vscode from 'vscode';
import * as path from 'path';
import { AgentXContext, AgentDefinition } from '../agentxContext';
import { loadAgentInstructions } from './agentContextLoader';
import { AgentXChatMetadata } from './commandHandlers';
import { AgenticLoop, ToolRegistry } from '../agentic';
import { createLocalAgenticAdapter } from './agenticAdapter';
import { checkHandoffGate } from '../utils/loopStateChecker';

/**
 * Route rule: maps keyword patterns to agent files.
 * Order matters -- first match wins.
 */
export interface RouteRule {
  agentFile: string;
  keywords: RegExp;
  description: string;
}

const ROUTE_RULES: RouteRule[] = [
  {
    agentFile: 'architect',
    keywords: /\b(architect|architecture|adr|system design|tech spec|spike|technical decision|scalability|design pattern|microservices?)\b/i,
    description: 'Routing to Architect -- system design/technical decisions',
  },
  {
    agentFile: 'reviewer',
    keywords: /\b(review|code review|pr review|pull request|in review|quality check|security review)\b/i,
    description: 'Routing to Reviewer -- issue is in review phase',
  },
  {
    agentFile: 'devops',
    keywords: /\b(devops|ci\/cd|pipeline|deploy|infrastructure|docker|kubernetes|k8s|github actions|terraform|helm|release)\b/i,
    description: 'Routing to DevOps Engineer -- infrastructure/pipeline work',
  },
  {
    agentFile: 'ux-designer',
    keywords: /\b(ux|ui\b|ui design|user experience|user interface|wireframe|prototype|design system|figma|user flow|accessibility|mockup)\b/i,
    description: 'Routing to UX Designer -- user interface/experience work',
  },
  {
    agentFile: 'product-manager',
    keywords: /\b(prd|product|epic|backlog|roadmap|user stor(?:y|ies)|requirements|prioriti|stakeholder|feature request|breakdown)\b/i,
    description: 'Routing to Product Manager -- product planning/requirements',
  },
  {
    agentFile: 'customer-coach',
    keywords: /\b(research|consult|prepare|brief|presentation|coaching|topic|client|engagement|compare|vendor|trade-?off|executive summary|faq)\b/i,
    description: 'Routing to Customer Coach -- research and consulting preparation',
  },
  {
    agentFile: 'engineer',
    keywords: /\b(implement|code|build|fix|bug|test|develop|refactor|feature|function|class|api|endpoint|database|migration)\b/i,
    description: 'Routing to Engineer -- implementation work',
  },
];

const FALLBACK_AGENT = 'agent-x';

/**
 * Classify a natural language prompt and route to the appropriate agent.
 */
export async function routeNaturalLanguage(
  request: vscode.ChatRequest,
  _chatContext: vscode.ChatContext,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  const prompt = request.prompt.trim();

  if (!prompt) {
    response.markdown(
      'Hello! I am **AgentX**, your multi-agent orchestrator.\n\n'
      + 'You can ask me anything, and I will route to the best agent.\n\n'
      + '**Slash commands:**\n'
      + '- `/ready` -- Show unblocked work\n'
      + '- `/workflow <type>` -- Run a workflow\n'
      + '- `/status` -- Show agent states\n'
      + '- `/deps <issue>` -- Check dependencies\n'
      + '- `/digest` -- Weekly digest\n\n'
      + 'Or just describe what you need in plain English.\n'
    );
    return { metadata: { initialized: true } as AgentXChatMetadata };
  }

  // Classify prompt
  response.progress('Classifying request...');
  const route = classifyPrompt(prompt);

  // -----------------------------------------------------------------------
  // ENFORCEMENT: Block reviewer routing when quality loop is incomplete.
  // The engineer MUST complete the iterative loop before handoff to review.
  // -----------------------------------------------------------------------
  if (route.agentFile === 'reviewer' && agentx.workspaceRoot) {
    const gate = checkHandoffGate(agentx.workspaceRoot);
    if (!gate.allowed) {
      response.markdown(
        '**[Quality Gate] Handoff to Reviewer BLOCKED**\n\n'
        + `> ${gate.reason}\n\n`
        + 'The iterative quality loop must reach `status=complete` before '
        + 'code review can begin. Use the following commands:\n\n'
        + '- `agentx loop start` -- Start a new loop\n'
        + '- `agentx loop iterate` -- Record iteration progress\n'
        + '- `agentx loop complete` -- Mark loop as done\n\n'
        + '---\n'
      );
      return {
        metadata: { agentName: 'quality-gate', initialized: true } as AgentXChatMetadata
      };
    }
  }

  // Load agent definition and instructions
  const agentFileName = route.agentFile + '.agent.md';
  const agentDef = await agentx.readAgentDef(agentFileName);
  const instructions = await loadAgentInstructions(agentx, agentFileName);

  // Header showing which agent was selected
  const agentName = agentDef?.name ?? route.agentFile;
  response.markdown(`**[${agentName}]** ${route.description}\n\n---\n\n`);

  const abortController = new AbortController();
  const cancellationSub = token.onCancellationRequested(() => {
    abortController.abort();
  });

  try {
    const loop = new AgenticLoop(
      {
        agentName: route.agentFile,
        systemPrompt: `You are AgentX routing assistant for ${agentName}.`,
        maxIterations: 8,
        tokenBudget: 40000,
      },
      new ToolRegistry(),
    );

    const adapter = createLocalAgenticAdapter(agentName, route.description);

    const summary = await loop.run(prompt, adapter, abortController.signal, {
      onToolCall: (toolName) => response.progress(`Executing tool: ${toolName}...`),
      onLoopWarning: (result) => response.markdown(`> [WARN] ${result.message}\n\n`),
    });

    if (summary.finalText) {
      response.markdown(summary.finalText + '\n\n');
    }
    response.markdown(
      `Loop summary: iterations=${summary.iterations}, tools=${summary.toolCallsExecuted}, `
      + `exit=${summary.exitReason}.\n\n`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown(`Agentic loop error: ${message}\n\n`);
  } finally {
    cancellationSub.dispose();
  }

  // Contextual guidance based on agent role
  if (instructions) {
    response.markdown(buildAgentResponse(agentDef, instructions));
  } else {
    response.markdown(
      `I identified **${agentName}** as the right agent for this request, `
      + `but could not load agent instructions. `
      + `Make sure \`.github/agents/${agentFileName}\` exists.\n`
    );
  }

  // Link to agent file
  if (agentx.workspaceRoot) {
    const agentUri = vscode.Uri.file(
      path.join(agentx.workspaceRoot, '.github', 'agents', agentFileName)
    );
    response.reference(agentUri);
  }

  return {
    metadata: {
      agentName: route.agentFile,
      initialized: true,
    } as AgentXChatMetadata
  };
}

export function classifyPrompt(prompt: string): RouteRule {
  for (const rule of ROUTE_RULES) {
    if (rule.keywords.test(prompt)) {
      return rule;
    }
  }
  return {
    agentFile: FALLBACK_AGENT,
    keywords: /.*/,
    description: 'Routing to Agent X -- adaptive coordinator',
  };
}

/**
 * Build markdown response with agent context extracted from .agent.md body.
 */
function buildAgentResponse(
  agentDef: AgentDefinition | undefined,
  instructions: string
): string {
  const parts: string[] = [];

  if (agentDef) {
    parts.push(`**Agent**: ${agentDef.name}\n`);
    parts.push(`**Description**: ${agentDef.description}\n`);
    parts.push(`**Model**: ${agentDef.model} | **Maturity**: ${agentDef.maturity}\n\n`);
  }

  // Extract Role section
  const roleMatch = instructions.match(/## Role\n([\s\S]*?)(?=\n## |\n---)/);
  if (roleMatch) {
    parts.push('### Role\n' + roleMatch[1].trim() + '\n\n');
  }

  // Extract constraints if present
  const constraintMatch = instructions.match(/## Constraints[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
  if (constraintMatch) {
    parts.push('### Constraints\n' + constraintMatch[1].trim() + '\n\n');
  }

  // Extract handoffs if present
  const handoffMatch = instructions.match(/## (?:Team & )?Handoffs[^\n]*\n([\s\S]*?)(?=\n## |\n---)/);
  if (handoffMatch) {
    parts.push('### Handoffs\n' + handoffMatch[1].trim() + '\n\n');
  }

  parts.push('---\n\n');
  parts.push(
    '*This agent would handle your request. '
    + 'Use the appropriate workflow command or invoke the agent directly in Copilot Chat.*\n'
  );

  return parts.join('');
}
