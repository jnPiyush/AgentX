import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  compareSemver,
  readInstalledVersion,
  checkVersionMismatch,
  silentVersionSync,
} from '../../utils/versionChecker';

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
// silentVersionSync
// -----------------------------------------------------------------

describe('versionChecker - silentVersionSync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-sync-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should not error when no .agentx dir exists', async () => {
    await silentVersionSync(tmpDir, '8.3.2', tmpDir);
    // No .agentx/ dir = not initialized, should silently return
    assert.ok(!fs.existsSync(path.join(tmpDir, '.agentx', 'version.json')));
  });

  it('should update version.json when extension is newer', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), JSON.stringify({
      version: '8.1.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }));

    await silentVersionSync(tmpDir, '8.3.2', tmpDir);

    const updated = JSON.parse(fs.readFileSync(path.join(agentxDir, 'version.json'), 'utf-8'));
    assert.equal(updated.version, '8.3.2');
    assert.equal(updated.mode, 'local'); // preserved
  });

  it('should not update when versions match', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    const original = JSON.stringify({
      version: '8.3.2', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), original);

    await silentVersionSync(tmpDir, '8.3.2', tmpDir);

    const content = fs.readFileSync(path.join(agentxDir, 'version.json'), 'utf-8');
    assert.equal(content, original); // unchanged
  });

  it('should not update when installed is newer than extension', async () => {
    const agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
    const original = JSON.stringify({
      version: '9.0.0', mode: 'local',
      installedAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });
    fs.writeFileSync(path.join(agentxDir, 'version.json'), original);

    await silentVersionSync(tmpDir, '8.3.2', tmpDir);

    const content = fs.readFileSync(path.join(agentxDir, 'version.json'), 'utf-8');
    assert.equal(content, original); // unchanged
  });

  it('should not error with empty workspace root', async () => {
    await silentVersionSync('', '8.3.2', tmpDir);
    // Should return silently
  });
});
