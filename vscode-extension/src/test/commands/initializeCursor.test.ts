import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { execFileSync } from 'child_process';
import { runInitializeCursorCommand } from '../../commands/initializeCursor';
import * as initialization from '../../commands/initializeInternals';
import * as shell from '../../utils/shell';

describe('Cursor initialization command', () => {
  let sandbox: sinon.SinonSandbox;
  let root: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-command-'));
    sandbox.stub(initialization, 'promptWorkspaceRoot').resolves(root);
    sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, task) => task(
      { report: () => undefined },
      { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => undefined }) },
    ));
    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'showWarningMessage');
    sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('requires an initialized workspace without silently seeding framework trees', async () => {
    const execute = sandbox.stub(shell, 'execShell').resolves('');
    await runInitializeCursorCommand(path.join(root, 'extension'));
    sinon.assert.notCalled(execute);
    assert.ok(!fs.existsSync(path.join(root, '.github')));
    sinon.assert.calledOnce(vscode.window.showWarningMessage as sinon.SinonStub);
  });

  it('uses the selected workspace and surfaces preserved overrides', async () => {
    fs.mkdirSync(path.join(root, '.frontier'));
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{}');
    const execute = sandbox.stub(shell, 'execShell').resolves(JSON.stringify({
      status: 'configured', preserved: ['.cursor/rules/custom.mdc'],
    }));
    const extension = path.join(root, 'extension');
    await runInitializeCursorCommand(extension);
    sinon.assert.calledWith(execute, sinon.match.string, root, 'pwsh');
    assert.ok(execute.firstCall.args[0].includes('frontier.ps1'));
    assert.ok(fs.readFileSync(path.join(root, '.frontier', 'runtime', 'frontier.ps1'), 'utf8').includes(extension));
    sinon.assert.calledOnce(vscode.window.showWarningMessage as sinon.SinonStub);
  });

  it('reports malformed setup output as an error rather than success', async () => {
    fs.mkdirSync(path.join(root, '.frontier'));
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{}');
    sandbox.stub(shell, 'execShell').resolves('null');
    await runInitializeCursorCommand(path.join(root, 'extension'));
    sinon.assert.calledOnce(vscode.window.showErrorMessage as sinon.SinonStub);
    sinon.assert.notCalled(vscode.window.showInformationMessage as sinon.SinonStub);
  });

  it('does not replace a standalone checkout launcher', async () => {
    fs.mkdirSync(path.join(root, '.frontier', 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{}');
    fs.writeFileSync(path.join(root, '.frontier', 'runtime', 'frontier-cli.ps1'), '# standalone');
    const launcher = path.join(root, '.frontier', 'runtime', 'frontier.ps1');
    fs.writeFileSync(launcher, '# user standalone launcher');
    sandbox.stub(shell, 'execShell').resolves('{"status":"configured","preserved":[]}');
    await runInitializeCursorCommand(path.join(root, 'extension'));
    assert.equal(fs.readFileSync(launcher, 'utf8'), '# user standalone launcher');
  });

  it('binds Cursor launchers to the selected host and recovers from its removed version', function () {
    this.timeout(120000);
    const home = path.join(root, 'home');
    const selected = path.join(home, '.cursor', 'extensions', 'jnpiyush.agentx-9.7.1');
    const upgraded = path.join(home, '.cursor', 'extensions', 'jnpiyush.agentx-9.7.2');
    const otherHost = path.join(home, '.vscode', 'extensions', 'jnpiyush.agentx-99.0.0');
    const output = path.join(root, 'selected.txt');
    for (const [directory, label] of [[selected, 'selected'], [upgraded, 'upgraded'], [otherHost, 'wrong-host']]) {
      const runtime = path.join(directory, '.github', 'frontier', '.frontier', 'runtime');
      fs.mkdirSync(runtime, { recursive: true });
      fs.writeFileSync(path.join(runtime, 'cursor.js'), '// supported');
      fs.writeFileSync(path.join(runtime, 'frontier.ps1'),
        `param([string]$OutputPath)\nSet-Content -LiteralPath $OutputPath -Value '${label}' -NoNewline\n`);
    }
    initialization.writeWorkspaceRuntimeWrappers(selected, root, true);
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home };
    for (const key of ['FRONTIER_EXTENSION_ROOT', 'HVE_EXTENSION_ROOT', 'AGENTX_EXTENSION_ROOT']) {
      delete env[key];
    }
    const command = ['-NoProfile', '-File', path.join(root, '.frontier', 'runtime', 'frontier.ps1'), output];
    execFileSync('pwsh', command, { env });
    assert.equal(fs.readFileSync(output, 'utf8'), 'selected');
    fs.rmSync(selected, { recursive: true, force: true });
    execFileSync('pwsh', command, { env });
    assert.equal(fs.readFileSync(output, 'utf8'), 'upgraded');
  });
});
