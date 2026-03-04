import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerWorkflowCommand } from '../../commands/workflow';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerWorkflowCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let registeredCallback: (...args: unknown[]) => unknown;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fakeContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    fakeAgentx = {
      checkInitialized: sandbox.stub(),
      runCli: sandbox.stub(),
      workspaceRoot: undefined,
    } as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerWorkflowCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register the agentx.runWorkflow command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.runWorkflow'),
    );
  });

  it('should warn when not initialized', async () => {
    fakeAgentx.checkInitialized.resolves(false);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallback();
    assert.ok(warnSpy.calledOnce);
  });

  it('should do nothing when user cancels quick pick', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

    await registeredCallback();
    assert.ok(fakeAgentx.runCli.notCalled);
  });

  it('should run CLI with selected workflow type', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'story', description: '' } as any);
    fakeAgentx.runCli.resolves('Step 1: Engineer\nStep 2: Reviewer');

    await registeredCallback();
    assert.ok(fakeAgentx.runCli.calledWith('workflow', ['story']));
  });

  it('should show error when CLI throws', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'bug', description: '' } as any);
    fakeAgentx.runCli.rejects(new Error('workflow error'));
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
    assert.ok(String(errSpy.firstCall.args[0]).includes('workflow error'));
  });
});
