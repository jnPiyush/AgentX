import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  evaluateAgentNativeReview,
  renderAgentNativeReviewText,
} from '../review/agent-native-review';

let reviewChannel: vscode.OutputChannel | undefined;

function getReviewChannel(): vscode.OutputChannel {
  if (!reviewChannel) {
    reviewChannel = vscode.window.createOutputChannel('Frontier Review');
  }
  return reviewChannel;
}

export function registerAgentNativeReviewCommand(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('frontier.showAgentNativeReview', async () => {
      const report = evaluateAgentNativeReview(agentx);
      if (!report) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to review parity surfaces.');
        return;
      }

      const channel = getReviewChannel();
      channel.clear();
      channel.appendLine(renderAgentNativeReviewText(report));
      channel.show(true);
    }),
  );
}
