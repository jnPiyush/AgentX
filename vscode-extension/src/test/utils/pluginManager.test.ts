import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PluginManager } from '../../utils/pluginManager';
import type { PluginManifest } from '../../utils/pluginManager';
import { AgentEventBus } from '../../utils/eventBus';

describe('PluginManager', () => {

  let pm: PluginManager;
  let bus: AgentEventBus;
  let tmpDir: string;

  beforeEach(() => {
    bus = new AgentEventBus();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-plugin-'));
    pm = new PluginManager(tmpDir, bus);
  });

  afterEach(() => {
    bus.dispose();
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
  });

  function createTestPlugin(name: string, type: PluginManifest['type'] = 'tool'): string {
    const pluginDir = path.join(tmpDir, 'plugins', name);
    fs.mkdirSync(pluginDir, { recursive: true });

    const manifest: PluginManifest = {
      name,
      version: '1.0.0',
      description: `Test plugin ${name}`,
      type,
      entry: { pwsh: `${name}.ps1`, bash: `${name}.sh` },
      tags: ['test'],
      maturity: 'stable',
    };

    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(manifest, null, 2),
    );
    fs.writeFileSync(path.join(pluginDir, `${name}.ps1`), '# stub');
    fs.writeFileSync(path.join(pluginDir, `${name}.sh`), '# stub');
    fs.writeFileSync(path.join(pluginDir, '.installed'), new Date().toISOString());

    return pluginDir;
  }

  it('should list no plugins when empty', () => {
    assert.equal(pm.list().length, 0);
  });

  it('should discover installed plugins', () => {
    createTestPlugin('my-tool');
    const plugins = pm.list();
    assert.equal(plugins.length, 1);
    assert.equal(plugins[0].manifest.name, 'my-tool');
    assert.equal(plugins[0].manifest.type, 'tool');
  });

  it('should discover multiple plugins', () => {
    createTestPlugin('tool-a');
    createTestPlugin('tool-b', 'skill');
    const plugins = pm.list();
    assert.equal(plugins.length, 2);
  });

  it('should get a specific plugin by name', () => {
    createTestPlugin('find-me');
    const found = pm.get('find-me');
    assert.ok(found);
    assert.equal(found.manifest.name, 'find-me');
    assert.equal(pm.get('nonexistent'), undefined);
  });

  it('should filter plugins by type', () => {
    createTestPlugin('t1', 'tool');
    createTestPlugin('s1', 'skill');
    createTestPlugin('t2', 'tool');
    assert.equal(pm.listByType('tool').length, 2);
    assert.equal(pm.listByType('skill').length, 1);
    assert.equal(pm.listByType('agent').length, 0);
  });

  it('should install from a local directory', () => {
    // Create a source directory outside plugins/
    const srcDir = path.join(tmpDir, 'external-plugin');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'plugin.json'), JSON.stringify({
      name: 'ext-tool',
      version: '2.0.0',
      description: 'External tool',
      type: 'tool',
      entry: { pwsh: 'run.ps1' },
    }));
    fs.writeFileSync(path.join(srcDir, 'run.ps1'), '# external');

    const installed = pm.installFromDir(srcDir);
    assert.equal(installed.manifest.name, 'ext-tool');
    assert.equal(installed.manifest.version, '2.0.0');

    // Should now appear in list
    assert.equal(pm.list().length, 1);
    assert.equal(pm.get('ext-tool')!.manifest.version, '2.0.0');
  });

  it('should replace existing plugin on reinstall', () => {
    createTestPlugin('upgradeable');
    assert.equal(pm.get('upgradeable')!.manifest.version, '1.0.0');

    const srcDir = path.join(tmpDir, 'upgrade-src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'plugin.json'), JSON.stringify({
      name: 'upgradeable',
      version: '2.0.0',
      description: 'Upgraded',
      type: 'tool',
      entry: { pwsh: 'run.ps1' },
    }));
    fs.writeFileSync(path.join(srcDir, 'run.ps1'), '# v2');

    pm.installFromDir(srcDir);
    assert.equal(pm.get('upgradeable')!.manifest.version, '2.0.0');
    assert.equal(pm.list().length, 1);
  });

  it('should remove a plugin', () => {
    createTestPlugin('to-remove');
    assert.equal(pm.list().length, 1);

    assert.equal(pm.remove('to-remove'), true);
    assert.equal(pm.list().length, 0);
    assert.equal(pm.remove('nonexistent'), false);
  });

  it('should scaffold a new plugin', () => {
    const dir = pm.scaffold('new-tool', 'tool', 'A new tool');

    // Check files were created
    assert.ok(fs.existsSync(path.join(dir, 'plugin.json')));
    assert.ok(fs.existsSync(path.join(dir, 'new-tool.ps1')));
    assert.ok(fs.existsSync(path.join(dir, 'README.md')));

    // Check manifest
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf-8'));
    assert.equal(manifest.name, 'new-tool');
    assert.equal(manifest.type, 'tool');
    assert.equal(manifest.version, '1.0.0');
  });

  it('should throw when scaffolding a duplicate name', () => {
    pm.scaffold('dupe', 'tool', 'first');
    assert.throws(() => pm.scaffold('dupe', 'tool', 'second'), /already exists/);
  });

  it('should build run command for pwsh', () => {
    createTestPlugin('runner');
    const cmd = pm.buildRunCommand('runner', { Folders: 'docs/prd' }, 'pwsh');
    assert.ok(cmd.includes('runner.ps1') || cmd.includes('runner.sh'));
    assert.ok(cmd.includes('Folders') || cmd.includes('folders'));
  });

  it('should build run command for bash', () => {
    createTestPlugin('runner');
    const cmd = pm.buildRunCommand('runner', { folders: 'docs/prd' }, 'bash');
    assert.ok(cmd.includes('runner'));
  });

  it('should fall back to node entry when preferred shell entry is missing', () => {
    const pluginDir = path.join(tmpDir, 'plugins', 'legacy-node');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      name: 'legacy-node',
      version: '1.0.0',
      description: 'legacy',
      type: 'tool',
      entry: { pwsh: 'legacy-node.ps1', node: 'legacy-node.mjs' },
    }));
    fs.writeFileSync(path.join(pluginDir, 'legacy-node.mjs'), '// legacy node script');
    fs.writeFileSync(path.join(pluginDir, '.installed'), new Date().toISOString());

    const cmd = pm.buildRunCommand('legacy-node', {}, 'pwsh');
    assert.ok(cmd.includes('node'));
    assert.ok(cmd.includes('legacy-node.mjs'));
  });

  it('should throw when running nonexistent plugin', () => {
    assert.throws(() => pm.buildRunCommand('nope'), /not installed/);
  });

  it('should validate manifest - bad name', () => {
    assert.throws(
      () => pm.validateManifest({ name: 'Bad Name', version: '1.0.0', type: 'tool', entry: { pwsh: 'x.ps1' }, description: 'x' }),
      /Invalid plugin name/,
    );
  });

  it('should validate manifest - bad version', () => {
    assert.throws(
      () => pm.validateManifest({ name: 'ok', version: 'bad', type: 'tool', entry: { pwsh: 'x.ps1' }, description: 'x' }),
      /Invalid version/,
    );
  });

  it('should validate manifest - no entry', () => {
    assert.throws(
      () => pm.validateManifest({ name: 'ok', version: '1.0.0', type: 'tool', entry: {} as any, description: 'x' }),
      /entry point/,
    );
  });

  it('should manage catalog', () => {
    assert.equal(pm.getCatalog().length, 0);

    pm.saveCatalog([
      { name: 'remote-plugin', version: '1.0.0', description: 'Remote', type: 'tool', source: 'https://example.com' },
    ]);

    const catalog = pm.getCatalog();
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].name, 'remote-plugin');
  });

  it('should emit state-change events on install and remove', () => {
    const events: string[] = [];
    bus.on('state-change', (e) => events.push(e.newState));

    const srcDir = path.join(tmpDir, 'evented');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'plugin.json'), JSON.stringify({
      name: 'evented', version: '1.0.0', description: 'x', type: 'tool', entry: { pwsh: 'x.ps1' },
    }));
    fs.writeFileSync(path.join(srcDir, 'x.ps1'), '#');

    pm.installFromDir(srcDir);
    pm.remove('evented');

    assert.ok(events.includes('installed:evented'));
    assert.ok(events.includes('removed:evented'));
  });
});
