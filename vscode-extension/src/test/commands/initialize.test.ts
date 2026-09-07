import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
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
  writeWorkspaceRuntimeWrappers,
} from '../../commands/initializeInternals';
import { readJsonWithComments } from '../../commands/initializeWorkspaceHelpers';
import { AgentXContext } from '../../agentxContext';
import { __setWorkspaceFoldersRaw } from '../mocks/vscode';

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
    __setWorkspaceFoldersRaw(originalWorkspaceFolders);
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
    __setWorkspaceFoldersRaw(undefined);
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();
    assert.ok(errSpy.calledOnce);
    assert.ok(String(errSpy.firstCall.args[0]).includes('Open a workspace'));
  });

  it('should show error when no workspace folders (legacy mode)', async () => {
    __setWorkspaceFoldersRaw(undefined);
    const errSpy = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback({ legacy: true });
    assert.ok(errSpy.calledOnce);
  });

  it('should show error for empty workspace folders array', async () => {
    __setWorkspaceFoldersRaw([]);
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
    __setWorkspaceFoldersRaw(originalWorkspaceFolders);
    sandbox.restore();
  });

  it('should show an error and return when no workspace folders are open', async () => {
    __setWorkspaceFoldersRaw(undefined);
    const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');

    await runInitializeLocalRuntimeCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    sinon.assert.calledOnce(errorStub);
    assert.ok(String(errorStub.firstCall.args[0]).includes('Open a workspace folder first'));
  });

  it('should read JSON-with-comments config without stripping string content', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-json-comments-'));
    const filePath = path.join(tempDir, 'config.json');

    try {
      fs.writeFileSync(filePath, [
        '{',
        '  // top-level comment',
        '  "url": "https://example.test//keep",',
        '  /* inline block comment */',
        '  "nested": {',
        '    "value": 1',
        '  }',
        '}',
      ].join('\n'), 'utf8');

      assert.deepEqual(readJsonWithComments<{
        url: string;
        nested: { value: number };
      }>(filePath), {
        url: 'https://example.test//keep',
        nested: { value: 1 },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

  it('should seed Copilot-CLI-friendly .github asset trees from the extension bundle', () => {
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ext-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-workspace-'));

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
    const seedPrefix = path.join('.github', 'agentx', 'seed');
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

  it('should write local runtime wrappers that delegate to the installed extension runtime', function () {
    // Spawns bash for syntax validation; process startup on Windows regularly
    // exceeds the default 10s mocha budget.
    this.timeout(120000);
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ext-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-workspace-'));

    try {
      writeWorkspaceRuntimeWrappers(extensionRoot, workspaceRoot);

      const powerShellLauncher = fs.readFileSync(path.join(workspaceRoot, '.agentx', 'agentx.ps1'), 'utf8');
      const issuePowerShellLauncher = fs.readFileSync(path.join(workspaceRoot, '.agentx', 'local-issue-manager.ps1'), 'utf8');
      const bashLauncher = fs.readFileSync(path.join(workspaceRoot, '.agentx', 'agentx.sh'), 'utf8');
      const issueBashLauncher = fs.readFileSync(path.join(workspaceRoot, '.agentx', 'local-issue-manager.sh'), 'utf8');

      assert.ok(powerShellLauncher.includes('$env:AGENTX_WORKSPACE_ROOT = $workspaceRoot'));
      assert.ok(powerShellLauncher.includes(extensionRoot));
      assert.ok(powerShellLauncher.includes(path.join('.github', 'agentx', '.agentx', 'agentx.ps1')));
      assert.ok(
        powerShellLauncher.indexOf("Get-ChildItem -Path $searchRoot") <
          powerShellLauncher.indexOf(`'${extensionRoot.replace(/'/g, "''")}'`),
      );
      assert.ok(powerShellLauncher.includes('| Sort-Object Version -Descending'));

      assert.ok(issuePowerShellLauncher.includes(path.join('.github', 'agentx', '.agentx', 'local-issue-manager.ps1')));

      assert.ok(bashLauncher.includes('export AGENTX_WORKSPACE_ROOT="$workspace_root"'));
      assert.ok(bashLauncher.includes(extensionRoot.replace(/\\/g, '/')));
      assert.ok(bashLauncher.includes('.github/agentx/.agentx/agentx.sh'));
      assert.ok(
        bashLauncher.indexOf("find \"$search_root\"") <
          bashLauncher.indexOf(`candidate='${extensionRoot.replace(/\\/g, '/').replace(/'/g, `'"'"'`)}'`),
      );
      assert.ok(bashLauncher.includes("sort -t $'\\t' -k1,1r"));
      execFileSync('bash', ['-n'], { input: bashLauncher });

      assert.ok(issueBashLauncher.includes('.github/agentx/.agentx/local-issue-manager.sh'));
    } finally {
      fs.rmSync(extensionRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should execute the newest installed runtime across VS Code channels', function () {
    // Spawns pwsh/bash twice; process startup on Windows regularly exceeds the
    // default 10s mocha budget.
    this.timeout(120000);
    const homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-home-'));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-workspace-'));
    const preferredExtensionRoot = path.join(homeRoot, 'preferred', 'jnpiyush.agentx-9.8.0');
    const overrideExtensionRoot = path.join(homeRoot, 'override', 'jnpiyush.agentx-9.7.0');
    const outputPath = path.join(homeRoot, 'selected-runtime.txt');

    const createRuntime = (extensionRoot: string, version: string): void => {
      const runtimeDirectory = path.join(extensionRoot, '.github', 'agentx', '.agentx');
      fs.mkdirSync(runtimeDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(runtimeDirectory, 'agentx.ps1'),
        `param([string]$OutputPath)\nSet-Content -LiteralPath $OutputPath -Value '${version}' -NoNewline\n`,
        'utf8',
      );
      fs.writeFileSync(
        path.join(runtimeDirectory, 'agentx.sh'),
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
        '.agentx',
        process.platform === 'win32' ? 'agentx.ps1' : 'agentx.sh',
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
          AGENTX_EXTENSION_ROOT: overrideExtensionRoot,
        },
      });
      assert.equal(fs.readFileSync(outputPath, 'utf8'), '9.7.0');
    } finally {
      fs.rmSync(homeRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should create runtime wrappers during local runtime initialization', async function () {
    this.timeout(10_000);
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-workspace-'));
    const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ext-'));
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, task) => task({ report: () => undefined }, {} as never));

    const commandAgentx = {
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: false,
      workspaceRoot: undefined,
      firstWorkspaceFolder: undefined,
    } as unknown as AgentXContext;

    __setWorkspaceFoldersRaw([
      { name: 'workspace', uri: vscode.Uri.file(workspaceRoot), index: 0 },
    ]);

    try {
      await runInitializeLocalRuntimeCommand(
        {
          ...fakeContext,
          extensionUri: vscode.Uri.file(extensionRoot),
          extension: { packageJSON: { version: '8.4.7' } },
        } as vscode.ExtensionContext,
        commandAgentx,
      );

      assert.ok(fs.existsSync(path.join(workspaceRoot, '.agentx', 'agentx.ps1')));
      assert.ok(fs.existsSync(path.join(workspaceRoot, '.agentx', 'local-issue-manager.ps1')));
      assert.ok(fs.existsSync(path.join(workspaceRoot, '.agentx', 'agentx.sh')));
      assert.ok(fs.existsSync(path.join(workspaceRoot, '.agentx', 'local-issue-manager.sh')));
      const versionStamp = JSON.parse(
        fs.readFileSync(path.join(workspaceRoot, '.agentx', 'version.json'), 'utf8'),
      ) as Record<string, unknown>;
      assert.deepEqual(Object.keys(versionStamp).sort(), ['installedAt', 'updatedAt', 'version']);
      assert.equal(versionStamp.version, '8.4.7');
      sinon.assert.calledWith(infoStub, 'AgentX: Local runtime initialized.');
      assert.ok(executeCommandStub.calledWith('agentx.refresh'));
    } finally {
      fs.rmSync(extensionRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
