import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FrontierContext } from '../../frontierContext';
import { runInitializeCliCommand } from '../../commands/initializeCli';
import {
  appendCliSymlinksToGitignore,
  CLI_ASSET_STATE_FILE,
  COPILOT_CLI_ASSET_DIRS,
  COPILOT_CLI_ASSET_FILES,
  COPILOT_CLI_SUPPORT_DIRS,
  createCopilotCliSymlinks,
  readCliAssetState,
  refreshCopilotCliSymlinks,
  findBrokenCopilotCliLinks,
  writeCliAssetState,
} from '../../commands/initializeInternals';

describe('Initialize CLI symlink helpers', () => {
  let extensionRoot: string;
  let workspaceRoot: string;

  beforeEach(() => {
    extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cli-ext-'));
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cli-work-'));
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
    const originalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cli-old-'));
    const replacementRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cli-new-'));

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

  it('detects dangling managed links without writes and repairs only after an explicit request', () => {
    const asset = COPILOT_CLI_ASSET_DIRS[0];
    const oldRoot = path.join(extensionRoot, 'old-version');
    const currentRoot = path.join(extensionRoot, 'current-version');
    fs.mkdirSync(path.join(oldRoot, asset.source), { recursive: true });
    fs.mkdirSync(path.join(currentRoot, asset.source), { recursive: true });
    createCopilotCliSymlinks(oldRoot, workspaceRoot);
    writeCliAssetState(workspaceRoot, {
      mode: 'symlink', extensionRoot: oldRoot, destinations: [asset.destination], updatedAt: 'fixture',
    });

    fs.rmSync(oldRoot, { recursive: true, force: true });
    const before = fs.readlinkSync(path.join(workspaceRoot, asset.destination));
    const broken = findBrokenCopilotCliLinks(workspaceRoot);
    assert.deepEqual(broken, [asset.destination]);
    assert.equal(fs.readlinkSync(path.join(workspaceRoot, asset.destination)), before);
    const repaired = refreshCopilotCliSymlinks(currentRoot, workspaceRoot, broken);
    assert.deepEqual(repaired.refreshed, [asset.destination]);
    assert.equal(fs.existsSync(path.join(workspaceRoot, asset.destination)), true);
    assert.equal(readCliAssetState(workspaceRoot)?.extensionRoot, currentRoot);
    fs.rmSync(currentRoot, { recursive: true, force: true });
    assert.deepEqual(findBrokenCopilotCliLinks(workspaceRoot), [asset.destination]);
  });

  it('recognizes legacy auto-refreshed version siblings without taking unrelated extension links', () => {
    const first = COPILOT_CLI_ASSET_DIRS[0];
    const second = COPILOT_CLI_ASSET_DIRS[1];
    const recorded = path.join(extensionRoot, 'jnpiyush.agentx-9.4.0');
    const refreshed = path.join(extensionRoot, 'jnpiyush.agentx-9.6.0');
    const current = path.join(extensionRoot, 'jnpiyush.agentx-9.7.0');
    const unrelated = path.join(extensionRoot, 'another.extension-9.6.0');
    fs.mkdirSync(path.join(refreshed, first.source), { recursive: true });
    fs.mkdirSync(path.join(unrelated, second.source), { recursive: true });
    fs.mkdirSync(path.join(workspaceRoot, '.github'), { recursive: true });
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(path.join(refreshed, first.source), path.join(workspaceRoot, first.destination), kind);
    fs.symlinkSync(path.join(unrelated, second.source), path.join(workspaceRoot, second.destination), kind);
    writeCliAssetState(workspaceRoot, {
      mode: 'symlink', extensionRoot: recorded,
      destinations: [first.destination, second.destination], updatedAt: 'legacy',
    });
    fs.rmSync(refreshed, { recursive: true, force: true });
    fs.rmSync(unrelated, { recursive: true, force: true });
    assert.deepEqual(findBrokenCopilotCliLinks(workspaceRoot), []);
    assert.deepEqual(findBrokenCopilotCliLinks(workspaceRoot, {
      extensionRoot: current, extensionId: 'jnpiyush.agentx',
    }), [first.destination]);
  });

  it('never overwrites user-authored files when refreshing support assets', () => {
    // refreshCopilotCliSymlinks runs on EVERY activation. The support trees and
    // standalone files land in shared namespaces (docs/, scripts/, evaluation/,
    // AGENTS.md, Skills.md) that users also author in, so a refresh must add
    // missing files and never clobber existing content.
    const bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cli-bundle-'));

    try {
      const supportDir = COPILOT_CLI_SUPPORT_DIRS[0];
      const bundledSupport = path.join(bundleRoot, supportDir.source);
      fs.mkdirSync(bundledSupport, { recursive: true });
      fs.writeFileSync(path.join(bundledSupport, 'shipped.md'), 'AGENTX SHIPPED', 'utf8');
      fs.writeFileSync(path.join(bundledSupport, 'collision.md'), 'AGENTX SHIPPED', 'utf8');

      const assetFile = COPILOT_CLI_ASSET_FILES[0];
      const bundledFile = path.join(bundleRoot, assetFile.source);
      fs.mkdirSync(path.dirname(bundledFile), { recursive: true });
      fs.writeFileSync(bundledFile, 'AGENTX SHIPPED', 'utf8');

      const userSupportFile = path.join(workspaceRoot, supportDir.destination, 'collision.md');
      fs.mkdirSync(path.dirname(userSupportFile), { recursive: true });
      fs.writeFileSync(userSupportFile, 'USER AUTHORED', 'utf8');

      const userAssetFile = path.join(workspaceRoot, assetFile.destination);
      fs.mkdirSync(path.dirname(userAssetFile), { recursive: true });
      fs.writeFileSync(userAssetFile, 'USER AUTHORED', 'utf8');

      refreshCopilotCliSymlinks(bundleRoot, workspaceRoot);

      assert.equal(fs.readFileSync(userSupportFile, 'utf8'), 'USER AUTHORED');
      assert.equal(fs.readFileSync(userAssetFile, 'utf8'), 'USER AUTHORED');
      assert.equal(
        fs.readFileSync(path.join(workspaceRoot, supportDir.destination, 'shipped.md'), 'utf8'),
        'AGENTX SHIPPED',
      );
    } finally {
      fs.rmSync(bundleRoot, { recursive: true, force: true });
    }
  });

  it('appends a dedicated gitignore block for CLI symlinks', () => {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    fs.writeFileSync(
      gitignorePath,
      '# existing\n\n# --- Frontier CLI symlinks (auto-generated, do not edit this block) ---\n/old\n# --- /Frontier CLI symlinks ---\n',
      'utf8',
    );

    appendCliSymlinksToGitignore(workspaceRoot);

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const marker = '# --- Frontier CLI symlinks (auto-generated, do not edit this block) ---';
    assert.equal((gitignore.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1);
    assert.ok(gitignore.includes('/.github/agents'));
    assert.ok(gitignore.includes('/.github/templates'));
  });
});

describe('runInitializeCliCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let tempRoot: string;
  let fakeAgentx: sinon.SinonStubbedInstance<FrontierContext>;
  let fakeContext: vscode.ExtensionContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-init-cli-'));
    fs.mkdirSync(path.join(tempRoot, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, '.frontier', 'config.json'), '{}', 'utf8');

    fakeAgentx = {
      invalidateCache: sandbox.stub(),
      workspaceState: { assertAvailable: (root: string) => root, inspect: () => undefined },
    } as unknown as sinon.SinonStubbedInstance<FrontierContext>;

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

    await runInitializeCliCommand(fakeContext, fakeAgentx as unknown as FrontierContext);

    sinon.assert.calledOnce(gitignoreStub);
    sinon.assert.calledOnce(fakeAgentx.invalidateCache as sinon.SinonStub);
    const state = readCliAssetState(tempRoot);
    assert.ok(state);
    assert.equal(state?.mode, 'symlink');
    assert.equal(state?.extensionRoot, '/test/extension');
    assert.deepEqual(
      state?.destinations,
      [...COPILOT_CLI_ASSET_DIRS, ...COPILOT_CLI_SUPPORT_DIRS, ...COPILOT_CLI_ASSET_FILES].map((asset) => asset.destination),
    );
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

    await runInitializeCliCommand(fakeContext, fakeAgentx as unknown as FrontierContext);

    sinon.assert.calledOnce(copyStub);
    sinon.assert.calledOnce(fakeAgentx.invalidateCache as sinon.SinonStub);
    const state = readCliAssetState(tempRoot);
    assert.ok(state);
    assert.equal(state?.mode, 'copy');
    assert.equal(state?.extensionRoot, '/test/extension');
  });
});