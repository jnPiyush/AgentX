import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerLoopCommand } from '../../commands/loopCommand';
import { FrontierContext } from '../../frontierContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerLoopCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<FrontierContext>;
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
    } as unknown as sinon.SinonStubbedInstance<FrontierContext>;

    infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallbacks[cmd] = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerLoopCommand(fakeContext, fakeAgentx as unknown as FrontierContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register the loop command', () => {
    assert.ok(registeredCallbacks['frontier.loop'], 'Missing agentx.loop');
    assert.ok(registeredCallbacks['frontier.loopStart'], 'Missing agentx.loopStart');
    assert.ok(registeredCallbacks['frontier.loopStatus'], 'Missing agentx.loopStatus');
    assert.ok(registeredCallbacks['frontier.loopIterate'], 'Missing agentx.loopIterate');
    assert.ok(registeredCallbacks['frontier.loopComplete'], 'Missing agentx.loopComplete');
    assert.ok(registeredCallbacks['frontier.loopCancel'], 'Missing agentx.loopCancel');
    assert.ok(registeredCallbacks['frontier.loopRollback'], 'Missing agentx.loopRollback');
  });

  it('should add the loop command to subscriptions', () => {
    assert.strictEqual(fakeContext.subscriptions.length, 7);
  });

  describe('frontier.loop (main)', () => {
    it('should warn when not initialized', async () => {
      fakeAgentx.checkInitialized.resolves(false);
      const warnSpy = sandbox.spy(vscode.window, 'showWarningMessage');

      await registeredCallbacks['frontier.loop']!();
      assert.ok(warnSpy.calledOnce);
    });

    it('should do nothing when user cancels quick pick', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

      await registeredCallbacks['frontier.loop']!();
      assert.ok(fakeAgentx.runCli.notCalled);
    });

    it('should run loop status action', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'status', description: '' } as vscode.QuickPickItem);
      fakeAgentx.runCli.resolves('Loop active: iteration 2/10');

      await registeredCallbacks['frontier.loop']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', ['status']));
    });

    it('should run loop cancel action', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'cancel', description: '' } as vscode.QuickPickItem);
      fakeAgentx.runCli.resolves('Loop cancelled');

      await registeredCallbacks['frontier.loop']!();
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

      await registeredCallbacks['frontier.loopStart']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', sinon.match.array.deepEquals([
        'start', '-p', 'Implement harness', '-m', '10', '-c', 'ALL_TESTS_PASSING', '-i', '42',
      ])));
      assert.ok(infoSpy.calledWith('Iterative loop started with a risk-based minimum of 1 to 5 iterations.'));
    });

    it('should pass required evidence to the direct loopIterate command', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showInputBox')
        .onFirstCall().resolves('Verified the gate')
        .onSecondCall().resolves('.agentx/state/gate.log');
      sandbox.stub(vscode.window, 'showQuickPick').resolves('No' as never);
      fakeAgentx.runCli.resolves('Iteration recorded');

      await registeredCallbacks['frontier.loopIterate']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', sinon.match.array.deepEquals([
        'iterate', '-s', 'Verified the gate', '-e', '.agentx/state/gate.log',
      ])));
    });
  });

});
