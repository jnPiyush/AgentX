import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerShowIssueCommand } from '../../commands/showIssue';
import { AgentXContext } from '../../agentxContext';

describe('registerShowIssueCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let callback: ((issueNumber?: string) => Promise<void>) | undefined;
  let fakeContext: vscode.ExtensionContext;
  let agentx: AgentXContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    agentx = {
      runCli: sandbox.stub(),
    } as unknown as AgentXContext;
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_command: string, registered: (issueNumber?: string) => Promise<void>) => {
        callback = registered;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does nothing when no issue number is provided', async () => {
    registerShowIssueCommand(fakeContext, agentx);

    await callback?.();

    assert.ok((agentx.runCli as sinon.SinonStub).notCalled);
  });

  it('renders structured issue JSON in the output channel', async () => {
    (agentx.runCli as sinon.SinonStub).resolves(JSON.stringify({
      number: 42,
      title: 'Fix release gate',
      status: 'In Review',
      state: 'open',
      labels: ['type:bug'],
      body: 'Release must block on coverage.',
    }));
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
      name: 'AgentX Issue Detail',
    } as unknown as vscode.LogOutputChannel);

    registerShowIssueCommand(fakeContext, agentx);

    await callback?.('42');

    assert.ok((agentx.runCli as sinon.SinonStub).calledWith('issue', ['get', '42']));
    assert.ok(appendLine.calledWith('=== Issue #42: Fix release gate ==='));
    assert.ok(appendLine.calledWith('  Status : In Review'));
    assert.ok(appendLine.calledWith('  Labels : type:bug'));
    assert.ok(show.calledWith(true));
  });

  it('falls back to plain text output when CLI does not return JSON', async () => {
    (agentx.runCli as sinon.SinonStub).resolves('plain text issue detail');
    sandbox.stub(vscode.window, 'createOutputChannel').returns({
      appendLine: sandbox.stub(),
      clear: sandbox.stub(),
      show: sandbox.stub(),
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
      name: 'AgentX Issue Detail',
    } as unknown as vscode.LogOutputChannel);

    registerShowIssueCommand(fakeContext, agentx);

    await callback?.('77');

    assert.ok((agentx.runCli as sinon.SinonStub).calledWith('issue', ['get', '77']));
  });

  it('shows an error when the CLI call fails', async () => {
    (agentx.runCli as sinon.SinonStub).rejects(new Error('cli failure'));
    const errorSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    registerShowIssueCommand(fakeContext, agentx);

    await callback?.('11');

    assert.ok(errorSpy.calledWith('Failed to load issue #11: cli failure'));
  });
});