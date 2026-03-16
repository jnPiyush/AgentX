import { strict as assert } from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerInitializeCommand } from '../../commands/initialize';
import { runInitializeCommand } from '../../commands/initializeCommandInternals';
import * as setupWizard from '../../commands/setupWizard';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerInitializeCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let registeredCallback: (...args: unknown[]) => unknown;
  let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;

    fakeAgentx = {
      checkInitialized: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    // Save original
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerInitializeCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    // Restore workspace folders
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should register agentx.initialize command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.initialize'),
    );
  });

  it('should add command to subscriptions', () => {
    assert.strictEqual(fakeContext.subscriptions.length, 1);
  });

  it('should show error when no workspace folders (default mode)', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
    assert.ok(String(errSpy.firstCall.args[0]).includes('Open a workspace'));
  });

  it('should show error when no workspace folders (legacy mode)', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback({ legacy: true });
    assert.ok(errSpy.calledOnce);
  });

  it('should show error for empty workspace folders array', async () => {
    (vscode.workspace as any).workspaceFolders = [];
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
  });
});

describe('runInitializeCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
      extension: { packageJSON: { version: '8.3.6' } },
    } as unknown as vscode.ExtensionContext;
    fakeAgentx = {} as unknown as sinon.SinonStubbedInstance<AgentXContext>;
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should show an error and return when no workspace folders are open', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

    await runInitializeCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    sinon.assert.calledOnce(errorStub);
    assert.ok(String(errorStub.firstCall.args[0]).includes('Open a workspace folder first'));
  });

  it('should warn and stop when the silent precheck fails', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-init-test-'));
    (vscode.workspace as any).workspaceFolders = [
      {
        name: 'test-workspace',
        uri: vscode.Uri.file(tempRoot),
      },
    ];

    const precheckStub = sandbox.stub(setupWizard, 'runSilentInstall').resolves({
      passed: false,
      report: {
        results: [],
        healthy: false,
        criticalCount: 1,
        warningCount: 0,
        timestamp: new Date().toISOString(),
      },
    });
    const warningStub = sandbox.stub(vscode.window, 'showWarningMessage');
    const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');

    try {
      await runInitializeCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }

    sinon.assert.calledOnce(precheckStub);
    sinon.assert.calledOnce(warningStub);
    sinon.assert.notCalled(quickPickStub);
    assert.ok(String(warningStub.firstCall.args[0]).includes('Some required dependencies could not be installed'));
  });
});
