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
  let infoStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    registeredCallbacks = {};

    fakeContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    fakeAgentx = {
      checkInitialized: sandbox.stub(),
      runCli: sandbox.stub(),
      ensureWorkspaceReady: sandbox.stub().resolves('fixture'),
      forWorkspace: () => fakeAgentx,
      workspaceState: { withMutation: async <T>(_root: string, action: () => Promise<T>) => action() },
    } as unknown as sinon.SinonStubbedInstance<FrontierContext>;

    infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

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
        .onThirdCall().resolves('IMPLEMENTATION_REVIEWED')
        .onCall(3).resolves('42');
      fakeAgentx.runCli.resolves('Loop started');

      await registeredCallbacks['frontier.loopStart']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', sinon.match.array.deepEquals([
        'start', '-p', 'Implement harness', '-m', '10', '-c', 'IMPLEMENTATION_REVIEWED', '-i', '42',
      ])));
      assert.ok(infoStub.calledWith('Iterative loop started with a risk-based minimum of 1 to 5 iterations.'));
    });

    it('should pass required evidence to the direct loopIterate command', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showInputBox')
        .onFirstCall().resolves('Verified the gate')
        .onSecondCall().resolves('.frontier/state/gate.log');
      sandbox.stub(vscode.window, 'showQuickPick').resolves('No' as never);
      fakeAgentx.runCli.resolves('Iteration recorded');

      await registeredCallbacks['frontier.loopIterate']!();
      assert.ok(fakeAgentx.runCli.calledWith('loop', sinon.match.array.deepEquals([
        'iterate', '-s', 'Verified the gate', '-e', '.frontier/state/gate.log',
      ])));
    });

    for (const action of ['iterate', 'complete']) {
      it(`submits ${action} without prompting for passing test counts`, async () => {
        fakeAgentx.checkInitialized.resolves(true);
        const inputs = sandbox.stub(vscode.window, 'showInputBox')
          .onFirstCall().resolves('Reviewed implementation; suites not run')
          .onSecondCall().resolves('fresh-evidence.json')
          .onThirdCall().rejects(new Error('Unexpected passing-count prompt'));
        sandbox.stub(vscode.window, 'showQuickPick').resolves('No' as never);
        fakeAgentx.runCli.resolves('Accepted');
        await registeredCallbacks[`frontier.loop${action === 'iterate' ? 'Iterate' : 'Complete'}`]!();
        sinon.assert.calledTwice(inputs);
        sinon.assert.calledOnce(fakeAgentx.runCli);
        const args = fakeAgentx.runCli.firstCall.args[1] as string[];
        assert.ok(!args.includes('--passing'));
        assert.equal(args[args.indexOf('-e') + 1], 'fresh-evidence.json');
      });
    }

    function prepareCompletion(): sinon.SinonStub {
      fakeAgentx.checkInitialized.resolves(true);
      sandbox.stub(vscode.window, 'showInputBox')
        .onFirstCall().resolves('Review complete')
        .onSecondCall().resolves('fresh-evidence.json');
      fakeAgentx.runCli.resolves('Loop complete');
      return sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    }

    it('offers tests after completion and opens only the configured test task on approval', async () => {
      const execute = prepareCompletion();
      fakeAgentx.runCli.callsFake(async () => {
        sinon.assert.notCalled(infoStub);
        return 'Loop complete';
      });
      infoStub.resolves({ title: 'Run Test Task' });

      await registeredCallbacks['frontier.loopComplete']!();

      sinon.assert.calledOnce(infoStub);
      assert.match(String(infoStub.firstCall.args[0]), /Would you like to run the test suite now/);
      assert.deepEqual(infoStub.firstCall.args[1], { modal: true });
      assert.deepEqual(infoStub.firstCall.args.slice(2).map(item => item.title),
        ['Run Test Task', 'Not Now']);
      sinon.assert.calledOnceWithExactly(execute, 'workbench.action.tasks.test');
      assert.ok(fakeAgentx.runCli.calledBefore(infoStub));
      assert.ok(infoStub.calledBefore(execute));
    });

    for (const choice of [undefined, { title: 'Not Now' }]) {
      it(`does not launch tests when the offer is ${choice ? 'declined' : 'dismissed'}`, async () => {
        const execute = prepareCompletion();
        infoStub.resolves(choice);

        await registeredCallbacks['frontier.loopComplete']!();

        sinon.assert.calledOnce(fakeAgentx.runCli);
        sinon.assert.calledOnce(infoStub);
        sinon.assert.notCalled(execute);
      });
    }

    it('does not offer or launch tests when completion is blocked', async () => {
      const execute = prepareCompletion();
      fakeAgentx.runCli.rejects(new Error('Reviewer approval missing'));
      const errors = sandbox.stub(vscode.window, 'showErrorMessage');

      await registeredCallbacks['frontier.loopComplete']!();

      sinon.assert.notCalled(infoStub);
      sinon.assert.notCalled(execute);
      sinon.assert.calledOnce(errors);
      assert.match(String(errors.firstCall.args[0]), /Loop complete failed/);
    });

    it('reports test-task launch errors without undoing successful loop completion', async () => {
      const execute = prepareCompletion();
      infoStub.resolves({ title: 'Run Test Task' });
      execute.rejects(new Error('Task unavailable'));
      const errors = sandbox.stub(vscode.window, 'showErrorMessage');

      await registeredCallbacks['frontier.loopComplete']!();

      sinon.assert.calledOnce(fakeAgentx.runCli);
      sinon.assert.calledOnce(errors);
      assert.match(String(errors.firstCall.args[0]), /loop is complete, but the test task/);
      assert.doesNotMatch(String(errors.firstCall.args[0]), /Loop complete failed/);
    });

    it('does not complete a loop after cancelling the summary or evidence prompt', async () => {
      fakeAgentx.checkInitialized.resolves(true);
      const input = sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);
      await registeredCallbacks['frontier.loopComplete']!();
      sinon.assert.calledOnce(input);
      sinon.assert.notCalled(fakeAgentx.runCli);
      input.resetHistory();
      input.onFirstCall().resolves('Complete');
      input.onSecondCall().resolves('');
      await registeredCallbacks['frontier.loopComplete']!();
      sinon.assert.notCalled(fakeAgentx.runCli);
    });
  });

});
