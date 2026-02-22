"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeNaturalLanguage = routeNaturalLanguage;
exports.classifyPrompt = classifyPrompt;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const agentContextLoader_1 = require("./agentContextLoader");
const ROUTE_RULES = [
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
async function routeNaturalLanguage(request, _chatContext, response, _token, agentx) {
    const prompt = request.prompt.trim();
    if (!prompt) {
        response.markdown('Hello! I am **AgentX**, your multi-agent orchestrator.\n\n'
            + 'You can ask me anything, and I will route to the best agent.\n\n'
            + '**Slash commands:**\n'
            + '- `/ready` -- Show unblocked work\n'
            + '- `/workflow <type>` -- Run a workflow\n'
            + '- `/status` -- Show agent states\n'
            + '- `/deps <issue>` -- Check dependencies\n'
            + '- `/digest` -- Weekly digest\n\n'
            + 'Or just describe what you need in plain English.\n');
        return { metadata: { initialized: true } };
    }
    // Classify prompt
    response.progress('Classifying request...');
    const route = classifyPrompt(prompt);
    // Load agent definition and instructions
    const agentFileName = route.agentFile + '.agent.md';
    const agentDef = await agentx.readAgentDef(agentFileName);
    const instructions = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, agentFileName);
    // Header showing which agent was selected
    const agentName = agentDef?.name ?? route.agentFile;
    response.markdown(`**[${agentName}]** ${route.description}\n\n---\n\n`);
    // Contextual guidance based on agent role
    if (instructions) {
        response.markdown(buildAgentResponse(agentDef, instructions));
    }
    else {
        response.markdown(`I identified **${agentName}** as the right agent for this request, `
            + `but could not load agent instructions. `
            + `Make sure \`.github/agents/${agentFileName}\` exists.\n`);
    }
    // Link to agent file
    if (agentx.workspaceRoot) {
        const agentUri = vscode.Uri.file(path.join(agentx.workspaceRoot, '.github', 'agents', agentFileName));
        response.reference(agentUri);
    }
    return {
        metadata: {
            agentName: route.agentFile,
            initialized: true,
        }
    };
}
function classifyPrompt(prompt) {
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
function buildAgentResponse(agentDef, instructions) {
    const parts = [];
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
    parts.push('*This agent would handle your request. '
        + 'Use the appropriate workflow command or invoke the agent directly in Copilot Chat.*\n');
    return parts.join('');
}
//# sourceMappingURL=agentRouter.js.map