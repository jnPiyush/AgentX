import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  executeAIEvaluationRun,
  planAIEvaluationRun,
} from '../../eval/aiEvaluationRunner';
import { AgentXContext } from '../../agentxContext';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ai-runner-facade-'));
  fs.mkdirSync(path.join(root, 'evaluation', 'datasets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evaluation', 'rubrics'), { recursive: true });
  fs.mkdirSync(path.join(root, '.copilot-tracking', 'eval-reports'), { recursive: true });
  fs.writeFileSync(path.join(root, 'evaluation', 'datasets', 'regression.jsonl'), '{"id":1}\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'evaluation', 'rubrics', 'correctness.md'), '# Correctness\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'evaluation', 'agentx.eval.yaml'), [
    'version: 1',
    'intent:',
    '  workflow: prompt',
    'runner:',
    '  preferred: promptfoo',
    '  mode: local',
    'modelMatrix:',
    '  primary:',
    '    name: gpt-4.1',
    'datasets:',
    '  - name: regression',
    '    path: evaluation/datasets/regression.jsonl',
    '    purpose: benchmark',
    '    coverageType: regression',
    'metrics:',
    '  - correctness',
    'thresholds:',
    '  - metric: correctness',
    '    blocking: 0.8',
    'rubrics:',
    '  - metric: correctness',
    '    path: evaluation/rubrics/correctness.md',
    'reporting:',
    '  outputDirectory: .copilot-tracking/eval-reports',
    '  formatVersion: 1',
    '',
  ].join('\n'), 'utf-8');
  fs.writeFileSync(path.join(root, 'evaluation', 'baseline.json'), JSON.stringify({
    version: 1,
    acceptedRunId: 'run-001',
    updatedAt: '2026-03-20T00:00:00.000Z',
    runner: 'promptfoo',
    model: 'gpt-4.1',
    aggregateScores: { correctness: 0.9 },
    thresholdSnapshot: { correctness: { blocking: 0.8 } },
  }, null, 2), 'utf-8');
  return root;
}

describe('aiEvaluationRunner facade', () => {
  it('returns undefined planning when no workspace is open', () => {
    assert.equal(planAIEvaluationRun({ workspaceRoot: undefined } as unknown as AgentXContext), undefined);
  });

  it('executes through the facade when a workspace exists', async () => {
    const root = createWorkspace();
    const agentx = { workspaceRoot: root } as unknown as AgentXContext;

    const planning = planAIEvaluationRun(agentx);
    assert.ok(planning?.ready);

    const result = await executeAIEvaluationRun(agentx, {
      adapters: [{
        runner: 'promptfoo',
        async execute() {
          return {
            runId: 'run-005',
            aggregateMetrics: [{ metric: 'correctness', score: 0.93 }],
          };
        },
      }],
    });

    assert.ok(result);
    assert.equal(result?.report.status, 'pass');
    assert.equal(result?.reportPath, '.copilot-tracking/eval-reports/run-005.json');
  });
});