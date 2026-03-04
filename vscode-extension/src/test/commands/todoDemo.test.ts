import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerTodoDemoCommand } from '../../commands/todoDemo';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerTodoDemoCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;
  let registeredCallback: (...args: unknown[]) => unknown;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fakeContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    fakeAgentx = {} as unknown as AgentXContext;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerTodoDemoCommand(fakeContext, fakeAgentx);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.todoDemo command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.todoDemo'),
    );
  });

  it('should add command to subscriptions', () => {
    assert.strictEqual(fakeContext.subscriptions.length, 1);
  });

  it('should show info message when invoked', async () => {
    const infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');
    registeredCallback();
    assert.ok(infoSpy.calledOnce);
    assert.ok(String(infoSpy.firstCall.args[0]).includes('Todo Demo'));
  });
});
