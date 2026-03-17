import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerReviewFindingCommands } from '../../commands/review-findings';

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('registerReviewFindingCommands', () => {
  let sandbox: sinon.SinonSandbox;
  let callbacks: Record<string, (...args: unknown[]) => Promise<void>>;
  let root: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    callbacks = {};
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-review-findings-command-'));
    writeFile(root, 'docs/artifacts/reviews/findings/FINDING-164-001.md', [
      '---',
      'id: FINDING-164-001',
      'title: Add tracked follow-up for deferred parity gaps',
      'source_review: docs/artifacts/reviews/REVIEW-164.md',
      'source_issue: 164',
      'severity: high',
      'status: Backlog',
      'priority: p1',
      'owner: reviewer',
      'promotion: required',
      'suggested_type: story',
      'labels: type:story',
      'dependencies: #163',
      'evidence: docs/artifacts/reviews/REVIEW-164.md',
      'backlog_issue: ',
      'created: 2026-03-12',
      'updated: 2026-03-12',
      '---',
      '',
      '# Review Finding: Add tracked follow-up for deferred parity gaps',
      '',
      '## Summary',
      '',
      'Deferred parity findings should become normal tracked work.',
    ].join('\n'));
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (command: string, callback: (...args: unknown[]) => Promise<void>) => {
        callbacks[command] = callback;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('shows review findings for the workspace', async () => {
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
      name: 'AgentX Review Findings',
    } as unknown as vscode.LogOutputChannel);

    registerReviewFindingCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, { workspaceRoot: root } as any);

    await callbacks['agentx.showReviewFindings']!();

    assert.ok(clear.calledOnce);
    assert.ok(appendLine.calledOnce);
    assert.ok(show.calledWith(true));
  });

  it('promotes a selected review finding through the AgentX issue flow', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ findingId: 'FINDING-164-001' } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns({
      appendLine: sandbox.stub(),
      clear: sandbox.stub(),
      show: sandbox.stub(),
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
      name: 'AgentX Review Findings',
    } as unknown as vscode.LogOutputChannel);
    const infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');
    const agentx = {
      workspaceRoot: root,
      runCli: async () => 'Created issue #73: Resolve review finding',
    } as any;

    registerReviewFindingCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, agentx);

    await callbacks['agentx.promoteReviewFinding']!();

    assert.ok(infoSpy.calledOnce);
    assert.ok(String(infoSpy.firstCall.args[0]).includes('FINDING-164-001'));
  });
});