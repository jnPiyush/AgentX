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
  token?: vscode.CancellationToken,
): Promise<vscode.ChatResult> {
  const controller = new AbortController();
  const subscription = token?.onCancellationRequested(() => controller.abort());
  if (token?.isCancellationRequested) { controller.abort(); }
  try {
    if (controller.signal.aborted) { return {}; }
    const initialized = await agentx.checkInitialized();
    if (controller.signal.aborted) { return {}; }
    if (!initialized) {
      return handleNotInitialized(response);
    }

    const userText = request.prompt.trim();
    if (!userText) {
      response.markdown('Please describe what you need Frontier to do.');
      return {};
    }

    return await routeFrontierChatRequest(userText, response, agentx, controller.signal);
  } finally {
    subscription?.dispose();
  }
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
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> => {
    return handleFrontierChatRequest(request, response, agentx, token);
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