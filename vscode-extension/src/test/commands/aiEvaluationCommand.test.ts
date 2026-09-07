import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAIEvaluationCommands } from '../../commands/ai-evaluation';
import * as aiEvaluationInternals from '../../commands/aiEvaluationCommandInternals';

describe('registerAIEvaluationCommands', () => {
  let sandbox: sinon.SinonSandbox;
  let callbacks: Record<string, (...args: unknown[]) => Promise<void>>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    callbacks = {};
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (command: string, callback: (...args: unknown[]) => Promise<void>) => {
        callbacks[command] = callback;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('registers the AI evaluation commands', () => {
    registerAIEvaluationCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, {} as AgentXContext);

    assert.ok(Object.keys(callbacks).includes('agentx.showAIEvaluationStatus'));
    assert.ok(Object.keys(callbacks).includes('agentx.scaffoldAIEvaluationContract'));
    assert.ok(Object.keys(callbacks).includes('agentx.runAIEvaluation'));
  });

  it('delegates command callbacks to the AI evaluation internals', async () => {
    const agentx = {} as AgentXContext;
    const showStatus = sandbox.stub(aiEvaluationInternals, 'showAIEvaluationStatus').resolves();
    const scaffold = sandbox.stub(aiEvaluationInternals, 'scaffoldAIEvaluationContract').resolves();
    const run = sandbox.stub(aiEvaluationInternals, 'runAIEvaluation').resolves();

    registerAIEvaluationCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, agentx);

    await callbacks['agentx.showAIEvaluationStatus']!();
    await callbacks['agentx.scaffoldAIEvaluationContract']!();
    await callbacks['agentx.runAIEvaluation']!();

    assert.ok(showStatus.calledWith(agentx));
    assert.ok(scaffold.calledWith(agentx));
    assert.ok(run.calledWith(agentx));
  });
});

describe('aiEvaluationCommandInternals', () => {
  let sandbox: sinon.SinonSandbox;
  let root: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ai-evaluation-command-'));
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('scaffolds a starter AI evaluation contract tree', async () => {
    const runnerPick = { label: 'Custom shell runner', runner: 'custom' };
    sandbox.stub(vscode.window, 'showQuickPick').resolves(runnerPick);
    sandbox.stub(vscode.window, 'showInputBox').resolves('Write-Output "{}"');
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
    sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);
    const infoSpy = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    await aiEvaluationInternals.scaffoldAIEvaluationContract({ workspaceRoot: root } as AgentXContext);

    const manifest = fs.readFileSync(path.join(root, 'evaluation', 'agentx.eval.yaml'), 'utf-8');
    const baseline = fs.readFileSync(path.join(root, 'evaluation', 'baseline.json'), 'utf-8');
    const dataset = fs.readFileSync(path.join(root, 'evaluation', 'datasets', 'regression.jsonl'), 'utf-8');
    const rubric = fs.readFileSync(path.join(root, 'evaluation', 'rubrics', 'correctness.md'), 'utf-8');
    const expectedShell = process.platform === 'win32' ? 'pwsh' : 'bash';

    assert.ok(manifest.includes('preferred: custom'));
    assert.ok(manifest.includes('execution:'));
    assert.ok(manifest.includes(`shell: ${expectedShell}`));
    assert.ok(baseline.includes('baseline-initial'));
    assert.ok(dataset.includes('sample-1'));
    assert.ok(rubric.includes('# Correctness Rubric'));
    assert.ok(infoSpy.calledOnce);
  });

  it('renders status text with metrics and issues', () => {
    const text = aiEvaluationInternals.renderAIEvaluationStatusText({
      contractPresent: true,
      contractReady: false,
      resultsPresent: true,
      issues: [
        {
          code: 'missing-baseline',
          severity: 'error',
          message: 'Baseline file is missing.',
        },
      ],
      manifestPath: 'evaluation/agentx.eval.yaml',
      baselinePath: undefined,
      latestReportPath: '.copilot-tracking/eval-reports/report.json',
      runnerSelection: {
        preferred: 'custom',
        alternates: [],
        mode: 'local',
      },
      manifest: {
        version: 1,
        intent: {
          workflow: 'prompt',
        },
        runner: {
          preferred: 'custom',
          alternates: [],
          mode: 'local',
        },
        modelMatrix: {
          primary: {
            name: 'replace-me',
          },
          fallback: [],
          comparisons: [],
        },
        datasets: [],
        metrics: ['correctness'],
        thresholds: [],
        rubrics: [],
        reporting: {
          outputDirectory: '.copilot-tracking/eval-reports',
          formatVersion: 1,
          retainRawOutputs: false,
        },
        execution: {
          command: 'Write-Output "{}"',
          shell: 'pwsh',
        },
      },
      latestReport: {
        version: 1,
        runId: 'run-123',
        generatedAt: '2026-03-14T00:00:00.000Z',
        runner: 'custom',
        status: 'warn',
        summary: {
          models: ['replace-me'],
          datasetCount: 1,
          pass: false,
        },
        aggregateMetrics: [
          {
            metric: 'correctness',
            score: 0.75,
            blocking: 0.8,
            status: 'warn',
          },
        ],
        failureSlices: [
          {
            label: 'sample-1',
            severity: 'medium',
            summary: 'Needs a baseline update.',
          },
        ],
        reviewerNote: 'Review before promotion.',
      },
    });

    assert.ok(text.includes('contract present but incomplete'));
    assert.ok(text.includes('correctness: 0.75 [warn]'));
    assert.ok(text.includes('missing-baseline'));
  });
});