import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  type LlmAdapterMode,
  runAddLlmAdapterCommand,
} from './llmAdaptersCommandInternals';

export function registerAddLlmAdapterCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
): void {
 const cmd = vscode.commands.registerCommand(
  'agentx.addLlmAdapter',
  async (preferredProviderId?: LlmAdapterMode) => {
   await runAddLlmAdapterCommand(agentx, preferredProviderId);
  },
 );

 context.subscriptions.push(cmd);
}