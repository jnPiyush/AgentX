import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { runInitializeCliCommand } from '../../commands/initializeCli';
import {
  appendCliSymlinksToGitignore,
  CLI_ASSET_STATE_FILE,
  COPILOT_CLI_ASSET_DIRS,
  createCopilotCliSymlinks,
  readCliAssetState,
  refreshCopilotCliSymlinks,
} from '../../commands/initializeInternals';

describe('Initialize CLI symlink helpers', () => {
  let extensionRoot: string;
  let workspaceRoot: string;

  beforeEach(() => {
    extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-cli-ext-'));
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-cli-work-'));
  });

  afterEach(() => {
    fs.rmSync(extensionRoot, { recursive: true, force: true });
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('creates symlinks and preserves real workspace directories', () => {
    const assets = COPILOT_CLI_ASSET_DIRS.slice(0, 2);
    for (const asset of assets) {
      const targetDir = path.join(extensionRoot, asset.source);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'marker.md'), asset.destination, 'utf8');
    }

    const preserved = path.join(workspaceRoot, assets[1].destination);
    fs.mkdirSync(preserved, { recursive: true });
    fs.writeFileSync(path.join(preserved, 'keep.md'), 'keep', 'utf8');

    const result = createCopilotCliSymlinks(extensionRoot, workspaceRoot);
    const linkedPath = path.join(workspaceRoot, assets[0].destination);

    assert.ok(result.linked.includes(assets[0].destination));
    assert.ok(result.skipped.includes(assets[1].destination));
    assert.ok(fs.lstatSync(linkedPath).isSymbolicLink());
    assert.equal(fs.readFileSync(path.join(preserved, 'keep.md'), 'utf8'), 'keep');
  });

  it('refreshes stale symlinks after the extension bundle moves', () => {
    const asset = COPILOT_CLI_ASSET_DIRS[0];
    const originalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-cli-old-'));
    const replacementRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-cli-new-'));

    try {
      fs.mkdirSync(path.join(originalRoot, asset.source), { recursive: true });
      fs.writeFileSync(path.join(originalRoot, asset.source, 'old.md'), 'old', 'utf8');
      createCopilotCliSymlinks(originalRoot, workspaceRoot);

      fs.rmSync(originalRoot, { recursive: true, force: true });

      fs.mkdirSync(path.join(replacementRoot, asset.source), { recursive: true });
      fs.writeFileSync(path.join(replacementRoot, asset.source, 'new.md'), 'new', 'utf8');

      const result = refreshCopilotCliSymlinks(replacementRoot, workspaceRoot);
      assert.ok(result.refreshed.includes(asset.destination));
      assert.equal(
        fs.readFileSync(path.join(workspaceRoot, asset.destination, 'new.md'), 'utf8'),
        'new',
      );
    } finally {
      fs.rmSync(originalRoot, { recursive: true, force: true });
      fs.rmSync(replacementRoot, { recursive: true, force: true });
    }
  });

  it('appends a dedicated gitignore block for CLI symlinks', () => {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    fs.writeFileSync(
      gitignorePath,
      '# existing\n\n# --- AgentX CLI symlinks (auto-generated, do not edit this block) ---\n/old\n# --- /AgentX CLI symlinks ---\n',
      'utf8',
    );

    appendCliSymlinksToGitignore(workspaceRoot);

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const marker = '# --- AgentX CLI symlinks (auto-generated, do not edit this block) ---';
    assert.equal((gitignore.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1);
    assert.ok(gitignore.includes('/.github/agents'));
    assert.ok(gitignore.includes('/.github/templates'));
  });
});

describe('runInitializeCliCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let tempRoot: string;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;
  let fakeContext: vscode.ExtensionContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-init-cli-'));
    fs.mkdirSync(path.join(tempRoot, '.agentx'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, '.agentx', 'config.json'), '{}', 'utf8');

    fakeAgentx = {
      invalidateCache: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    fakeContext = {
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;

    sandbox.stub(vscode.window, 'withProgress').callsFake(async (_options, task) => task({ report: () => undefined }, {} as never));
    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.stub(vscode.window, 'showWarningMessage');
    sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    sandbox.restore();
  });

  it('writes CLI state and runs symlink initialization when Symlink is selected', async () => {
    const initializeInternals = await import('../../commands/initializeInternals');

    sandbox.stub(initializeInternals, 'promptWorkspaceRoot').resolves(tempRoot);
    sandbox.stub(initializeInternals, 'createCopilotCliSymlinks').returns({
      linked: ['.github/agents'],
      refreshed: [],
      skipped: [],
    });
    const gitignoreStub = sandbox.stub(initializeInternals, 'appendCliSymlinksToGitignore');
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => 'copy',
    } as unknown as vscode.WorkspaceConfiguration);
    sandbox.stub(vscode.window, 'showQuickPick').resolves({
      label: 'Symlink',
      description: 'zero-copy',
      value: 'symlink',
    } as never);

    await runInitializeCliCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    sinon.assert.calledOnce(gitignoreStub);
    sinon.assert.calledOnce(fakeAgentx.invalidateCache as sinon.SinonStub);
    const state = readCliAssetState(tempRoot);
    assert.ok(state);
    assert.equal(state?.mode, 'symlink');
    assert.equal(state?.extensionRoot, '/test/extension');
    assert.deepEqual(state?.destinations, COPILOT_CLI_ASSET_DIRS.map((asset) => asset.destination));
    assert.ok(fs.existsSync(path.join(tempRoot, CLI_ASSET_STATE_FILE)));
  });

  it('writes CLI state and runs copy initialization when Copy is selected', async () => {
    const initializeInternals = await import('../../commands/initializeInternals');

    sandbox.stub(initializeInternals, 'promptWorkspaceRoot').resolves(tempRoot);
    const copyStub = sandbox.stub(initializeInternals, 'copyCopilotCliAssets');
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => 'copy',
    } as unknown as vscode.WorkspaceConfiguration);
    sandbox.stub(vscode.window, 'showQuickPick').resolves({
      label: 'Copy',
      description: 'team-friendly',
      value: 'copy',
    } as never);

    await runInitializeCliCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    sinon.assert.calledOnce(copyStub);
    sinon.assert.calledOnce(fakeAgentx.invalidateCache as sinon.SinonStub);
    const state = readCliAssetState(tempRoot);
    assert.ok(state);
    assert.equal(state?.mode, 'copy');
    assert.equal(state?.extensionRoot, '/test/extension');
  });
});