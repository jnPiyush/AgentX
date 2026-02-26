import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { renderThreadMarkdown, renderMonitorReportMarkdown } from '../utils/clarificationRenderer';
import { ClarificationRecord, MonitorReport } from '../utils/clarificationTypes';

/**
 * Metadata attached to every ChatResult for followup logic.
 */
export interface AgentXChatMetadata {
  command?: string;
  agentName?: string;
  issueNumber?: string;
  workflowType?: string;
  initialized: boolean;
}

/**
 * Dispatch a slash command to the appropriate handler.
 */
export async function handleSlashCommand(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  response: vscode.ChatResponseStream,
  _token: vscode.CancellationToken,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
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
    case 'clarify':
      return handleClarify(request, response, agentx);
    default:
      response.markdown(
        `Unknown command: \`/${request.command}\`.\n\n`
        + 'Available: `/ready`, `/workflow`, `/status`, `/deps`, `/digest`, `/clarify`'
      );
      return { metadata: { command: request.command, initialized: true } as AgentXChatMetadata };
  }
}

async function handleReady(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  response.progress('Running ready queue scan...');

  try {
    const output = await agentx.runCli('ready');
    if (!output || output.trim().length === 0) {
      response.markdown(
        '**Ready Queue**: No unblocked work found.\n\n'
        + 'All issues are either blocked by dependencies or already assigned.'
      );
    } else {
      response.markdown('**Ready Queue** -- Unblocked work sorted by priority:\n\n');
      response.markdown('```\n' + output + '\n```');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown('**Error** running ready queue: ' + message);
  }

  return { metadata: { command: 'ready', initialized: true } as AgentXChatMetadata };
}

async function handleWorkflow(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  const VALID_TYPES = ['feature', 'epic', 'story', 'bug', 'spike', 'devops', 'docs'];
  const workflowType = request.prompt.trim().toLowerCase();

  if (!workflowType || !VALID_TYPES.includes(workflowType)) {
    response.markdown(
      '**Usage**: `@agentx /workflow <type>`\n\n'
      + '| Type | Pipeline |\n'
      + '|------|----------|\n'
      + '| `feature` | PM -> UX -> Architect -> Engineer -> Reviewer |\n'
      + '| `epic` | Full epic workflow with PRD and breakdown |\n'
      + '| `story` | Engineer -> Reviewer (spec ready) |\n'
      + '| `bug` | Engineer -> Reviewer (direct) |\n'
      + '| `spike` | Architect research spike |\n'
      + '| `devops` | DevOps pipeline workflow |\n'
      + '| `docs` | Documentation update |\n'
    );
    return { metadata: { command: 'workflow', initialized: true } as AgentXChatMetadata };
  }

  response.progress(`Running ${workflowType} workflow...`);
  try {
    const output = await agentx.runCli('workflow', [workflowType]);
    response.markdown(`**Workflow: ${workflowType}**\n\n`);
    response.markdown('```\n' + output + '\n```');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown(`**Error** running workflow: ${message}`);
  }

  return { metadata: { command: 'workflow', workflowType, initialized: true } as AgentXChatMetadata };
}

async function handleStatus(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  response.progress('Loading agent status...');

  try {
    const output = await agentx.runCli('state');
    response.markdown('**Agent Status**\n\n');
    response.markdown('```\n' + output + '\n```');
  } catch {
    // Fallback: read agent definitions directly
    const agents = await agentx.listAgents();
    if (agents.length === 0) {
      response.markdown('No agents found in this workspace.');
    } else {
      response.markdown('**Agents** (' + agents.length + '):\n\n');
      response.markdown('| Agent | Model | Maturity | Mode |\n|-------|-------|----------|------|\n');
      for (const a of agents) {
        response.markdown(`| ${a.name} | ${a.model} | ${a.maturity} | ${a.mode} |\n`);
      }
    }
  }

  return { metadata: { command: 'status', initialized: true } as AgentXChatMetadata };
}

async function handleDeps(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  const issueMatch = request.prompt.trim().match(/^#?(\d+)$/);
  if (!issueMatch) {
    response.markdown(
      '**Usage**: `@agentx /deps <issue-number>`\n\n'
      + 'Example: `@agentx /deps 42`'
    );
    return { metadata: { command: 'deps', initialized: true } as AgentXChatMetadata };
  }

  const issueNumber = issueMatch[1];
  response.progress(`Checking dependencies for issue #${issueNumber}...`);

  try {
    const output = await agentx.runCli('deps', [issueNumber]);
    response.markdown(`**Dependencies for Issue #${issueNumber}**\n\n`);
    response.markdown('```\n' + output + '\n```');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown(`**Error** checking dependencies: ${message}`);
  }

  return { metadata: { command: 'deps', issueNumber, initialized: true } as AgentXChatMetadata };
}

async function handleDigest(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  response.progress('Generating weekly digest (this may take a moment)...');

  try {
    const output = await agentx.runCli('digest');
    response.markdown('**Weekly Digest**\n\n');
    response.markdown(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown(`**Error** generating digest: ${message}`);
  }

  return { metadata: { command: 'digest', initialized: true } as AgentXChatMetadata };
}

/**
 * Handle /clarify [list|show <id>|stale]
 *
 * Subcommands:
 *  (no args)  -- list all active clarifications
 *  list       -- same as no args
 *  show <id>  -- show full thread for a specific clarification
 *  stale      -- show only stale/stuck clarifications
 */
async function handleClarify(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext
): Promise<vscode.ChatResult> {
  const args = request.prompt.trim().split(/\s+/).filter(Boolean);
  const subcmd = args[0]?.toLowerCase() ?? 'list';

  response.progress('Loading clarification data...');

  try {
    // Attempt to call the CLI for live data.
    const cliArgs = args.length > 0 ? args : ['list'];
    const output = await agentx.runCli('clarify', cliArgs);

    if (!output || output.trim().length === 0) {
      response.markdown('**Clarifications**: No active clarifications found.');
    } else if (subcmd === 'show' && args[1]) {
      // CLI returns JSON for show subcommand -- try to render as markdown thread.
      try {
        const parsed: unknown = JSON.parse(output);
        const records = Array.isArray(parsed)
          ? (parsed as ClarificationRecord[])
          : [parsed as ClarificationRecord];
        response.markdown(renderThreadMarkdown(records));
      } catch {
        // CLI returned plain text -- just display it.
        response.markdown('```\n' + output + '\n```');
      }
    } else if (subcmd === 'stale') {
      // CLI returns JSON monitor report for stale subcommand.
      try {
        const report = JSON.parse(output) as MonitorReport;
        response.markdown(renderMonitorReportMarkdown(report));
      } catch {
        response.markdown('```\n' + output + '\n```');
      }
    } else {
      response.markdown('**Active Clarifications**\n\n');
      response.markdown('```\n' + output + '\n```');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    response.markdown(
      `**Clarification Command Help**\n\n`
      + '| Subcommand | Description |\n'
      + '|------------|-------------|\n'
      + '| `/clarify` | List all active clarifications |\n'
      + '| `/clarify list` | Same as above |\n'
      + '| `/clarify show <id>` | Show full thread for one clarification |\n'
      + '| `/clarify stale` | Show stale / stuck clarifications |\n'
      + '\n'
      + `_CLI error: ${message}_`
    );
  }

  return { metadata: { command: 'clarify', initialized: true } as AgentXChatMetadata };
}
