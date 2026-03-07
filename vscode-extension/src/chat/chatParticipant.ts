import * as vscode from 'vscode';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { stripAnsi } from '../utils/stripAnsi';

const PARTICIPANT_ID = 'agentx.chat';

/**
 * Register the @agentx chat participant in Copilot Chat.
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  agentx: AgentXContext
): void {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> => {
    // Auto-ensure local config so chat works without explicit initialization
    const initialized = await agentx.checkInitialized();
    if (!initialized) {
      // Only block if we still can't initialize (e.g. no workspace open)
      return handleNotInitialized(response);
    }

    const userText = request.prompt.trim();
    if (!userText) {
      response.markdown('Please describe what you need AgentX to do.');
      return {};
    }

    // Detect simple run pattern: "run <agent> <task>"
    const runMatch = userText.match(/^run\s+(\S+)\s+(.+)$/is);
    if (runMatch) {
      const agentName = runMatch[1].toLowerCase();
      const task = runMatch[2].trim();
      try {
        response.progress(`Running ${agentName} agent...`);
        const output = await agentx.runCli('run', [agentName, `"${task.replace(/"/g, '\\"')}"`]);
        response.markdown(stripAnsi(output));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        response.markdown(`**AgentX error:** ${msg}`);
      }
      return {};
    }

    // Default: show usage guidance
    response.markdown(
      '**AgentX** - Multi-Agent Orchestration\n\n'
      + 'Usage:\n'
      + '- `@agentx run engineer "implement the health endpoint for issue #42"`\n'
      + '- `@agentx run architect "design the auth system"`\n'
      + '- `@agentx run reviewer "review the changes in issue #42"`\n\n'
      + 'Or use the AgentX sidebar to browse agents, templates, and workflows.'
    );
    return {};
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.file(
    path.join(context.extensionPath, 'resources', 'icon.png')
  );
  context.subscriptions.push(participant);
}

function handleNotInitialized(response: vscode.ChatResponseStream): vscode.ChatResult {
  response.markdown('**AgentX requires an open workspace folder.**\n\nOpen a folder in VS Code to get started.');
  return {};
}
