import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

import {
  compareSemver,
  readInstalledVersion,
  checkVersionMismatch,
  promptIfUpdateAvailable,
} from '../../utils/versionChecker';

// Re-import mock helpers for config manipulation
import { __setConfig, __clearConfig } from '../mocks/vscode';

// -----------------------------------------------------------------
// compareSemver
// -----------------------------------------------------------------

describe('versionChecker - compareSemver', () => {
  it('should return 0 for equal versions', () => {
    assert.equal(compareSemver('1.2.3', '1.2.3'), 0);
  });

  it('should return 1 when a > b (major)', () => {
    assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  });

  it('should return -1 when a < b (major)', () => {
    assert.equal(compareSemver('1.9.9', '2.0.0'), -1);
  });

  it('should return 1 when a > b (minor)', () => {
    assert.equal(compareSemver('6.6.0', '6.5.3'), 1);
  });

  it('should return -1 when a < b (minor)', () => {
    assert.equal(compareSemver('6.5.3', '6.6.0'), -1);
  });

  it('should return 1 when a > b (patch)', () => {
    assert.equal(compareSemver('1.0.2', '1.0.1'), 1);
  });

  it('should return -1 when a < b (patch)', () => {
    assert.equal(compareSemver('1.0.1', '1.0.2'), -1);
  });

  it('should handle invalid versions gracefully', () => {
    assert.equal(compareSemver('', '1.0.0'), -1);
    assert.equal(compareSemver('1.0.0', ''), 1);
    assert.equal(compareSemver('', ''), 0);
    assert.equal(compareSemver('abc', '1.0.0'), -1);
  });
});

// -----------------------------------------------------------------
// readInstalledVersion
// -----------------------------------------------------------------

describe('versionChecker - readInstalledVersion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ver-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return undefined when .agentx/version.json does not exist', () => {
    const result = readInstalledVersion(tmpDir);
    assert.equal(result, undefined);
  });

  it('should return parsed version info when file exists', () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.5.0',
      mode: 'local',
      installedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }));

    const result = readInstalledVersion(tmpDir);
    assert.ok(result);
    assert.equal(result.version, '6.5.0');
    assert.equal(result.mode, 'local');
  });

  it('should return undefined when file contains invalid JSON', () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), 'not json!');

    const result = readInstalledVersion(tmpDir);
    assert.equal(result, undefined);
  });

  it('should return undefined when version field is missing', () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      mode: 'local',
    }));

    const result = readInstalledVersion(tmpDir);
    assert.equal(result, undefined);
  });
});

// -----------------------------------------------------------------
// checkVersionMismatch
// -----------------------------------------------------------------

describe('versionChecker - checkVersionMismatch', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-mis-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should report no update when version file is missing', () => {
    const result = checkVersionMismatch(tmpDir, '6.6.0');
    assert.equal(result.updateAvailable, false);
    assert.equal(result.installedVersion, '');
  });

  it('should report update available when installed < extension', () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.5.3',
      mode: 'local',
      installedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }));

    const result = checkVersionMismatch(tmpDir, '6.6.0');
    assert.equal(result.updateAvailable, true);
    assert.equal(result.installedVersion, '6.5.3');
    assert.equal(result.extensionVersion, '6.6.0');
  });

  it('should report no update when versions match', () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.6.0',
      mode: 'local',
      installedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }));

    const result = checkVersionMismatch(tmpDir, '6.6.0');
    assert.equal(result.updateAvailable, false);
  });

  it('should report no update when installed > extension', () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '7.0.0',
      mode: 'local',
      installedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }));

    const result = checkVersionMismatch(tmpDir, '6.6.0');
    assert.equal(result.updateAvailable, false);
  });
});

// -----------------------------------------------------------------
// promptIfUpdateAvailable
// -----------------------------------------------------------------

describe('versionChecker - promptIfUpdateAvailable', () => {
  let tmpDir: string;
  let showInfoStub: sinon.SinonStub;
  let execCommandStub: sinon.SinonStub;
  let globalState: vscode.Memento;
  let stateStore: Record<string, unknown>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-prompt-'));
    __clearConfig();

    showInfoStub = sinon.stub(vscode.window, 'showInformationMessage');
    execCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    // Minimal Memento mock
    stateStore = {};
    globalState = {
      keys: () => Object.keys(stateStore),
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return (key in stateStore ? stateStore[key] : defaultValue) as T | undefined;
      },
      update: async (key: string, value: unknown) => {
        stateStore[key] = value;
      },
    } as vscode.Memento;
  });

  afterEach(() => {
    sinon.restore();
    __clearConfig();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should not prompt when no version file exists', async () => {
    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.equal(showInfoStub.called, false);
  });

  it('should not prompt when versions match', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.6.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }));

    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.equal(showInfoStub.called, false);
  });

  it('should prompt when installed version is older', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.5.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }));

    showInfoStub.resolves(undefined); // user dismisses

    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.ok(showInfoStub.calledOnce, 'should show notification');
    assert.ok(
      String(showInfoStub.firstCall.args[0]).includes('v6.5.0'),
      'message should mention installed version',
    );
  });

  it('should open wizard when user clicks Update Now', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.5.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }));

    showInfoStub.resolves('Update Now');

    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.ok(execCommandStub.calledOnce, 'should execute command');
    assert.equal(execCommandStub.firstCall.args[0], 'agentx.initialize');
  });

  it('should persist dismiss decision and not prompt again', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.5.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }));

    showInfoStub.resolves('Dismiss');

    // First call - should prompt and user dismisses
    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.ok(showInfoStub.calledOnce);

    showInfoStub.resetHistory();

    // Second call - should not prompt (dismissed for this version)
    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.equal(showInfoStub.called, false, 'should not prompt after dismiss');
  });

  it('should respect skipUpdateCheck setting', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '6.5.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }));

    __setConfig('agentx.skipUpdateCheck', true);

    await promptIfUpdateAvailable(tmpDir, '6.6.0', globalState);
    assert.equal(showInfoStub.called, false, 'should not prompt when opt-out is set');
  });
});
