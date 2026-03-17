import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerParallelDeliveryCommands } from '../../commands/parallel-delivery';
import { AgentXContext } from '../../agentxContext';
import * as parallelFacade from '../../parallel/parallel-delivery';

describe('registerParallelDeliveryCommands', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let registeredCallbacks: Record<string, (...args: unknown[]) => unknown>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    registeredCallbacks = {};
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (command: string, callback: (...args: unknown[]) => unknown) => {
        registeredCallbacks[command] = callback;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('registers bounded parallel commands', () => {
    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);
    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('agentx.showBoundedParallelRuns'));
    assert.ok(registerCommand.calledWith('agentx.assessBoundedParallelDelivery'));
    assert.ok(registerCommand.calledWith('agentx.startBoundedParallelDelivery'));
    assert.ok(registerCommand.calledWith('agentx.reconcileBoundedParallelRun'));
  });

  it('shows a warning when listing runs without a workspace', async () => {
    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: undefined } as AgentXContext);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallbacks['agentx.showBoundedParallelRuns']!();

    assert.ok(warnSpy.calledOnce);
  });

  it('lists runs and writes them to the output channel', async () => {
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
      name: 'AgentX Bounded Parallel',
    } as unknown as vscode.LogOutputChannel);
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([]);

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showBoundedParallelRuns']!();

    assert.ok(clear.calledOnce);
    assert.ok(appendLine.calledOnce);
    assert.ok(show.calledWith(true));
  });

  it('assesses bounded parallel delivery for a selected issue scope', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'Specific issue', value: 'issue' } as any)
      .onSecondCall().resolves('independent' as any)
      .onThirdCall().resolves('low' as any)
      .onCall(3).resolves('low' as any)
      .onCall(4).resolves('bounded' as any)
      .onCall(5).resolves('recoverable' as any);
    sandbox.stub(vscode.window, 'showInputBox')
      .onFirstCall().resolves('123')
      .onSecondCall().resolves('Parallel delivery');
    sandbox.stub(parallelFacade, 'assessBoundedParallelDelivery').resolves({ parallelId: 'PAR-1' } as any);
    sandbox.stub(parallelFacade, 'renderBoundedParallelRunsText').returns('assessment');
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
      name: 'AgentX Bounded Parallel',
    } as unknown as vscode.LogOutputChannel);

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.assessBoundedParallelDelivery']!();

    assert.ok((parallelFacade.assessBoundedParallelDelivery as sinon.SinonStub).calledOnce);
    assert.deepEqual((parallelFacade.assessBoundedParallelDelivery as sinon.SinonStub).firstCall.args[1], {
      title: 'Parallel delivery',
      issue: 123,
      plan: undefined,
      scopeIndependence: 'independent',
      dependencyCoupling: 'low',
      artifactOverlap: 'low',
      reviewComplexity: 'bounded',
      recoveryComplexity: 'recoverable',
    });
  });

  it('starts an eligible bounded parallel run', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'PAR-1 Run', parallelId: 'PAR-1' } as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves('[{"title":"Unit A","scopeBoundary":"docs only","owner":"engineer","recoveryGuidance":"retry sequentially"}]');
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([{ parallelId: 'PAR-1', title: 'Run', assessment: { decision: 'eligible' } } as any]);
    sandbox.stub(parallelFacade, 'startBoundedParallelDelivery').resolves({ parallelId: 'PAR-1' } as any);
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
      name: 'AgentX Bounded Parallel',
    } as unknown as vscode.LogOutputChannel);

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.startBoundedParallelDelivery']!();

    assert.ok((parallelFacade.startBoundedParallelDelivery as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      parallelId: 'PAR-1',
      units: [{
        title: 'Unit A',
        scopeBoundary: 'docs only',
        owner: 'engineer',
        isolationMode: undefined,
        status: undefined,
        mergeReadiness: undefined,
        recoveryGuidance: 'retry sequentially',
        summarySignal: undefined,
      }],
    }));
  });

  it('reconciles a bounded parallel run', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'PAR-1 Run', parallelId: 'PAR-1' } as any)
      .onSecondCall().resolves('pass' as any)
      .onThirdCall().resolves('pass' as any)
      .onCall(3).resolves('pass' as any)
      .onCall(4).resolves('approved' as any);
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([{ parallelId: 'PAR-1', title: 'Run' } as any]);
    sandbox.stub(parallelFacade, 'reconcileBoundedParallelRun').resolves({ parallelId: 'PAR-1' } as any);
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
      name: 'AgentX Bounded Parallel',
    } as unknown as vscode.LogOutputChannel);

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.reconcileBoundedParallelRun']!();

    assert.ok((parallelFacade.reconcileBoundedParallelRun as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      parallelId: 'PAR-1',
      overlapReview: 'pass',
      conflictReview: 'pass',
      acceptanceEvidence: 'pass',
      ownerApproval: 'approved',
    }));
  });
});