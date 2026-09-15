import * as vscode from 'vscode';
import * as path from 'path';
import { FrontierContext } from '../frontierContext';
import {
  getFrontierChatFollowups,
  resetChatRouterStateForTests,
  routeFrontierChatRequest,
} from './requestRouter';

const PARTICIPANT_ID = 'frontier.chat';

export function resetChatParticipantStateForTests(): void {
  resetChatRouterStateForTests();
}

export { getFrontierChatFollowups };

export async function handleFrontierChatRequest(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
): Promise<vscode.ChatResult> {
  const initialized = await agentx.checkInitialized();
  if (!initialized) {
    return handleNotInitialized(response);
  }

  const userText = request.prompt.trim();
  if (!userText) {
    response.markdown('Please describe what you need Frontier to do.');
    return {};
  }

  return routeFrontierChatRequest(userText, response, agentx);
}

/**
 * Register the @frontier chat participant in Copilot Chat.
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  agentx: FrontierContext
): void {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> => {
    return handleFrontierChatRequest(request, response, agentx);
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.file(
    path.join(context.extensionPath, 'resources', 'icon.png')
  );
  participant.followupProvider = {
    provideFollowups: async () => getFrontierChatFollowups(agentx),
  };
  context.subscriptions.push(participant);
}

function handleNotInitialized(response: vscode.ChatResponseStream): vscode.ChatResult {
  response.markdown('**Frontier requires an open workspace folder.**\n\nOpen a folder in VS Code to get started.');
  return {};
}