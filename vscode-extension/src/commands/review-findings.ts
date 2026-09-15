import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  ReviewFindingRecord,
  getPromotableReviewFindings,
  loadReviewFindingRecords,
  promoteReviewFinding,
  renderReviewFindingsText,
} from '../review/review-findings';

let findingsChannel: vscode.OutputChannel | undefined;

function getFindingsChannel(): vscode.OutputChannel {
  if (!findingsChannel) {
    findingsChannel = vscode.window.createOutputChannel('Frontier Review Findings');
  }
  return findingsChannel;
}

function showFindings(records: ReadonlyArray<ReviewFindingRecord>): void {
  const channel = getFindingsChannel();
  channel.clear();
  channel.appendLine(renderReviewFindingsText(records));
  channel.show(true);
}

async function selectFinding(root: string): Promise<ReviewFindingRecord | undefined> {
  const records = getPromotableReviewFindings(root);
  if (records.length === 0) {
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    records.map((record) => ({
      label: `${record.id} ${record.title}`,
      description: `${record.priority} | ${record.severity} | ${record.promotion}`,
      detail: record.summary || record.relativePath,
      findingId: record.id,
    })),
    {
      title: 'Frontier - Promote Review Finding',
      placeHolder: 'Select a durable review finding to promote into backlog work',
    },
  );

  if (!selected) {
    return undefined;
  }

  return records.find((record) => record.id === selected.findingId);
}

export function registerReviewFindingCommands(
  context: vscode.ExtensionContext,
  agentx: FrontierContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('frontier.showReviewFindings', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to show review findings.');
        return;
      }

      showFindings(loadReviewFindingRecords(root));
    }),
    vscode.commands.registerCommand('frontier.promoteReviewFinding', async (findingId?: string) => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Frontier needs an open workspace to promote review findings.');
        return;
      }

      const finding = findingId
        ? loadReviewFindingRecords(root).find((record) => record.id.toLowerCase() === findingId.toLowerCase())
        : await selectFinding(root);
      if (!finding) {
        vscode.window.showWarningMessage('No promotable review finding was selected.');
        return;
      }

      try {
        const result = await promoteReviewFinding(agentx, finding.id);
        showFindings(loadReviewFindingRecords(root));
        const detail = result.alreadyPromoted
          ? `already linked to issue #${result.issueNumber}`
          : `promoted as issue #${result.issueNumber}`;
        vscode.window.showInformationMessage(`Frontier: ${result.finding.id} ${detail}.`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Frontier failed to promote the finding: ${message}`);
      }
    }),
  );
}