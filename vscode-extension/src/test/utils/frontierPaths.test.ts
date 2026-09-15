import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  migrateLegacyState,
  resolveFrontierStateDirectory,
  resolveFrontierStatePath,
} from '../../utils/frontierPaths';

describe('Frontier state paths', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-paths-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('defaults new workspaces to .frontier', () => {
    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.frontier'));
  });

  it('reads legacy state until it is migrated', () => {
    fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
    fs.writeFileSync(path.join(root, '.agentx', 'config.json'), '{"provider":"local"}');

    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.agentx'));
  });

  it('reads transitional HVE state before published AgentX state', () => {
    fs.mkdirSync(path.join(root, '.hve', 'state'), { recursive: true });
    fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });

    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.hve'));
  });

  it('migrates legacy state once and makes Frontier authoritative', () => {
    fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
    fs.writeFileSync(path.join(root, '.agentx', 'config.json'), '{"provider":"local"}');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'marker.txt'), 'legacy');
    fs.writeFileSync(path.join(root, '.agentx', 'agentx-cli.ps1'), 'runtime');

    assert.equal(migrateLegacyState(root), true);
    assert.equal(fs.readFileSync(resolveFrontierStatePath(root, 'state', 'marker.txt'), 'utf8'), 'legacy');
    assert.equal(fs.existsSync(path.join(root, '.frontier', 'agentx-cli.ps1')), false);
    assert.equal(fs.readFileSync(path.join(root, '.agentx', 'agentx-cli.ps1'), 'utf8'), 'runtime');
    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.frontier'));
    assert.equal(migrateLegacyState(root), false);
  });

  it('migrates transitional HVE state once and makes Frontier authoritative', () => {
    fs.mkdirSync(path.join(root, '.hve', 'state'), { recursive: true });
    fs.writeFileSync(path.join(root, '.hve', 'state', 'marker.txt'), 'transitional');

    assert.equal(migrateLegacyState(root), true);
    assert.equal(fs.readFileSync(resolveFrontierStatePath(root, 'state', 'marker.txt'), 'utf8'), 'transitional');
    assert.equal(resolveFrontierStateDirectory(root), path.join(root, '.frontier'));
  });

  it('never overwrites existing Frontier state with legacy state', () => {
    fs.mkdirSync(path.join(root, '.frontier'), { recursive: true });
    fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{"provider":"github"}');
    fs.writeFileSync(path.join(root, '.agentx', 'config.json'), '{"provider":"local"}');

    assert.equal(migrateLegacyState(root), false);
    assert.equal(fs.readFileSync(path.join(root, '.frontier', 'config.json'), 'utf8'), '{"provider":"github"}');
  });

  it('fills partial HVE and Frontier state without losing AgentX backlog or resurrecting deleted data', () => {
    for (const directory of ['.frontier', '.hve', '.agentx/issues', '.agentx/state']) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    fs.writeFileSync(path.join(root, '.hve/config.json'), '{"provider":"local"}');
    fs.writeFileSync(path.join(root, '.agentx/config.json'), '{"provider":"github"}');
    fs.writeFileSync(path.join(root, '.agentx/issues/1.json'), '{"number":1}');
    fs.writeFileSync(path.join(root, '.agentx/state/history.json'), '[]');
    assert.equal(migrateLegacyState(root), true);
    assert.equal(fs.readFileSync(path.join(root, '.frontier/config.json'), 'utf8'), '{"provider":"local"}');
    assert.equal(fs.readFileSync(path.join(root, '.frontier/issues/1.json'), 'utf8'), '{"number":1}');
    assert.ok(fs.existsSync(path.join(root, '.frontier/state/history.json')));
    fs.unlinkSync(path.join(root, '.frontier/issues/1.json'));
    assert.equal(migrateLegacyState(root), false);
    assert.equal(fs.existsSync(path.join(root, '.frontier/issues/1.json')), false);
  });

  it('refuses concurrent migration and rejects a linked marker directory', () => {
    fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
    fs.mkdirSync(path.join(root, '.frontier-migration.lock'));
    assert.throws(() => migrateLegacyState(root), /busy/);
    assert.equal(fs.existsSync(path.join(root, '.frontier/state/frontier-migration-v1.json')), false);
    fs.rmdirSync(path.join(root, '.frontier-migration.lock'));
    fs.mkdirSync(path.join(root, 'outside'));
    fs.mkdirSync(path.join(root, '.frontier'));
    fs.symlinkSync(path.join(root, 'outside'), path.join(root, '.frontier/state'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => migrateLegacyState(root), /symbolic links/);
    assert.deepEqual(fs.readdirSync(path.join(root, 'outside')), []);
  });
});