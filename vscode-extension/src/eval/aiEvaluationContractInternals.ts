import * as fs from 'fs';
import * as path from 'path';
import type {
  AIEvaluationExecutionShell,
  AIEvaluationBaseline,
  AIEvaluationDatasetRef,
  AIEvaluationFailureSlice,
  AIEvaluationIssue,
  AIEvaluationManifest,
  AIEvaluationMetricResult,
  AIEvaluationModelRef,
  AIEvaluationReport,
  AIEvaluationRubricRef,
  AIEvaluationRunnerKind,
  AIEvaluationRunnerMode,
  AIEvaluationRunnerSelection,
  AIEvaluationThreshold,
  AIEvaluationWorkflowIntent,
  AIEvaluationWorkspaceState,
} from './aiEvaluationContractTypes';

const MANIFEST_PATH = path.join('evaluation', 'agentx.eval.yaml');
const BASELINE_PATH = path.join('evaluation', 'baseline.json');
const DEFAULT_REPORT_DIR = path.join('.copilot-tracking', 'eval-reports');

const WORKFLOW_INTENTS: ReadonlySet<AIEvaluationWorkflowIntent> = new Set([
  'prompt',
  'rag',
  'agentic',
  'multimodal',
  'hybrid',
]);

const RUNNER_KINDS: ReadonlySet<AIEvaluationRunnerKind> = new Set([
  'promptfoo',
  'azure-ai-evaluation',
  'custom',
]);

const RUNNER_MODES: ReadonlySet<AIEvaluationRunnerMode> = new Set([
  'local',
  'remote',
  'hybrid',
]);

const EXECUTION_SHELLS: ReadonlySet<AIEvaluationExecutionShell> = new Set([
  'pwsh',
  'bash',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRelative(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function pushIssue(
  issues: AIEvaluationIssue[],
  severity: AIEvaluationIssue['severity'],
  code: string,
  message: string,
  filePath?: string,
): void {
  issues.push({ code, severity, message, filePath: filePath ? toRelative(filePath) : undefined });
}

function readYamlFile(filePath: string, issues: AIEvaluationIssue[]): unknown {
  try {
    const yamlModule = require('yaml') as { parse: (input: string) => unknown };
    return yamlModule.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parse error';
    pushIssue(issues, 'error', 'manifest.parse', `Unable to parse evaluation manifest: ${message}`, filePath);
    return undefined;
  }
}

function readJsonFile(filePath: string, issues: AIEvaluationIssue[], code: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    pushIssue(issues, 'error', code, `Unable to parse JSON artifact: ${message}`, filePath);
    return undefined;
  }
}

function readRequiredString(
  value: unknown,
  issues: AIEvaluationIssue[],
  code: string,
  label: string,
  filePath: string,
): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushIssue(issues, 'error', code, `${label} must be a non-empty string.`, filePath);
    return undefined;
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readRequiredNumber(
  value: unknown,
  issues: AIEvaluationIssue[],
  code: string,
  label: string,
  filePath: string,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushIssue(issues, 'error', code, `${label} must be a finite number.`, filePath);
    return undefined;
  }

  return value;
}

function readModelRef(
  value: unknown,
  issues: AIEvaluationIssue[],
  codePrefix: string,
  filePath: string,
): AIEvaluationModelRef | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return { name: value.trim() };
  }

  if (!isRecord(value)) {
    pushIssue(issues, 'error', `${codePrefix}.shape`, 'Model reference must be a string or object.', filePath);
    return undefined;
  }

  const name = readRequiredString(value.name, issues, `${codePrefix}.name`, 'Model name', filePath);
  if (!name) {
    return undefined;
  }

  return {
    name,
    provider: readOptionalString(value.provider),
    version: readOptionalString(value.version),
  };
}

function readModelRefArray(
  value: unknown,
  issues: AIEvaluationIssue[],
  codePrefix: string,
  filePath: string,
): ReadonlyArray<AIEvaluationModelRef> {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    pushIssue(issues, 'error', `${codePrefix}.shape`, 'Model collection must be an array.', filePath);
    return [];
  }

  return value
    .map((entry, index) => readModelRef(entry, issues, `${codePrefix}[${index}]`, filePath))
    .filter((entry): entry is AIEvaluationModelRef => !!entry);
}

function validateRunnerKind(
  value: unknown,
  issues: AIEvaluationIssue[],
  code: string,
  label: string,
  filePath: string,
): AIEvaluationRunnerKind | undefined {
  const parsed = readRequiredString(value, issues, code, label, filePath);
  if (!parsed) {
    return undefined;
  }

  if (!RUNNER_KINDS.has(parsed as AIEvaluationRunnerKind)) {
    pushIssue(issues, 'error', code, `${label} must be one of: promptfoo, azure-ai-evaluation, custom.`, filePath);
    return undefined;
  }

  return parsed as AIEvaluationRunnerKind;
}

function validateRunnerMode(
  value: unknown,
  issues: AIEvaluationIssue[],
  filePath: string,
): AIEvaluationRunnerMode | undefined {
  const parsed = readRequiredString(value, issues, 'manifest.runner.mode', 'Runner mode', filePath);
  if (!parsed) {
    return undefined;
  }

  if (!RUNNER_MODES.has(parsed as AIEvaluationRunnerMode)) {
    pushIssue(issues, 'error', 'manifest.runner.mode', 'Runner mode must be one of: local, remote, hybrid.', filePath);
    return undefined;
  }

  return parsed as AIEvaluationRunnerMode;
}

function validateWorkflowIntent(
  value: unknown,
  issues: AIEvaluationIssue[],
  filePath: string,
): AIEvaluationWorkflowIntent | undefined {
  const parsed = readRequiredString(value, issues, 'manifest.intent.workflow', 'Workflow intent', filePath);
  if (!parsed) {
    return undefined;
  }

  if (!WORKFLOW_INTENTS.has(parsed as AIEvaluationWorkflowIntent)) {
    pushIssue(issues, 'error', 'manifest.intent.workflow', 'Workflow intent must be one of: prompt, rag, agentic, multimodal, hybrid.', filePath);
    return undefined;
  }

  return parsed as AIEvaluationWorkflowIntent;
}

function validateExecutionShell(
  value: unknown,
  issues: AIEvaluationIssue[],
  filePath: string,
): AIEvaluationExecutionShell | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = readRequiredString(value, issues, 'manifest.execution.shell', 'Execution shell', filePath);
  if (!parsed) {
    return undefined;
  }

  if (!EXECUTION_SHELLS.has(parsed as AIEvaluationExecutionShell)) {
    pushIssue(issues, 'error', 'manifest.execution.shell', 'Execution shell must be one of: pwsh, bash.', filePath);
    return undefined;
  }

  return parsed as AIEvaluationExecutionShell;
}

function readDatasets(
  value: unknown,
  root: string,
  issues: AIEvaluationIssue[],
  filePath: string,
): ReadonlyArray<AIEvaluationDatasetRef> {
  if (!Array.isArray(value) || value.length === 0) {
    pushIssue(issues, 'error', 'manifest.datasets', 'Datasets must be a non-empty array.', filePath);
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        pushIssue(issues, 'error', `manifest.datasets[${index}]`, 'Dataset entry must be an object.', filePath);
        return undefined;
      }

      const datasetPath = readRequiredString(
        entry.path,
        issues,
        `manifest.datasets[${index}].path`,
        'Dataset path',
        filePath,
      );
      const dataset = {
        name: readRequiredString(entry.name, issues, `manifest.datasets[${index}].name`, 'Dataset name', filePath),
        path: datasetPath,
        purpose: readRequiredString(entry.purpose, issues, `manifest.datasets[${index}].purpose`, 'Dataset purpose', filePath),
        coverageType: readRequiredString(
          entry.coverageType,
          issues,
          `manifest.datasets[${index}].coverageType`,
          'Dataset coverage type',
          filePath,
        ),
        rowCount: readOptionalNumber(entry.rowCount),
        dataFormat: readOptionalString(entry.dataFormat),
      };

      if (!dataset.name || !dataset.path || !dataset.purpose || !dataset.coverageType) {
        return undefined;
      }

      const absolutePath = path.join(root, dataset.path);
      if (!fs.existsSync(absolutePath)) {
        pushIssue(
          issues,
          'error',
          `manifest.datasets[${index}].missing`,
          `Dataset path does not exist: ${dataset.path}`,
          filePath,
        );
      }

      return dataset as AIEvaluationDatasetRef;
    })
    .filter((entry): entry is AIEvaluationDatasetRef => !!entry);
}

function readStringArray(
  value: unknown,
  issues: AIEvaluationIssue[],
  code: string,
  label: string,
  filePath: string,
): ReadonlyArray<string> {
  if (!Array.isArray(value) || value.length === 0) {
    pushIssue(issues, 'error', code, `${label} must be a non-empty array.`, filePath);
    return [];
  }

  const results = value
    .map((entry, index) => readRequiredString(entry, issues, `${code}[${index}]`, `${label} entry`, filePath))
    .filter((entry): entry is string => !!entry);

  return [...new Set(results)];
}

function readThresholds(
  value: unknown,
  metrics: ReadonlyArray<string>,
  issues: AIEvaluationIssue[],
  filePath: string,
): ReadonlyArray<AIEvaluationThreshold> {
  if (!Array.isArray(value) || value.length === 0) {
    pushIssue(issues, 'error', 'manifest.thresholds', 'Thresholds must be a non-empty array.', filePath);
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        pushIssue(issues, 'error', `manifest.thresholds[${index}]`, 'Threshold entry must be an object.', filePath);
        return undefined;
      }

      const metric = readRequiredString(entry.metric, issues, `manifest.thresholds[${index}].metric`, 'Threshold metric', filePath);
      const blocking = readOptionalNumber(entry.blocking);
      const warning = readOptionalNumber(entry.warning);

      if (!metric) {
        return undefined;
      }

      if (!metrics.includes(metric)) {
        pushIssue(
          issues,
          'error',
          `manifest.thresholds[${index}].metric`,
          `Threshold metric must be declared in metrics: ${metric}`,
          filePath,
        );
      }

      if (blocking === undefined && warning === undefined) {
        pushIssue(
          issues,
          'error',
          `manifest.thresholds[${index}]`,
          'Threshold entry must declare at least one of blocking or warning.',
          filePath,
        );
      }

      return { metric, blocking, warning } as AIEvaluationThreshold;
    })
    .filter((entry): entry is AIEvaluationThreshold => !!entry);
}

function readRubrics(
  value: unknown,
  root: string,
  issues: AIEvaluationIssue[],
  filePath: string,
): ReadonlyArray<AIEvaluationRubricRef> {
  if (!Array.isArray(value) || value.length === 0) {
    pushIssue(issues, 'error', 'manifest.rubrics', 'Rubrics must be a non-empty array.', filePath);
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        pushIssue(issues, 'error', `manifest.rubrics[${index}]`, 'Rubric entry must be an object.', filePath);
        return undefined;
      }

      const rubricPath = readRequiredString(
        entry.path,
        issues,
        `manifest.rubrics[${index}].path`,
        'Rubric path',
        filePath,
      );
      const rubric = {
        metric: readRequiredString(entry.metric, issues, `manifest.rubrics[${index}].metric`, 'Rubric metric', filePath),
        path: rubricPath,
        judgeType: readOptionalString(entry.judgeType),
        scoringScale: readOptionalString(entry.scoringScale),
        calibrationRule: readOptionalString(entry.calibrationRule),
      };

      if (!rubric.metric || !rubric.path) {
        return undefined;
      }

      const absolutePath = path.join(root, rubric.path);
      if (!fs.existsSync(absolutePath)) {
        pushIssue(
          issues,
          'error',
          `manifest.rubrics[${index}].missing`,
          `Rubric path does not exist: ${rubric.path}`,
          filePath,
        );
      }

      return rubric as AIEvaluationRubricRef;
    })
    .filter((entry): entry is AIEvaluationRubricRef => !!entry);
}

function readManifest(root: string, issues: AIEvaluationIssue[]): {
  readonly manifestPath: string | undefined;
  readonly manifest: AIEvaluationManifest | undefined;
} {
  const manifestPath = path.join(root, MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    return { manifestPath: undefined, manifest: undefined };
  }

  const parsed = readYamlFile(manifestPath, issues);
  if (!isRecord(parsed)) {
    pushIssue(issues, 'error', 'manifest.shape', 'Evaluation manifest must be an object.', manifestPath);
    return { manifestPath, manifest: undefined };
  }

  const version = readRequiredNumber(parsed.version, issues, 'manifest.version', 'Manifest version', manifestPath);
  const intent = isRecord(parsed.intent) ? parsed.intent : undefined;
  if (!intent) {
    pushIssue(issues, 'error', 'manifest.intent', 'Manifest intent section is required.', manifestPath);
  }

  const workflow = intent ? validateWorkflowIntent(intent.workflow, issues, manifestPath) : undefined;
  const runner = isRecord(parsed.runner) ? parsed.runner : undefined;
  if (!runner) {
    pushIssue(issues, 'error', 'manifest.runner', 'Runner section is required.', manifestPath);
  }

  const preferredRunner = runner
    ? validateRunnerKind(runner.preferred, issues, 'manifest.runner.preferred', 'Preferred runner', manifestPath)
    : undefined;
  const alternates = Array.isArray(runner?.alternates)
    ? runner.alternates
      .map((entry, index) => validateRunnerKind(entry, issues, `manifest.runner.alternates[${index}]`, 'Alternate runner', manifestPath))
      .filter((entry): entry is AIEvaluationRunnerKind => !!entry)
    : [];
  const uniqueAlternates = [...new Set(alternates.filter((entry) => entry !== preferredRunner))];
  if (preferredRunner && alternates.includes(preferredRunner)) {
    pushIssue(issues, 'warning', 'manifest.runner.alternates.duplicate', 'Alternate runners should not repeat the preferred runner.', manifestPath);
  }

  const mode = runner ? validateRunnerMode(runner.mode, issues, manifestPath) : undefined;
  const remoteHost = readOptionalString(runner?.remoteHost);
  if (mode && mode !== 'local' && !remoteHost) {
    pushIssue(issues, 'error', 'manifest.runner.remoteHost', 'Remote and hybrid runners must declare remoteHost.', manifestPath);
  }

  const modelMatrix = isRecord(parsed.modelMatrix) ? parsed.modelMatrix : undefined;
  if (!modelMatrix) {
    pushIssue(issues, 'error', 'manifest.modelMatrix', 'Model matrix is required.', manifestPath);
  }

  const primaryModel = modelMatrix
    ? readModelRef(modelMatrix.primary, issues, 'manifest.modelMatrix.primary', manifestPath)
    : undefined;
  const fallbackModels = modelMatrix
    ? readModelRefArray(modelMatrix.fallback, issues, 'manifest.modelMatrix.fallback', manifestPath)
    : [];
  const comparisonModels = modelMatrix
    ? readModelRefArray(modelMatrix.comparisons, issues, 'manifest.modelMatrix.comparisons', manifestPath)
    : [];

  const metrics = readStringArray(parsed.metrics, issues, 'manifest.metrics', 'Metrics', manifestPath);
  const datasets = readDatasets(parsed.datasets, root, issues, manifestPath);
  const thresholds = readThresholds(parsed.thresholds, metrics, issues, manifestPath);
  const rubrics = readRubrics(parsed.rubrics, root, issues, manifestPath);
  const execution = isRecord(parsed.execution) ? parsed.execution : undefined;
  if (parsed.execution !== undefined && !execution) {
    pushIssue(issues, 'error', 'manifest.execution', 'Execution section must be an object.', manifestPath);
  }
  const executionCommand = execution ? readOptionalString(execution.command) : undefined;
  const executionShell = execution ? validateExecutionShell(execution.shell, issues, manifestPath) : undefined;
  const reporting = isRecord(parsed.reporting) ? parsed.reporting : undefined;
  if (!reporting) {
    pushIssue(issues, 'error', 'manifest.reporting', 'Reporting section is required.', manifestPath);
  }

  const outputDirectory = reporting
    ? readRequiredString(reporting.outputDirectory, issues, 'manifest.reporting.outputDirectory', 'Reporting output directory', manifestPath)
    : undefined;
  const formatVersion = reporting
    ? readRequiredNumber(reporting.formatVersion, issues, 'manifest.reporting.formatVersion', 'Reporting format version', manifestPath)
    : undefined;

  if (!version || !workflow || !preferredRunner || !mode || !primaryModel || !outputDirectory || !formatVersion) {
    return { manifestPath, manifest: undefined };
  }

  return {
    manifestPath,
    manifest: {
      version,
      intent: {
        workflow,
        description: intent ? readOptionalString(intent.description) : undefined,
      },
      runner: {
        preferred: preferredRunner,
        alternates: uniqueAlternates,
        mode,
        remoteHost,
      },
      modelMatrix: {
        primary: primaryModel,
        fallback: fallbackModels,
        comparisons: comparisonModels,
      },
      datasets,
      metrics,
      thresholds,
      rubrics,
      reporting: {
        outputDirectory,
        formatVersion,
        retainRawOutputs: reporting ? Boolean(reporting.retainRawOutputs) : undefined,
      },
      execution: executionCommand || executionShell
        ? {
          command: executionCommand,
          shell: executionShell,
        }
        : undefined,
    },
  };
}

function readScoreMap(
  value: unknown,
  issues: AIEvaluationIssue[],
  code: string,
  label: string,
  filePath: string,
): Readonly<Record<string, number>> {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    pushIssue(issues, 'error', code, `${label} must be a non-empty object.`, filePath);
    return {};
  }

  const scores: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      pushIssue(issues, 'error', `${code}.${key}`, `${label} values must be finite numbers.`, filePath);
      continue;
    }
    scores[key] = entry;
  }

  return scores;
}

function readThresholdSnapshot(
  value: unknown,
  issues: AIEvaluationIssue[],
  filePath: string,
): Readonly<Record<string, Readonly<{ blocking?: number; warning?: number }>>> {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    pushIssue(issues, 'error', 'baseline.thresholdSnapshot', 'Threshold snapshot must be a non-empty object.', filePath);
    return {};
  }

  const snapshot: Record<string, { blocking?: number; warning?: number }> = {};
  for (const [metric, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      pushIssue(issues, 'error', `baseline.thresholdSnapshot.${metric}`, 'Threshold snapshot entry must be an object.', filePath);
      continue;
    }

    snapshot[metric] = {
      blocking: readOptionalNumber(entry.blocking),
      warning: readOptionalNumber(entry.warning),
    };
  }

  return snapshot;
}

function readBaseline(root: string, issues: AIEvaluationIssue[]): {
  readonly baselinePath: string | undefined;
  readonly baseline: AIEvaluationBaseline | undefined;
} {
  const baselinePath = path.join(root, BASELINE_PATH);
  if (!fs.existsSync(baselinePath)) {
    pushIssue(issues, 'error', 'baseline.missing', 'Baseline artifact is required at evaluation/baseline.json.');
    return { baselinePath: undefined, baseline: undefined };
  }

  const parsed = readJsonFile(baselinePath, issues, 'baseline.parse');
  if (!isRecord(parsed)) {
    pushIssue(issues, 'error', 'baseline.shape', 'Baseline artifact must be an object.', baselinePath);
    return { baselinePath, baseline: undefined };
  }

  const version = readRequiredNumber(parsed.version, issues, 'baseline.version', 'Baseline version', baselinePath);
  const acceptedRunId = readRequiredString(parsed.acceptedRunId, issues, 'baseline.acceptedRunId', 'Accepted run id', baselinePath);
  const updatedAt = readRequiredString(parsed.updatedAt, issues, 'baseline.updatedAt', 'Updated timestamp', baselinePath);
  const runner = validateRunnerKind(parsed.runner, issues, 'baseline.runner', 'Baseline runner', baselinePath);
  const model = readRequiredString(parsed.model, issues, 'baseline.model', 'Baseline model', baselinePath);
  const aggregateScores = readScoreMap(parsed.aggregateScores, issues, 'baseline.aggregateScores', 'Aggregate scores', baselinePath);
  const thresholdSnapshot = readThresholdSnapshot(parsed.thresholdSnapshot, issues, baselinePath);

  if (!version || !acceptedRunId || !updatedAt || !runner || !model) {
    return { baselinePath, baseline: undefined };
  }

  return {
    baselinePath,
    baseline: {
      version,
      acceptedRunId,
      updatedAt,
      runner,
      model,
      aggregateScores,
      thresholdSnapshot,
    },
  };
}

function readMetricResults(
  value: unknown,
  issues: AIEvaluationIssue[],
  filePath: string,
): ReadonlyArray<AIEvaluationMetricResult> {
  if (!Array.isArray(value) || value.length === 0) {
    pushIssue(issues, 'error', 'report.aggregateMetrics', 'Aggregate metrics must be a non-empty array.', filePath);
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        pushIssue(issues, 'error', `report.aggregateMetrics[${index}]`, 'Metric result must be an object.', filePath);
        return undefined;
      }

      const metric = readRequiredString(entry.metric, issues, `report.aggregateMetrics[${index}].metric`, 'Metric name', filePath);
      const score = readRequiredNumber(entry.score, issues, `report.aggregateMetrics[${index}].score`, 'Metric score', filePath);
      const status = readRequiredString(entry.status, issues, `report.aggregateMetrics[${index}].status`, 'Metric status', filePath);
      if (!metric || score === undefined || !status) {
        return undefined;
      }

      if (!['pass', 'warn', 'fail', 'missing'].includes(status)) {
        pushIssue(issues, 'error', `report.aggregateMetrics[${index}].status`, 'Metric status must be pass, warn, fail, or missing.', filePath);
        return undefined;
      }

      return {
        metric,
        score,
        blocking: readOptionalNumber(entry.blocking),
        warning: readOptionalNumber(entry.warning),
        status,
      } as AIEvaluationMetricResult;
    })
    .filter((entry): entry is AIEvaluationMetricResult => !!entry);
}

function readFailureSlices(
  value: unknown,
  issues: AIEvaluationIssue[],
  filePath: string,
): ReadonlyArray<AIEvaluationFailureSlice> {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    pushIssue(issues, 'error', 'report.failureSlices', 'Failure slices must be an array.', filePath);
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        pushIssue(issues, 'error', `report.failureSlices[${index}]`, 'Failure slice must be an object.', filePath);
        return undefined;
      }

      const label = readRequiredString(entry.label, issues, `report.failureSlices[${index}].label`, 'Failure label', filePath);
      const severity = readRequiredString(entry.severity, issues, `report.failureSlices[${index}].severity`, 'Failure severity', filePath);
      const summary = readRequiredString(entry.summary, issues, `report.failureSlices[${index}].summary`, 'Failure summary', filePath);
      if (!label || !severity || !summary) {
        return undefined;
      }

      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        pushIssue(issues, 'error', `report.failureSlices[${index}].severity`, 'Failure severity must be low, medium, high, or critical.', filePath);
        return undefined;
      }

      return {
        label,
        severity,
        summary,
        dataset: readOptionalString(entry.dataset),
      } as AIEvaluationFailureSlice;
    })
    .filter((entry): entry is AIEvaluationFailureSlice => !!entry);
}

function readLatestReportFile(reportDir: string): string | undefined {
  if (!fs.existsSync(reportDir)) {
    return undefined;
  }

  return fs.readdirSync(reportDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(reportDir, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

function readLatestReport(
  root: string,
  manifest: AIEvaluationManifest | undefined,
  baseline: AIEvaluationBaseline | undefined,
  issues: AIEvaluationIssue[],
): {
  readonly latestReportPath: string | undefined;
  readonly latestReport: AIEvaluationReport | undefined;
} {
  const reportDir = path.join(root, manifest?.reporting.outputDirectory ?? DEFAULT_REPORT_DIR);
  const latestReportPath = readLatestReportFile(reportDir);
  if (!latestReportPath) {
    return { latestReportPath: undefined, latestReport: undefined };
  }

  const parsed = readJsonFile(latestReportPath, issues, 'report.parse');
  if (!isRecord(parsed)) {
    pushIssue(issues, 'error', 'report.shape', 'Normalized report must be an object.', latestReportPath);
    return { latestReportPath, latestReport: undefined };
  }

  const version = readRequiredNumber(parsed.version, issues, 'report.version', 'Report version', latestReportPath);
  const runId = readRequiredString(parsed.runId, issues, 'report.runId', 'Run id', latestReportPath);
  const generatedAt = readRequiredString(parsed.generatedAt, issues, 'report.generatedAt', 'Generated timestamp', latestReportPath);
  const runner = validateRunnerKind(parsed.runner, issues, 'report.runner', 'Report runner', latestReportPath);
  const status = readRequiredString(parsed.status, issues, 'report.status', 'Report status', latestReportPath);
  if (status && !['pass', 'warn', 'fail'].includes(status)) {
    pushIssue(issues, 'error', 'report.status', 'Report status must be pass, warn, or fail.', latestReportPath);
  }

  const summary = isRecord(parsed.summary) ? parsed.summary : undefined;
  if (!summary) {
    pushIssue(issues, 'error', 'report.summary', 'Report summary section is required.', latestReportPath);
  }

  const models = summary
    ? readStringArray(summary.models, issues, 'report.summary.models', 'Report models', latestReportPath)
    : [];
  const datasetCount = summary
    ? readRequiredNumber(summary.datasetCount, issues, 'report.summary.datasetCount', 'Report dataset count', latestReportPath)
    : undefined;
  const pass = summary?.pass;
  if (summary && typeof pass !== 'boolean') {
    pushIssue(issues, 'error', 'report.summary.pass', 'Report summary pass must be a boolean.', latestReportPath);
  }

  const aggregateMetrics = readMetricResults(parsed.aggregateMetrics, issues, latestReportPath);
  const failureSlices = readFailureSlices(parsed.failureSlices, issues, latestReportPath);
  const reviewerNote = readRequiredString(parsed.reviewerNote, issues, 'report.reviewerNote', 'Reviewer note', latestReportPath);

  if (manifest) {
    for (const threshold of manifest.thresholds) {
      if (!aggregateMetrics.some((entry) => entry.metric === threshold.metric)) {
        pushIssue(
          issues,
          'error',
          'report.aggregateMetrics.missing',
          `Report is missing aggregate metric required by manifest: ${threshold.metric}`,
          latestReportPath,
        );
      }
    }
  }

  const regression = isRecord(parsed.regression) ? parsed.regression : undefined;
  if (baseline && !regression) {
    pushIssue(issues, 'warning', 'report.regression.missing', 'Report is missing regression details for the current baseline.', latestReportPath);
  }

  if (!version || !runId || !generatedAt || !runner || !status || datasetCount === undefined || typeof pass !== 'boolean' || !reviewerNote) {
    return { latestReportPath, latestReport: undefined };
  }

  return {
    latestReportPath,
    latestReport: {
      version,
      runId,
      generatedAt,
      runner,
      status: status as AIEvaluationReport['status'],
      summary: {
        models,
        datasetCount,
        pass,
      },
      aggregateMetrics,
      regression: regression && isRecord(regression)
        ? {
          baselineRunId: readOptionalString(regression.baselineRunId),
          status: readRegressionStatus(regression.status),
          deltas: Array.isArray(regression.deltas)
            ? regression.deltas
              .map((entry) => {
                if (!isRecord(entry)) {
                  return undefined;
                }

                const metric = readOptionalString(entry.metric);
                const delta = readOptionalNumber(entry.delta);
                const direction = readOptionalString(entry.direction);
                if (!metric || delta === undefined || !direction || !['improved', 'regressed', 'unchanged'].includes(direction)) {
                  return undefined;
                }

                return {
                  metric,
                  delta,
                  direction,
                };
              })
              .filter((entry): entry is NonNullable<NonNullable<AIEvaluationReport['regression']>['deltas'][number]> => !!entry)
            : [],
        }
        : undefined,
      failureSlices,
      safetySummary: isRecord(parsed.safetySummary)
        ? {
          criticalCount: readOptionalNumber(parsed.safetySummary.criticalCount) ?? 0,
          highCount: readOptionalNumber(parsed.safetySummary.highCount) ?? 0,
          summary: readOptionalString(parsed.safetySummary.summary),
        }
        : undefined,
      costAndLatency: isRecord(parsed.costAndLatency)
        ? {
          totalCostUsd: readOptionalNumber(parsed.costAndLatency.totalCostUsd),
          avgLatencyMs: readOptionalNumber(parsed.costAndLatency.avgLatencyMs),
        }
        : undefined,
      reviewerNote,
    },
  };
}

function readRegressionStatus(value: unknown): NonNullable<AIEvaluationReport['regression']>['status'] {
  return value === 'improved' || value === 'stable' || value === 'regressed'
    ? value
    : 'unknown';
}

function hasErrors(issues: ReadonlyArray<AIEvaluationIssue>): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function selectAIEvaluationRunner(
  manifest: AIEvaluationManifest | undefined,
): AIEvaluationRunnerSelection | undefined {
  if (!manifest) {
    return undefined;
  }

  return {
    preferred: manifest.runner.preferred,
    alternates: manifest.runner.alternates,
    mode: manifest.runner.mode,
    remoteHost: manifest.runner.remoteHost,
  };
}

export function evaluateAIEvaluationContractFromRoot(root: string): AIEvaluationWorkspaceState {
  const issues: AIEvaluationIssue[] = [];
  const { manifestPath, manifest } = readManifest(root, issues);
  const shouldReadArtifacts = !!manifestPath;
  const { baselinePath, baseline } = shouldReadArtifacts
    ? readBaseline(root, issues)
    : { baselinePath: undefined, baseline: undefined };
  const { latestReportPath, latestReport } = shouldReadArtifacts
    ? readLatestReport(root, manifest, baseline, issues)
    : { latestReportPath: undefined, latestReport: undefined };
  const runnerSelection = selectAIEvaluationRunner(manifest);

  return {
    contractPresent: !!manifestPath,
    contractReady: !!manifest && !!baseline && !hasErrors(issues),
    resultsPresent: !!latestReport,
    manifestPath: manifestPath ? toRelative(manifestPath) : undefined,
    baselinePath: baselinePath ? toRelative(baselinePath) : undefined,
    latestReportPath: latestReportPath ? toRelative(latestReportPath) : undefined,
    manifest,
    baseline,
    latestReport,
    runnerSelection,
    issues,
  };
}

export function renderAIEvaluationContractSummary(state: AIEvaluationWorkspaceState): string {
  const errorCount = state.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = state.issues.filter((issue) => issue.severity === 'warning').length;

  if (!state.contractPresent) {
    return 'No AI eval contract';
  }

  if (errorCount > 0) {
    return `blocked (${errorCount} error${errorCount === 1 ? '' : 's'})`;
  }

  if (state.resultsPresent && state.latestReport) {
    return warningCount > 0
      ? `${state.latestReport.status} (${warningCount} warning${warningCount === 1 ? '' : 's'})`
      : state.latestReport.status;
  }

  return warningCount > 0
    ? `ready (${warningCount} warning${warningCount === 1 ? '' : 's'})`
    : 'ready (no reports)';
}

export function renderAIEvaluationContractTooltip(state: AIEvaluationWorkspaceState): string {
  if (!state.contractPresent) {
    return 'No evaluation/agentx.eval.yaml manifest found in the current workspace.';
  }

  const lines: string[] = [];
  if (state.runnerSelection) {
    lines.push(`Runner: ${state.runnerSelection.preferred} (${state.runnerSelection.mode})`);
    if (state.runnerSelection.alternates.length > 0) {
      lines.push(`Alternates: ${state.runnerSelection.alternates.join(', ')}`);
    }
    if (state.runnerSelection.remoteHost) {
      lines.push(`Remote host: ${state.runnerSelection.remoteHost}`);
    }
  }

  if (state.manifestPath) {
    lines.push(`Manifest: ${state.manifestPath}`);
  }
  if (state.baselinePath) {
    lines.push(`Baseline: ${state.baselinePath}`);
  }
  if (state.latestReportPath) {
    lines.push(`Latest report: ${state.latestReportPath}`);
  }

  for (const issue of state.issues) {
    lines.push(`${issue.severity.toUpperCase()}: ${issue.message}`);
  }

  return lines.join('\n');
}