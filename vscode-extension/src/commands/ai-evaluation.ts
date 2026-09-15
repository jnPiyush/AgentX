import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  runAIEvaluation,
  scaffoldAIEvaluationContract,
  showAIEvaluationStatus,
} from './aiEvaluationCommandInternals';

export function registerAIEvaluationCommands(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('frontier.showAIEvaluationStatus', async () => {
      await showAIEvaluationStatus(agentx);
    }),
    vscode.commands.registerCommand('frontier.scaffoldAIEvaluationContract', async () => {
      await scaffoldAIEvaluationContract(agentx);
    }),
    vscode.commands.registerCommand('frontier.runAIEvaluation', async () => {
      await runAIEvaluation(agentx);
    }),
  );
}