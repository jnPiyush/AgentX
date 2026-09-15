import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
 createLearningCapture,
 launchPlanDeepening,
 launchReviewKickoff,
 showBrainstorm,
 showCaptureGuidance,
 showCompoundLoop,
 showOperatorEnablementChecklist,
 showRankedLearnings,
 showWorkflowNextStep,
 showWorkflowRolloutScorecard,
} from './learningsCommandInternals';

export function registerLearningsCommands(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('frontier.showBrainstormGuide', async (query?: string) => {
      await showBrainstorm(agentx, query);
    }),
    vscode.commands.registerCommand('frontier.showPlanningLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'planning', query);
    }),
    vscode.commands.registerCommand('frontier.showReviewLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'review', query);
    }),
    vscode.commands.registerCommand('frontier.showKnowledgeCaptureGuidance', async () => {
      await showCaptureGuidance(agentx);
    }),
    vscode.commands.registerCommand('frontier.showCompoundLoop', async () => {
      await showCompoundLoop(agentx);
    }),
    vscode.commands.registerCommand('frontier.showWorkflowNextStep', async () => {
      await showWorkflowNextStep(agentx);
    }),
    vscode.commands.registerCommand('frontier.deepenPlan', async () => {
      await launchPlanDeepening(agentx);
    }),
    vscode.commands.registerCommand('frontier.kickoffReview', async () => {
      await launchReviewKickoff(agentx);
    }),
    vscode.commands.registerCommand('frontier.showWorkflowRolloutScorecard', async () => {
      await showWorkflowRolloutScorecard(agentx);
    }),
    vscode.commands.registerCommand('frontier.showOperatorEnablementChecklist', async () => {
      await showOperatorEnablementChecklist(agentx);
    }),
    vscode.commands.registerCommand('frontier.createLearningCapture', async () => {
      await createLearningCapture(agentx);
    }),
  );
}
