import { AgentXContext } from '../agentxContext';
import {
  createAIEvaluationExecutionPlan,
  executeAIEvaluationRunFromRoot,
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

export function planAIEvaluationRun(agentx: AgentXContext) {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return createAIEvaluationExecutionPlan(root);
}

export async function executeAIEvaluationRun(
  agentx: AgentXContext,
  options: Parameters<typeof executeAIEvaluationRunFromRoot>[1],
) {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return executeAIEvaluationRunFromRoot(root, options);
}