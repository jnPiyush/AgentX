import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerTaskBundleCommands } from '../../commands/task-bundles';
import { AgentXContext } from '../../agentxContext';
import * as bundleFacade from '../../taskBundles/task-bundles';

describe('registerTaskBundleCommands', () => {
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
      name: 'AgentX Task Bundles',
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

  it('registers the task bundle commands', () => {
    const agentx = { workspaceRoot: 'c:/repo' } as AgentXContext;

    registerTaskBundleCommands(fakeContext, agentx);

    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('agentx.showTaskBundles'));
    assert.ok(registerCommand.calledWith('agentx.createTaskBundle'));
    assert.ok(registerCommand.calledWith('agentx.resolveTaskBundle'));
    assert.ok(registerCommand.calledWith('agentx.promoteTaskBundle'));
  });

  it('shows a warning when task bundles are requested without a workspace', async () => {
    registerTaskBundleCommands(fakeContext, { workspaceRoot: undefined } as AgentXContext);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallbacks['agentx.showTaskBundles']!();

    assert.ok(warnSpy.calledOnce);
  });

  it('shows warnings for create, resolve, and promote without a workspace', async () => {
    registerTaskBundleCommands(fakeContext, { workspaceRoot: undefined } as AgentXContext);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallbacks['agentx.createTaskBundle']!();
    await registeredCallbacks['agentx.resolveTaskBundle']!();
    await registeredCallbacks['agentx.promoteTaskBundle']!();

    assert.equal(warnSpy.callCount, 3);
  });

  it('lists task bundles for the selected scope', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'All bundles', value: 'all' } as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([]);
    const channel = createOutputChannelStub();
    sandbox.stub(vscode.window, 'createOutputChannel').returns(channel);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showTaskBundles']!();

    assert.ok((bundleFacade.listTaskBundles as sinon.SinonStub).calledWithMatch(sinon.match.any, { all: true }));
    assert.ok((channel.appendLine as sinon.SinonStub).calledOnce);
  });

  it('shows an error when listing task bundles fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'All bundles', value: 'all' } as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').rejects(new Error('list failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showTaskBundles']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to list task bundles: list failed'));
  });

  it('creates a task bundle from prompted inputs', async () => {
    sandbox.stub(vscode.window, 'showInputBox')
      .onFirstCall().resolves('Bundle title')
      .onSecondCall().resolves('Bundle summary');
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves('p1' as any)
      .onSecondCall().resolves('story_candidate' as any)
      .onThirdCall().resolves({ label: 'Use active context', value: 'active' } as any);
    sandbox.stub(bundleFacade, 'createTaskBundle').resolves({ bundleId: 'BND-1' } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());
    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.createTaskBundle']!();

    assert.ok((bundleFacade.createTaskBundle as sinon.SinonStub).calledOnce);
    assert.deepEqual((bundleFacade.createTaskBundle as sinon.SinonStub).firstCall.args[1], {
      title: 'Bundle title',
      summary: 'Bundle summary',
      priority: 'p1',
      promotionMode: 'story_candidate',
      owner: 'engineer',
      issue: undefined,
      plan: undefined,
    });
  });

  it('creates a task bundle scoped to a specific issue', async () => {
    sandbox.stub(vscode.window, 'showInputBox')
      .onFirstCall().resolves('Bundle title')
      .onSecondCall().resolves('Bundle summary')
      .onThirdCall().resolves('42');
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves('p2' as any)
      .onSecondCall().resolves('feature_candidate' as any)
      .onThirdCall().resolves({ label: 'Specific issue', value: 'issue' } as any);
    sandbox.stub(bundleFacade, 'createTaskBundle').resolves({ bundleId: 'BND-42' } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.createTaskBundle']!();

    assert.deepEqual((bundleFacade.createTaskBundle as sinon.SinonStub).firstCall.args[1], {
      title: 'Bundle title',
      summary: 'Bundle summary',
      priority: 'p2',
      promotionMode: 'feature_candidate',
      owner: 'engineer',
      issue: 42,
      plan: undefined,
    });
  });

  it('shows an error when creating a task bundle fails', async () => {
    sandbox.stub(vscode.window, 'showInputBox')
      .onFirstCall().resolves('Bundle title')
      .onSecondCall().resolves('Bundle summary');
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves('p1' as any)
      .onSecondCall().resolves('story_candidate' as any)
      .onThirdCall().resolves({ label: 'Use active context', value: 'active' } as any);
    sandbox.stub(bundleFacade, 'createTaskBundle').rejects(new Error('create failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.createTaskBundle']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to create the task bundle: create failed'));
  });

  it('resolves the selected task bundle', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('Done' as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'none' } as any]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').resolves({ bundleId: 'BND-1', state: 'Done' } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok((bundleFacade.resolveTaskBundle as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      bundleId: 'BND-1',
      state: 'Done',
      archiveReason: undefined,
    }));
  });

  it('warns when no task bundle is selected for resolution', async () => {
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([]);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok(warnSpy.calledOnceWith('No task bundle was selected.'));
  });

  it('archives the selected task bundle with a required archive reason', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('Archived' as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves('No longer needed');
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'none' } as any]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').resolves({ bundleId: 'BND-1', state: 'Archived' } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok((bundleFacade.resolveTaskBundle as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      bundleId: 'BND-1',
      state: 'Archived',
      archiveReason: 'No longer needed',
    }));
  });

  it('does not resolve an archived task bundle without an archive reason', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('Archived' as any);
    sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);
    const resolveStub = sandbox.stub(bundleFacade, 'resolveTaskBundle');
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'none' } as any]);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok(resolveStub.notCalled);
  });

  it('shows an error when resolving a task bundle fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('Done' as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'none' } as any]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').rejects(new Error('resolve failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to resolve the task bundle: resolve failed'));
  });

  it('promotes the selected task bundle', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('feature' as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'story_candidate' } as any]);
    sandbox.stub(bundleFacade, 'promoteTaskBundle').resolves({
      bundle: { bundleId: 'BND-1' },
      targetReference: 'feature #12',
      duplicateCheckResult: 'created',
    } as any);
    sandbox.stub(vscode.window, 'createOutputChannel').returns(createOutputChannelStub());

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.promoteTaskBundle']!();

    assert.ok((bundleFacade.promoteTaskBundle as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      bundleId: 'BND-1',
      target: 'feature',
    }));
  });

  it('warns when no task bundle is selected for promotion', async () => {
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([]);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.promoteTaskBundle']!();

    assert.ok(warnSpy.calledOnceWith('No task bundle was selected.'));
  });

  it('shows an error when promoting a task bundle fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('story' as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'story_candidate' } as any]);
    sandbox.stub(bundleFacade, 'promoteTaskBundle').rejects(new Error('promote failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.promoteTaskBundle']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to promote the task bundle: promote failed'));
  });
});