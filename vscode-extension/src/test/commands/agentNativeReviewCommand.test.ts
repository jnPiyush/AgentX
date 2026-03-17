import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerAgentNativeReviewCommand } from '../../commands/agent-native-review';
import { AgentXContext } from '../../agentxContext';
import * as reviewFacade from '../../review/agent-native-review';

describe('registerAgentNativeReviewCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let callback: (() => Promise<void>) | undefined;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_command: string, registered: () => Promise<void>) => {
        callback = registered;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('shows a warning when no review report is available', async () => {
    sandbox.stub(reviewFacade, 'evaluateAgentNativeReview').returns(undefined);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    registerAgentNativeReviewCommand({ subscriptions: [] } as unknown as vscode.ExtensionContext, {} as AgentXContext);

    await callback?.();

    assert.ok(warnSpy.calledWith('AgentX needs an open workspace to review parity surfaces.'));
  });

  it('renders the review report when available', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-command-review-'));
    fs.mkdirSync(path.join(root, 'docs', 'guides'), { recursive: true });
    fs.mkdirSync(path.join(root, '.github', 'templates'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs', 'artifacts', 'learnings'), { recursive: true });
    fs.mkdirSync(path.join(root, 'vscode-extension', 'src', 'chat'), { recursive: true });
    fs.mkdirSync(path.join(root, 'vscode-extension', 'src', 'views'), { recursive: true });
    fs.mkdirSync(path.join(root, 'vscode-extension'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'guides', 'KNOWLEDGE-REVIEW-WORKFLOWS.md'), '# Guide\n', 'utf-8');
    fs.writeFileSync(path.join(root, '.github', 'templates', 'REVIEW-TEMPLATE.md'), '# Review\n', 'utf-8');
    fs.writeFileSync(path.join(root, 'docs', 'artifacts', 'learnings', 'LEARNING-165.md'), '# Learning\n', 'utf-8');
    fs.writeFileSync(path.join(root, 'vscode-extension', 'package.json'), JSON.stringify({
      contributes: {
        commands: [
          { command: 'agentx.runWorkflow' },
          { command: 'agentx.showReviewLearnings' },
          { command: 'agentx.showKnowledgeCaptureGuidance' },
          { command: 'agentx.showAgentNativeReview' },
        ],
      },
    }), 'utf-8');
    fs.writeFileSync(path.join(root, 'vscode-extension', 'src', 'chat', 'chatParticipant.ts'), [
      'run engineer',
      'learnings review',
      'capture guidance',
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(root, 'vscode-extension', 'src', 'views', 'workTreeProvider.ts'), [
      'agentx.runWorkflow',
      'agentx.showReviewLearnings',
      'agentx.showKnowledgeCaptureGuidance',
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(root, 'vscode-extension', 'src', 'views', 'statusTreeProvider.ts'), 'agentx.showAgentNativeReview\n', 'utf-8');
    fs.writeFileSync(path.join(root, 'vscode-extension', 'src', 'agentxContext.ts'), [
      'workspaceRoot',
      'getPendingClarification',
      'listExecutionPlanFiles',
      'getStatePath',
      'docs/artifacts/learnings',
    ].join('\n'), 'utf-8');
    const appendLine = sandbox.stub();
    const clear = sandbox.stub();
    const show = sandbox.stub();
    sandbox.stub(vscode.window, 'createOutputChannel').returns({
      appendLine,
      clear,
      show,
      append: sandbox.stub(),
      hide: sandbox.stub(),
      dispose: sandbox.stub(),
      trace: sandbox.stub(),
      debug: sandbox.stub(),
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      replace: sandbox.stub(),
      onDidChangeLogLevel: sandbox.stub(),
      logLevel: 1,
      name: 'AgentX Review',
    } as unknown as vscode.LogOutputChannel);

    registerAgentNativeReviewCommand(
      { subscriptions: [] } as unknown as vscode.ExtensionContext,
      { workspaceRoot: root } as AgentXContext,
    );

    await callback?.();

    assert.ok(clear.calledOnce);
    assert.ok(String(appendLine.firstCall.args[0]).includes('Agent-Native Review'));
    assert.ok(show.calledWith(true));

    fs.rmSync(root, { recursive: true, force: true });
  });
});