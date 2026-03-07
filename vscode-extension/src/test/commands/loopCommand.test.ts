import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerLoopCommand } from '../../commands/loopCommand';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerLoopCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let registeredCallbacks: Record<string, (...args: unknown[]) => unknown>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registeredCallbacks = {};

    fakeContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    fakeAgentx = {
      checkInitialized: sandbox.stub(),
      runCli: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallbacks[cmd] = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerLoopCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register the loop command', () => {
    assert.ok(registeredCallbacks['agentx.loop'], 'Missing agentx.loop');
  });

  it('should add the loop command to subscriptions', () => {
    assert.strictEqual(fakeContext.subscriptions.length, 1);
  });

  describe('agentx.loop (main)', () => {
    it('should warn when not initialized', async () => {
      fakeAgentx.checkInitialized.resolves(false);
      const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

      await registeredCallbacks['agentx.loop']!();
      assert.ok(warnSpy.calledOnce);
    });

    it('should do nothing when user cancels quick pick', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

      await registeredCallbacks['agentx.loop']!();
      assert.ok(fakeAgentx.runCli.notCalled);
    });

    it('should run loop status action', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'status', description: '' } as any);
      fakeAgentx.runCli.resolves('Loop active: iteration 2/10');

      await registeredCallbacks['agentx.loop']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', ['status']));
    });

    it('should run loop cancel action', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'cancel', description: '' } as any);
      fakeAgentx.runCli.resolves('Loop cancelled');

      await registeredCallbacks['agentx.loop']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', ['cancel']));
    });
  });

});
