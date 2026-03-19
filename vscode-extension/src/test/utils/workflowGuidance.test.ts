import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  evaluateWorkflowGuidance,
  renderOperatorEnablementChecklistMarkdown,
  renderWorkflowEntryPointMarkdown,
  renderWorkflowGuidanceMarkdown,
  renderWorkflowRolloutScorecardMarkdown,
} from '../../utils/workflowGuidance';

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

describe('workflow guidance utility', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-workflow-guidance-'));
    writeFile(tmpDir, '.agentx/issues/219.json', JSON.stringify({
      number: 219,
      title: 'Create rollout scorecard',
      state: 'open',
      status: 'In Progress',
    }));
    writeFile(tmpDir, '.agentx/state/harness-state.json', JSON.stringify({
      version: 1,
      threads: [{
        id: 'thread-1',
        title: 'Create rollout scorecard',
        taskType: 'story',
        status: 'active',
        issueNumber: 219,
        planPath: 'docs/execution/plans/ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md',
        startedAt: '2026-03-13T10:00:00Z',
        updatedAt: '2026-03-13T10:05:00Z',
      }],
      turns: [],
      items: [],
      evidence: [],
    }));
    writeFile(tmpDir, '.agentx/state/loop-state.json', JSON.stringify({
      active: false,
      status: 'complete',
      prompt: 'done',
      iteration: 3,
      minIterations: 3,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      issueNumber: 219,
      startedAt: isoMinutesAgo(30),
      lastIterationAt: isoMinutesAgo(5),
      history: [],
    }));
    writeFile(tmpDir, 'docs/execution/plans/ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md', '# Plan\n');
    writeFile(tmpDir, 'docs/execution/progress/ROLLOUT-SCORECARD-IMPLEMENTATION-PROGRESS.md', '# Progress\n');
    writeFile(tmpDir, 'docs/guides/WORKFLOW-ROLLOUT-SCORECARD.md', '# Scorecard\n');
    writeFile(tmpDir, 'docs/guides/WORKFLOW-PILOT-ORDER.md', '# Pilot\n');
    writeFile(tmpDir, 'docs/guides/WORKFLOW-OPERATOR-CHECKLIST.md', '# Checklist\n');
    writeFile(tmpDir, 'docs/artifacts/specs/SPEC-218.md', '# Spec\n');
    writeFile(tmpDir, 'docs/artifacts/specs/SPEC-219.md', '# Spec\n');
    writeFile(tmpDir, 'docs/artifacts/specs/SPEC-220.md', '# Spec\n');
    writeFile(tmpDir, 'docs/artifacts/specs/SPEC-221.md', '# Spec\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves review-ready guidance from the active issue and linked plan', () => {
    const snapshot = evaluateWorkflowGuidance(tmpDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.currentCheckpoint, 'Review');
    assert.equal(snapshot?.planDeepening.allowed, true);
    assert.equal(snapshot?.reviewKickoff.allowed, true);
    assert.equal(snapshot?.rolloutRows[0]?.state, 'pilot-ready');
  });

  it('fails closed to plan guidance when no plan is linked', () => {
    writeFile(tmpDir, '.agentx/state/harness-state.json', JSON.stringify({
      version: 1,
      threads: [{
        id: 'thread-1',
        title: 'Create rollout scorecard',
        taskType: 'story',
        status: 'active',
        issueNumber: 219,
        startedAt: '2026-03-13T10:00:00Z',
        updatedAt: '2026-03-13T10:05:00Z',
      }],
      turns: [],
      items: [],
      evidence: [],
    }));
    fs.rmSync(path.join(tmpDir, 'docs', 'execution', 'plans', 'ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md'), { force: true });
    fs.rmSync(path.join(tmpDir, 'docs', 'execution', 'progress', 'ROLLOUT-SCORECARD-IMPLEMENTATION-PROGRESS.md'), { force: true });
    fs.rmSync(path.join(tmpDir, '.agentx', 'state', 'loop-state.json'), { force: true });

    const snapshot = evaluateWorkflowGuidance(tmpDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.currentCheckpoint, 'Plan');
    assert.equal(snapshot?.recommendedAction, 'Deepen the plan before implementation continues');
  });

  it('resolves brainstorm guidance when no issue or harness thread is linked', () => {
    fs.rmSync(path.join(tmpDir, '.agentx', 'issues'), { recursive: true, force: true });
    fs.rmSync(path.join(tmpDir, '.agentx', 'state', 'harness-state.json'), { force: true });
    fs.rmSync(path.join(tmpDir, '.agentx', 'state', 'loop-state.json'), { force: true });

    const snapshot = evaluateWorkflowGuidance(tmpDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.currentCheckpoint, 'Brainstorm');
    assert.equal(snapshot?.recommendedAction, 'Frame the work with the brainstorm guide');
  });

  it('resolves compound capture when the issue is closed with review evidence but no learning capture', () => {
    writeFile(tmpDir, '.agentx/issues/219.json', JSON.stringify({
      number: 219,
      title: 'Create rollout scorecard',
      state: 'closed',
      status: 'Done',
    }));
    writeFile(tmpDir, 'docs/artifacts/reviews/REVIEW-219.md', '# Review\n');

    const snapshot = evaluateWorkflowGuidance(tmpDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.currentCheckpoint, 'Compound Capture');
    assert.equal(snapshot?.recommendedAction, 'Record the curated learning capture before final closeout');
  });

  it('keeps the checkpoint in work when the completed loop state is stale', () => {
    writeFile(tmpDir, '.agentx/state/loop-state.json', JSON.stringify({
      active: false,
      status: 'complete',
      prompt: 'done',
      iteration: 3,
      minIterations: 3,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      issueNumber: 219,
      startedAt: '2025-01-01T00:00:00Z',
      lastIterationAt: '2025-01-01T01:00:00Z',
      history: [],
    }));

    const snapshot = evaluateWorkflowGuidance(tmpDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.currentCheckpoint, 'Work');
    assert.equal(snapshot?.recommendedAction, 'Continue implementation and validation evidence');
  });

  it('renders workflow guidance, entry point, rollout, and checklist markdown', () => {
    const snapshot = evaluateWorkflowGuidance(tmpDir);

    const guidance = renderWorkflowGuidanceMarkdown(snapshot);
    const entryPoint = renderWorkflowEntryPointMarkdown(snapshot, 'review-kickoff');
    const rollout = renderWorkflowRolloutScorecardMarkdown(snapshot);
    const checklist = renderOperatorEnablementChecklistMarkdown(snapshot);

    assert.ok(guidance.includes('Workflow Guidance'));
    assert.ok(guidance.includes('Current checkpoint'));
    assert.ok(entryPoint.includes('Kick Off Review'));
    assert.ok(rollout.includes('Workflow Rollout Scorecard'));
    assert.ok(checklist.includes('Operator Enablement Checklist'));
  });

  it('falls back to hidden runtime workflow guides when visible guides are absent', () => {
    fs.rmSync(path.join(tmpDir, 'docs', 'guides'), { recursive: true, force: true });
    writeFile(tmpDir, '.agentx/runtime/docs/guides/WORKFLOW-ROLLOUT-SCORECARD.md', '# Scorecard\n');
    writeFile(tmpDir, '.agentx/runtime/docs/guides/WORKFLOW-PILOT-ORDER.md', '# Pilot\n');
    writeFile(tmpDir, '.agentx/runtime/docs/guides/WORKFLOW-OPERATOR-CHECKLIST.md', '# Checklist\n');

    const snapshot = evaluateWorkflowGuidance(tmpDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.rolloutRows[0]?.state, 'pilot-ready');
    assert.equal(snapshot?.rolloutScorecardPath, '.agentx/runtime/docs/guides/WORKFLOW-ROLLOUT-SCORECARD.md');
  });
});