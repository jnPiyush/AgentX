import { FrontierContext } from '../frontierContext';
import {
  evaluateAIEvaluationContractFromRoot,
  renderAIEvaluationContractSummary,
  renderAIEvaluationContractTooltip,
} from './aiEvaluationContractInternals';
import type { AIEvaluationWorkspaceState } from './aiEvaluationContractTypes';

export type {
  AIEvaluationDeltaDirection,
  AIEvaluationExecutionConfig,
  AIEvaluationExecutionShell,
  AIEvaluationBaseline,
  AIEvaluationDatasetRef,
  AIEvaluationFailureSlice,
  AIEvaluationGateStatus,
  AIEvaluationIssue,
  AIEvaluationManifest,
  AIEvaluationMetricResult,
  AIEvaluationMetricStatus,
  AIEvaluationModelRef,
  AIEvaluationRegressionDelta,
  AIEvaluationReport,
  AIEvaluationReportPolicy,
  AIEvaluationRubricRef,
  AIEvaluationRunnerKind,
  AIEvaluationRunnerMode,
  AIEvaluationRunnerSelection,
  AIEvaluationSeverity,
  AIEvaluationThreshold,
  AIEvaluationWorkflowIntent,
  AIEvaluationWorkspaceState,
} from './aiEvaluationContractTypes';

export function evaluateAIEvaluationContract(agentx: FrontierContext): AIEvaluationWorkspaceState | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return evaluateAIEvaluationContractFromRoot(root);
}

export function getAIEvaluationContractSummary(agentx: FrontierContext): string {
  const state = evaluateAIEvaluationContract(agentx);
  if (!state) {
    return 'No AI evaluation';
  }

  return renderAIEvaluationContractSummary(state);
}

export function getAIEvaluationContractTooltip(agentx: FrontierContext): string {
  const state = evaluateAIEvaluationContract(agentx);
  if (!state) {
    return 'No workspace open for AI evaluation.';
  }

  return renderAIEvaluationContractTooltip(state);
}