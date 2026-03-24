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

  function createOutputChannelStub(): vscode.LogOutputChannel {
    return {
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
    } as unknown as vscode.LogOutputChannel;
  }

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

  it('shows warnings for assess, start, and reconcile without a workspace', async () => {
    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: undefined } as AgentXContext);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallbacks['agentx.assessBoundedParallelDelivery']!();
    await registeredCallbacks['agentx.startBoundedParallelDelivery']!();
    await registeredCallbacks['agentx.reconcileBoundedParallelRun']!();

    assert.equal(warnSpy.callCount, 3);
  });

  it('lists runs and writes them to the output channel', async () => {
    const channel = createOutputChannelStub();
    sandbox.stub(vscode.window, 'createOutputChannel').returns(channel);
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([]);

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showBoundedParallelRuns']!();

    assert.ok((channel.clear as sinon.SinonStub).calledOnce);
    assert.ok((channel.appendLine as sinon.SinonStub).calledOnce);
    assert.ok((channel.show as sinon.SinonStub).calledWith(true));
  });

  it('shows an error when listing bounded parallel runs fails', async () => {
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').rejects(new Error('list failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showBoundedParallelRuns']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to list bounded parallel runs: list failed'));
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
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

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

  it('shows an error when bounded parallel assessment fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'Use active context', value: 'active' } as any)
      .onSecondCall().resolves('independent' as any)
      .onThirdCall().resolves('low' as any)
      .onCall(3).resolves('low' as any)
      .onCall(4).resolves('bounded' as any)
      .onCall(5).resolves('recoverable' as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves('Parallel delivery');
    sandbox.stub(parallelFacade, 'assessBoundedParallelDelivery').rejects(new Error('assessment failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.assessBoundedParallelDelivery']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to assess bounded parallel delivery: assessment failed'));
  });

  it('starts an eligible bounded parallel run', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'PAR-1 Run', parallelId: 'PAR-1' } as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves('[{"title":"Unit A","scopeBoundary":"docs only","owner":"engineer","recoveryGuidance":"retry sequentially"}]');
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([{ parallelId: 'PAR-1', title: 'Run', assessment: { decision: 'eligible' } } as any]);
    sandbox.stub(parallelFacade, 'startBoundedParallelDelivery').resolves({ parallelId: 'PAR-1' } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

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

  it('shows an error when bounded parallel start receives invalid JSON', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'PAR-1 Run', parallelId: 'PAR-1' } as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves('{not valid json');
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([{ parallelId: 'PAR-1', title: 'Run', assessment: { decision: 'eligible' } } as any]);
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.startBoundedParallelDelivery']!();

    assert.ok(errorSpy.calledOnce);
    assert.ok(String(errorSpy.firstCall.args[0]).includes('AgentX failed to start bounded parallel delivery:'));
  });

  it('shows an error when bounded parallel start fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'PAR-1 Run', parallelId: 'PAR-1' } as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves('[{"title":"Unit A","scopeBoundary":"docs only","owner":"engineer","recoveryGuidance":"retry sequentially"}]');
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([{ parallelId: 'PAR-1', title: 'Run', assessment: { decision: 'eligible' } } as any]);
    sandbox.stub(parallelFacade, 'startBoundedParallelDelivery').rejects(new Error('start failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.startBoundedParallelDelivery']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to start bounded parallel delivery: start failed'));
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
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

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

  it('shows an error when bounded parallel reconciliation fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'PAR-1 Run', parallelId: 'PAR-1' } as any)
      .onSecondCall().resolves('pass' as any)
      .onThirdCall().resolves('pass' as any)
      .onCall(3).resolves('pass' as any)
      .onCall(4).resolves('approved' as any);
    sandbox.stub(parallelFacade, 'listBoundedParallelRuns').resolves([{ parallelId: 'PAR-1', title: 'Run' } as any]);
    sandbox.stub(parallelFacade, 'reconcileBoundedParallelRun').rejects(new Error('reconcile failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.reconcileBoundedParallelRun']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to reconcile bounded parallel output: reconcile failed'));
  });
});