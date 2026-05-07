import { AgentXContext } from '../agentxContext';
import {
 AgentNativeReviewReport,
 CapabilityMapEntry,
 evaluateAgentNativeReviewFromRoot,
 ParityCheckResult,
 renderAgentNativeReviewMarkdown,
 renderAgentNativeReviewText,
 ReviewPillar,
 ReviewSeverity,
} from './agentNativeReviewInternals';

export type {
 AgentNativeReviewReport,
 CapabilityMapEntry,
 ParityCheckResult,
 ReviewPillar,
 ReviewSeverity,
};

export {
 renderAgentNativeReviewMarkdown,
 renderAgentNativeReviewText,
};

export function evaluateAgentNativeReview(agentx: AgentXContext): AgentNativeReviewReport | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return evaluateAgentNativeReviewFromRoot(root, agentx.extensionContext?.extensionPath);
}

export function getAgentNativeReviewSummary(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'No review';
  }
  return `${report.score.percent}% (${report.score.earned}/${report.score.max})`;
}

export function getAgentNativeReviewTooltip(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'No workspace open for agent-native review.';
  }

  return report.checks.map((check) => `${check.label}: ${check.summary}`).join('\n');
}

export function getAgentNativeGapSummary(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'unknown';
  }

  const failingEntries = report.capabilityMap.filter((entry) => entry.severity !== 'none').length;
  return failingEntries === 0 ? 'no gaps' : `${failingEntries} gap${failingEntries === 1 ? '' : 's'}`;
}

export function getAgentNativeGapTooltip(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'No workspace open for agent-native review.';
  }

  const failingEntries = report.capabilityMap.filter((entry) => entry.severity !== 'none');
  if (failingEntries.length === 0) {
    return 'No action, context, or shared-workspace parity gaps detected.';
  }

  return failingEntries.map((entry) => `${entry.label}: ${entry.summary}`).join('\n');
}
