import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerHookEventsCommand } from '../../commands/hookEvents';
import { AgentEventBus } from '../../utils/eventBus';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerHookEventsCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeEventBus: sinon.SinonStubbedInstance<AgentEventBus>;
  let registeredCallback: (...args: unknown[]) => unknown;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fakeContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    fakeEventBus = {
      getHistory: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<AgentEventBus>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerHookEventsCommand(fakeContext, fakeEventBus as unknown as AgentEventBus);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.showHookEvents command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.showHookEvents'),
    );
  });

  it('should do nothing when user cancels quick pick', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

    await registeredCallback();
    assert.ok(fakeEventBus.getHistory.notCalled);
  });

  it('should display hook events from event bus history', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves('25' as any);
    fakeEventBus.getHistory.returns([
      { event: 'tool-invoked', data: { tool: 'readFile', agent: 'engineer' }, timestamp: Date.now() },
      { event: 'handoff-triggered', data: { fromAgent: 'pm', toAgent: 'architect' }, timestamp: Date.now() },
      { event: 'other-event', data: {}, timestamp: Date.now() }, // should be filtered out
    ]);

    const channelSpy = sandbox.spy(vscode.window, 'createOutputChannel');

    await registeredCallback();
    assert.ok(fakeEventBus.getHistory.calledWith(25));
    assert.ok(channelSpy.calledOnce);
  });

  it('should handle empty hook event history', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves('50' as any);
    fakeEventBus.getHistory.returns([]);

    await registeredCallback();
    assert.ok(fakeEventBus.getHistory.calledWith(50));
  });

  it('should format event data with agent and tool fields', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves('25' as any);
    fakeEventBus.getHistory.returns([
      { event: 'agent-error', data: { agent: 'engineer', detail: 'test error message', status: 'failed' }, timestamp: Date.now() },
    ]);

    // Should not throw
    await registeredCallback();
    assert.ok(fakeEventBus.getHistory.calledOnce);
  });
});
