import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { __clearConfig, __setConfig } from '../mocks/vscode';
import { registerInitializeLocalRuntimeCommand } from '../../commands/initialize';
import { runInitializeLocalRuntimeCommand } from '../../commands/initializeCommandInternals';
import {
  copyBundledRuntimeAssets,
  copyCopilotCliAssets,
  COPILOT_CLI_ASSET_DIRS,
  COPILOT_CLI_ASSET_FILES,
  COPILOT_CLI_SUPPORT_DIRS,
  ESSENTIAL_DIRS,
  ESSENTIAL_FILES,
  RUNTIME_ASSET_DIRS,
  RUNTIME_DIRS,
  mergeGitignore,
  writeWorkspaceRuntimeWrappers,
} from '../../commands/initializeInternals';
import { FrontierContext } from '../../frontierContext';

describe('Frontier generated ignore rules', () => {
  it('seeds the state helper beside scripts that load it in an external workspace', () => {
    const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-seed-state-')));
    const extension = path.join(base, 'extension');
    const workspace = path.join(base, 'workspace');
    const source = path.resolve(__dirname, '..', '..', '..', '..');
    const seed = path.join(extension, '.github', 'frontier', 'seed');
    try {
      fs.mkdirSync(path.join(seed, 'scripts'), { recursive: true });
      fs.mkdirSync(workspace);
      for (const name of ['validate-handoff.ps1', 'score-code-quality.ps1']) {
        fs.copyFileSync(path.join(source, 'scripts', name), path.join(seed, 'scripts', name));
      }
      const helper = COPILOT_CLI_ASSET_FILES.find(asset => asset.destination.endsWith('workspace-state.ps1'));
      assert.ok(helper);
      fs.mkdirSync(path.dirname(path.join(extension, helper.source)), { recursive: true });
      fs.copyFileSync(path.join(source, '.frontier', 'runtime', 'workspace-state.ps1'), path.join(extension, helper.source));
      copyCopilotCliAssets(extension, workspace, false);
      assert.equal(fs.existsSync(path.join(workspace, helper.destination)), true);
      const env = { ...process.env };
      for (const key of ['FRONTIER_STATE_ROOT', 'FRONTIER_STATE_WORKSPACE', 'FRONTIER_STATE_AUTHORITY',
        'FRONTIER_WORKSPACE_ROOT', 'HVE_WORKSPACE_ROOT', 'AGENTX_WORKSPACE_ROOT']) { delete env[key]; }
      execFileSync('pwsh', ['-NoProfile', '-File', path.join(workspace, 'scripts', 'validate-handoff.ps1')],
        { cwd: workspace, env, encoding: 'utf8' });
      const scoped = execFileSync('pwsh', ['-NoProfile', '-File',
        path.join(workspace, 'scripts', 'score-code-quality.ps1'), '-Mode', 'Scope',
        '-WorkspaceRoot', workspace, '-Json'], { cwd: workspace, env, encoding: 'utf8' });
      assert.equal(JSON.parse(scoped).status, 'scoped');
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
  });

  it('ignores Frontier state without legacy entries or removing user rules', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ignore-'));
    try {
      fs.writeFileSync(path.join(root, '.gitignore'), 'custom-user-rule\n');
      mergeGitignore(root);
      mergeGitignore(root);
      const content = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
      for (const entry of ['.frontier/', 'custom-user-rule']) {
        assert.ok(content.includes(entry));
      }
      for (const legacy of ['.hve/', '.agentx/', '.frontier.migrating-*/', '.frontier-migration.lock/']) {
        assert.ok(!content.includes(legacy), `unexpected legacy ignore entry ${legacy}`);
      }
      assert.equal(content.split('.frontier/').length - 1, 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerInitializeLocalRuntimeCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<FrontierContext>;
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
    } as unknown as sinon.SinonStubbedInstance<FrontierContext>;

    // Save original
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerInitializeLocalRuntimeCommand(fakeContext, fakeAgentx as unknown as FrontierContext);
  });

  afterEach(() => {
    // Restore workspace folders
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should register frontier.initializeLocalRuntime command', () => {
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('frontier.initializeLocalRuntime'),
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
  let fakeAgentx: sinon.SinonStubbedInstance<FrontierContext>;
  let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
      extension: { packageJSON: { version: '8.4.0' } },
    } as unknown as vscode.ExtensionContext;
    fakeAgentx = {} as unknown as sinon.SinonStubbedInstance<FrontierContext>;
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;
  });

  afterEach(() => {
    (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    sandbox.restore();
  });

  it('should show an error and return when no workspace folders are open', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

    await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx as unknown as FrontierContext);

    sinon.assert.calledOnce(errorStub);
    assert.ok(String(errorStub.firstCall.args[0]).includes('Open a workspace folder first'));
  });

  for (const [enforceIssues, cursorBound] of [[true, false], [false, false], [true, true], [false, true]]) {
    it(`preserves configuration and Cursor binding on reinstall: issues=${enforceIssues}, cursor=${cursorBound}`, async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-reinstall-'));
      const internals = await import('../../commands/initializeInternals');
      const adapters = await import('../../commands/adaptersCommandInternals');
      const dependencies = await import('../../utils/dependencyChecker');
      const existing = {
        ...(enforceIssues ? { provider: 'github' } : {}),
        integration: 'ado', mode: 'ado', enforceIssues,
        llmProvider: 'openai-api',
        llmProviders: { 'openai-api': { defaultModel: 'custom-model', baseUrl: 'http://localhost:8080' } },
        custom: { enabled: false, values: [1, 2] },
        nextIssueNumber: 42, created: '2020-01-01T00:00:00Z', updatedAt: 'old',
      };
      try {
        fs.mkdirSync(path.join(root, '.frontier'));
        const configFile = path.join(root, '.frontier', 'config.json');
        fs.writeFileSync(configFile, JSON.stringify(existing));
        if (cursorBound) {
          fs.writeFileSync(path.join(root, '.frontier', 'cursor-assets.json'), '{"schemaVersion":1,"files":{}}');
        }
        sandbox.stub(internals, 'promptWorkspaceFolder').resolves({
          uri: vscode.Uri.file(root), name: 'reinstall-fixture', index: 0,
        });
        sandbox.stub(internals, 'copyBundledRuntimeAssets');
        sandbox.stub(internals, 'copyCopilotCliAssets');
        const wrappers = sandbox.stub(internals, 'writeWorkspaceRuntimeWrappers');
        sandbox.stub(internals, 'mergeGitignore');
        const githubSync = sandbox.stub(adapters, 'syncDetectedGitHubAdapter').rejects(new Error('Must preserve selected provider'));
        const adoSync = sandbox.stub(adapters, 'syncDetectedAdoAdapter').rejects(new Error('Must preserve selected provider'));
        sandbox.stub(dependencies, 'checkAllDependencies').resolves({ results: [] } as never);
        sandbox.stub(vscode.window, 'showWarningMessage').resolves('Reinstall' as never);
        const errors = sandbox.stub(vscode.window, 'showErrorMessage');
        const context = {
          invalidateCache: sandbox.stub(), githubConnected: false, adoConnected: false,
          workspaceState: { assertAvailable: (value: string) => value, inspect: () => undefined },
        } as unknown as FrontierContext;

        await runInitializeLocalRuntimeCommand(fakeContext, context);

        sinon.assert.notCalled(errors);
        sinon.assert.notCalled(githubSync);
        sinon.assert.notCalled(adoSync);
        if (cursorBound) {
          sinon.assert.calledWithExactly(wrappers, fakeContext.extensionUri.fsPath, root, true);
        } else {
          sinon.assert.calledWithExactly(wrappers, fakeContext.extensionUri.fsPath, root);
        }
        const actual = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        assert.deepEqual(actual, {
          provider: enforceIssues ? 'github' : 'ado',
          ...existing,
          updatedAt: actual.updatedAt,
        });
        assert.notEqual(actual.updatedAt, 'old');
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }

  describe('initialization footprint', () => {
    let root: string;
    let extensionRoot: string;
    let errors: sinon.SinonStub;
    let chooseWorkspace: sinon.SinonStub;
    let githubSync: sinon.SinonStub;

    beforeEach(async () => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-init-footprint-'));
      extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-init-bundle-'));
      const memories = path.join(extensionRoot, RUNTIME_ASSET_DIRS[0].source);
      fs.mkdirSync(memories, { recursive: true });
      for (const name of ['conventions.md', 'decisions.md', 'pitfalls.md']) {
        fs.writeFileSync(path.join(memories, name), `starter ${name}\n`);
      }
      const internals = await import('../../commands/initializeInternals');
      const adapters = await import('../../commands/adaptersCommandInternals');
      const dependencies = await import('../../utils/dependencyChecker');
      chooseWorkspace = sandbox.stub(internals, 'promptWorkspaceFolder').resolves({
        uri: vscode.Uri.file(root), name: 'footprint-fixture', index: 0,
      });
      githubSync = sandbox.stub(adapters, 'syncDetectedGitHubAdapter').resolves(false);
      sandbox.stub(adapters, 'syncDetectedAdoAdapter').resolves(false);
      sandbox.stub(dependencies, 'checkAllDependencies').resolves({ results: [] } as never);
      sandbox.stub(fakeContext, 'extensionUri').value(vscode.Uri.file(extensionRoot));
      fakeAgentx = sandbox.createStubInstance(FrontierContext);
      Object.defineProperty(fakeAgentx, 'workspaceState', {
        value: { assertAvailable: (value: string) => value, inspect: () => undefined },
      });
      sandbox.stub(fakeAgentx, 'workspaceRoot').get(() => root);
      errors = sandbox.stub(vscode.window, 'showErrorMessage');
      __clearConfig();
    });

    afterEach(() => {
      __clearConfig();
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(extensionRoot, { recursive: true, force: true });
    });

    for (const mode of [undefined, 'standard']) {
      it(`preserves the standard scaffold when mode is ${mode ?? 'unset'}`, async () => {
        if (mode) {
          __setConfig('frontier.initializationMode', mode);
        }
        await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

        sinon.assert.notCalled(errors);
        for (const dir of RUNTIME_DIRS) {
          assert.ok(fs.statSync(path.join(root, dir)).isDirectory(), dir);
        }
        assert.equal(
          fs.readFileSync(path.join(root, 'memories', 'conventions.md'), 'utf8'),
          'starter conventions.md\n',
        );
        assert.ok(!fs.existsSync(path.join(root, '.github')));
      });
    }

    it('starts background repository discovery for the initialized workspace', async () => {
      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);
      await new Promise((resolve) => setImmediate(resolve));

      sinon.assert.notCalled(errors);
      assert.ok((fakeAgentx.runCli as sinon.SinonStub).calledWith('context', ['--start-refresh'], root));
    });

    it('still seeds explicitly requested CLI assets in standard mode', async () => {
      __setConfig('frontier.seedRepoLocalAssets', true);
      const bundledAgents = path.join(extensionRoot, COPILOT_CLI_ASSET_DIRS[0].source);
      fs.mkdirSync(bundledAgents, { recursive: true });
      fs.writeFileSync(path.join(bundledAgents, 'fixture.agent.md'), 'fixture agent\n');

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

      sinon.assert.notCalled(errors);
      assert.equal(fs.readFileSync(
        path.join(root, '.github', 'agents', 'fixture.agent.md'), 'utf8'), 'fixture agent\n');
    });

    it('creates exactly the state and launcher files in minimal mode', async () => {
      __setConfig('frontier.initializationMode', 'minimal');
      const configuration = sandbox.spy(vscode.workspace, 'getConfiguration');

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

      sinon.assert.notCalled(errors);
      const files = fs.readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
        .sort();
      assert.deepEqual(files, [
        '.frontier/config.json',
        '.frontier/runtime/frontier.ps1',
        '.frontier/runtime/frontier.sh',
        '.frontier/runtime/local-issue-manager.ps1',
        '.frontier/runtime/local-issue-manager.sh',
        '.frontier/state/agent-status.json',
        '.frontier/version.json',
        '.gitignore',
      ].map((entry) => path.normalize(entry)).sort());
      assert.deepEqual(fs.readdirSync(root).sort(), ['.frontier', '.gitignore']);
      assert.deepEqual(fs.readdirSync(path.join(root, '.frontier')).sort(),
        ['config.json', 'runtime', 'state', 'version.json']);
      assert.ok(configuration.getCalls().some((call) =>
        call.args[0] === 'frontier'
        && call.args[1] instanceof vscode.Uri && call.args[1].fsPath === root));
    });

    it('uses the exact selected remote URI for folder-specific minimal settings', async () => {
      chooseWorkspace.restore();
      const remoteUri = vscode.Uri.file(root);
      sandbox.stub(remoteUri, 'scheme').value('vscode-remote');
      sandbox.stub(remoteUri, 'authority').value('ssh-remote+fixture');
      const remoteFolder = { uri: remoteUri, name: 'remote-project', index: 1 };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([
        { uri: vscode.Uri.file(extensionRoot), name: 'unselected-project', index: 0 },
        remoteFolder,
      ]);
      sandbox.stub(vscode.window, 'showQuickPick').resolves({
        label: remoteFolder.name, description: root, folder: remoteFolder,
      } as never);
      const selectedSettings = vscode.workspace.getConfiguration('frontier');
      sandbox.stub(selectedSettings, 'get')
        .withArgs('initializationMode', 'standard').returns('minimal');
      const otherSettings = vscode.workspace.getConfiguration('frontier');
      const configuration = sandbox.stub(vscode.workspace, 'getConfiguration')
        .callsFake((_section, scope) => scope === remoteUri ? selectedSettings : otherSettings);

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

      sinon.assert.notCalled(errors);
      assert.ok(configuration.getCalls().some((call) => call.args[1] === remoteUri));
      assert.deepEqual(fs.readdirSync(root).sort(), ['.frontier', '.gitignore']);
      assert.ok(!fs.existsSync(path.join(extensionRoot, '.frontier')));
    });

    it('preserves first-time GitHub MCP configuration as a documented footprint exception', async () => {
      __setConfig('frontier.initializationMode', 'minimal');
      githubSync.restore();
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      execFileSync('git', ['remote', 'add', 'origin',
        'https://github.com/example/minimal-fixture.git'], { cwd: root });

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

      sinon.assert.notCalled(errors);
      const mcp = JSON.parse(fs.readFileSync(path.join(root, '.vscode', 'mcp.json'), 'utf8'));
      assert.deepEqual(mcp.servers.github, {
        type: 'http', url: 'https://api.githubcopilot.com/mcp/',
      });
      const config = JSON.parse(fs.readFileSync(
        path.join(root, '.frontier', 'config.json'), 'utf8'));
      assert.equal(config.provider, 'github');
      assert.equal(config.repo, 'example/minimal-fixture');
      assert.deepEqual(fs.readdirSync(root).sort(),
        ['.frontier', '.git', '.gitignore', '.vscode']);
      assert.ok(!fs.existsSync(path.join(root, 'docs')));
      assert.ok(!fs.existsSync(path.join(root, 'memories')));
    });

    for (const mode of ['unknown', 3]) {
      it(`rejects invalid initialization mode ${mode} before writing`, async () => {
        __setConfig('frontier.initializationMode', mode);

        await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

        sinon.assert.calledOnce(errors);
        assert.match(String(errors.firstCall.args[0]), /initializationMode/);
        assert.deepEqual(fs.readdirSync(root), []);
      });
    }

    it('rejects minimal mode with asset seeding instead of silently copying files', async () => {
      __setConfig('frontier.initializationMode', 'minimal');
      __setConfig('frontier.seedRepoLocalAssets', true);

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

      sinon.assert.calledOnce(errors);
      assert.match(String(errors.firstCall.args[0]), /seedRepoLocalAssets/);
      assert.deepEqual(fs.readdirSync(root), []);
    });

    it('preserves existing project content and state during a minimal reinstall', async () => {
      __setConfig('frontier.initializationMode', 'minimal');
      sandbox.stub(vscode.window, 'showWarningMessage').resolves('Reinstall' as never);
      const existing = new Map([
        ['memories/decisions.md', 'project decisions\n'],
        ['docs/artifacts/prd/PRD-1.md', 'project requirements\n'],
        ['.github/agents/custom.agent.md', 'project agent\n'],
        ['.frontier/state/agent-status.json', '{"engineer":{"status":"working"}}'],
      ]);
      for (const [relative, content] of existing) {
        const target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
      }
      const config = { provider: 'local', nextIssueNumber: 12, enforceIssues: true };
      fs.writeFileSync(path.join(root, '.frontier', 'config.json'), JSON.stringify(config));

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);

      sinon.assert.notCalled(errors);
      for (const [relative, content] of existing) {
        assert.equal(fs.readFileSync(path.join(root, relative), 'utf8'), content);
      }
      const actual = JSON.parse(fs.readFileSync(
        path.join(root, '.frontier', 'config.json'), 'utf8'));
      assert.equal(actual.nextIssueNumber, 12);
      assert.equal(actual.enforceIssues, true);
      assert.ok(!fs.existsSync(path.join(root, 'memories', 'conventions.md')));
      assert.ok(!fs.existsSync(path.join(root, 'docs', 'ux')));
    });

    it('creates learning output directories only when capture is requested', async () => {
      __setConfig('frontier.initializationMode', 'minimal');
      const { createLearningCapture } = await import('../../commands/learningsCommandInternals');
      sandbox.stub(vscode.window, 'showInputBox')
        .onFirstCall().resolves('7')
        .onSecondCall().resolves('Capture in a minimal workspace');

      await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx);
      assert.ok(!fs.existsSync(path.join(root, 'docs')));

      await createLearningCapture(fakeAgentx);

      sinon.assert.notCalled(errors);
      const learning = path.join(root, 'docs', 'artifacts', 'learnings', 'LEARNING-7.md');
      assert.ok(fs.readFileSync(learning, 'utf8').includes('Capture in a minimal workspace'));
      assert.ok(!fs.existsSync(path.join(root, 'docs', 'artifacts', 'prd')));
      assert.ok(!fs.existsSync(path.join(root, 'memories')));
    });
  });

  it('should keep standard initialization scoped to the existing runtime scaffold', () => {
    assert.deepEqual(ESSENTIAL_DIRS, []);
    assert.deepEqual(ESSENTIAL_FILES, []);
    assert.deepEqual(RUNTIME_ASSET_DIRS, [
      {
        source: path.join('.github', 'frontier', '.frontier', 'runtime', 'templates', 'memories'),
        destination: 'memories',
      },
    ]);

    assert.ok(RUNTIME_DIRS.includes('.frontier/state'));
    assert.ok(RUNTIME_DIRS.includes('.frontier/sessions'));
    assert.ok(RUNTIME_DIRS.includes('docs/execution/plans'));
    assert.ok(RUNTIME_DIRS.includes('docs/execution/progress'));
    assert.ok(RUNTIME_DIRS.includes('docs/artifacts/reviews'));
    assert.ok(RUNTIME_DIRS.includes('docs/artifacts/reviews/findings'));
    assert.ok(RUNTIME_DIRS.includes('docs/artifacts/learnings'));
    assert.ok(RUNTIME_DIRS.includes('memories/session'));
    assert.ok(!RUNTIME_DIRS.includes('docs/guides'));

    assert.ok(!RUNTIME_DIRS.includes('docs/architecture'));
    assert.ok(!RUNTIME_DIRS.includes('.frontier/runtime'));
  });

  it('should seed Copilot-CLI-friendly .github asset trees from the extension bundle', () => {
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ext-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-workspace-'));

    try {
      for (const asset of [...COPILOT_CLI_ASSET_DIRS, ...COPILOT_CLI_SUPPORT_DIRS]) {
        const sourceDir = path.join(extensionRoot, asset.source);
        fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, 'marker.md'), `bundled ${asset.destination}\n`, 'utf8');
      }
      for (const asset of COPILOT_CLI_ASSET_FILES) {
        const sourceFile = path.join(extensionRoot, asset.source);
        fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
        fs.writeFileSync(sourceFile, `bundled ${asset.destination}\n`, 'utf8');
      }

      const customAgentsDir = path.join(workspaceRoot, '.github', 'agents');
      fs.mkdirSync(customAgentsDir, { recursive: true });
      fs.writeFileSync(path.join(customAgentsDir, 'marker.md'), 'user override\n', 'utf8');

      copyCopilotCliAssets(extensionRoot, workspaceRoot, false);

      assert.strictEqual(
        fs.readFileSync(path.join(customAgentsDir, 'marker.md'), 'utf8'),
        'user override\n',
      );

      const seededDirs = [...COPILOT_CLI_ASSET_DIRS, ...COPILOT_CLI_SUPPORT_DIRS]
        .filter((a) => a.destination !== path.join('.github', 'agents'));
      for (const asset of seededDirs) {
        const seeded = path.join(workspaceRoot, asset.destination, 'marker.md');
        assert.ok(fs.existsSync(seeded), `expected ${asset.destination}/marker.md to exist`);
        assert.strictEqual(fs.readFileSync(seeded, 'utf8'), `bundled ${asset.destination}\n`);
      }

      for (const asset of COPILOT_CLI_ASSET_FILES) {
        const seeded = path.join(workspaceRoot, asset.destination);
        assert.ok(fs.existsSync(seeded), `expected ${asset.destination} to exist`);
        assert.strictEqual(fs.readFileSync(seeded, 'utf8'), `bundled ${asset.destination}\n`);
      }
    } finally {
      fs.rmSync(extensionRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should seed every CLI asset from the pristine bundle seed tree', () => {
    const seedPrefix = path.join('.github', 'frontier', 'seed');
    const allAssets = [
      ...COPILOT_CLI_ASSET_DIRS,
      ...COPILOT_CLI_SUPPORT_DIRS,
      ...COPILOT_CLI_ASSET_FILES,
    ];

    assert.ok(allAssets.length > 0);
    for (const asset of allAssets) {
      assert.ok(
        asset.source.startsWith(seedPrefix),
        `${asset.source} must be seeded from the pristine seed tree, not the link-rewritten bundle`,
      );
    }
  });

  it('should never seed host-owned repository files', () => {
    const forbidden = ['workflows', 'ISSUE_TEMPLATE', 'CODEOWNERS', 'PULL_REQUEST_TEMPLATE', 'LICENSE', 'NOTICE'];
    const destinations = [
      ...COPILOT_CLI_ASSET_DIRS,
      ...COPILOT_CLI_SUPPORT_DIRS,
      ...COPILOT_CLI_ASSET_FILES,
    ].map((a) => a.destination);

    for (const name of forbidden) {
      assert.ok(
        !destinations.some((d) => d.split(/[\\/]/).includes(name)),
        `${name} must not be seeded into a user workspace`,
      );
    }
  });

  it('should seed starter memory files without overwriting existing workspace memory', () => {
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ext-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-workspace-'));

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

  it('should write local runtime wrappers that delegate to the installed extension runtime', function () {
    // Spawns bash for syntax validation; process startup on Windows regularly
    // exceeds the default 10s mocha budget.
    this.timeout(120000);
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ext-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-workspace-'));

    try {
      writeWorkspaceRuntimeWrappers(extensionRoot, workspaceRoot);

      const runtimeWrapperDir = path.join(workspaceRoot, '.frontier', 'runtime');
      const powerShellLauncher = fs.readFileSync(path.join(runtimeWrapperDir, 'frontier.ps1'), 'utf8');
      assert.ok(!fs.existsSync(path.join(workspaceRoot, '.agentx')), 'no legacy .agentx wrappers are written');
      const issuePowerShellLauncher = fs.readFileSync(path.join(runtimeWrapperDir, 'local-issue-manager.ps1'), 'utf8');
      const bashLauncher = fs.readFileSync(path.join(runtimeWrapperDir, 'frontier.sh'), 'utf8');
      const issueBashLauncher = fs.readFileSync(path.join(runtimeWrapperDir, 'local-issue-manager.sh'), 'utf8');

      // Single-segment Join-Path keeps the wrapper runnable from Windows PowerShell 5.1.
      assert.ok(powerShellLauncher.includes("(Join-Path $PSScriptRoot '../..')"));
      assert.ok(!powerShellLauncher.includes("'..' '..'"), 'wrapper avoids multi-segment Join-Path');
      assert.ok(powerShellLauncher.includes('$env:FRONTIER_WORKSPACE_ROOT = $workspaceRoot'));
      assert.ok(!powerShellLauncher.includes('AGENTX_WORKSPACE_ROOT'));
      assert.ok(!powerShellLauncher.includes('HVE_EXTENSION_ROOT'));
      assert.ok(powerShellLauncher.includes(extensionRoot));
      assert.ok(powerShellLauncher.includes(path.join('.github', 'frontier', '.frontier', 'runtime', 'frontier.ps1')));
      assert.ok(
        powerShellLauncher.indexOf("Get-ChildItem -Path $searchRoot") <
          powerShellLauncher.indexOf(`'${extensionRoot.replace(/'/g, "''")}'`),
      );
      assert.ok(powerShellLauncher.includes('| Sort-Object Version -Descending'));

      assert.ok(issuePowerShellLauncher.includes(path.join('.github', 'frontier', '.frontier', 'runtime', 'local-issue-manager.ps1')));

      assert.ok(bashLauncher.includes('dirname "${BASH_SOURCE[0]}")/../..'));
      assert.ok(bashLauncher.includes('export FRONTIER_WORKSPACE_ROOT="$workspace_root"'));
      assert.ok(!bashLauncher.includes('AGENTX_WORKSPACE_ROOT'));
      assert.ok(!bashLauncher.includes('HVE_EXTENSION_ROOT'));
      assert.ok(bashLauncher.includes(extensionRoot.replace(/\\/g, '/')));
      assert.ok(bashLauncher.includes('.github/frontier/.frontier/runtime/frontier.sh'));
      assert.ok(
        bashLauncher.indexOf("find \"$search_root\"") <
          bashLauncher.indexOf(`candidate='${extensionRoot.replace(/\\/g, '/').replace(/'/g, `'"'"'`)}'`),
      );
      assert.ok(bashLauncher.includes("sort -t $'\\t' -k1,1r"));
      execFileSync('bash', ['-n'], { input: bashLauncher });

      assert.ok(issueBashLauncher.includes('.github/frontier/.frontier/runtime/local-issue-manager.sh'));
    } finally {
      fs.rmSync(extensionRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should execute the newest installed runtime across VS Code channels', function () {
    // Spawns pwsh/bash twice; process startup on Windows regularly exceeds the
    // default 10s mocha budget.
    this.timeout(120000);
    const homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-home-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-workspace-'));
    const preferredExtensionRoot = path.join(homeRoot, 'preferred', 'jnpiyush.agentx-9.8.0');
    const overrideExtensionRoot = path.join(homeRoot, 'override', 'jnpiyush.agentx-9.7.0');
    const outputPath = path.join(homeRoot, 'selected-runtime.txt');

    const createRuntime = (extensionRoot: string, version: string): void => {
      const runtimeDirectory = path.join(extensionRoot, '.github', 'frontier', '.frontier', 'runtime');
      fs.mkdirSync(runtimeDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(runtimeDirectory, 'frontier.ps1'),
        `param([string]$OutputPath)\nSet-Content -LiteralPath $OutputPath -Value '${version}' -NoNewline\n`,
        'utf8',
      );
      fs.writeFileSync(
        path.join(runtimeDirectory, 'frontier.sh'),
        `#!/usr/bin/env bash\nprintf '%s' '${version}' > "$1"\n`,
        { encoding: 'utf8', mode: 0o755 },
      );
    };

    try {
      createRuntime(path.join(homeRoot, '.vscode', 'extensions', 'jnpiyush.agentx-9.9.0'), '9.9.0');
      createRuntime(path.join(homeRoot, '.vscode-insiders', 'extensions', 'jnpiyush.agentx-9.10.0'), '9.10.0');
      createRuntime(preferredExtensionRoot, '9.8.0');
      createRuntime(overrideExtensionRoot, '9.7.0');
      writeWorkspaceRuntimeWrappers(preferredExtensionRoot, workspaceRoot);

      const baseEnvironment = {
        ...process.env,
        HOME: homeRoot,
        USERPROFILE: homeRoot,
      };
      const launcherPath = path.join(
        workspaceRoot,
        '.frontier',
        'runtime',
        process.platform === 'win32' ? 'frontier.ps1' : 'frontier.sh',
      );
      const command = process.platform === 'win32' ? 'pwsh' : 'bash';
      const commandArguments = process.platform === 'win32'
        ? ['-NoProfile', '-File', launcherPath, outputPath]
        : [launcherPath, outputPath];

      execFileSync(command, commandArguments, {
        env: baseEnvironment,
      });
      assert.equal(fs.readFileSync(outputPath, 'utf8'), '9.10.0');

      execFileSync(command, commandArguments, {
        env: {
          ...baseEnvironment,
          FRONTIER_EXTENSION_ROOT: overrideExtensionRoot,
        },
      });
      assert.equal(fs.readFileSync(outputPath, 'utf8'), '9.7.0');
    } finally {
      fs.rmSync(homeRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should create runtime wrappers during local runtime initialization', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-workspace-'));
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-ext-'));
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, task) => task({ report: () => undefined }, {} as never));

    const commandAgentx = {
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: false,
      workspaceRoot: undefined,
      firstWorkspaceFolder: undefined,
    } as unknown as FrontierContext;

    (vscode.workspace as any).workspaceFolders = [
      { name: 'workspace', uri: vscode.Uri.file(workspaceRoot), index: 0 },
    ];

    try {
      await runInitializeLocalRuntimeCommand(
        {
          ...fakeContext,
          extensionUri: vscode.Uri.file(extensionRoot),
          extension: { packageJSON: { version: '8.4.7' } },
        } as vscode.ExtensionContext,
        commandAgentx,
      );

      for (const wrapper of ['frontier.ps1', 'local-issue-manager.ps1', 'frontier.sh', 'local-issue-manager.sh']) {
        assert.ok(fs.existsSync(path.join(workspaceRoot, '.frontier', 'runtime', wrapper)), `${wrapper} wrapper exists`);
      }
      assert.ok(!fs.existsSync(path.join(workspaceRoot, '.agentx')), 'initialization does not create .agentx');
      const versionStamp = JSON.parse(
        fs.readFileSync(path.join(workspaceRoot, '.frontier', 'version.json'), 'utf8'),
      ) as Record<string, unknown>;
      assert.deepEqual(Object.keys(versionStamp).sort(), ['installedAt', 'updatedAt', 'version']);
      assert.equal(versionStamp.version, '8.4.7');
      sinon.assert.calledWith(infoStub, 'Frontier: Local runtime initialized.');
      assert.ok(executeCommandStub.calledWith('frontier.refresh'));
    } finally {
      fs.rmSync(extensionRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
