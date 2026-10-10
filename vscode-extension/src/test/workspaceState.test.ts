import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { WorkspaceState } from '../workspaceState';
import { registerFrontierMcp } from '../runtime/mcpProvider';
import { registerPolicyHookEnvironment } from '../runtime/policyHooks';
import { resolveFrontierStateDirectory } from '../utils/frontierPaths';
import { resolveAgentDefinitionPath } from '../frontierContextInternals';
import {
  canonicalWorkspaceRoot, privateWorkspacePath, provisionWorkspace,
  readWorkspaceBinding, workspaceIdentity, containsWorkspacePath,
} from '../utils/workspaceProfiles';
import * as shell from '../utils/shell';
import { parseConfigurationJson } from '../utils/configurationJson';
import { __clearConfig, __setConfig, __setWorkspaceFolders, env, window, workspace } from './mocks/vscode';

function memento(): vscode.Memento {
  const values = new Map<string, unknown>();
  function get<T>(key: string): T | undefined;
  function get<T>(key: string, fallback: T): T;
  function get<T>(key: string, fallback?: T): T | undefined {
    return values.has(key) ? values.get(key) as T : fallback;
  }
  return { keys: () => [...values.keys()], get, update: async (key, value) => {
    if (value === undefined) { values.delete(key); } else { values.set(key, value); }
  } };
}

function extensionContext(base: string): vscode.ExtensionContext {
  const bundle = path.join(base, 'bundle');
  const runtime = path.join(bundle, '.github', 'frontier', '.frontier', 'runtime');
  fs.mkdirSync(path.join(runtime, 'mcp-server'), { recursive: true });
  fs.writeFileSync(path.join(runtime, 'frontier.ps1'), '# fixture launcher');
  fs.writeFileSync(path.join(runtime, 'frontier.sh'), '# fixture launcher');
  fs.writeFileSync(path.join(runtime, 'mcp-server', 'index.js'), '// fixture server');
  const metadata: Partial<vscode.ExtensionContext> = {
    extensionPath: bundle, extensionUri: vscode.Uri.file(bundle),
    globalStorageUri: vscode.Uri.file(path.join(base, 'storage')), subscriptions: [],
    workspaceState: memento(), globalState: { ...memento(), setKeysForSync: () => {} },
    extension: {
      id: 'fixture.frontier', extensionPath: bundle, extensionUri: vscode.Uri.file(bundle),
      packageJSON: { version: '9.7.0' }, isActive: true, exports: {}, activate: async () => ({}),
      extensionKind: vscode.ExtensionKind.Workspace,
    },
  };
  return metadata as vscode.ExtensionContext;
}

describe('Automatic Frontier workspace state', () => {
  let base: string;
  let root: string;
  let context: vscode.ExtensionContext;
  let frontier: FrontierContext;

  beforeEach(() => {
    base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-auto-workspace-')));
    root = path.join(base, 'source');
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'source.txt'), 'source bytes\n');
    root = canonicalWorkspaceRoot(root);
    context = extensionContext(base);
    __clearConfig();
    __setWorkspaceFolders([{ path: root }]);
    workspace.isTrusted = true;
    env.remoteName = undefined;
    window.activeTextEditor = undefined;
    frontier = new FrontierContext(context);
  });

  afterEach(() => {
    for (const disposable of context.subscriptions) { disposable.dispose(); }
    sinon.restore();
    __clearConfig();
    __setWorkspaceFolders(undefined);
    workspace.isTrusted = true;
    env.remoteName = undefined;
    window.activeTextEditor = undefined;
    fs.rmSync(base, { recursive: true, force: true });
  });

  function confirmPrivateRuntime(): sinon.SinonStub {
    return sinon.stub(shell, 'execShell').callsFake(async (_command, target, _shell, env) =>
      JSON.stringify({
        storageMode: 'private', workspaceRoot: target,
        stateRoot: env?.FRONTIER_STATE_ROOT, authority: env?.FRONTIER_STATE_AUTHORITY ?? '',
      }));
  }

  it('keeps passive readiness free of source writes, profiles, scans and CLI calls', async () => {
    const execute = sinon.stub(shell, 'execShell');
    assert.equal(frontier.workspaceRoot, root);
    assert.equal(await frontier.checkInitialized(), true);
    assert.equal(frontier.hasCliRuntime(), false);
    assert.deepEqual(fs.readdirSync(root), ['source.txt']);
    assert.equal(fs.existsSync(context.globalStorageUri.fsPath), false);
    sinon.assert.notCalled(execute);
  });

  it('refreshes sidebar providers only when the selected workspace changes', async () => {
    const { activate } = await import('../extension');
    const registry = await import('../commands/registry');
    const views = await import('../views/registry');
    const mcp = await import('../runtime/mcpProvider');
    const capability = await import('../utils/hostCapability');
    const companions = await import('../utils/companionExtensions');
    const agentsWindow = await import('../utils/agentsWindowOptIn');
    sinon.stub(registry, 'registerFrontierCommands');
    sinon.stub(views, 'registerSidebarProviders');
    const refresh = sinon.stub(views, 'refreshSidebarProviders');
    sinon.stub(mcp, 'registerFrontierMcp');
    sinon.stub(capability, 'warnIfHostUnsupported').resolves();
    sinon.stub(companions, 'checkCompanionExtensions').resolves();
    sinon.stub(agentsWindow, 'maybePromptForAgentsWindow').resolves();
    const callbacks: Array<(editor: vscode.TextEditor | undefined) => unknown> = [];
    sinon.stub(vscode.window, 'onDidChangeActiveTextEditor').callsFake(callback => {
      callbacks.push(callback);
      return { dispose: () => {} };
    });
    const execute = sinon.stub(shell, 'execShell');
    const clock = sinon.useFakeTimers();
    activate(context);
    await clock.tickAsync(700);
    window.activeTextEditor = { document: { uri: vscode.Uri.file(path.join(root, 'one.ts')) } };
    for (const callback of callbacks) { callback(undefined); }
    await clock.tickAsync(700);
    window.activeTextEditor = { document: { uri: vscode.Uri.file(path.join(root, 'two.ts')) } };
    for (const callback of callbacks) { callback(undefined); }
    await clock.tickAsync(700);
    sinon.assert.notCalled(refresh);
    sinon.assert.notCalled(execute);
    const second = path.join(base, 'second');
    fs.mkdirSync(second);
    __setWorkspaceFolders([{ path: root }, { path: second }]);
    window.activeTextEditor = { document: { uri: vscode.Uri.file(path.join(second, 'file.ts')) } };
    for (const callback of callbacks) { callback(undefined); }
    await clock.tickAsync(700);
    sinon.assert.calledOnce(refresh);
  });

  it('provisions on first explicit use and verifies the runtime binding before tasks', async () => {
    const execute = confirmPrivateRuntime();
    const ready = await frontier.ensureWorkspaceReady();
    const binding = frontier.workspaceState.inspect(root)!;
    assert.equal(ready, root);
    assert.equal(binding.mode, 'private');
    assert.equal(binding.stateRoot, privateWorkspacePath(context.globalStorageUri.fsPath, root, ''));
    assert.equal(resolveFrontierStateDirectory(root), binding.stateRoot);
    assert.deepEqual(fs.readdirSync(root), ['source.txt']);
    assert.equal(fs.readFileSync(path.join(root, 'source.txt'), 'utf8'), 'source bytes\n');
    assert.equal(fs.existsSync(path.join(binding.stateRoot, 'state', 'repo-context')), false);
    await frontier.forWorkspace(root).ensureWorkspaceReady();
    sinon.assert.calledOnce(execute);
    assert.ok(execute.firstCall.args[0].includes('workspace-state'));
  });

  it('refuses an old runtime that does not confirm the selected private state', async () => {
    sinon.stub(shell, 'execShell').resolves(JSON.stringify({ storageMode: 'repository', workspaceRoot: root }));
    const stream = sinon.stub(shell, 'execShellStreaming');
    await assert.rejects(frontier.runCliStreaming('run', ['engineer', 'task']), /did not confirm/);
    sinon.assert.notCalled(stream);
    assert.deepEqual(fs.readdirSync(root), ['source.txt']);
  });

  it('preserves existing repository configuration and makes its selection sticky', () => {
    fs.mkdirSync(path.join(root, '.frontier'));
    const config = path.join(root, '.frontier', 'config.json');
    const content = '{"provider":"local","enforceIssues":true,"custom":{"retain":1}}';
    fs.writeFileSync(config, content);
    const state = new WorkspaceState(context);
    state.ensure(root);
    assert.equal(state.inspect(root)?.mode, 'repository');
    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.frontier'));
    assert.equal(fs.readFileSync(config, 'utf8'), content);
    fs.unlinkSync(config);
    assert.throws(() => state.ensure(root), /Repository-managed Frontier state was removed/);
  });

  it('preserves commented configuration and does not reset an invalid existing config', () => {
    assert.throws(() => parseConfigurationJson('{"project":1/* comment */2}'), SyntaxError);
    assert.throws(() => parseConfigurationJson('{}/* unfinished'), SyntaxError);
    assert.deepEqual(parseConfigurationJson('{"url":"https://example.invalid/a/*b*/"}'),
      { url: 'https://example.invalid/a/*b*/' });
    fs.mkdirSync(path.join(root, '.frontier'));
    const filename = path.join(root, '.frontier', 'config.json');
    const content = '{ "provider": "local", /* keep this note */ "enforceIssues": true }';
    fs.writeFileSync(filename, content);
    frontier.workspaceState.ensure(root);
    assert.equal(fs.readFileSync(filename, 'utf8'), content);
    fs.writeFileSync(filename, '{ invalid');
    assert.throws(() => frontier.workspaceState.ensure(root), SyntaxError);
    assert.equal(fs.readFileSync(filename, 'utf8'), '{ invalid');
  });

  it('keeps corrupt profiles blocked for existing state-path consumers', () => {
    frontier.workspaceState.ensure(root);
    const directory = resolveFrontierStateDirectory(root);
    fs.writeFileSync(path.join(directory, 'workspace-binding.json'), '{}');
    assert.throws(() => frontier.workspaceState.inspect(root), /different workspace/);
    assert.throws(() => resolveFrontierStateDirectory(root), /different workspace/);
  });

  it('keeps distinct Unicode folders isolated even when JavaScript lowercase collides', () => {
    const first = path.join(base, String.fromCodePoint(0x130));
    const second = path.join(base, `i${String.fromCodePoint(0x307)}`);
    fs.mkdirSync(first);
    fs.mkdirSync(second);
    __setWorkspaceFolders([{ path: first }, { path: second }]);
    const state = new WorkspaceState(context);
    state.ensure(first);
    state.ensure(second);
    assert.equal(first.toLowerCase(), second.toLowerCase());
    assert.notEqual(resolveFrontierStateDirectory(first), resolveFrontierStateDirectory(second));
    assert.equal(containsWorkspacePath(first, second), false);
    __setWorkspaceFolders([{ path: second }]);
    assert.throws(() => state.assertAvailable(first), /filesystem folder/);
  });

  it('rejects editor mutations during transitions and releases completed editor leases', async () => {
    frontier.workspaceState.ensure(root);
    const directory = resolveFrontierStateDirectory(root);
    const transition = path.join(directory, 'transition.lock');
    fs.writeFileSync(transition, '');
    const action = sinon.spy(async () => 'done');
    await assert.rejects(frontier.workspaceState.withMutation(root, action), /mode is changing/);
    sinon.assert.notCalled(action);
    assert.deepEqual(fs.readdirSync(path.join(directory, 'editor-leases')), []);
    fs.unlinkSync(transition);
    const value = await frontier.workspaceState.withMutation(root, async () => {
      assert.equal(fs.readdirSync(path.join(directory, 'editor-leases')).length, 1);
      return 'done';
    });
    assert.equal(value, 'done');
    assert.deepEqual(fs.readdirSync(path.join(directory, 'editor-leases')), []);
  });

  it('ignores interrupted transition markers whose owner exited but honors live owners', async () => {
    frontier.workspaceState.ensure(root);
    const directory = resolveFrontierStateDirectory(root);
    const transition = path.join(directory, 'transition.lock');
    fs.writeFileSync(transition, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await assert.rejects(frontier.workspaceState.withMutation(root, async () => 'done'), /workspace-state recover/);
    const kill = sinon.stub(process, 'kill').callsFake(() => {
      throw Object.assign(new Error('missing'), { code: 'ESRCH' });
    });
    try {
      assert.equal(await frontier.workspaceState.withMutation(root, async () => 'done'), 'done');
    } finally { kill.restore(); }
    assert.deepEqual(fs.readdirSync(path.join(directory, 'editor-leases')), []);
  });

  it('rejects altered pending-input root bindings rather than resuming another workspace', async () => {
    frontier.workspaceState.ensure(root);
    await frontier.setPendingSetup({ kind: 'llm-adapter', step: 'choose-llm-provider', prompt: 'fixture' });
    const filename = path.join(resolveFrontierStateDirectory(root), 'state', 'pending-setup.json');
    const record = JSON.parse(fs.readFileSync(filename, 'utf8'));
    record.state.workspaceRoot = base;
    fs.writeFileSync(filename, JSON.stringify(record));
    await assert.rejects(frontier.getPendingSetup(root), /does not match/);
  });

  it('does not switch a private profile when repository configuration appears', () => {
    frontier.workspaceState.ensure(root);
    const original = resolveFrontierStateDirectory(root);
    fs.mkdirSync(path.join(root, '.frontier'));
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{}');
    const reopened = new WorkspaceState(context);
    reopened.ensure(root);
    assert.equal(resolveFrontierStateDirectory(root), original);
    assert.equal(reopened.inspect(root)?.mode, 'private');
  });

  it('preserves incomplete repository or private state rather than replacing history', () => {
    fs.mkdirSync(path.join(root, '.frontier', 'sessions'), { recursive: true });
    assert.throws(() => frontier.workspaceState.ensure(root), /no configuration/);
    assert.equal(fs.existsSync(context.globalStorageUri.fsPath), false);
    const plain = path.join(base, 'another');
    fs.mkdirSync(plain);
    __setWorkspaceFolders([{ path: plain }]);
    const destination = privateWorkspacePath(context.globalStorageUri.fsPath, plain, '');
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'retained.txt'), 'history');
    assert.throws(() => new WorkspaceState(context).ensure(plain), /incomplete/);
    assert.equal(fs.readFileSync(path.join(destination, 'retained.txt'), 'utf8'), 'history');
  });

  it('rejects untrusted, virtual, disabled and incorrectly hosted remote workspaces', async () => {
    workspace.isTrusted = false;
    await assert.rejects(frontier.ensureWorkspaceReady(root), /Trust this workspace/);
    workspace.isTrusted = true;
    __setConfig('frontier.automaticWorkspaceState', false);
    await assert.rejects(frontier.ensureWorkspaceReady(root), /disabled/);
    __clearConfig();
    workspace.workspaceFolders = [{ uri: vscode.Uri.from({ scheme: 'memfs', path: root }), name: 'virtual', index: 0 }];
    await assert.rejects(frontier.ensureWorkspaceReady(root), /filesystem folder/);
    workspace.workspaceFolders = [{
      uri: vscode.Uri.from({ scheme: 'vscode-remote', authority: 'ssh-remote+host', path: root }),
      name: 'remote', index: 0,
    }];
    await assert.rejects(frontier.ensureWorkspaceReady(root), /remote workspace extension host/);
    assert.equal(fs.existsSync(context.globalStorageUri.fsPath), false);
  });

  it('keeps a valid selected folder usable beside an unsupported drive root', () => {
    __setWorkspaceFolders([{ path: path.parse(root).root }, { path: root }]);
    assert.equal(frontier.workspaceState.assertAvailable(root), root);
    assert.equal(frontier.workspaceState.ensure(root), root);
  });

  it('supports metadata-only chat preparation without invoking PowerShell', async () => {
    const execute = sinon.stub(shell, 'execShell').rejects(new Error('PowerShell is unavailable'));
    assert.equal(await frontier.ensureWorkspaceState(root), root);
    sinon.assert.notCalled(execute);
    await assert.rejects(frontier.ensureWorkspaceReady(root), /PowerShell is unavailable/);
    assert.equal(fs.existsSync(path.join(root, '.frontier')), false);
  });

  it('isolates roots and authorities and keeps caller overrides away from state bindings', async () => {
    confirmPrivateRuntime();
    const second = path.join(base, 'second');
    fs.mkdirSync(second);
    __setWorkspaceFolders([{ path: root }, { path: second }]);
    const firstState = await frontier.ensureWorkspaceReady(root);
    await frontier.ensureWorkspaceReady(second);
    assert.notEqual(resolveFrontierStateDirectory(root), resolveFrontierStateDirectory(second));
    assert.notEqual(workspaceIdentity(root, 'remote-a'), workspaceIdentity(root, 'remote-b'));
    const stream = sinon.stub(shell, 'execShellStreaming').resolves('done');
    __setConfig('frontier.repositoryContext.enabled', false);
    await frontier.runCliStreaming('run', ['engineer', 'task'], undefined, {
      FRONTIER_STATE_ROOT: resolveFrontierStateDirectory(second),
      FRONTIER_STATE_WORKSPACE: second, FRONTIER_STATE_AUTHORITY: 'different',
      FRONTIER_WORKSPACE_ROOT: second,
      FRONTIER_GRAPH_ENABLED: '1',
    }, root);
    const passed = stream.firstCall.args[4]!;
    assert.equal(passed.FRONTIER_STATE_ROOT, resolveFrontierStateDirectory(firstState));
    assert.equal(passed.FRONTIER_STATE_WORKSPACE, root);
    assert.equal(passed.FRONTIER_WORKSPACE_ROOT, root);
    assert.equal(passed.HVE_WORKSPACE_ROOT, undefined);
    assert.equal(passed.AGENTX_WORKSPACE_ROOT, undefined);
    assert.equal(passed.FRONTIER_STATE_AUTHORITY, '');
    assert.equal(passed.FRONTIER_GRAPH_ENABLED, '0');
  });

  it('persists pending work across workspace containers without sharing it across roots', async () => {
    confirmPrivateRuntime();
    const second = path.join(base, 'second');
    fs.mkdirSync(second);
    __setWorkspaceFolders([{ path: root }, { path: second }]);
    await frontier.ensureWorkspaceReady(root);
    await frontier.ensureWorkspaceReady(second);
    const first = frontier.forWorkspace(root);
    window.activeTextEditor = { document: { uri: vscode.Uri.file(path.join(second, 'file.ts')) } };
    frontier.invalidateCache();
    assert.equal(frontier.workspaceRoot, second);
    await first.setPendingClarification({ sessionId: 'first', agentName: 'engineer', prompt: 'A' });
    await first.setPendingSetup({ kind: 'llm-adapter', step: 'choose-llm-provider', prompt: 'A' });
    assert.equal(await frontier.getPendingClarification(second), undefined);
    assert.equal(await frontier.getPendingSetup(second), undefined);
    const reopened = new FrontierContext({ ...context, workspaceState: memento() });
    assert.equal((await reopened.getPendingClarification(root))?.sessionId, 'first');
    assert.equal((await reopened.getPendingSetup(root))?.prompt, 'A');
    await assert.rejects(first.runCli('state', [], second), /identity changed/);
    await first.clearPendingClarification();
    assert.equal(await reopened.getPendingClarification(root), undefined);
  });

  it('does not resolve executable assets from private writable state', () => {
    frontier.workspaceState.ensure(root);
    const privateAgents = path.join(resolveFrontierStateDirectory(root), 'runtime', 'agents');
    const bundledAgents = path.join(context.extensionPath, '.github', 'frontier', 'agents');
    for (const directory of [privateAgents, bundledAgents]) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'example.agent.md'), 'fixture');
    }
    assert.equal(resolveAgentDefinitionPath(root, context.extensionPath, 'example.agent.md'),
      path.join(bundledAgents, 'example.agent.md'));
  });

  it('rejects malformed bindings and linked profile roots', () => {
    const destination = privateWorkspacePath(context.globalStorageUri.fsPath, root, '');
    const binding = provisionWorkspace(destination, root, '', '9.7.0');
    const filename = path.join(destination, 'workspace-binding.json');
    for (const change of [{ mode: ['private'] }, { schemaVersion: '1' },
      { authority: 'other' }, { identity: '0'.repeat(64) }, { workspaceRoot: base }]) {
      fs.writeFileSync(filename, JSON.stringify({ ...binding, ...change }));
      assert.throws(() => readWorkspaceBinding(destination, root, ''), /different workspace/);
    }
    fs.writeFileSync(filename, JSON.stringify(binding));
    const link = path.join(base, 'linked-storage');
    fs.symlinkSync(context.globalStorageUri.fsPath, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(privateWorkspacePath(link, root, ''), destination);
    const second = path.join(base, 'second');
    fs.mkdirSync(second);
    const linkedProfile = path.join(context.globalStorageUri.fsPath, 'workspaces', workspaceIdentity(second, ''));
    fs.symlinkSync(destination, linkedProfile, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => privateWorkspacePath(context.globalStorageUri.fsPath, second, ''), /must not contain links/);
  });

  it('binds hook children to the loaded runtime without provisioning workspace state', () => {
    const previousRuntime = process.env.FRONTIER_HOOK_RUNTIME;
    const previousProfiles = process.env.FRONTIER_HOOK_PROFILES;
    registerPolicyHookEnvironment(context, frontier);
    assert.equal(process.env.FRONTIER_HOOK_RUNTIME,
      path.join(context.extensionPath, '.github', 'frontier', '.frontier', 'runtime', 'policy-hook.js'));
    const profiles = JSON.parse(process.env.FRONTIER_HOOK_PROFILES!);
    assert.deepEqual(profiles, [{ workspaceRoot: root, authority: '', graphEnabled: true,
      stateRoot: privateWorkspacePath(context.globalStorageUri.fsPath, root, '') }]);
    assert.equal(fs.existsSync(context.globalStorageUri.fsPath), false);
    assert.deepEqual(fs.readdirSync(root), ['source.txt']);
    for (const disposable of context.subscriptions.splice(0)) { disposable.dispose(); }
    assert.equal(process.env.FRONTIER_HOOK_RUNTIME, previousRuntime);
    assert.equal(process.env.FRONTIER_HOOK_PROFILES, previousProfiles);
  });

  it('advertises MCP without provisioning, then binds it on explicit start without a graph scan', async () => {
    const execute = confirmPrivateRuntime();
    let provider: vscode.McpServerDefinitionProvider | undefined;
    sinon.stub(vscode.lm, 'registerMcpServerDefinitionProvider').callsFake((_id, value) => {
      provider = value;
      return { dispose: () => {} };
    });
    registerFrontierMcp(context, frontier);
    const cancellation = new vscode.CancellationTokenSource();
    const definitions = await provider!.provideMcpServerDefinitions(cancellation.token);
    assert.equal(definitions!.length, 1);
    sinon.assert.notCalled(execute);
    assert.equal(fs.existsSync(context.globalStorageUri.fsPath), false);
    __setConfig('frontier.repositoryContext.enabled', false);
    const disabledDefinitions = await provider!.provideMcpServerDefinitions(cancellation.token);
    assert.notEqual(disabledDefinitions![0].version, definitions![0].version);
    __clearConfig();
    const resolved = await provider!.resolveMcpServerDefinition!(definitions![0], cancellation.token);
    assert.ok(resolved instanceof vscode.McpStdioServerDefinition);
    if (!(resolved instanceof vscode.McpStdioServerDefinition)) { throw new Error('Expected stdio definition'); }
    assert.equal(resolved.command, 'node');
    assert.equal(resolved.env.FRONTIER_WORKSPACE_ROOT, root);
    assert.equal(resolved.env.FRONTIER_REPO_ROOT, path.join(context.extensionPath, '.github', 'frontier'));
    assert.equal(resolved.env.FRONTIER_STATE_ROOT, resolveFrontierStateDirectory(root));
    assert.equal(fs.existsSync(path.join(resolveFrontierStateDirectory(root), 'state', 'repo-context')), false);
    assert.deepEqual(fs.readdirSync(root), ['source.txt']);
    cancellation.dispose();
  });
});
