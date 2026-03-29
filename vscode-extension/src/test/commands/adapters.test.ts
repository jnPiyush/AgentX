import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddRemoteAdapterCommand } from '../../commands/adapters';
import { syncDetectedAdoAdapter, syncDetectedGitHubAdapter } from '../../commands/adaptersCommandInternals';

describe('registerAddRemoteAdapterCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;
    fakeAgentx = {} as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => { /* noop */ } }),
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.addRemoteAdapter command', () => {
    registerAddRemoteAdapterCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addRemoteAdapter'),
    );
  });
});

describe('syncDetectedGitHubAdapter', () => {
  let sandbox: sinon.SinonSandbox;
  let tempRoot: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-adapter-sync-'));
    fs.mkdirSync(path.join(tempRoot, '.agentx'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, '.agentx', 'config.json'),
      JSON.stringify({ provider: 'local', integration: 'local', mode: 'local', created: '2026-03-17T00:00:00.000Z' }, null, 2),
    );

    sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    sandbox.stub(vscode.window, 'showInformationMessage');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    sandbox.restore();
  });

  it('adds a GitHub adapter from the detected origin remote and switches active mode to GitHub', async () => {
    const shell = await import('../../utils/shell');
    sandbox.stub(shell, 'execShell').resolves('https://github.com/octo-org/octo-repo.git');

    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: true,
      adoConnected: false,
    } as unknown as AgentXContext;

    const changed = await syncDetectedGitHubAdapter(fakeAgentx);

    assert.equal(changed, true);

    const config = JSON.parse(fs.readFileSync(path.join(tempRoot, '.agentx', 'config.json'), 'utf-8'));
    assert.equal(config.provider, 'github');
    assert.equal(config.integration, 'github');
    assert.equal(config.mode, 'github');
    assert.equal(config.repo, 'octo-org/octo-repo');
    assert.equal(config.adapters.github.repo, 'octo-org/octo-repo');

    const mcpConfig = JSON.parse(fs.readFileSync(path.join(tempRoot, '.vscode', 'mcp.json'), 'utf-8'));
    assert.deepEqual(mcpConfig.servers.github, {
      type: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
    });
  });

  it('does nothing when the workspace has no GitHub origin remote', async () => {
    const shell = await import('../../utils/shell');
    sandbox.stub(shell, 'execShell').rejects(new Error('no remote'));

    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: false,
    } as unknown as AgentXContext;

    const changed = await syncDetectedGitHubAdapter(fakeAgentx);

    assert.equal(changed, false);
    assert.equal(fs.existsSync(path.join(tempRoot, '.vscode', 'mcp.json')), false);
  });
});

describe('syncDetectedAdoAdapter', () => {
  let sandbox: sinon.SinonSandbox;
  let tempRoot: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ado-sync-'));
    fs.mkdirSync(path.join(tempRoot, '.agentx'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, '.agentx', 'config.json'),
      JSON.stringify({ provider: 'local', integration: 'local', mode: 'local', created: '2026-03-17T00:00:00.000Z' }, null, 2),
    );

    sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    sandbox.stub(vscode.window, 'showInformationMessage');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    sandbox.restore();
  });

  it('adds an Azure DevOps adapter from a detected dev.azure.com origin and switches active mode to ADO', async () => {
    const shell = await import('../../utils/shell');
    sandbox.stub(shell, 'execShell').resolves('https://dev.azure.com/octo-org/OctoProject/_git/OctoRepo');

    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: true,
    } as unknown as AgentXContext;

    const changed = await syncDetectedAdoAdapter(fakeAgentx);

    assert.equal(changed, true);

    const config = JSON.parse(fs.readFileSync(path.join(tempRoot, '.agentx', 'config.json'), 'utf-8'));
    assert.equal(config.provider, 'ado');
    assert.equal(config.integration, 'ado');
    assert.equal(config.mode, 'ado');
    assert.equal(config.organization, 'octo-org');
    assert.equal(config.project, 'OctoProject');
    assert.equal(config.adapters.ado.organization, 'octo-org');
    assert.equal(config.adapters.ado.project, 'OctoProject');
    assert.equal(fs.existsSync(path.join(tempRoot, '.vscode', 'mcp.json')), false);
  });

  it('adds an Azure DevOps adapter from a detected ssh.dev.azure.com origin', async () => {
    const shell = await import('../../utils/shell');
    sandbox.stub(shell, 'execShell').resolves('git@ssh.dev.azure.com:v3/octo-org/OctoProject/OctoRepo');

    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: true,
    } as unknown as AgentXContext;

    const changed = await syncDetectedAdoAdapter(fakeAgentx);

    assert.equal(changed, true);

    const config = JSON.parse(fs.readFileSync(path.join(tempRoot, '.agentx', 'config.json'), 'utf-8'));
    assert.equal(config.adapters.ado.organization, 'octo-org');
    assert.equal(config.adapters.ado.project, 'OctoProject');
  });

  it('does nothing when the workspace has no Azure DevOps origin remote', async () => {
    const shell = await import('../../utils/shell');
    sandbox.stub(shell, 'execShell').resolves('https://github.com/octo-org/octo-repo.git');

    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: false,
    } as unknown as AgentXContext;

    const changed = await syncDetectedAdoAdapter(fakeAgentx);

    assert.equal(changed, false);
    assert.equal(fs.existsSync(path.join(tempRoot, '.vscode', 'mcp.json')), false);
  });
});