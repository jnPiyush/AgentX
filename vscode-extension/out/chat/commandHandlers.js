"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSlashCommand = handleSlashCommand;
/**
 * Dispatch a slash command to the appropriate handler.
 */
async function handleSlashCommand(request, _context, response, _token, agentx) {
    switch (request.command) {
        case 'ready':
            return handleReady(response, agentx);
        case 'workflow':
            return handleWorkflow(request, response, agentx);
        case 'status':
            return handleStatus(response, agentx);
        case 'deps':
            return handleDeps(request, response, agentx);
        case 'digest':
            return handleDigest(response, agentx);
        default:
            response.markdown(`Unknown command: \`/${request.command}\`.\n\n`
                + 'Available: `/ready`, `/workflow`, `/status`, `/deps`, `/digest`');
            return { metadata: { command: request.command, initialized: true } };
    }
}
async function handleReady(response, agentx) {
    response.progress('Running ready queue scan...');
    try {
        const output = await agentx.runCli('ready');
        if (!output || output.trim().length === 0) {
            response.markdown('**Ready Queue**: No unblocked work found.\n\n'
                + 'All issues are either blocked by dependencies or already assigned.');
        }
        else {
            response.markdown('**Ready Queue** -- Unblocked work sorted by priority:\n\n');
            response.markdown('```\n' + output + '\n```');
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        response.markdown('**Error** running ready queue: ' + message);
    }
    return { metadata: { command: 'ready', initialized: true } };
}
async function handleWorkflow(request, response, agentx) {
    const VALID_TYPES = ['feature', 'epic', 'story', 'bug', 'spike', 'devops', 'docs'];
    const workflowType = request.prompt.trim().toLowerCase();
    if (!workflowType || !VALID_TYPES.includes(workflowType)) {
        response.markdown('**Usage**: `@agentx /workflow <type>`\n\n'
            + '| Type | Pipeline |\n'
            + '|------|----------|\n'
            + '| `feature` | PM -> UX -> Architect -> Engineer -> Reviewer |\n'
            + '| `epic` | Full epic workflow with PRD and breakdown |\n'
            + '| `story` | Engineer -> Reviewer (spec ready) |\n'
            + '| `bug` | Engineer -> Reviewer (direct) |\n'
            + '| `spike` | Architect research spike |\n'
            + '| `devops` | DevOps pipeline workflow |\n'
            + '| `docs` | Documentation update |\n');
        return { metadata: { command: 'workflow', initialized: true } };
    }
    response.progress(`Running ${workflowType} workflow...`);
    try {
        const output = await agentx.runCli('workflow', [workflowType]);
        response.markdown(`**Workflow: ${workflowType}**\n\n`);
        response.markdown('```\n' + output + '\n```');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        response.markdown(`**Error** running workflow: ${message}`);
    }
    return { metadata: { command: 'workflow', workflowType, initialized: true } };
}
async function handleStatus(response, agentx) {
    response.progress('Loading agent status...');
    try {
        const output = await agentx.runCli('state');
        response.markdown('**Agent Status**\n\n');
        response.markdown('```\n' + output + '\n```');
    }
    catch {
        // Fallback: read agent definitions directly
        const agents = await agentx.listAgents();
        if (agents.length === 0) {
            response.markdown('No agents found in this workspace.');
        }
        else {
            response.markdown('**Agents** (' + agents.length + '):\n\n');
            response.markdown('| Agent | Model | Maturity | Mode |\n|-------|-------|----------|------|\n');
            for (const a of agents) {
                response.markdown(`| ${a.name} | ${a.model} | ${a.maturity} | ${a.mode} |\n`);
            }
        }
    }
    return { metadata: { command: 'status', initialized: true } };
}
async function handleDeps(request, response, agentx) {
    const issueMatch = request.prompt.trim().match(/^#?(\d+)$/);
    if (!issueMatch) {
        response.markdown('**Usage**: `@agentx /deps <issue-number>`\n\n'
            + 'Example: `@agentx /deps 42`');
        return { metadata: { command: 'deps', initialized: true } };
    }
    const issueNumber = issueMatch[1];
    response.progress(`Checking dependencies for issue #${issueNumber}...`);
    try {
        const output = await agentx.runCli('deps', [issueNumber]);
        response.markdown(`**Dependencies for Issue #${issueNumber}**\n\n`);
        response.markdown('```\n' + output + '\n```');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        response.markdown(`**Error** checking dependencies: ${message}`);
    }
    return { metadata: { command: 'deps', issueNumber, initialized: true } };
}
async function handleDigest(response, agentx) {
    response.progress('Generating weekly digest (this may take a moment)...');
    try {
        const output = await agentx.runCli('digest');
        response.markdown('**Weekly Digest**\n\n');
        response.markdown(output);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        response.markdown(`**Error** generating digest: ${message}`);
    }
    return { metadata: { command: 'digest', initialized: true } };
}
//# sourceMappingURL=commandHandlers.js.map