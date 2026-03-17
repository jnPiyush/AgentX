import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddPluginCommand } from '../../commands/plugins';
import { runAddPluginCommand } from '../../commands/pluginsCommandInternals';

describe('registerAddPluginCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;
    fakeAgentx = {} as unknown as sinon.SinonStubbedInstance<AgentXContext>;
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => { /* noop */ } }),
    );
  });

  afterEach(() => {
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should register agentx.addPlugin command', () => {
    registerAddPluginCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addPlugin'),
    );
  });
});

describe('runAddPluginCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should show an error when no workspace folders are open', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

    await runAddPluginCommand(fakeContext, {} as AgentXContext);

    sinon.assert.calledOnce(errorStub);
    assert.ok(String(errorStub.firstCall.args[0]).includes('Open a workspace folder first'));
  });
});