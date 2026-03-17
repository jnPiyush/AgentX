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

  it('lists task bundles for the selected scope', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'All bundles', value: 'all' } as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([]);
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
      name: 'AgentX Task Bundles',
    } as unknown as vscode.LogOutputChannel);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.showTaskBundles']!();

    assert.ok((bundleFacade.listTaskBundles as sinon.SinonStub).calledWithMatch(sinon.match.any, { all: true }));
    assert.ok(appendLine.calledOnce);
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
      name: 'AgentX Task Bundles',
    } as unknown as vscode.LogOutputChannel);
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

  it('resolves the selected task bundle', async () => {
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({ label: 'BND-1 Bundle', bundleId: 'BND-1' } as any)
      .onSecondCall().resolves('Done' as any);
    sandbox.stub(bundleFacade, 'listTaskBundles').resolves([{ bundleId: 'BND-1', title: 'Bundle', priority: 'p1', state: 'Backlog', parentContext: {}, promotionMode: 'none' } as any]);
    sandbox.stub(bundleFacade, 'resolveTaskBundle').resolves({ bundleId: 'BND-1', state: 'Done' } as any);
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
      name: 'AgentX Task Bundles',
    } as unknown as vscode.LogOutputChannel);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.resolveTaskBundle']!();

    assert.ok((bundleFacade.resolveTaskBundle as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      bundleId: 'BND-1',
      state: 'Done',
      archiveReason: undefined,
    }));
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
      name: 'AgentX Task Bundles',
    } as unknown as vscode.LogOutputChannel);

    registerTaskBundleCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);

    await registeredCallbacks['agentx.promoteTaskBundle']!();

    assert.ok((bundleFacade.promoteTaskBundle as sinon.SinonStub).calledWithMatch(sinon.match.any, {
      bundleId: 'BND-1',
      target: 'feature',
    }));
  });
});