import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerStatusCommand } from '../../commands/status';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerStatusCommand', () => {
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
      listAgents: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    // Stub createWebviewPanel
    sandbox.stub(vscode.window, 'createWebviewPanel' as any).returns({
      webview: { html: '' },
      dispose: () => { /* noop */ },
    });

    registerStatusCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register the agentx.showStatus command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.showStatus'),
    );
  });

  it('should warn when not initialized', async () => {
    fakeAgentx.checkInitialized.resolves(false);
    const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallback();
    assert.ok(warnSpy.calledOnce);
  });

  it('should show CLI output in webview when runCli succeeds', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.resolves('engineer: working (issue #42)');

    await registeredCallback();
    assert.ok(fakeAgentx.runCli.calledWith('state'));
  });

  it('should fall back to listAgents when runCli fails', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.rejects(new Error('CLI not available'));
    fakeAgentx.listAgents.resolves([
      { name: 'Engineer', model: 'gpt-4o', maturity: 'stable', mode: 'standard', description: 'Implement code', fileName: 'engineer.agent.md' },
    ]);

    await registeredCallback();
    assert.ok(fakeAgentx.listAgents.calledOnce);
  });

  it('should show info message when no agents found in fallback', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.rejects(new Error('no CLI'));
    fakeAgentx.listAgents.resolves([]);
    const infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');

    await registeredCallback();
    assert.ok(infoSpy.calledOnce);
  });
});
