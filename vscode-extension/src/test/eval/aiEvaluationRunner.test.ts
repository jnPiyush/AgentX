import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createAIEvaluationExecutionPlan,
  executeAIEvaluationRunFromRoot,
  normalizeAIEvaluationOutput,
  persistNormalizedAIEvaluationReport,
} from '../../eval/aiEvaluationRunnerInternals';
import type { AIEvaluationRunnerAdapter } from '../../eval/aiEvaluationRunnerTypes';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ai-runner-'));
  fs.mkdirSync(path.join(root, 'evaluation', 'datasets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evaluation', 'rubrics'), { recursive: true });
  fs.mkdirSync(path.join(root, '.copilot-tracking', 'eval-reports'), { recursive: true });
  return root;
}

function writeContractArtifacts(root: string, options?: { retainRawOutputs?: boolean }): void {
  fs.writeFileSync(path.join(root, 'evaluation', 'datasets', 'regression.jsonl'), '{"id":1}\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'evaluation', 'rubrics', 'correctness.md'), '# Correctness\n', 'utf-8');

  const manifest = [
    'version: 1',
    'intent:',
    '  workflow: rag',
    'runner:',
    '  preferred: promptfoo',
    '  alternates:',
    '    - azure-ai-evaluation',
    '  mode: local',
    'modelMatrix:',
    '  primary:',
    '    name: gpt-4.1',
    '    provider: openai',
    '  fallback:',
    '    - name: gpt-4.1-mini',
    'datasets:',
    '  - name: regression',
    '    path: evaluation/datasets/regression.jsonl',
    '    purpose: benchmark',
    '    coverageType: regression',
    '    rowCount: 1',
    '    dataFormat: jsonl',
    'metrics:',
    '  - correctness',
    '  - groundedness',
    'thresholds:',
    '  - metric: correctness',
    '    blocking: 0.8',
    '    warning: 0.85',
    '  - metric: groundedness',
    '    blocking: 0.75',
    '    warning: 0.8',
    'rubrics:',
    '  - metric: correctness',
    '    path: evaluation/rubrics/correctness.md',
    '    judgeType: llm-as-judge',
    'reporting:',
    '  outputDirectory: .copilot-tracking/eval-reports',
    '  formatVersion: 1',
    `  retainRawOutputs: ${options?.retainRawOutputs ? 'true' : 'false'}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'evaluation', 'frontier.eval.yaml'), manifest, 'utf-8');

  fs.writeFileSync(path.join(root, 'evaluation', 'baseline.json'), JSON.stringify({
    version: 1,
    acceptedRunId: 'run-001',
    updatedAt: '2026-03-20T00:00:00.000Z',
    runner: 'promptfoo',
    model: 'gpt-4.1',
    aggregateScores: {
      correctness: 0.92,
      groundedness: 0.88,
    },
    thresholdSnapshot: {
      correctness: { blocking: 0.8, warning: 0.85 },
      groundedness: { blocking: 0.75, warning: 0.8 },
    },
  }, null, 2), 'utf-8');
}

describe('aiEvaluationRunner internals', () => {
  it('creates an execution plan for a ready contract', () => {
    const root = createWorkspace();
    writeContractArtifacts(root);

    const planning = createAIEvaluationExecutionPlan(root);

    assert.equal(planning.ready, true);
    assert.ok(planning.plan);
    assert.equal(planning.plan?.runner.preferred, 'promptfoo');
    assert.equal(planning.plan?.workflow, 'rag');
    assert.equal(planning.plan?.baselineRunId, 'run-001');
    assert.deepEqual(planning.plan?.metrics, ['correctness', 'groundedness']);
  });

  it('normalizes raw output into an Frontier report shape', () => {
    const root = createWorkspace();
    writeContractArtifacts(root);

    const planning = createAIEvaluationExecutionPlan(root);
    assert.equal(planning.ready, true);
    assert.ok(planning.plan);

    const report = normalizeAIEvaluationOutput(planning.contract, planning.plan!, {
      runId: 'run-002',
      generatedAt: '2026-03-20T01:00:00.000Z',
      models: ['gpt-4.1'],
      datasetCount: 1,
      aggregateMetrics: [
        { metric: 'correctness', score: 0.84 },
        { metric: 'groundedness', score: 0.74 },
      ],
      failureSlices: [
        { label: 'row-4', severity: 'high', summary: 'Groundedness slipped on citation-heavy query.' },
      ],
      safetySummary: {
        criticalCount: 0,
        highCount: 1,
        summary: 'One high-severity safety alert requires review.',
      },
    });

    assert.equal(report.status, 'fail');
    assert.equal(report.summary.pass, false);
    assert.equal(report.regression?.status, 'regressed');
    assert.equal(report.aggregateMetrics[0].status, 'warn');
    assert.equal(report.aggregateMetrics[1].status, 'fail');
  });

  it('executes an injected adapter and persists normalized reports', async () => {
    const root = createWorkspace();
    writeContractArtifacts(root, { retainRawOutputs: true });

    const adapter: AIEvaluationRunnerAdapter = {
      runner: 'promptfoo',
      async execute() {
        return {
          runId: 'run-003',
          generatedAt: '2026-03-20T02:00:00.000Z',
          models: ['gpt-4.1'],
          datasetCount: 1,
          aggregateMetrics: [
            { metric: 'correctness', score: 0.9 },
            { metric: 'groundedness', score: 0.86 },
          ],
          reviewerNote: 'Ready for review.',
        };
      },
    };

    const result = await executeAIEvaluationRunFromRoot(root, { adapters: [adapter] });

    assert.equal(result.report.status, 'pass');
    assert.equal(result.report.runId, 'run-003');
    assert.equal(result.reportPath, '.copilot-tracking/eval-reports/run-003.json');
    assert.equal(result.rawOutputPath, '.copilot-tracking/eval-reports/run-003.raw.json');

    const persisted = JSON.parse(fs.readFileSync(path.join(root, result.reportPath), 'utf-8')) as { status: string };
    assert.equal(persisted.status, 'pass');
    assert.ok(fs.existsSync(path.join(root, result.rawOutputPath!)));
  });

  it('writes reports without raw payloads when raw retention is disabled', () => {
    const root = createWorkspace();
    writeContractArtifacts(root, { retainRawOutputs: false });

    const planning = createAIEvaluationExecutionPlan(root);
    assert.equal(planning.ready, true);
    assert.ok(planning.plan);

    const report = normalizeAIEvaluationOutput(planning.contract, planning.plan!, {
      runId: 'run-004',
      aggregateMetrics: [
        { metric: 'correctness', score: 0.91 },
        { metric: 'groundedness', score: 0.83 },
      ],
    });

    const persisted = persistNormalizedAIEvaluationReport(root, planning.plan!, report, {
      runId: 'run-004',
      aggregateMetrics: [
        { metric: 'correctness', score: 0.91 },
        { metric: 'groundedness', score: 0.83 },
      ],
    });

    assert.equal(persisted.reportPath, '.copilot-tracking/eval-reports/run-004.json');
    assert.equal(persisted.rawOutputPath, undefined);
  });
});