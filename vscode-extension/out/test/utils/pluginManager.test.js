"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const pluginManager_1 = require("../../utils/pluginManager");
const eventBus_1 = require("../../utils/eventBus");
describe('PluginManager', () => {
    let pm;
    let bus;
    let tmpDir;
    beforeEach(() => {
        bus = new eventBus_1.AgentEventBus();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-plugin-'));
        pm = new pluginManager_1.PluginManager(tmpDir, bus);
    });
    afterEach(() => {
        bus.dispose();
        try {
            fs.rmSync(tmpDir, { recursive: true });
        }
        catch { /* ok */ }
    });
    function createTestPlugin(name, type = 'tool') {
        const pluginDir = path.join(tmpDir, 'plugins', name);
        fs.mkdirSync(pluginDir, { recursive: true });
        const manifest = {
            name,
            version: '1.0.0',
            description: `Test plugin ${name}`,
            type,
            entry: { pwsh: `${name}.ps1`, bash: `${name}.sh` },
            tags: ['test'],
            maturity: 'stable',
        };
        fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
        fs.writeFileSync(path.join(pluginDir, `${name}.ps1`), '# stub');
        fs.writeFileSync(path.join(pluginDir, `${name}.sh`), '# stub');
        fs.writeFileSync(path.join(pluginDir, '.installed'), new Date().toISOString());
        return pluginDir;
    }
    it('should list no plugins when empty', () => {
        assert_1.strict.equal(pm.list().length, 0);
    });
    it('should discover installed plugins', () => {
        createTestPlugin('my-tool');
        const plugins = pm.list();
        assert_1.strict.equal(plugins.length, 1);
        assert_1.strict.equal(plugins[0].manifest.name, 'my-tool');
        assert_1.strict.equal(plugins[0].manifest.type, 'tool');
    });
    it('should discover multiple plugins', () => {
        createTestPlugin('tool-a');
        createTestPlugin('tool-b', 'skill');
        const plugins = pm.list();
        assert_1.strict.equal(plugins.length, 2);
    });
    it('should get a specific plugin by name', () => {
        createTestPlugin('find-me');
        const found = pm.get('find-me');
        assert_1.strict.ok(found);
        assert_1.strict.equal(found.manifest.name, 'find-me');
        assert_1.strict.equal(pm.get('nonexistent'), undefined);
    });
    it('should filter plugins by type', () => {
        createTestPlugin('t1', 'tool');
        createTestPlugin('s1', 'skill');
        createTestPlugin('t2', 'tool');
        assert_1.strict.equal(pm.listByType('tool').length, 2);
        assert_1.strict.equal(pm.listByType('skill').length, 1);
        assert_1.strict.equal(pm.listByType('agent').length, 0);
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
        assert_1.strict.equal(installed.manifest.name, 'ext-tool');
        assert_1.strict.equal(installed.manifest.version, '2.0.0');
        // Should now appear in list
        assert_1.strict.equal(pm.list().length, 1);
        assert_1.strict.equal(pm.get('ext-tool').manifest.version, '2.0.0');
    });
    it('should replace existing plugin on reinstall', () => {
        createTestPlugin('upgradeable');
        assert_1.strict.equal(pm.get('upgradeable').manifest.version, '1.0.0');
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
        assert_1.strict.equal(pm.get('upgradeable').manifest.version, '2.0.0');
        assert_1.strict.equal(pm.list().length, 1);
    });
    it('should remove a plugin', () => {
        createTestPlugin('to-remove');
        assert_1.strict.equal(pm.list().length, 1);
        assert_1.strict.equal(pm.remove('to-remove'), true);
        assert_1.strict.equal(pm.list().length, 0);
        assert_1.strict.equal(pm.remove('nonexistent'), false);
    });
    it('should scaffold a new plugin', () => {
        const dir = pm.scaffold('new-tool', 'tool', 'A new tool');
        // Check files were created
        assert_1.strict.ok(fs.existsSync(path.join(dir, 'plugin.json')));
        assert_1.strict.ok(fs.existsSync(path.join(dir, 'new-tool.ps1')));
        assert_1.strict.ok(fs.existsSync(path.join(dir, 'new-tool.sh')));
        assert_1.strict.ok(fs.existsSync(path.join(dir, 'README.md')));
        // Check manifest
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf-8'));
        assert_1.strict.equal(manifest.name, 'new-tool');
        assert_1.strict.equal(manifest.type, 'tool');
        assert_1.strict.equal(manifest.version, '1.0.0');
    });
    it('should throw when scaffolding a duplicate name', () => {
        pm.scaffold('dupe', 'tool', 'first');
        assert_1.strict.throws(() => pm.scaffold('dupe', 'tool', 'second'), /already exists/);
    });
    it('should build run command for pwsh', () => {
        createTestPlugin('runner');
        const cmd = pm.buildRunCommand('runner', { Folders: 'docs/prd' }, 'pwsh');
        assert_1.strict.ok(cmd.includes('runner.ps1'));
        assert_1.strict.ok(cmd.includes('-Folders "docs/prd"'));
    });
    it('should build run command for bash', () => {
        createTestPlugin('runner');
        const cmd = pm.buildRunCommand('runner', { folders: 'docs/prd' }, 'bash');
        assert_1.strict.ok(cmd.includes('runner.sh'));
        assert_1.strict.ok(cmd.includes('--folders "docs/prd"'));
    });
    it('should throw when running nonexistent plugin', () => {
        assert_1.strict.throws(() => pm.buildRunCommand('nope'), /not installed/);
    });
    it('should validate manifest - bad name', () => {
        assert_1.strict.throws(() => pm.validateManifest({ name: 'Bad Name', version: '1.0.0', type: 'tool', entry: { pwsh: 'x.ps1' }, description: 'x' }), /Invalid plugin name/);
    });
    it('should validate manifest - bad version', () => {
        assert_1.strict.throws(() => pm.validateManifest({ name: 'ok', version: 'bad', type: 'tool', entry: { pwsh: 'x.ps1' }, description: 'x' }), /Invalid version/);
    });
    it('should validate manifest - no entry', () => {
        assert_1.strict.throws(() => pm.validateManifest({ name: 'ok', version: '1.0.0', type: 'tool', entry: {}, description: 'x' }), /entry point/);
    });
    it('should manage catalog', () => {
        assert_1.strict.equal(pm.getCatalog().length, 0);
        pm.saveCatalog([
            { name: 'remote-plugin', version: '1.0.0', description: 'Remote', type: 'tool', source: 'https://example.com' },
        ]);
        const catalog = pm.getCatalog();
        assert_1.strict.equal(catalog.length, 1);
        assert_1.strict.equal(catalog[0].name, 'remote-plugin');
    });
    it('should emit state-change events on install and remove', () => {
        const events = [];
        bus.on('state-change', (e) => events.push(e.newState));
        const srcDir = path.join(tmpDir, 'evented');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'plugin.json'), JSON.stringify({
            name: 'evented', version: '1.0.0', description: 'x', type: 'tool', entry: { pwsh: 'x.ps1' },
        }));
        fs.writeFileSync(path.join(srcDir, 'x.ps1'), '#');
        pm.installFromDir(srcDir);
        pm.remove('evented');
        assert_1.strict.ok(events.includes('installed:evented'));
        assert_1.strict.ok(events.includes('removed:evented'));
    });
});
//# sourceMappingURL=pluginManager.test.js.map