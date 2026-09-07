import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerTaskBundleCommands } from '../../commands/task-bundles';
import { AgentXContext } from '../../agentxContext';
import * as bundleFacade from '../../taskBundles/task-bundles';
import { TaskBundlePromotionResult, TaskBundleRecord } from '../../taskBundles/task-bundlesTypes';

/** Builds a `QuickPickItem`-shaped scope option, matching `task-bundles.ts`'s promptScope() items. */
function scopeQuickPickItem(label: string, value: string): vscode.QuickPickItem & { value: string } {
  return { label, value };
}

/** Builds a `QuickPickItem`-shaped bundle option, matching `task-bundles.ts`'s bundle-picker items. */
function bundleQuickPickItem(bundleId: string, label = `${bundleId} Bundle`): vscode.QuickPickItem & { bundleId: string } {
  return { label, bundleId };
}

function fakeBundleRecord(overrides: Partial<TaskBundleRecord> & { bundleId: string }): TaskBundleRecord {
  return {
    title: 'Bundle',
    summary: '',
    parentContext: { source: 'explicit-issue' },
    priority: 'p1',
    state: 'Proposed',
    owner: 'engineer',
    evidenceLinks: [],
    promotionMode: 'none',
    createdAt: '2026-03-13T00:00:00.000Z',
    updatedAt: '2026-03-13T00:00:00.000Z',
    tags: [],
    ...overrides,
  };
}

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
    sandbox.stub(vscode.window, 'showQuickPick').resolves(scopeQuickPickItem('All bundles', 'all'));
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([]);
    const channel = createOutputChannelStub();
    sandbox.stub(vscode.window, 'createOutputChannel').returns(channel);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showTaskBundles']!();

    assert.ok((bundleFacade.listTaskBundles as sinon.SinonStub).calledWithMatch(sinon.match.any, { all: true }));
    assert.ok((channel.appendLine as sinon.SinonStub).calledOnce);
  });

  it('shows an error when listing task bundles fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves(scopeQuickPickItem('All bundles', 'all'));
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
      .onFirstCall().resolves('p1' as never)
      .onSecondCall().resolves('story_candidate' as never)
      .onThirdCall().resolves(scopeQuickPickItem('Use active context', 'active'));
    sandbox.stub(bundleFacade, 'createTaskBundle').resolves(fakeBundleRecord({ bundleId: 'BND-1' }));
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
      .onFirstCall().resolves('p2' as never)
      .onSecondCall().resolves('feature_candidate' as never)
      .onThirdCall().resolves(scopeQuickPickItem('Specific issue', 'issue'));
    sandbox.stub(bundleFacade, 'createTaskBundle').resolves(fakeBundleRecord({ bundleId: 'BND-42' }));
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
      .onFirstCall().resolves('p1' as never)
      .onSecondCall().resolves('story_candidate' as never)
      .onThirdCall().resolves(scopeQuickPickItem('Use active context', 'active'));
    sandbox.stub(bundleFacade, 'createTaskBundle').rejects(new Error('create failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.createTaskBundle']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to create the task bundle: create failed'));
  });

  it('resolves the selected task bundle', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves(bundleQuickPickItem('BND-1'))
      .onSecondCall().resolves('Done' as never);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([fakeBundleRecord({ bundleId: 'BND-1' })]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').resolves(fakeBundleRecord({ bundleId: 'BND-1', state: 'Done' }));
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
      .onFirstCall().resolves(bundleQuickPickItem('BND-1'))
      .onSecondCall().resolves('Archived' as never);
    sandbox.stub(vscode.window, 'showInputBox').resolves('No longer needed');
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([fakeBundleRecord({ bundleId: 'BND-1' })]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').resolves(fakeBundleRecord({ bundleId: 'BND-1', state: 'Archived' }));
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
      .onFirstCall().resolves(bundleQuickPickItem('BND-1'))
      .onSecondCall().resolves('Archived' as never);
    sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);
    const resolveStub = sandbox.stub(bundleFacade, 'resolveTaskBundle');
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([fakeBundleRecord({ bundleId: 'BND-1' })]);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok(resolveStub.notCalled);
  });

  it('shows an error when resolving a task bundle fails', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves(bundleQuickPickItem('BND-1'))
      .onSecondCall().resolves('Done' as never);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([fakeBundleRecord({ bundleId: 'BND-1' })]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').rejects(new Error('resolve failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to resolve the task bundle: resolve failed'));
  });

  it('promotes the selected task bundle', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves(bundleQuickPickItem('BND-1'))
      .onSecondCall().resolves('feature' as never);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([fakeBundleRecord({ bundleId: 'BND-1', promotionMode: 'story_candidate' })]);
    sandbox.stub(bundleFacade, 'promoteTaskBundle').resolves({
      bundle: fakeBundleRecord({ bundleId: 'BND-1' }),
      targetType: 'feature',
      targetReference: 'feature #12',
      duplicateCheckResult: 'created',
    } as TaskBundlePromotionResult);
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
      .onFirstCall().resolves(bundleQuickPickItem('BND-1'))
      .onSecondCall().resolves('story' as never);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([fakeBundleRecord({ bundleId: 'BND-1', promotionMode: 'story_candidate' })]);
    sandbox.stub(bundleFacade, 'promoteTaskBundle').rejects(new Error('promote failed'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.promoteTaskBundle']!();

    assert.ok(errorSpy.calledOnceWith('AgentX failed to promote the task bundle: promote failed'));
  });
});