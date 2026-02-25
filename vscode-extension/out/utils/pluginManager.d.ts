import { AgentEventBus } from './eventBus';
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
export declare class PluginManager {
    private readonly pluginsDir;
    private readonly catalogPath;
    private readonly eventBus;
    constructor(agentxDir: string, eventBus?: AgentEventBus);
    /**
     * List all installed plugins.
     */
    list(): InstalledPlugin[];
    /**
     * Get a specific installed plugin by name.
     */
    get(name: string): InstalledPlugin | undefined;
    /**
     * List plugins filtered by type.
     */
    listByType(type: PluginManifest['type']): InstalledPlugin[];
    /**
     * Install a plugin from a local directory.
     * Copies the plugin folder into .agentx/plugins/{name}/.
     */
    installFromDir(sourceDir: string): InstalledPlugin;
    /**
     * Create a new plugin scaffold in .agentx/plugins/{name}/.
     */
    scaffold(name: string, type: PluginManifest['type'], description: string): string;
    /**
     * Remove an installed plugin by name.
     */
    remove(name: string): boolean;
    /**
     * Build the shell command to run a plugin.
     *
     * @param name - Plugin name.
     * @param args - Key-value arguments.
     * @param shell - Target shell ('pwsh' or 'bash').
     * @returns The command string ready for execution.
     */
    buildRunCommand(name: string, args?: Record<string, string>, shell?: 'pwsh' | 'bash'): string;
    /**
     * Get the local plugin catalog (available plugins for install).
     */
    getCatalog(): CatalogEntry[];
    /**
     * Save a catalog to disk.
     */
    saveCatalog(catalog: CatalogEntry[]): void;
    /**
     * Validate a plugin manifest.
     */
    validateManifest(manifest: PluginManifest): void;
    private copyDirRecursive;
}
//# sourceMappingURL=pluginManager.d.ts.map