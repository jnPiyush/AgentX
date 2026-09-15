import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  evaluateAIEvaluationContractFromRoot,
  renderAIEvaluationContractSummary,
  selectAIEvaluationRunner,
} from '../../eval/aiEvaluationContractInternals';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ai-contract-'));
  fs.mkdirSync(path.join(root, 'evaluation', 'datasets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evaluation', 'rubrics'), { recursive: true });
  fs.mkdirSync(path.join(root, '.copilot-tracking', 'eval-reports'), { recursive: true });
  return root;
}

function writeContractArtifacts(root: string, options?: { remote?: boolean; withReport?: boolean; missingBaseline?: boolean }): void {
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
    `  mode: ${options?.remote ? 'remote' : 'local'}`,
    ...(options?.remote ? ['  remoteHost: https://contoso.example'] : []),
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
    'rubrics:',
    '  - metric: correctness',
    '    path: evaluation/rubrics/correctness.md',
    '    judgeType: llm-as-judge',
    'reporting:',
    '  outputDirectory: .copilot-tracking/eval-reports',
    '  formatVersion: 1',
    '  retainRawOutputs: false',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'evaluation', 'frontier.eval.yaml'), manifest, 'utf-8');

  if (!options?.missingBaseline) {
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
        groundedness: { blocking: 0.75 },
      },
    }, null, 2), 'utf-8');
  }

  if (options?.withReport !== false) {
    fs.writeFileSync(path.join(root, '.copilot-tracking', 'eval-reports', 'run-002.json'), JSON.stringify({
      version: 1,
      runId: 'run-002',
      generatedAt: '2026-03-20T01:00:00.000Z',
      runner: 'promptfoo',
      status: 'pass',
      summary: {
        models: ['gpt-4.1'],
        datasetCount: 1,
        pass: true,
      },
      aggregateMetrics: [
        { metric: 'correctness', score: 0.93, blocking: 0.8, warning: 0.85, status: 'pass' },
        { metric: 'groundedness', score: 0.9, blocking: 0.75, status: 'pass' },
      ],
      regression: {
        baselineRunId: 'run-001',
        status: 'improved',
        deltas: [
          { metric: 'correctness', delta: 0.01, direction: 'improved' },
        ],
      },
      failureSlices: [],
      safetySummary: {
        criticalCount: 0,
        highCount: 0,
        summary: 'No critical safety findings.',
      },
      costAndLatency: {
        totalCostUsd: 1.25,
        avgLatencyMs: 580,
      },
      reviewerNote: 'Ready for review.',
    }, null, 2), 'utf-8');
  }
}

describe('aiEvaluationContract internals', () => {
  afterEach(() => {
    // Temp directories are cleaned by the OS; each test uses a fresh root.
  });

  it('loads a complete AI evaluation contract workspace', () => {
    const root = createWorkspace();
    writeContractArtifacts(root);

    const state = evaluateAIEvaluationContractFromRoot(root);

    assert.equal(state.contractPresent, true);
    assert.equal(state.contractReady, true);
    assert.equal(state.resultsPresent, true);
    assert.equal(state.manifest?.intent.workflow, 'rag');
    assert.equal(state.baseline?.acceptedRunId, 'run-001');
    assert.equal(state.latestReport?.status, 'pass');
    assert.equal(state.issues.length, 0);
    assert.equal(selectAIEvaluationRunner(state.manifest)?.preferred, 'promptfoo');
    assert.equal(renderAIEvaluationContractSummary(state), 'pass');
  });

  it('flags a missing baseline as a blocking contract error', () => {
    const root = createWorkspace();
    writeContractArtifacts(root, { missingBaseline: true, withReport: false });

    const state = evaluateAIEvaluationContractFromRoot(root);

    assert.equal(state.contractPresent, true);
    assert.equal(state.contractReady, false);
    assert.equal(state.resultsPresent, false);
    assert.ok(state.issues.some((issue) => issue.code === 'baseline.missing' && issue.severity === 'error'));
    assert.equal(renderAIEvaluationContractSummary(state), 'blocked (1 error)');
  });

  it('requires remoteHost for remote runner declarations', () => {
    const root = createWorkspace();
    writeContractArtifacts(root, { remote: true });

    const manifestPath = path.join(root, 'evaluation', 'frontier.eval.yaml');
    const content = fs.readFileSync(manifestPath, 'utf-8').replace('  remoteHost: https://contoso.example\n', '');
    fs.writeFileSync(manifestPath, content, 'utf-8');

    const state = evaluateAIEvaluationContractFromRoot(root);

    assert.equal(state.contractReady, false);
    assert.ok(state.issues.some((issue) => issue.code === 'manifest.runner.remoteHost'));
  });
});