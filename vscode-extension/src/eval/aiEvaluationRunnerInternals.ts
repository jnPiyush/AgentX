import * as fs from 'fs';
import * as path from 'path';
import {
  evaluateAIEvaluationContractFromRoot,
} from './aiEvaluationContractInternals';
import type {
  AIEvaluationManifest,
  AIEvaluationMetricResult,
  AIEvaluationReport,
  AIEvaluationRunnerKind,
  AIEvaluationThreshold,
  AIEvaluationWorkspaceState,
} from './aiEvaluationContractTypes';
import type {
  AIEvaluationExecutionBlocker,
  AIEvaluationExecutionContext,
  AIEvaluationExecutionOptions,
  AIEvaluationExecutionPlan,
  AIEvaluationExecutionPlanningResult,
  AIEvaluationExecutionResult,
  AIEvaluationRawOutput,
  AIEvaluationRunnerAdapter,
  ShellAIEvaluationCommand,
} from './aiEvaluationRunnerTypes';
import { execShellStreaming } from '../utils/shell';

const RUN_ID_PREFIX = 'eval';
const REGRESSION_EPSILON = 0.0001;

function toRelative(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function toWorkspaceRelative(root: string, filePath: string): string {
  return toRelative(path.relative(root, filePath));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value
    .map((entry) => readOptionalString(entry))
    .filter((entry): entry is string => !!entry);

  return entries.length > 0 ? [...new Set(entries)] : undefined;
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${RUN_ID_PREFIX}-${timestamp}-${suffix}`;
}

function buildModels(manifest: AIEvaluationManifest): ReadonlyArray<string> {
  return [...new Set([
    manifest.modelMatrix.primary.name,
    ...manifest.modelMatrix.fallback.map((model) => model.name),
    ...manifest.modelMatrix.comparisons.map((model) => model.name),
  ])];
}

function buildBlockers(contract: AIEvaluationWorkspaceState): ReadonlyArray<AIEvaluationExecutionBlocker> {
  const blockers: AIEvaluationExecutionBlocker[] = contract.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => ({ code: issue.code, message: issue.message }));

  if (!contract.contractPresent) {
    blockers.unshift({
      code: 'contract.missing',
      message: 'AI evaluation execution requires evaluation/frontier.eval.yaml in the workspace.',
    });
  }

  if (!contract.manifest) {
    blockers.push({
      code: 'manifest.invalid',
      message: 'AI evaluation execution requires a valid evaluation manifest.',
    });
  }

  if (!contract.baseline) {
    blockers.push({
      code: 'baseline.invalid',
      message: 'AI evaluation execution requires a valid baseline artifact.',
    });
  }

  if (!contract.runnerSelection) {
    blockers.push({
      code: 'runner.missing',
      message: 'AI evaluation execution requires a resolved runner selection.',
    });
  }

  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function createAIEvaluationExecutionPlan(root: string): AIEvaluationExecutionPlanningResult {
  const contract = evaluateAIEvaluationContractFromRoot(root);
  const blockers = buildBlockers(contract);
  const manifest = contract.manifest;
  const runner = contract.runnerSelection;

  if (!contract.contractReady || !manifest || !runner || blockers.length > 0) {
    return {
      ready: false,
      contract,
      blockers,
    };
  }

  return {
    ready: true,
    contract,
    blockers: [],
    plan: {
      runId: createRunId(),
      root,
      manifestPath: contract.manifestPath ?? 'evaluation/frontier.eval.yaml',
      workflow: manifest.intent.workflow,
      runner,
      reportDirectory: manifest.reporting.outputDirectory,
      retainRawOutputs: Boolean(manifest.reporting.retainRawOutputs),
      models: buildModels(manifest),
      datasets: manifest.datasets.map((dataset) => dataset.path),
      metrics: manifest.metrics,
      baselineRunId: contract.baseline?.acceptedRunId,
    },
  };
}

function buildThresholdMap(
  manifest: AIEvaluationManifest,
): ReadonlyMap<string, AIEvaluationThreshold> {
  return new Map(manifest.thresholds.map((threshold) => [threshold.metric, threshold]));
}

function buildRawMetricMap(raw: AIEvaluationRawOutput): ReadonlyMap<string, number> {
  return new Map(raw.aggregateMetrics.map((metric) => [metric.metric, metric.score]));
}

function getMetricStatus(score: number, threshold: AIEvaluationThreshold | undefined): AIEvaluationMetricResult['status'] {
  if (!threshold) {
    return 'pass';
  }

  if (threshold.blocking !== undefined && score < threshold.blocking) {
    return 'fail';
  }

  if (threshold.warning !== undefined && score < threshold.warning) {
    return 'warn';
  }

  return 'pass';
}

function normalizeDeclaredMetric(
  metric: string,
  threshold: AIEvaluationThreshold | undefined,
  rawMetricMap: ReadonlyMap<string, number>,
): AIEvaluationMetricResult {
  const rawScore = rawMetricMap.get(metric);
  if (rawScore === undefined) {
    return {
      metric,
      score: 0,
      blocking: threshold?.blocking,
      warning: threshold?.warning,
      status: 'missing',
    };
  }

  return {
    metric,
    score: rawScore,
    blocking: threshold?.blocking,
    warning: threshold?.warning,
    status: getMetricStatus(rawScore, threshold),
  };
}

function normalizeExtraMetric(
  metric: string,
  rawMetricMap: ReadonlyMap<string, number>,
  threshold: AIEvaluationThreshold | undefined,
): AIEvaluationMetricResult | undefined {
  const rawScore = rawMetricMap.get(metric);
  if (rawScore === undefined) {
    return undefined;
  }

  return {
    metric,
    score: rawScore,
    blocking: threshold?.blocking,
    warning: threshold?.warning,
    status: getMetricStatus(rawScore, threshold),
  };
}

function normalizeAggregateMetrics(
  manifest: AIEvaluationManifest,
  raw: AIEvaluationRawOutput,
): ReadonlyArray<AIEvaluationMetricResult> {
  const thresholdMap = buildThresholdMap(manifest);
  const rawMetricMap = buildRawMetricMap(raw);
  const declaredMetrics = manifest.metrics.map((metric) => normalizeDeclaredMetric(
    metric,
    thresholdMap.get(metric),
    rawMetricMap,
  ));

  const declaredSet = new Set(manifest.metrics);
  const extraMetrics = raw.aggregateMetrics
    .map((metric) => metric.metric)
    .filter((metric) => !declaredSet.has(metric))
    .map((metric) => normalizeExtraMetric(metric, rawMetricMap, thresholdMap.get(metric)))
    .filter((metric): metric is AIEvaluationMetricResult => !!metric);

  return [...declaredMetrics, ...extraMetrics];
}

function computeRegressionStatus(
  deltas: ReadonlyArray<NonNullable<AIEvaluationReport['regression']>['deltas'][number]>,
): NonNullable<AIEvaluationReport['regression']>['status'] {
  if (deltas.length === 0) {
    return 'unknown';
  }

  if (deltas.some((delta) => delta.direction === 'regressed')) {
    return 'regressed';
  }

  if (deltas.some((delta) => delta.direction === 'improved')) {
    return 'improved';
  }

  return 'stable';
}

function buildRegression(
  contract: AIEvaluationWorkspaceState,
  aggregateMetrics: ReadonlyArray<AIEvaluationMetricResult>,
): AIEvaluationReport['regression'] | undefined {
  const baseline = contract.baseline;
  if (!baseline) {
    return undefined;
  }

  const deltas = aggregateMetrics
    .map((metric) => {
      const baselineScore = baseline.aggregateScores[metric.metric];
      if (baselineScore === undefined) {
        return undefined;
      }

      const delta = metric.score - baselineScore;
      const direction = delta > REGRESSION_EPSILON
        ? 'improved'
        : delta < -REGRESSION_EPSILON
          ? 'regressed'
          : 'unchanged';

      return {
        metric: metric.metric,
        delta,
        direction,
      };
    })
    .filter((delta): delta is NonNullable<AIEvaluationReport['regression']>['deltas'][number] => !!delta);

  return {
    baselineRunId: baseline.acceptedRunId,
    status: computeRegressionStatus(deltas),
    deltas,
  };
}

function buildReportStatus(
  aggregateMetrics: ReadonlyArray<AIEvaluationMetricResult>,
  raw: AIEvaluationRawOutput,
): AIEvaluationReport['status'] {
  if (aggregateMetrics.some((metric) => metric.status === 'fail' || metric.status === 'missing')) {
    return 'fail';
  }

  if ((raw.safetySummary?.criticalCount ?? 0) > 0) {
    return 'fail';
  }

  if (aggregateMetrics.some((metric) => metric.status === 'warn')) {
    return 'warn';
  }

  if ((raw.safetySummary?.highCount ?? 0) > 0) {
    return 'warn';
  }

  return 'pass';
}

function buildReviewerNote(
  raw: AIEvaluationRawOutput,
  plan: AIEvaluationExecutionPlan,
  status: AIEvaluationReport['status'],
  aggregateMetrics: ReadonlyArray<AIEvaluationMetricResult>,
): string {
  const provided = readOptionalString(raw.reviewerNote);
  if (provided) {
    return provided;
  }

  const failingMetrics = aggregateMetrics
    .filter((metric) => metric.status === 'fail' || metric.status === 'missing')
    .map((metric) => metric.metric);
  if (failingMetrics.length > 0) {
    return `Runner ${plan.runner.preferred} produced ${status} status with blocking metrics: ${failingMetrics.join(', ')}.`;
  }

  const warningMetrics = aggregateMetrics
    .filter((metric) => metric.status === 'warn')
    .map((metric) => metric.metric);
  if (warningMetrics.length > 0) {
    return `Runner ${plan.runner.preferred} produced ${status} status with warning metrics: ${warningMetrics.join(', ')}.`;
  }

  return `Runner ${plan.runner.preferred} completed successfully for ${plan.workflow} evaluation.`;
}

function buildSummaryModels(
  raw: AIEvaluationRawOutput,
  plan: AIEvaluationExecutionPlan,
): ReadonlyArray<string> {
  return raw.models && raw.models.length > 0 ? raw.models : plan.models;
}

export function normalizeAIEvaluationOutput(
  contract: AIEvaluationWorkspaceState,
  plan: AIEvaluationExecutionPlan,
  raw: AIEvaluationRawOutput,
): AIEvaluationReport {
  const manifest = contract.manifest;
  if (!manifest) {
    throw new Error('Cannot normalize AI evaluation output without a valid manifest.');
  }

  const aggregateMetrics = normalizeAggregateMetrics(manifest, raw);
  const status = buildReportStatus(aggregateMetrics, raw);
  const regression = buildRegression(contract, aggregateMetrics);

  return {
    version: manifest.reporting.formatVersion,
    runId: raw.runId ?? plan.runId,
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    runner: plan.runner.preferred,
    status,
    summary: {
      models: buildSummaryModels(raw, plan),
      datasetCount: raw.datasetCount ?? plan.datasets.length,
      pass: status === 'pass',
    },
    aggregateMetrics,
    regression,
    failureSlices: raw.failureSlices ?? [],
    safetySummary: raw.safetySummary
      ? {
        criticalCount: raw.safetySummary.criticalCount ?? 0,
        highCount: raw.safetySummary.highCount ?? 0,
        summary: raw.safetySummary.summary,
      }
      : undefined,
    costAndLatency: raw.costAndLatency
      ? {
        totalCostUsd: raw.costAndLatency.totalCostUsd,
        avgLatencyMs: raw.costAndLatency.avgLatencyMs,
      }
      : undefined,
    reviewerNote: buildReviewerNote(raw, plan, status, aggregateMetrics),
  };
}

export function persistNormalizedAIEvaluationReport(
  root: string,
  plan: AIEvaluationExecutionPlan,
  report: AIEvaluationReport,
  rawOutput?: AIEvaluationRawOutput,
): {
  readonly reportPath: string;
  readonly rawOutputPath?: string;
} {
  const reportDirectory = path.join(root, plan.reportDirectory);
  fs.mkdirSync(reportDirectory, { recursive: true });

  const reportPath = path.join(reportDirectory, `${report.runId}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

  let rawOutputPath: string | undefined;
  if (plan.retainRawOutputs && rawOutput) {
    rawOutputPath = path.join(reportDirectory, `${report.runId}.raw.json`);
    fs.writeFileSync(rawOutputPath, `${JSON.stringify(rawOutput, null, 2)}\n`, 'utf-8');
  }

  return {
    reportPath: toWorkspaceRelative(root, reportPath),
    rawOutputPath: rawOutputPath ? toWorkspaceRelative(root, rawOutputPath) : undefined,
  };
}

function getAdapter(
  adapters: ReadonlyArray<AIEvaluationRunnerAdapter>,
  runner: AIEvaluationRunnerKind,
): AIEvaluationRunnerAdapter | undefined {
  return adapters.find((adapter) => adapter.runner === runner)
    ?? adapters.find((adapter) => adapter.runner === 'any');
}

function formatBlockers(blockers: ReadonlyArray<AIEvaluationExecutionBlocker>): string {
  return blockers.map((blocker) => `${blocker.code}: ${blocker.message}`).join('\n');
}

export async function executeAIEvaluationRunFromRoot(
  root: string,
  options: AIEvaluationExecutionOptions,
): Promise<AIEvaluationExecutionResult> {
  const planning = createAIEvaluationExecutionPlan(root);
  if (!planning.ready || !planning.plan) {
    throw new Error(`AI evaluation execution is blocked:\n${formatBlockers(planning.blockers)}`);
  }

  const adapter = getAdapter(options.adapters, planning.plan.runner.preferred);
  if (!adapter) {
    throw new Error(`No AI evaluation adapter registered for runner ${planning.plan.runner.preferred}.`);
  }

  const context: AIEvaluationExecutionContext = {
    contract: planning.contract,
    plan: planning.plan,
  };
  const rawOutput = await adapter.execute(context, { onLine: options.onLine });
  const report = normalizeAIEvaluationOutput(planning.contract, planning.plan, rawOutput);
  const persisted = persistNormalizedAIEvaluationReport(root, planning.plan, report, rawOutput);

  return {
    plan: planning.plan,
    report,
    reportPath: persisted.reportPath,
    rawOutputPath: persisted.rawOutputPath,
  };
}

function readRawMetricScore(value: unknown): AIEvaluationRawOutput['aggregateMetrics'][number] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const metric = readOptionalString(value.metric);
  const score = readOptionalNumber(value.score);
  if (!metric || score === undefined) {
    return undefined;
  }

  return { metric, score };
}

function readRawFailureSlice(
  value: unknown,
): NonNullable<AIEvaluationRawOutput['failureSlices']>[number] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const label = readOptionalString(value.label);
  const severity = readOptionalString(value.severity);
  const summary = readOptionalString(value.summary);
  if (!label || !summary || !severity || !['low', 'medium', 'high', 'critical'].includes(severity)) {
    return undefined;
  }
  const normalizedSeverity = severity as 'low' | 'medium' | 'high' | 'critical';

  return {
    label,
    severity: normalizedSeverity,
    summary,
    dataset: readOptionalString(value.dataset),
  };
}

function parseShellRunnerOutput(stdout: string): AIEvaluationRawOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    throw new Error(`Runner did not return valid JSON output: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error('Runner JSON output must be an object.');
  }

  const aggregateMetrics = Array.isArray(parsed.aggregateMetrics)
    ? parsed.aggregateMetrics
      .map((entry) => readRawMetricScore(entry))
      .filter((entry): entry is NonNullable<AIEvaluationRawOutput['aggregateMetrics'][number]> => !!entry)
    : [];

  if (aggregateMetrics.length === 0) {
    throw new Error('Runner JSON output must include aggregateMetrics with at least one metric result.');
  }

  return {
    runId: readOptionalString(parsed.runId),
    generatedAt: readOptionalString(parsed.generatedAt),
    models: readStringArray(parsed.models),
    datasetCount: readOptionalNumber(parsed.datasetCount),
    aggregateMetrics,
    failureSlices: Array.isArray(parsed.failureSlices)
      ? parsed.failureSlices
        .map((entry) => readRawFailureSlice(entry))
        .filter((entry): entry is NonNullable<AIEvaluationRawOutput['failureSlices']>[number] => !!entry)
      : undefined,
    safetySummary: isRecord(parsed.safetySummary)
      ? {
        criticalCount: readOptionalNumber(parsed.safetySummary.criticalCount),
        highCount: readOptionalNumber(parsed.safetySummary.highCount),
        summary: readOptionalString(parsed.safetySummary.summary),
      }
      : undefined,
    costAndLatency: isRecord(parsed.costAndLatency)
      ? {
        totalCostUsd: readOptionalNumber(parsed.costAndLatency.totalCostUsd),
        avgLatencyMs: readOptionalNumber(parsed.costAndLatency.avgLatencyMs),
      }
      : undefined,
    reviewerNote: readOptionalString(parsed.reviewerNote),
  };
}

export function createShellAIEvaluationRunnerAdapter(
  runner: AIEvaluationRunnerKind | 'any',
  buildCommand: (context: AIEvaluationExecutionContext) => ShellAIEvaluationCommand,
): AIEvaluationRunnerAdapter {
  return {
    runner,
    async execute(context, options) {
      const command = buildCommand(context);
      const shell = command.shell ?? (process.platform === 'win32' ? 'pwsh' : 'bash');
      const stdout = await execShellStreaming(
        command.command,
        context.plan.root,
        shell,
        options?.onLine,
        command.envOverrides,
      );
      return parseShellRunnerOutput(stdout);
    },
  };
}