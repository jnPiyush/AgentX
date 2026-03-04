import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerReadyQueueCommand } from '../../commands/readyQueue';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Mock ReadyQueueTreeProvider
// ---------------------------------------------------------------------------

class FakeReadyQueueProvider {
  lastData: unknown = undefined;
  refreshCount = 0;

  refresh(data?: unknown): void {
    this.lastData = data;
    this.refreshCount++;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerReadyQueueCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let fakeProvider: FakeReadyQueueProvider;
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

    fakeProvider = new FakeReadyQueueProvider();

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    // Stub executeCommand for focus calls
    sandbox.stub(vscode.commands, 'executeCommand').resolves();

    registerReadyQueueCommand(
      fakeContext,
      fakeAgentx as unknown as AgentXContext,
      fakeProvider as any,
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.readyQueue command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.readyQueue'),
    );
  });

  it('should refresh provider when not initialized', async () => {
    fakeAgentx.checkInitialized.resolves(false);

    await registeredCallback();
    assert.strictEqual(fakeProvider.refreshCount, 1);
    assert.ok(
      (vscode.commands.executeCommand as sinon.SinonStub).calledWith('agentx-ready.focus'),
    );
  });

  it('should parse CLI JSON and pass to provider', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    const mockIssues = [{ number: 1, title: 'Test', priority: 'p0' }];
    fakeAgentx.runCli.resolves(JSON.stringify(mockIssues));

    await registeredCallback();
    assert.deepStrictEqual(fakeProvider.lastData, mockIssues);
  });

  it('should handle non-array JSON gracefully', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.resolves('{"not": "array"}');

    await registeredCallback();
    // Tree provider receives undefined for non-array
    assert.strictEqual(fakeProvider.lastData, undefined);
  });

  it('should handle invalid JSON by passing undefined', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.resolves('not valid json');

    await registeredCallback();
    assert.strictEqual(fakeProvider.lastData, undefined);
  });

  it('should show error and refresh on CLI failure', async () => {
    fakeAgentx.checkInitialized.resolves(true);
    fakeAgentx.runCli.rejects(new Error('CLI timeout'));
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
    assert.ok(fakeProvider.refreshCount >= 1);
  });
});
