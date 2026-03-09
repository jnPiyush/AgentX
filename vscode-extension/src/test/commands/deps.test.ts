import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerDepsCommand } from '../../commands/deps';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDepsCommand', () => {
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
    } as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    // Capture the registered callback
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerDepsCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register the agentx.checkDeps command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.checkDeps'),
    );
  });

  it('should add command to subscriptions', () => {
    assert.strictEqual(fakeContext.subscriptions.length, 1);
  });

  it('should warn when not initialized', async () => {
    fakeAgentx.checkInitialized.resolves(false);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallback();
    assert.ok(warnSpy.calledOnce);
  });

  it('should show output when CLI succeeds', async () => {
    fakeAgentx.checkInitialized.resolves(true);

    // Stub showInputBox to return an issue number
    sandbox.stub(vscode.window, 'showInputBox').resolves('42');
    fakeAgentx.runCli.resolves('No blockers found');

    // Track output channel creation
    const channelSpy = sandbox.spy(vscode.window, 'createOutputChannel');

    await registeredCallback();
    assert.ok(channelSpy.calledOnce);
    assert.ok(fakeAgentx.runCli.calledWith('deps', ['42']));
  });

  it('should do nothing when user cancels input', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);

    await registeredCallback();
    assert.ok(fakeAgentx.runCli.notCalled);
  });

  it('should use provided issue number without prompting', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    const inputSpy = sandbox.spy(vscode.window, 'showInputBox');
    fakeAgentx.runCli.resolves('No blockers found');

    await registeredCallback('77');
    assert.ok(inputSpy.notCalled);
    assert.ok(fakeAgentx.runCli.calledWith('deps', ['77']));
  });

  it('should show error when CLI throws', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    sandbox.stub(vscode.window, 'showInputBox').resolves('42');
    fakeAgentx.runCli.rejects(new Error('CLI failed'));
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
    assert.ok(String(errSpy.firstCall.args[0]).includes('CLI failed'));
  });
});
