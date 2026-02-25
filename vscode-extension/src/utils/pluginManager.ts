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

import * as fs from 'fs';
import * as path from 'path';
import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Plugin manifest (plugin.json).
 */
export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly type: 'tool' | 'skill' | 'agent' | 'channel' | 'workflow';
  readonly entry: {
    pwsh?: string;
    bash?: string;
    node?: string;
  };
  readonly args?: PluginArg[];
  readonly requires?: string[];
  readonly tags?: string[];
  readonly maturity?: 'experimental' | 'preview' | 'stable' | 'deprecated';
  readonly source?: string;
}

export interface PluginArg {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
  readonly default?: string;
}

/**
 * Installed plugin with resolved paths.
 */
export interface InstalledPlugin {
  readonly manifest: PluginManifest;
  readonly pluginDir: string;
  readonly installedAt: string;
}

/**
 * Remote plugin entry in the catalog.
 */
export interface CatalogEntry {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly type: PluginManifest['type'];
  readonly source: string;
  readonly tags?: string[];
  readonly maturity?: string;
}

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
export class PluginManager {
  private readonly pluginsDir: string;
  private readonly catalogPath: string;
  private readonly eventBus: AgentEventBus | undefined;

  constructor(agentxDir: string, eventBus?: AgentEventBus) {
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
  list(): InstalledPlugin[] {
    if (!fs.existsSync(this.pluginsDir)) { return []; }

    const plugins: InstalledPlugin[] = [];
    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) { continue; }

      const manifestPath = path.join(this.pluginsDir, entry.name, 'plugin.json');
      if (!fs.existsSync(manifestPath)) { continue; }

      try {
        const manifest = JSON.parse(
          fs.readFileSync(manifestPath, 'utf-8'),
        ) as PluginManifest;

        const statPath = path.join(this.pluginsDir, entry.name, '.installed');
        const installedAt = fs.existsSync(statPath)
          ? fs.readFileSync(statPath, 'utf-8').trim()
          : 'unknown';

        plugins.push({
          manifest,
          pluginDir: path.join(this.pluginsDir, entry.name),
          installedAt,
        });
      } catch {
        // Skip invalid manifests
      }
    }

    return plugins;
  }

  /**
   * Get a specific installed plugin by name.
   */
  get(name: string): InstalledPlugin | undefined {
    return this.list().find((p) => p.manifest.name === name);
  }

  /**
   * List plugins filtered by type.
   */
  listByType(type: PluginManifest['type']): InstalledPlugin[] {
    return this.list().filter((p) => p.manifest.type === type);
  }

  // -----------------------------------------------------------------------
  // Install
  // -----------------------------------------------------------------------

  /**
   * Install a plugin from a local directory.
   * Copies the plugin folder into .agentx/plugins/{name}/.
   */
  installFromDir(sourceDir: string): InstalledPlugin {
    const manifestPath = path.join(sourceDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`No plugin.json found in ${sourceDir}`);
    }

    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf-8'),
    ) as PluginManifest;

    this.validateManifest(manifest);

    const destDir = path.join(this.pluginsDir, manifest.name);

    // Remove existing version if present
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    // Copy plugin files
    this.copyDirRecursive(sourceDir, destDir);

    // Write install timestamp
    fs.writeFileSync(
      path.join(destDir, '.installed'),
      new Date().toISOString(),
    );

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
  scaffold(name: string, type: PluginManifest['type'], description: string): string {
    const pluginDir = path.join(this.pluginsDir, name);
    if (fs.existsSync(pluginDir)) {
      throw new Error(`Plugin '${name}' already exists at ${pluginDir}`);
    }

    fs.mkdirSync(pluginDir, { recursive: true });

    const manifest: PluginManifest = {
      name,
      version: '1.0.0',
      description,
      type,
      entry: {
        pwsh: `${name}.ps1`,
        bash: `${name}.sh`,
      },
      args: [],
      requires: [],
      tags: [type],
      maturity: 'experimental',
    };

    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(manifest, null, 2),
    );

    // Create stub entry scripts
    fs.writeFileSync(
      path.join(pluginDir, `${name}.ps1`),
      [
        '#!/usr/bin/env pwsh',
        `# AgentX Plugin: ${name}`,
        `# ${description}`,
        '',
        'param(',
        '  [string]$Action = "run"',
        ')',
        '',
        'Write-Host "Plugin ${name} running..." -ForegroundColor Cyan',
        '',
      ].join('\n'),
    );

    fs.writeFileSync(
      path.join(pluginDir, `${name}.sh`),
      [
        '#!/bin/bash',
        `# AgentX Plugin: ${name}`,
        `# ${description}`,
        '',
        `echo "Plugin ${name} running..."`,
        '',
      ].join('\n'),
    );

    fs.writeFileSync(
      path.join(pluginDir, 'README.md'),
      [
        `# ${name}`,
        '',
        description,
        '',
        '## Usage',
        '',
        '```powershell',
        `./.agentx/plugins/${name}/${name}.ps1`,
        '```',
        '',
        '```bash',
        `./.agentx/plugins/${name}/${name}.sh`,
        '```',
        '',
      ].join('\n'),
    );

    return pluginDir;
  }

  // -----------------------------------------------------------------------
  // Remove
  // -----------------------------------------------------------------------

  /**
   * Remove an installed plugin by name.
   */
  remove(name: string): boolean {
    const pluginDir = path.join(this.pluginsDir, name);
    if (!fs.existsSync(pluginDir)) { return false; }

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
  buildRunCommand(
    name: string,
    args: Record<string, string> = {},
    shell: 'pwsh' | 'bash' = 'pwsh',
  ): string {
    const plugin = this.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' is not installed.`);
    }

    const entry = shell === 'bash'
      ? plugin.manifest.entry.bash
      : plugin.manifest.entry.pwsh;

    if (!entry) {
      throw new Error(`Plugin '${name}' has no ${shell} entry point.`);
    }

    const scriptPath = path.join(plugin.pluginDir, entry);

    // Build argument string
    const argParts: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (shell === 'pwsh') {
        argParts.push(`-${key} "${value}"`);
      } else {
        argParts.push(`--${key} "${value}"`);
      }
    }
    const argStr = argParts.length > 0 ? ' ' + argParts.join(' ') : '';

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
  getCatalog(): CatalogEntry[] {
    if (!fs.existsSync(this.catalogPath)) { return []; }
    try {
      const data = JSON.parse(fs.readFileSync(this.catalogPath, 'utf-8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a catalog to disk.
   */
  saveCatalog(catalog: CatalogEntry[]): void {
    fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2));
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validate a plugin manifest.
   */
  validateManifest(manifest: PluginManifest): void {
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

  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
