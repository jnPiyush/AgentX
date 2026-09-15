import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { evaluateAIEvaluationContract } from '../eval/aiEvaluationContract';
import type {
  AIEvaluationExecutionShell,
  AIEvaluationRunnerKind,
  AIEvaluationWorkspaceState,
} from '../eval/aiEvaluationContract';
import {
  createShellAIEvaluationRunnerAdapter,
  executeAIEvaluationRun,
  planAIEvaluationRun,
} from '../eval/aiEvaluationRunner';
import type { AIEvaluationExecutionResult } from '../eval/aiEvaluationRunner';

const AI_EVALUATION_CHANNEL_NAME = 'Frontier AI Evaluation';
const DEFAULT_DATASET_PATH = 'evaluation/datasets/regression.jsonl';
const DEFAULT_RUBRIC_PATH = 'evaluation/rubrics/correctness.md';
const DEFAULT_MANIFEST_PATH = 'evaluation/frontier.eval.yaml';
const DEFAULT_BASELINE_PATH = 'evaluation/baseline.json';
const DEFAULT_REPORT_DIR = '.copilot-tracking/eval-reports';
const MAX_DISPLAYED_FAILURE_SLICES = 5;

let aiEvaluationChannel: vscode.OutputChannel | undefined;

interface RunnerQuickPickItem extends vscode.QuickPickItem {
  readonly runner: AIEvaluationRunnerKind;
}

export function getAIEvaluationChannel(): vscode.OutputChannel {
  if (!aiEvaluationChannel) {
    aiEvaluationChannel = vscode.window.createOutputChannel(AI_EVALUATION_CHANNEL_NAME);
  }

  return aiEvaluationChannel;
}

function writeFileIfMissing(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

function escapeYamlSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildManifestContent(
  runner: AIEvaluationRunnerKind,
  command: string | undefined,
  shell: AIEvaluationExecutionShell,
): string {
  const lines = [
    'version: 1',
    'intent:',
    '  workflow: prompt',
    '  description: Starter AI evaluation contract created by Frontier.',
    'runner:',
    `  preferred: ${runner}`,
    '  mode: local',
    'modelMatrix:',
    '  primary:',
    '    name: replace-me',
    'datasets:',
    '  - name: regression',
    `    path: ${DEFAULT_DATASET_PATH}`,
    '    purpose: benchmark',
    '    coverageType: regression',
    '    rowCount: 1',
    '    dataFormat: jsonl',
    'metrics:',
    '  - correctness',
    'thresholds:',
    '  - metric: correctness',
    '    blocking: 0.8',
    '    warning: 0.9',
    'rubrics:',
    '  - metric: correctness',
    `    path: ${DEFAULT_RUBRIC_PATH}`,
    '    judgeType: llm-as-judge',
    'reporting:',
    `  outputDirectory: ${DEFAULT_REPORT_DIR}`,
    '  formatVersion: 1',
    '  retainRawOutputs: false',
  ];

  if (command) {
    lines.push('execution:');
    lines.push(`  command: ${escapeYamlSingleQuoted(command)}`);
    lines.push(`  shell: ${shell}`);
  }

  return `${lines.join('\n')}\n`;
}

function buildBaselineContent(runner: AIEvaluationRunnerKind): string {
  return `${JSON.stringify({
    version: 1,
    acceptedRunId: 'baseline-initial',
    updatedAt: new Date().toISOString(),
    runner,
    model: 'replace-me',
    aggregateScores: {
      correctness: 0,
    },
    thresholdSnapshot: {
      correctness: {
        blocking: 0.8,
        warning: 0.9,
      },
    },
  }, null, 2)}\n`;
}

function buildDatasetContent(): string {
  return `${JSON.stringify({
    id: 'sample-1',
    input: 'Replace with a representative prompt or task input.',
    expected: 'Replace with the accepted answer or outcome.',
    metadata: {
      purpose: 'starter-sample',
    },
  })}\n`;
}

function buildRubricContent(): string {
  return [
    '# Correctness Rubric',
    '',
    'Score responses against the expected output for factual and task accuracy.',
    '',
    '## Scale',
    '',
    '- 1.0: Fully correct and complete.',
    '- 0.5: Partially correct or missing a material detail.',
    '- 0.0: Incorrect, missing, or unsafe.',
    '',
  ].join('\n');
}

function toAbsolutePath(root: string, relativePath: string): string {
  return path.join(root, ...relativePath.split('/'));
}

async function openWorkspaceFile(root: string, relativePath: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(toAbsolutePath(root, relativePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

function renderMetricLines(state: AIEvaluationWorkspaceState): ReadonlyArray<string> {
  const report = state.latestReport;
  if (!report) {
    return [];
  }

  return report.aggregateMetrics.map((metric) => (
    `- ${metric.metric}: ${metric.score} [${metric.status}]`
  ));
}

function renderFailureLines(state: AIEvaluationWorkspaceState): ReadonlyArray<string> {
  const report = state.latestReport;
  if (!report || report.failureSlices.length === 0) {
    return [];
  }

  return report.failureSlices.slice(0, MAX_DISPLAYED_FAILURE_SLICES).map((slice) => (
    `- ${slice.severity}: ${slice.label} -> ${slice.summary}`
  ));
}

export function renderAIEvaluationStatusText(state: AIEvaluationWorkspaceState): string {
  const lines = [
    'Frontier AI Evaluation',
    '',
    `Summary: ${state.contractReady ? 'ready to run' : state.contractPresent ? 'contract present but incomplete' : 'no contract configured'}`,
    `Contract present: ${state.contractPresent ? 'yes' : 'no'}`,
    `Contract ready: ${state.contractReady ? 'yes' : 'no'}`,
    `Results present: ${state.resultsPresent ? 'yes' : 'no'}`,
  ];

  if (state.manifestPath) {
    lines.push(`Manifest: ${state.manifestPath}`);
  }
  if (state.baselinePath) {
    lines.push(`Baseline: ${state.baselinePath}`);
  }
  if (state.latestReportPath) {
    lines.push(`Latest report: ${state.latestReportPath}`);
  }
  if (state.runnerSelection) {
    lines.push(`Runner: ${state.runnerSelection.preferred} (${state.runnerSelection.mode})`);
  }
  if (state.manifest?.execution?.command) {
    lines.push(`Execution command: configured (${state.manifest.execution.shell ?? 'pwsh'})`);
  } else {
    lines.push('Execution command: not configured');
  }

  const metricLines = renderMetricLines(state);
  if (metricLines.length > 0) {
    lines.push('', 'Metrics:');
    lines.push(...metricLines);
  }

  const failureLines = renderFailureLines(state);
  if (failureLines.length > 0) {
    lines.push('', 'Failure slices:');
    lines.push(...failureLines);
  }

  if (state.issues.length > 0) {
    lines.push('', 'Issues:');
    for (const issue of state.issues) {
      lines.push(`- ${issue.severity}: ${issue.code} -> ${issue.message}`);
    }
  }

  return lines.join('\n');
}

function renderExecutionResultText(result: AIEvaluationExecutionResult): string {
  const report = result.report;
  const lines = [
    'Execution complete.',
    '',
    `Run id: ${report.runId}`,
    `Status: ${report.status}`,
    `Report: ${result.reportPath}`,
  ];

  if (result.rawOutputPath) {
    lines.push(`Raw output: ${result.rawOutputPath}`);
  }

  lines.push('', 'Metrics:');
  for (const metric of report.aggregateMetrics) {
    lines.push(`- ${metric.metric}: ${metric.score} [${metric.status}]`);
  }

  if (report.failureSlices.length > 0) {
    lines.push('', 'Failure slices:');
    for (const slice of report.failureSlices.slice(0, MAX_DISPLAYED_FAILURE_SLICES)) {
      lines.push(`- ${slice.severity}: ${slice.label} -> ${slice.summary}`);
    }
  }

  lines.push('', `Reviewer note: ${report.reviewerNote}`);
  return lines.join('\n');
}

async function promptForRunner(): Promise<AIEvaluationRunnerKind | undefined> {
  const selection = await vscode.window.showQuickPick<RunnerQuickPickItem>([
    {
      label: 'Promptfoo-compatible',
      description: 'Starter contract for a promptfoo-oriented workflow',
      runner: 'promptfoo',
    },
    {
      label: 'Azure AI Evaluation-compatible',
      description: 'Starter contract for an Azure-native workflow',
      runner: 'azure-ai-evaluation',
    },
    {
      label: 'Custom shell runner',
      description: 'Any command that prints Frontier raw evaluation JSON',
      runner: 'custom',
    },
  ], {
    title: 'Frontier - Scaffold AI Evaluation Contract',
    placeHolder: 'Choose the starter runner declaration',
  });

  return selection?.runner;
}

async function promptForExecutionCommand(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: 'Frontier - AI Evaluation Execution Command',
    prompt: 'Optional shell command that prints Frontier raw evaluation JSON to stdout',
    placeHolder: 'Leave blank to scaffold the contract without a runnable command',
    ignoreFocusOut: true,
  });

  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getExecutionShell(): AIEvaluationExecutionShell {
  return process.platform === 'win32' ? 'pwsh' : 'bash';
}

export async function showAIEvaluationStatus(agentx: FrontierContext): Promise<void> {
  const state = evaluateAIEvaluationContract(agentx);
  if (!state) {
    vscode.window.showWarningMessage('Frontier needs an open workspace to show AI evaluation status.');
    return;
  }

  const channel = getAIEvaluationChannel();
  channel.clear();
  channel.appendLine(renderAIEvaluationStatusText(state));
  channel.show(true);
}

export async function scaffoldAIEvaluationContract(agentx: FrontierContext): Promise<void> {
  const root = agentx.workspaceRoot;
  if (!root) {
    vscode.window.showWarningMessage('Frontier needs an open workspace to scaffold AI evaluation files.');
    return;
  }

  const manifestPath = toAbsolutePath(root, DEFAULT_MANIFEST_PATH);
  if (fs.existsSync(manifestPath)) {
    await openWorkspaceFile(root, DEFAULT_MANIFEST_PATH);
    vscode.window.showInformationMessage('Frontier: opened the existing AI evaluation manifest.');
    return;
  }

  const runner = await promptForRunner();
  if (!runner) {
    return;
  }

  const executionCommand = await promptForExecutionCommand();
  const shell = getExecutionShell();

  writeFileIfMissing(root, DEFAULT_MANIFEST_PATH, buildManifestContent(runner, executionCommand, shell));
  writeFileIfMissing(root, DEFAULT_BASELINE_PATH, buildBaselineContent(runner));
  writeFileIfMissing(root, DEFAULT_DATASET_PATH, buildDatasetContent());
  writeFileIfMissing(root, DEFAULT_RUBRIC_PATH, buildRubricContent());

  await openWorkspaceFile(root, DEFAULT_MANIFEST_PATH);
  vscode.window.showInformationMessage('Frontier: scaffolded AI evaluation contract files.');
}

function formatRunnerMessageSource(fromManifest: boolean): string {
  return fromManifest ? 'manifest execution command' : 'ad-hoc execution command';
}

function getBlockingMessage(state: AIEvaluationWorkspaceState): string {
  const blockingIssues = state.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `${issue.code}: ${issue.message}`);
  return blockingIssues.join('\n');
}

export async function runAIEvaluation(agentx: FrontierContext): Promise<void> {
  const root = agentx.workspaceRoot;
  if (!root) {
    vscode.window.showWarningMessage('Frontier needs an open workspace to run AI evaluation.');
    return;
  }

  const planning = planAIEvaluationRun(agentx);
  if (!planning) {
    vscode.window.showWarningMessage('Frontier needs an open workspace to plan AI evaluation.');
    return;
  }

  if (!planning.ready || !planning.plan) {
    await showAIEvaluationStatus(agentx);
    const detail = getBlockingMessage(planning.contract);
    vscode.window.showErrorMessage(
      detail.length > 0
        ? `Frontier cannot run AI evaluation until the contract is ready.\n${detail}`
        : 'Frontier cannot run AI evaluation until the contract is ready.',
    );
    return;
  }

  const executionCommand = planning.contract.manifest?.execution?.command
    ?? await promptForExecutionCommand();
  if (!executionCommand) {
    return;
  }

  const shell = planning.contract.manifest?.execution?.shell ?? getExecutionShell();
  const commandFromManifest = !!planning.contract.manifest?.execution?.command;
  const channel = getAIEvaluationChannel();
  channel.clear();
  channel.appendLine(`Running AI evaluation via ${planning.plan.runner.preferred}.`);
  channel.appendLine(`Command source: ${formatRunnerMessageSource(commandFromManifest)}`);
  channel.appendLine('');
  channel.show(true);

  try {
    const result = await executeAIEvaluationRun(agentx, {
      adapters: [
        createShellAIEvaluationRunnerAdapter(planning.plan.runner.preferred, () => ({
          command: executionCommand,
          shell,
        })),
      ],
      onLine: (line, source) => {
        channel.appendLine(`[${source}] ${line}`);
      },
    });

    if (!result) {
      vscode.window.showWarningMessage('Frontier could not resolve an AI evaluation workspace to run.');
      return;
    }

    channel.appendLine('');
    channel.appendLine(renderExecutionResultText(result));

    const openReport = 'Open Report';
    const selection = await vscode.window.showInformationMessage(
      `Frontier: AI evaluation completed with status ${result.report.status}.`,
      openReport,
    );
    if (selection === openReport) {
      await openWorkspaceFile(root, result.reportPath);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    channel.appendLine('');
    channel.appendLine(`Execution failed: ${message}`);
    vscode.window.showErrorMessage(`Frontier failed to run AI evaluation: ${message}`);
  }
}