import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  addHarnessContractFinding,
  completeHarnessThread,
  createHarnessCheckpoint,
  evaluateHarnessStopGate,
  findDefaultExecutionPlanPath,
  getActiveHarnessContract,
  getHarnessContractFindings,
  getHarnessStatusDisplay,
  readHarnessState,
  recordHarnessContextBudget,
  recordHarnessEvidence,
  recordHarnessIteration,
  recordHarnessPermission,
  recordHarnessStatusCheck,
  setHarnessContractState,
  startHarnessThread,
  upsertHarnessNote,
  upsertHarnessTeamTask,
} from '../../utils/harnessState';

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-harness-'));
  fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
  return root;
}

describe('harnessState', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('returns an empty default state when file does not exist', () => {
    const state = readHarnessState(wsRoot);
    assert.equal(state.version, 1);
    assert.equal(state.threads.length, 0);
    assert.equal(state.turns.length, 0);
    assert.equal(state.stopGates.length, 0);
    assert.equal(state.contextBudgets.length, 0);
    assert.equal(state.notes.length, 0);
    assert.equal(state.checkpoints.length, 0);
    assert.equal(state.permissionRecords.length, 0);
    assert.equal(state.teamTasks.length, 0);
  });

  it('finds a default execution plan under docs/plans', () => {
    fs.mkdirSync(path.join(wsRoot, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(wsRoot, 'docs', 'plans', 'demo.md'), '# Demo\n');

    assert.equal(findDefaultExecutionPlanPath(wsRoot), 'docs/plans/demo.md');
  });

  it('starts a harness thread and creates an active turn', () => {
    const thread = startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
      completionCriteria: 'ALL_TESTS_PASSING',
      issueNumber: 42,
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.threads.length, 1);
    assert.equal(state.turns.length, 1);
    assert.equal(thread.status, 'active');
    assert.equal(state.turns[0].status, 'active');
    assert.equal(state.items.length >= 1, true);
    assert.equal(state.evidence.length, 1);
  });

  it('records iterations by completing the current turn and creating the next one', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    recordHarnessIteration(wsRoot, 'Fixed failing tests');

    const state = readHarnessState(wsRoot);
    assert.equal(state.turns.length, 2);
    assert.equal(state.turns[0].status, 'complete');
    assert.equal(state.turns[1].status, 'active');
    assert.equal(state.evidence.some((entry) => entry.summary === 'Fixed failing tests'), true);
  });

  it('records status checks without changing the active turn', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    recordHarnessStatusCheck(wsRoot, 'Loop status requested');

    const state = readHarnessState(wsRoot);
    assert.equal(state.turns.length, 1);
    assert.equal(state.items.some((entry) => entry.summary === 'Loop status requested'), true);
  });

  it('completes the active thread and marks the turn complete', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    completeHarnessThread(wsRoot, {
      status: 'complete',
      summary: 'All tests passing',
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.threads[0].status, 'complete');
    assert.equal(state.turns[0].status, 'complete');
    assert.equal(state.evidence.some((entry) => entry.summary === 'All tests passing'), true);
  });

  it('returns a compact active harness status string', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    const display = getHarnessStatusDisplay(wsRoot);
    assert.ok(display.includes('Harness iterative-loop turn 1'));
  });

  it('persists active contract state alongside the current harness thread', () => {
    startHarnessThread(wsRoot, {
      taskType: 'story',
      title: 'Implement bounded work slice',
      prompt: 'Implement contract runtime support',
      issueNumber: 253,
    });

    const contract = setHarnessContractState(wsRoot, {
      contractPath: 'docs/execution/contracts/CONTRACT-253-runtime.md',
      evidencePath: 'docs/execution/contracts/EVIDENCE-253-runtime.md',
      status: 'Active',
      title: 'Runtime contract support',
      nextAction: 'Attach evaluator findings before review',
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.contracts.length, 1);
    assert.equal(contract.status, 'Active');
    assert.equal(getActiveHarnessContract(wsRoot)?.contractPath, 'docs/execution/contracts/CONTRACT-253-runtime.md');
  });

  it('attaches evaluator findings to the active contract with severity and next action', () => {
    startHarnessThread(wsRoot, {
      taskType: 'story',
      title: 'Implement bounded work slice',
      prompt: 'Implement contract runtime support',
      issueNumber: 253,
    });
    const contract = setHarnessContractState(wsRoot, {
      contractPath: 'docs/execution/contracts/CONTRACT-253-runtime.md',
      status: 'Blocked',
      title: 'Runtime contract support',
      blocker: 'Evaluator finding unresolved',
    });

    addHarnessContractFinding(wsRoot, {
      contractPath: 'docs/execution/contracts/CONTRACT-253-runtime.md',
      severity: 'high',
      summary: 'Runtime proof is missing for the active slice',
      nextAction: 'Run the real-surface verification before advancing to review',
    });

    const findings = getHarnessContractFindings(wsRoot, contract.id);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].nextAction, 'Run the real-surface verification before advancing to review');
  });

  it('records typed evidence and passes a deterministic stop gate', () => {
    startHarnessThread(wsRoot, {
      taskType: 'story',
      title: 'Implement runtime primitives',
      prompt: 'Add production-grade evidence tracking',
    });

    recordHarnessEvidence(wsRoot, {
      evidenceType: 'implementation',
      summary: 'Implemented runtime primitives',
      artifactPath: 'vscode-extension/src/utils/harnessStateEngine.ts',
      status: 'pass',
    });
    recordHarnessEvidence(wsRoot, {
      evidenceType: 'verification',
      summary: 'Compile passed',
      command: 'npm run compile',
      exitCode: 0,
      status: 'pass',
    });
    recordHarnessEvidence(wsRoot, {
      evidenceType: 'review',
      summary: 'Self-review found no high or medium issues',
      status: 'pass',
    });
    recordHarnessContextBudget(wsRoot, { maxTokens: 1_000_000 });

    const gate = evaluateHarnessStopGate(wsRoot, { maxContextPercent: 80 });
    const state = readHarnessState(wsRoot);

    assert.equal(gate.status, 'passed');
    assert.equal(gate.blockers.length, 0);
    assert.equal(state.evidence.filter((entry) => entry.evidenceClass).length, 3);
    assert.equal(state.stopGates.length, 1);
  });

  it('blocks stop gates when required evidence is missing', () => {
    startHarnessThread(wsRoot, {
      taskType: 'story',
      title: 'Implement runtime primitives',
      prompt: 'Add production-grade evidence tracking',
    });

    recordHarnessEvidence(wsRoot, {
      evidenceType: 'implementation',
      summary: 'Implementation recorded',
    });

    const gate = evaluateHarnessStopGate(wsRoot);
    assert.equal(gate.status, 'blocked');
    assert.ok(gate.blockers.some((blocker) => blocker.includes('verification')));
  });

  it('records continuity notes, checkpoints, and coordinated team tasks', () => {
    startHarnessThread(wsRoot, {
      taskType: 'feature',
      title: 'Coordinate harness team',
      prompt: 'Track work across agents',
    });

    upsertHarnessNote(wsRoot, {
      scope: 'active-slice',
      content: 'Continue from the runtime evidence helpers.',
    });
    createHarnessCheckpoint(wsRoot, {
      title: 'Runtime model ready',
      summary: 'Types and engine helpers are available for evaluator wiring.',
      filePaths: ['vscode-extension/src/utils/harnessStateEngine.ts'],
      restoreHint: 'Run tests before extending UI surfaces.',
    });
    const task = upsertHarnessTeamTask(wsRoot, {
      teamId: 'runtime-quality',
      title: 'Wire evaluator checks',
      assignee: 'Reviewer',
      status: 'review',
      scope: 'harness evaluator',
    });
    upsertHarnessTeamTask(wsRoot, {
      ...task,
      status: 'complete',
      evidencePath: 'vscode-extension/src/eval/harnessEvaluatorInternals.ts',
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.notes.length, 1);
    assert.equal(state.checkpoints.length, 1);
    assert.equal(state.teamTasks.length, 1);
    assert.equal(state.teamTasks[0].status, 'complete');
  });

  it('classifies permission-sensitive commands before execution', () => {
    const safe = recordHarnessPermission(wsRoot, { command: 'npm run compile' });
    const publish = recordHarnessPermission(wsRoot, { command: 'vsce publish --packagePath agentx.vsix' });
    const destructive = recordHarnessPermission(wsRoot, { command: 'git reset --hard HEAD' });

    assert.equal(safe.decision, 'allow');
    assert.equal(publish.decision, 'confirm');
    assert.equal(destructive.decision, 'block');
  });
});
