import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerInitializeLocalRuntimeCommand } from '../../commands/initialize';
import { runInitializeLocalRuntimeCommand } from '../../commands/initializeCommandInternals';
import {
  copyBundledRuntimeAssets,
  ESSENTIAL_DIRS,
  ESSENTIAL_FILES,
  RUNTIME_ASSET_DIRS,
  RUNTIME_DIRS,
} from '../../commands/initializeInternals';
import { AgentXContext } from '../../agentxContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerInitializeLocalRuntimeCommand', () => {
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

    registerInitializeLocalRuntimeCommand(fakeContext, fakeAgentx as unknown as AgentXContext);
  });

  afterEach(() => {
    // Restore workspace folders
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should register agentx.initializeLocalRuntime command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.initializeLocalRuntime'),
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

describe('runInitializeLocalRuntimeCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
      extension: { packageJSON: { version: '8.4.0' } },
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

    await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    sinon.assert.calledOnce(errorStub);
    assert.ok(String(errorStub.firstCall.args[0]).includes('Open a workspace folder first'));
  });

  it('should keep Initialize scoped to minimal runtime assets', () => {
    assert.deepEqual(ESSENTIAL_DIRS, []);
    assert.deepEqual(ESSENTIAL_FILES, []);
    assert.deepEqual(RUNTIME_ASSET_DIRS, [
      {
        source: path.join('.github', 'agentx', '.agentx', 'templates', 'memories'),
        destination: 'memories',
      },
    ]);

    assert.ok(RUNTIME_DIRS.includes('.agentx/state'));
    assert.ok(RUNTIME_DIRS.includes('.agentx/sessions'));
    assert.ok(RUNTIME_DIRS.includes('docs/execution/plans'));
    assert.ok(RUNTIME_DIRS.includes('docs/execution/progress'));
    assert.ok(RUNTIME_DIRS.includes('docs/artifacts/reviews'));
    assert.ok(RUNTIME_DIRS.includes('docs/artifacts/reviews/findings'));
    assert.ok(RUNTIME_DIRS.includes('docs/artifacts/learnings'));
    assert.ok(RUNTIME_DIRS.includes('memories/session'));
    assert.ok(!RUNTIME_DIRS.includes('docs/guides'));

    assert.ok(!RUNTIME_DIRS.includes('docs/architecture'));
    assert.ok(!RUNTIME_DIRS.includes('.agentx/runtime'));
  });

  it('should seed starter memory files without overwriting existing workspace memory', () => {
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ext-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-workspace-'));

    try {
      const bundledMemories = path.join(extensionRoot, RUNTIME_ASSET_DIRS[0].source);
      fs.mkdirSync(bundledMemories, { recursive: true });
      fs.writeFileSync(path.join(bundledMemories, 'conventions.md'), 'starter convention\n', 'utf8');
      fs.writeFileSync(path.join(bundledMemories, 'pitfalls.md'), 'starter pitfall\n', 'utf8');

      const workspaceMemories = path.join(workspaceRoot, 'memories');
      fs.mkdirSync(workspaceMemories, { recursive: true });
      fs.writeFileSync(path.join(workspaceMemories, 'pitfalls.md'), 'existing pitfall\n', 'utf8');

      copyBundledRuntimeAssets(extensionRoot, workspaceRoot);

      assert.strictEqual(
        fs.readFileSync(path.join(workspaceMemories, 'conventions.md'), 'utf8'),
        'starter convention\n',
      );
      assert.strictEqual(
        fs.readFileSync(path.join(workspaceMemories, 'pitfalls.md'), 'utf8'),
        'existing pitfall\n',
      );
    } finally {
      fs.rmSync(extensionRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
