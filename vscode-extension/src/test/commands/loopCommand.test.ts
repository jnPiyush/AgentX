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
  let infoSpy: sinon.SinonSpy;

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

    infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');

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
    assert.ok(registeredCallbacks['agentx.loopStart'], 'Missing agentx.loopStart');
    assert.ok(registeredCallbacks['agentx.loopStatus'], 'Missing agentx.loopStatus');
    assert.ok(registeredCallbacks['agentx.loopIterate'], 'Missing agentx.loopIterate');
    assert.ok(registeredCallbacks['agentx.loopComplete'], 'Missing agentx.loopComplete');
    assert.ok(registeredCallbacks['agentx.loopCancel'], 'Missing agentx.loopCancel');
    assert.ok(registeredCallbacks['agentx.loopRollback'], 'Missing agentx.loopRollback');
  });

  it('should add the loop command to subscriptions', () => {
    assert.strictEqual(fakeContext.subscriptions.length, 7);
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

    it('should run the direct loopStart command', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showInputBox')
        .onFirstCall().resolves('Implement harness')
        .onSecondCall().resolves('10')
        .onThirdCall().resolves('ALL_TESTS_PASSING')
        .onCall(3).resolves('42');
      fakeAgentx.runCli.resolves('Loop started');

      await registeredCallbacks['agentx.loopStart']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', sinon.match.array.deepEquals([
        'start', '-p', 'Implement harness', '-m', '10', '-c', 'ALL_TESTS_PASSING', '-i', '42',
      ])));
      assert.ok(infoSpy.calledWith('Iterative loop started with a default minimum of 5 review iterations.'));
    });
  });

});
