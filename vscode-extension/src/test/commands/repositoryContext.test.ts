import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerRepositoryContextCommand, startRepositoryDiscovery } from '../../commands/repositoryContext';
import { FrontierContext } from '../../frontierContext';

describe('repository context command', () => {
  let sandbox: sinon.SinonSandbox;
  let root: string;
  let fakeAgentx: { workspaceRoot: string | undefined; runCli: sinon.SinonStub };
  let registeredCallback: (...args: unknown[]) => unknown;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-repo-context-command-'));
    fakeAgentx = { workspaceRoot: root, runCli: sandbox.stub() };
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        registeredCallback = cb;
        return { dispose: () => undefined };
      },
    );
    registerRepositoryContextCommand({ subscriptions: [] } as unknown as vscode.ExtensionContext, fakeAgentx as unknown as FrontierContext);
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  function initialize(): void {
    fs.mkdirSync(path.join(root, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{"mode":"local"}');
  }

  it('registers frontier.refreshRepositoryContext', () => {
    assert.ok((vscode.commands.registerCommand as sinon.SinonStub).calledWith('frontier.refreshRepositoryContext'));
  });

  it('does not index an open folder where Frontier is not initialized', async () => {
    const warn = sandbox.spy(vscode.window, 'showWarningMessage');

    await registeredCallback();

    assert.ok(warn.calledOnce);
    sinon.assert.notCalled(fakeAgentx.runCli);
  });

  it('does not index when no workspace is open', async () => {
    fakeAgentx.workspaceRoot = undefined;

    await registeredCallback();

    sinon.assert.notCalled(fakeAgentx.runCli);
  });

  it('updates the graph synchronously when invoked explicitly', async () => {
    initialize();
    fakeAgentx.runCli.resolves('Repository navigation.');
    const info = sandbox.spy(vscode.window, 'showInformationMessage');

    await registeredCallback();

    assert.ok(fakeAgentx.runCli.calledWith('context', ['--sync']));
    assert.ok(info.calledOnce);
  });

  it('reports CLI failures', async () => {
    initialize();
    fakeAgentx.runCli.rejects(new Error('graph locked'));
    const error = sandbox.spy(vscode.window, 'showErrorMessage');

    await registeredCallback();

    assert.ok(String(error.firstCall.args[0]).includes('graph locked'));
  });

  it('starts background discovery without waiting and reports a failed start', async () => {
    fakeAgentx.runCli.rejects(new Error('offline'));
    const warn = sandbox.spy(vscode.window, 'showWarningMessage');

    startRepositoryDiscovery(fakeAgentx as unknown as FrontierContext, '/workspace');
    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(fakeAgentx.runCli.calledWith('context', ['--start-refresh'], '/workspace'));
    assert.ok(warn.calledOnce);
    assert.ok(String(warn.firstCall.args[0]).includes('offline'));
  });
});
