import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerDigestCommand } from '../../commands/digest';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDigestCommand', () => {
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

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerDigestCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.generateDigest command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.generateDigest'),
    );
  });

  it('should warn when not initialized', async () => {
    fakeAgentx.checkInitialized.resolves(false);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallback();
    assert.ok(warnSpy.calledOnce);
  });

  it('should run CLI digest command with progress', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.resolves('Digest summary for this week...');

    await registeredCallback();
    assert.ok(fakeAgentx.runCli.calledWith('digest'));
  });

  it('should show success message on completion', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.resolves('digest content');
    const infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');

    await registeredCallback();
    assert.ok(infoSpy.calledOnce);
    assert.ok(String(infoSpy.firstCall.args[0]).includes('digest generated'));
  });

  it('should show error on failure', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.rejects(new Error('digest failed'));
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
    assert.ok(String(errSpy.firstCall.args[0]).includes('digest failed'));
  });
});
