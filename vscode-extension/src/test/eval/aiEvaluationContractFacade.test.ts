import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  evaluateAIEvaluationContract,
  getAIEvaluationContractSummary,
  getAIEvaluationContractTooltip,
} from '../../eval/aiEvaluationContract';
import { AgentXContext } from '../../agentxContext';

function createWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ai-facade-'));
  fs.mkdirSync(path.join(root, 'evaluation', 'datasets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evaluation', 'rubrics'), { recursive: true });
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

describe('aiEvaluationContract facade', () => {
  it('returns undefined when no workspace is open', () => {
    const noWorkspaceAgentx = { workspaceRoot: undefined } as unknown as AgentXContext;
    const state = evaluateAIEvaluationContract(noWorkspaceAgentx);
    assert.equal(state, undefined);
    assert.equal(getAIEvaluationContractSummary(noWorkspaceAgentx), 'No AI evaluation');
    assert.equal(getAIEvaluationContractTooltip(noWorkspaceAgentx), 'No workspace open for AI evaluation.');
  });

  it('summarizes a ready contract without reports', () => {
    const root = createWorkspace();
    const agentx = { workspaceRoot: root } as unknown as AgentXContext;

    const state = evaluateAIEvaluationContract(agentx);

    assert.ok(state);
    assert.equal(state?.contractReady, true);
    assert.equal(getAIEvaluationContractSummary(agentx), 'ready (no reports)');
    assert.ok(getAIEvaluationContractTooltip(agentx).includes('Runner: promptfoo (local)'));
  });
});