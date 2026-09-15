import { FrontierContext } from '../frontierContext';
import {
  createAIEvaluationExecutionPlan,
  createShellAIEvaluationRunnerAdapter,
  executeAIEvaluationRunFromRoot,
  normalizeAIEvaluationOutput,
  persistNormalizedAIEvaluationReport,
} from './aiEvaluationRunnerInternals';

export type {
  AIEvaluationExecutionBlocker,
  AIEvaluationExecutionContext,
  AIEvaluationExecutionOptions,
  AIEvaluationExecutionPlan,
  AIEvaluationExecutionPlanningResult,
  AIEvaluationExecutionResult,
  AIEvaluationRawCostAndLatency,
  AIEvaluationRawFailureSlice,
  AIEvaluationRawMetricScore,
  AIEvaluationRawOutput,
  AIEvaluationRawSafetySummary,
  AIEvaluationRunnerAdapter,
  ShellAIEvaluationCommand,
} from './aiEvaluationRunnerTypes';

export {
  createShellAIEvaluationRunnerAdapter,
  normalizeAIEvaluationOutput,
  persistNormalizedAIEvaluationReport,
} from './aiEvaluationRunnerInternals';

export function planAIEvaluationRun(agentx: FrontierContext) {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return createAIEvaluationExecutionPlan(root);
}

export async function executeAIEvaluationRun(
  agentx: FrontierContext,
  options: Parameters<typeof executeAIEvaluationRunFromRoot>[1],
) {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return executeAIEvaluationRunFromRoot(root, options);
}