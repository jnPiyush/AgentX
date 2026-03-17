import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerPendingClarificationCommand } from '../../commands/pendingClarification';
import { AgentXContext } from '../../agentxContext';

describe('registerPendingClarificationCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let callback: (() => Promise<void>) | undefined;
  let fakeContext: vscode.ExtensionContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_command: string, registered: () => Promise<void>) => {
        callback = registered;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('shows an informational message when no clarification is pending', async () => {
    const infoSpy = sandbox.spy(vscode.window, 'showInformationMessage');
    registerPendingClarificationCommand(fakeContext, {
      getPendingClarification: async () => undefined,
    } as AgentXContext);

    await callback?.();

    assert.ok(infoSpy.calledWith('There is no pending clarification right now.'));
  });

  it('renders pending clarification details to the output channel', async () => {
    const appendLine = sandbox.stub();
    const clear = sandbox.stub();
    const show = sandbox.stub();
    sandbox.stub(vscode.window, 'createOutputChannel').returns({
      appendLine,
      clear,
      show,
      append: sandbox.stub(),
      hide: sandbox.stub(),
      dispose: sandbox.stub(),
      trace: sandbox.stub(),
      debug: sandbox.stub(),
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      replace: sandbox.stub(),
      onDidChangeLogLevel: sandbox.stub(),
      logLevel: 1,
      name: 'AgentX Clarification',
    } as unknown as vscode.LogOutputChannel);

    registerPendingClarificationCommand(fakeContext, {
      getPendingClarification: async () => ({
        agentName: 'Engineer',
        prompt: 'Need acceptance criteria',
        humanPrompt: 'Prioritize the happy path first.',
      }),
    } as AgentXContext);

    await callback?.();

    assert.ok(clear.calledOnce);
    assert.ok(appendLine.calledWith('=== Pending Clarification: Engineer ==='));
    assert.ok(appendLine.calledWith('Need acceptance criteria'));
    assert.ok(appendLine.calledWith('--- Current guidance ---'));
    assert.ok(appendLine.calledWith('Prioritize the happy path first.'));
    assert.ok(show.calledWith(true));
  });
});