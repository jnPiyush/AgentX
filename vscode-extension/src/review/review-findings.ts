import { FrontierContext } from '../frontierContext';
import { encodeBase64 } from './review-findingsInternals';
import type {
  ReviewFindingPromotionResult,
} from './review-findingsTypes';
import {
 buildReviewFindingIssueDraft,
 findReviewFindingById,
 getPromotableFindingSummary as getPromotableFindingSummaryForRoot,
 getPromotableFindingTooltip as getPromotableFindingTooltipForRoot,
 getPromotableReviewFindings,
 getReviewFindingSummary as getReviewFindingSummaryForRoot,
 getReviewFindingTooltip as getReviewFindingTooltipForRoot,
 loadReviewFindingRecords,
 renderReviewFindingsMarkdown,
 renderReviewFindingsText,
 updatePromotedFinding,
} from './reviewFindingsEngine';

export type {
  ReviewFindingIssueDraft,
  ReviewFindingPriority,
  ReviewFindingPromotion,
  ReviewFindingPromotionResult,
  ReviewFindingRecord,
  ReviewFindingSeverity,
  ReviewFindingStatus,
  ReviewFindingType,
} from './review-findingsTypes';

export async function promoteReviewFinding(
  agentx: FrontierContext,
  findingId: string,
): Promise<ReviewFindingPromotionResult> {
  const root = agentx.workspaceRoot;
  if (!root) {
    throw new Error('Frontier needs an open workspace to promote review findings.');
  }

  const finding = findReviewFindingById(root, findingId);
  if (!finding) {
    throw new Error(`Review finding ${findingId} was not found.`);
  }

  if (finding.backlogIssue) {
    return {
      finding,
      issueNumber: finding.backlogIssue,
      alreadyPromoted: true,
    };
  }

  const draft = buildReviewFindingIssueDraft(finding);
  const output = await agentx.runCli('issue', [
    'create',
    '--title-base64',
    encodeBase64(draft.title),
    '--body-base64',
    encodeBase64(draft.body),
    '-l',
    draft.labels.join(','),
  ]);
  const match = output.match(/#(\d+)/);
  if (!match) {
    throw new Error('Frontier created the issue, but the new issue number could not be parsed.');
  }

  const issueNumber = Number(match[1]);
  const updatedFinding = updatePromotedFinding(root, finding, issueNumber);
  return {
    finding: updatedFinding,
    issueNumber,
    alreadyPromoted: false,
  };
}

export {
 buildReviewFindingIssueDraft,
 findReviewFindingById,
 getPromotableReviewFindings,
 loadReviewFindingRecords,
 renderReviewFindingsMarkdown,
 renderReviewFindingsText,
};

export function getReviewFindingSummary(agentx: FrontierContext): string {
 return getReviewFindingSummaryForRoot(agentx.workspaceRoot);
}

export function getReviewFindingTooltip(agentx: FrontierContext): string {
 return getReviewFindingTooltipForRoot(agentx.workspaceRoot);
}

export function getPromotableFindingSummary(agentx: FrontierContext): string {
 return getPromotableFindingSummaryForRoot(agentx.workspaceRoot);
}

export function getPromotableFindingTooltip(agentx: FrontierContext): string {
 return getPromotableFindingTooltipForRoot(agentx.workspaceRoot);
}