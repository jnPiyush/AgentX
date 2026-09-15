import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  type LlmAdapterMode,
  runAddLlmAdapterCommand,
} from './llmAdaptersCommandInternals';

export function registerAddLlmAdapterCommand(
 context: vscode.ExtensionContext,
 agentx: FrontierContext,
): void {
 const cmd = vscode.commands.registerCommand(
  'frontier.addLlmAdapter',
  async (preferredProviderId?: LlmAdapterMode) => {
   await runAddLlmAdapterCommand(agentx, preferredProviderId);
  },
 );

 context.subscriptions.push(cmd);
}