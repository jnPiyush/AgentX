import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddPluginCommand } from '../../commands/plugins';
import {
  getPublishedPluginSummaryOrThrow,
  getLocalPluginPicks,
  getRegistryPluginPicks,
  resolvePluginDirectoryFromArtifact,
  runAddPluginCommand,
  selectCatalogPicks,
} from '../../commands/pluginsCommandInternals';
import { computeFileChecksum, verifyFileChecksum } from '../../utils/pluginIntegrity';
import {
  appendPluginInstallRecord,
  buildPermissionFingerprint,
  getLatestPluginInstallRecord,
  readPluginInstallAuditState,
} from '../../utils/pluginInstallState';

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

describe('pluginsCommandInternals helpers', () => {
  let sandbox: sinon.SinonSandbox;
  let tempRoot: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-plugins-'));
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('prefers registry picks when compatible published entries exist', async () => {
    const selection = await selectCatalogPicks(
      async () => [{
        sourceKind: 'registry',
        pluginId: 'convert-docs',
        qualifiedId: 'jnpiyush.convert-docs',
        publisher: 'jnpiyush',
        version: '1.0.0',
        label: 'Convert Docs',
        description: 'Docs plugin v1.0.0 | registry',
        artifactUrl: 'https://example.test/plugin.zip',
        targetDirName: 'convert-docs',
      }],
      async () => [{
        sourceKind: 'local',
        pluginId: 'fallback',
        qualifiedId: 'fallback',
        version: '0.1.0',
        label: 'Fallback',
        description: 'Archive fallback',
        pluginDir: 'C:/tmp/fallback',
        targetDirName: 'fallback',
      }],
    );

    assert.equal(selection.source, 'registry');
    assert.equal(selection.picks.length, 1);
    assert.equal(selection.picks[0].sourceKind, 'registry');
  });

  it('falls back to the archive catalog when the registry returns no compatible picks', async () => {
    const selection = await selectCatalogPicks(
      async () => [],
      async () => [{
        sourceKind: 'local',
        pluginId: 'fallback',
        qualifiedId: 'fallback',
        version: '0.1.0',
        label: 'Fallback',
        description: 'Archive fallback',
        pluginDir: 'C:/tmp/fallback',
        targetDirName: 'fallback',
      }],
    );

    assert.equal(selection.source, 'archive');
    assert.equal(selection.picks.length, 1);
    assert.equal(selection.picks[0].sourceKind, 'local');
  });

  it('falls back to the archive catalog when the registry is unavailable', async () => {
    const selection = await selectCatalogPicks(
      async () => { throw new Error('network failed'); },
      async () => [{
        sourceKind: 'local',
        pluginId: 'fallback',
        qualifiedId: 'fallback',
        version: '0.1.0',
        label: 'Fallback',
        description: 'Archive fallback',
        pluginDir: 'C:/tmp/fallback',
        targetDirName: 'fallback',
      }],
    );

    assert.equal(selection.source, 'archive');
    assert.equal(selection.picks.length, 1);
    assert.equal(selection.picks[0].sourceKind, 'local');
  });

  it('filters registry entries to the latest compatible release', () => {
    const picks = getRegistryPluginPicks({
      schemaVersion: 1,
      plugins: [
        {
          publisher: 'jnpiyush',
          pluginId: 'convert-docs',
          displayName: 'Convert Docs',
          description: 'Docs plugin',
          releases: [
            {
              version: '2.0.0',
              artifactUrl: 'https://example.test/2.0.0.zip',
              engines: { agentx: '>=9.0.0 <10.0.0' },
            },
            {
              version: '1.0.0',
              artifactUrl: 'https://example.test/1.0.0.zip',
              checksum: 'sha256:abc123',
              pluginPath: '.agentx/plugins/convert-docs',
              engines: { agentx: '^8.4.0' },
            },
          ],
        },
      ],
    }, '8.4.5');

    assert.equal(picks.length, 1);
    assert.equal(picks[0].sourceKind, 'registry');
    assert.equal(picks[0].artifactUrl, 'https://example.test/1.0.0.zip');
    assert.equal(picks[0].checksum, 'sha256:abc123');
    assert.equal(picks[0].pluginPath, '.agentx/plugins/convert-docs');
  });

  it('validates published plugin identity against the registry entry', () => {
    const summary = getPublishedPluginSummaryOrThrow({
      schemaVersion: 2,
      name: 'convert-docs',
      id: 'convert-docs',
      publisher: 'jnpiyush',
      displayName: 'Convert Docs',
      version: '1.0.0',
      description: 'Docs plugin',
      type: 'tool',
      capabilities: ['tool'],
      entry: { pwsh: 'convert-docs.ps1' },
    }, {
      sourceKind: 'registry',
      pluginId: 'convert-docs',
      qualifiedId: 'jnpiyush.convert-docs',
      publisher: 'jnpiyush',
      version: '1.0.0',
      label: 'Convert Docs',
      description: 'Docs plugin v1.0.0 | registry',
      artifactUrl: 'https://example.test/convert-docs-1.0.0.zip',
      targetDirName: 'convert-docs',
    });

    assert.equal(summary.qualifiedId, 'jnpiyush.convert-docs');
  });

  it('rejects published plugin artifacts whose identity does not match the registry entry', () => {
    assert.throws(() => getPublishedPluginSummaryOrThrow({
      schemaVersion: 2,
      name: 'convert-docs',
      id: 'convert-docs',
      publisher: 'jnpiyush',
      displayName: 'Convert Docs',
      version: '1.0.0',
      description: 'Docs plugin',
      type: 'tool',
      capabilities: ['tool'],
      entry: { pwsh: 'convert-docs.ps1' },
    }, {
      sourceKind: 'registry',
      pluginId: 'convert-docs',
      qualifiedId: 'agentx.convert-docs',
      publisher: 'agentx',
      version: '1.0.0',
      label: 'Convert Docs',
      description: 'Docs plugin v1.0.0 | registry',
      artifactUrl: 'https://example.test/convert-docs-1.0.0.zip',
      targetDirName: 'convert-docs',
    }), /publisher mismatch/i);
  });

  it('resolves a plugin directory from an extracted artifact path hint', () => {
    const archiveRoot = path.join(tempRoot, 'AgentX-master');
    const pluginDir = path.join(archiveRoot, '.agentx', 'plugins', 'convert-docs');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      name: 'convert-docs',
      version: '1.0.0',
      description: 'Docs plugin',
      type: 'tool',
      entry: { pwsh: 'convert-docs.ps1' },
    }), 'utf-8');

    const resolved = resolvePluginDirectoryFromArtifact(tempRoot, '.agentx/plugins/convert-docs');
    assert.equal(resolved, pluginDir);
  });

  it('supports published plugin artifacts with plugin.json at the archive root', () => {
    fs.writeFileSync(path.join(tempRoot, 'plugin.json'), JSON.stringify({
      name: 'convert-docs',
      version: '1.0.0',
      description: 'Docs plugin',
      type: 'tool',
      entry: { pwsh: 'convert-docs.ps1' },
    }), 'utf-8');

    const resolved = resolvePluginDirectoryFromArtifact(tempRoot);
    assert.equal(resolved, tempRoot);
  });

  it('reads local plugin picks with stable identifiers', () => {
    const pluginDir = path.join(tempRoot, 'convert-docs');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      schemaVersion: 2,
      name: 'convert-docs',
      id: 'convert-docs',
      publisher: 'jnpiyush',
      displayName: 'Convert Docs',
      version: '1.0.0',
      description: 'Docs plugin',
      type: 'tool',
      capabilities: ['tool'],
      entry: { pwsh: 'convert-docs.ps1' },
    }), 'utf-8');

    const picks = getLocalPluginPicks(tempRoot);
    assert.equal(picks[0].qualifiedId, 'jnpiyush.convert-docs');
    assert.equal(picks[0].pluginId, 'convert-docs');
  });

  it('verifies plugin artifact checksums', () => {
    const filePath = path.join(tempRoot, 'artifact.zip');
    fs.writeFileSync(filePath, 'plugin artifact', 'utf-8');
    const checksum = `sha256:${computeFileChecksum(filePath, 'sha256')}`;

    const verification = verifyFileChecksum(filePath, checksum);
    assert.equal(verification.matches, true);
    assert.equal(verification.algorithm, 'sha256');
  });

  it('records plugin install audit history', () => {
    const manifest = {
      schemaVersion: 2,
      name: 'convert-docs',
      id: 'convert-docs',
      publisher: 'jnpiyush',
      displayName: 'Convert Docs',
      version: '1.0.0',
      description: 'Docs plugin',
      type: 'tool',
      capabilities: ['tool'],
      requires: ['pandoc'],
      permissions: {
        filesystem: 'read-write',
        process: 'allowlist',
      },
      entry: { pwsh: 'convert-docs.ps1' },
    } as const;

    appendPluginInstallRecord(tempRoot, {
      qualifiedId: 'jnpiyush.convert-docs',
      pluginId: 'convert-docs',
      publisher: 'jnpiyush',
      displayName: 'Convert Docs',
      version: '1.0.0',
      sourceKind: 'registry',
      installedAt: '2026-03-19T03:00:00Z',
      installedByExtensionVersion: '8.4.5',
      hostVersion: '8.4.5',
      installPath: path.join(tempRoot, '.agentx', 'plugins', 'convert-docs'),
      targetDirName: 'convert-docs',
      artifactUrl: 'https://example.test/convert-docs-1.0.0.zip',
      artifactChecksum: 'sha256:abc123',
      checksumVerified: true,
      sourceRepository: 'https://github.com/jnPiyush/agentx-plugin-convert-docs',
      capabilities: manifest.capabilities,
      requires: manifest.requires,
      permissions: manifest.permissions,
      trustDecision: {
        kind: 'approved',
        prompted: true,
        reason: 'first-install',
        approvedAt: '2026-03-19T03:00:00Z',
        permissionFingerprint: buildPermissionFingerprint(manifest),
      },
    });

    const state = readPluginInstallAuditState(tempRoot);
    assert.equal(state.installs.length, 1);
    assert.equal(getLatestPluginInstallRecord(state, 'jnpiyush.convert-docs')?.checksumVerified, true);
  });
});
