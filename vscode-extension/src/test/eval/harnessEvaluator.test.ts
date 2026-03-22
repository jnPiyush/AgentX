import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { evaluateHarnessQuality } from '../../eval/harnessEvaluator';

function createWorkspaceRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-eval-'));
  fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'execution', 'plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'execution', 'progress'), { recursive: true });
  return root;
}

function createRecentTimestamp(): string {
  return new Date().toISOString();
}

function createAgentxStub(root: string) {
  return {
    workspaceRoot: root,
    listExecutionPlanFiles: () => {
      const plansDir = path.join(root, 'docs', 'execution', 'plans');
      if (!fs.existsSync(plansDir)) {
        return [];
      }

      return fs.readdirSync(plansDir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => `docs/execution/plans/${name}`)
        .sort();
    },
    getStatePath: (fileName: string) => path.join(root, '.agentx', 'state', fileName),
  } as any;
}

describe('harness evaluator', () => {
  it('should score fully observed, complete quality artifacts', () => {
    const root = createWorkspaceRoot();
    const recentTimestamp = createRecentTimestamp();
    fs.writeFileSync(path.join(root, 'docs', 'execution', 'plans', 'EXEC-PLAN-1.md'), '# Plan', 'utf-8');
    fs.writeFileSync(path.join(root, 'docs', 'execution', 'progress', 'EXEC-PLAN-1.md'), '# Progress', 'utf-8');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'loop-state.json'), JSON.stringify({
      active: false,
      status: 'complete',
      prompt: 'Ship evaluation',
      iteration: 5,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      startedAt: recentTimestamp,
      lastIterationAt: recentTimestamp,
      history: [],
    }), 'utf-8');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'harness-state.json'), JSON.stringify({
      version: 1,
      threads: [{
        id: 'thread-1',
        title: 'Implement evaluator',
        taskType: 'story',
        status: 'complete',
        startedAt: recentTimestamp,
        updatedAt: recentTimestamp,
      }],
      turns: [],
      items: [],
      evidence: [{
        id: 'evidence-1',
        threadId: 'thread-1',
        evidenceType: 'completion',
        summary: 'Completed evaluator',
        createdAt: recentTimestamp,
      }],
    }), 'utf-8');

    const report = evaluateHarnessQuality(createAgentxStub(root));

    assert.ok(report);
    assert.equal(report?.score.percent, 100);
    assert.equal(report?.coverage.percent, 100);
    assert.equal(report?.dominantAttribution, 'clear');
    assert.equal(report?.checks.filter((check) => check.passed).length, 5);
  });

  it('should attribute missing artifacts to harness gaps', () => {
    const root = createWorkspaceRoot();

    const report = evaluateHarnessQuality(createAgentxStub(root));

    assert.ok(report);
    assert.equal(report?.score.percent, 0);
    assert.equal(report?.coverage.percent, 0);
    assert.equal(report?.dominantAttribution, 'harness');
    assert.ok(report?.checks.some((check) => check.id === 'loop-complete' && check.attribution === 'policy'));
    assert.ok(report?.checks.some((check) => check.id === 'evidence-recorded' && check.attribution === 'harness'));
  });

  it('should respect disabled checks from .agentx/config.json', () => {
    const root = createWorkspaceRoot();
    const recentTimestamp = createRecentTimestamp();
    fs.writeFileSync(path.join(root, '.agentx', 'config.json'), JSON.stringify({
      harnessDisabledChecks: 'execution-plan-present,progress-log-present',
    }), 'utf-8');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'loop-state.json'), JSON.stringify({
      active: false,
      status: 'complete',
      prompt: 'Ship evaluation',
      iteration: 5,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      startedAt: recentTimestamp,
      lastIterationAt: recentTimestamp,
      history: [],
    }), 'utf-8');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'harness-state.json'), JSON.stringify({
      version: 1,
      threads: [{
        id: 'thread-1',
        title: 'Implement evaluator',
        taskType: 'story',
        status: 'complete',
        startedAt: recentTimestamp,
        updatedAt: recentTimestamp,
      }],
      turns: [],
      items: [],
      evidence: [{
        id: 'evidence-1',
        threadId: 'thread-1',
        evidenceType: 'completion',
        summary: 'Completed evaluator',
        createdAt: recentTimestamp,
      }],
    }), 'utf-8');

    const report = evaluateHarnessQuality(createAgentxStub(root));

    assert.ok(report);
    assert.equal(report?.checks.length, 3);
    assert.ok(report?.checks.every((check) => check.id !== 'execution-plan-present'));
    assert.ok(report?.checks.every((check) => check.id !== 'progress-log-present'));
    assert.equal(report?.score.percent, 100);
  });
});