"use strict";
// ---------------------------------------------------------------------------
// AgentX -- Plugin Manager
// ---------------------------------------------------------------------------
//
// Discovers, installs, removes, and runs plugins from the .agentx/plugins/
// directory. Each plugin is a folder with a plugin.json manifest and entry
// scripts (PowerShell, Bash, or Node.js).
//
// Plugin types:
//   tool     - Standalone utilities (convert-docs, scan-secrets, etc.)
//   skill    - Additional skill packs
//   agent    - Custom agent definitions
//   channel  - Communication channel extensions
//   workflow  - Custom workflow templates
// ---------------------------------------------------------------------------
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
exports.PluginManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ---------------------------------------------------------------------------
// Plugin Manager
// ---------------------------------------------------------------------------
/**
 * Manages the lifecycle of AgentX plugins.
 *
 * Usage:
 * ```ts
 * const pm = new PluginManager('/path/to/.agentx', eventBus);
 * const plugins = pm.list();
 * const result = await pm.run('convert-docs', { folders: 'docs/prd' });
 * ```
 */
class PluginManager {
    pluginsDir;
    catalogPath;
    eventBus;
    constructor(agentxDir, eventBus) {
        this.pluginsDir = path.join(agentxDir, 'plugins');
        this.catalogPath = path.join(agentxDir, 'plugin-catalog.json');
        this.eventBus = eventBus;
        // Ensure plugins directory exists
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }
    }
    // -----------------------------------------------------------------------
    // Discovery
    // -----------------------------------------------------------------------
    /**
     * List all installed plugins.
     */
    list() {
        if (!fs.existsSync(this.pluginsDir)) {
            return [];
        }
        const plugins = [];
        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const manifestPath = path.join(this.pluginsDir, entry.name, 'plugin.json');
            if (!fs.existsSync(manifestPath)) {
                continue;
            }
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const statPath = path.join(this.pluginsDir, entry.name, '.installed');
                const installedAt = fs.existsSync(statPath)
                    ? fs.readFileSync(statPath, 'utf-8').trim()
                    : 'unknown';
                plugins.push({
                    manifest,
                    pluginDir: path.join(this.pluginsDir, entry.name),
                    installedAt,
                });
            }
            catch {
                // Skip invalid manifests
            }
        }
        return plugins;
    }
    /**
     * Get a specific installed plugin by name.
     */
    get(name) {
        return this.list().find((p) => p.manifest.name === name);
    }
    /**
     * List plugins filtered by type.
     */
    listByType(type) {
        return this.list().filter((p) => p.manifest.type === type);
    }
    // -----------------------------------------------------------------------
    // Install
    // -----------------------------------------------------------------------
    /**
     * Install a plugin from a local directory.
     * Copies the plugin folder into .agentx/plugins/{name}/.
     */
    installFromDir(sourceDir) {
        const manifestPath = path.join(sourceDir, 'plugin.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`No plugin.json found in ${sourceDir}`);
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        this.validateManifest(manifest);
        const destDir = path.join(this.pluginsDir, manifest.name);
        // Remove existing version if present
        if (fs.existsSync(destDir)) {
            fs.rmSync(destDir, { recursive: true, force: true });
        }
        // Copy plugin files
        this.copyDirRecursive(sourceDir, destDir);
        // Write install timestamp
        fs.writeFileSync(path.join(destDir, '.installed'), new Date().toISOString());
        if (this.eventBus) {
            this.eventBus.emit('state-change', {
                source: 'plugin-manager',
                newState: `installed:${manifest.name}`,
                timestamp: Date.now(),
            });
        }
        return {
            manifest,
            pluginDir: destDir,
            installedAt: new Date().toISOString(),
        };
    }
    /**
     * Create a new plugin scaffold in .agentx/plugins/{name}/.
     */
    scaffold(name, type, description) {
        const pluginDir = path.join(this.pluginsDir, name);
        if (fs.existsSync(pluginDir)) {
            throw new Error(`Plugin '${name}' already exists at ${pluginDir}`);
        }
        fs.mkdirSync(pluginDir, { recursive: true });
        const manifest = {
            name,
            version: '1.0.0',
            description,
            type,
            entry: {
                node: `${name}.mjs`,
            },
            args: [],
            requires: [],
            tags: [type],
            maturity: 'experimental',
        };
        fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
        // Create stub Node.js entry script
        fs.writeFileSync(path.join(pluginDir, `${name}.mjs`), [
            '#!/usr/bin/env node',
            `// AgentX Plugin: ${name}`,
            `// ${description}`,
            '',
            `console.log('Plugin ${name} running...');`,
            '',
        ].join('\n'));
        fs.writeFileSync(path.join(pluginDir, 'README.md'), [
            `# ${name}`,
            '',
            description,
            '',
            '## Usage',
            '',
            '```bash',
            `node .agentx/plugins/${name}/${name}.mjs`,
            '```',
            '',
        ].join('\n'));
        return pluginDir;
    }
    // -----------------------------------------------------------------------
    // Remove
    // -----------------------------------------------------------------------
    /**
     * Remove an installed plugin by name.
     */
    remove(name) {
        const pluginDir = path.join(this.pluginsDir, name);
        if (!fs.existsSync(pluginDir)) {
            return false;
        }
        fs.rmSync(pluginDir, { recursive: true, force: true });
        if (this.eventBus) {
            this.eventBus.emit('state-change', {
                source: 'plugin-manager',
                newState: `removed:${name}`,
                timestamp: Date.now(),
            });
        }
        return true;
    }
    // -----------------------------------------------------------------------
    // Run
    // -----------------------------------------------------------------------
    /**
     * Build the shell command to run a plugin.
     *
     * @param name - Plugin name.
     * @param args - Key-value arguments.
     * @param shell - Target shell ('pwsh' or 'bash').
     * @returns The command string ready for execution.
     */
    buildRunCommand(name, args = {}, shell = 'pwsh') {
        const plugin = this.get(name);
        if (!plugin) {
            throw new Error(`Plugin '${name}' is not installed.`);
        }
        // Prefer node entry, fall back to shell-specific
        const entry = plugin.manifest.entry.node
            ?? (shell === 'bash' ? plugin.manifest.entry.bash : plugin.manifest.entry.pwsh);
        if (!entry) {
            throw new Error(`Plugin '${name}' has no ${shell} entry point.`);
        }
        const scriptPath = path.join(plugin.pluginDir, entry);
        // Build argument string
        const argParts = [];
        for (const [key, value] of Object.entries(args)) {
            if (shell === 'pwsh') {
                argParts.push(`-${key} "${value}"`);
            }
            else {
                argParts.push(`--${key} "${value}"`);
            }
        }
        const argStr = argParts.length > 0 ? ' ' + argParts.join(' ') : '';
        // Node.js entries use 'node' command
        if (entry === plugin.manifest.entry.node) {
            return `node "${scriptPath}"${argStr}`;
        }
        if (shell === 'pwsh') {
            return `& "${scriptPath}"${argStr}`;
        }
        return `bash "${scriptPath}"${argStr}`;
    }
    // -----------------------------------------------------------------------
    // Catalog
    // -----------------------------------------------------------------------
    /**
     * Get the local plugin catalog (available plugins for install).
     */
    getCatalog() {
        if (!fs.existsSync(this.catalogPath)) {
            return [];
        }
        try {
            const data = JSON.parse(fs.readFileSync(this.catalogPath, 'utf-8'));
            return Array.isArray(data) ? data : [];
        }
        catch {
            return [];
        }
    }
    /**
     * Save a catalog to disk.
     */
    saveCatalog(catalog) {
        fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2));
    }
    // -----------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------
    /**
     * Validate a plugin manifest.
     */
    validateManifest(manifest) {
        if (!manifest.name || !/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
            throw new Error(`Invalid plugin name: '${manifest.name}'. Must be kebab-case.`);
        }
        if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
            throw new Error(`Invalid version: '${manifest.version}'. Must be semver.`);
        }
        if (!manifest.type) {
            throw new Error('Plugin manifest missing "type" field.');
        }
        if (!manifest.entry || Object.keys(manifest.entry).length === 0) {
            throw new Error('Plugin manifest must have at least one entry point.');
        }
    }
    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    copyDirRecursive(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirRecursive(srcPath, destPath);
            }
            else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
exports.PluginManager = PluginManager;
//# sourceMappingURL=pluginManager.js.map