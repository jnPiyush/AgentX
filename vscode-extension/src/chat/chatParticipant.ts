import * as vscode from 'vscode';
import * as path from 'path';
import { FrontierContext } from '../frontierContext';
import { matchesInitializeIntent } from './requestRouterInternals';
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
    const userText = request.prompt.trim();
    if (!userText) {
      response.markdown('Please describe what you need Frontier to do.');
      return {};
    }
    if (matchesInitializeIntent(userText)) {
      return await routeFrontierChatRequest(userText, response, agentx, controller.signal);
    }

    const root = await agentx.ensureWorkspaceState();
    if (controller.signal.aborted) { return {}; }
    return await routeFrontierChatRequest(userText, response, agentx.forWorkspace(root), controller.signal);
  } catch (error) {
    if (controller.signal.aborted) { return {}; }
    response.markdown(`**Frontier error:** ${error instanceof Error ? error.message : String(error)}`);
    return {};
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
    path.join(context.extensionPath, 'resources', 'frontier-ai-coding-harness.png')
  );
  participant.followupProvider = {
    provideFollowups: async () => getFrontierChatFollowups(agentx),
  };
  context.subscriptions.push(participant);
}
