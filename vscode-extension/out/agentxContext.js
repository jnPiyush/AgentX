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
exports.AgentXContext = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const shell_1 = require("./utils/shell");
const eventBus_1 = require("./utils/eventBus");
const thinkingLog_1 = require("./utils/thinkingLog");
const contextCompactor_1 = require("./utils/contextCompactor");
/**
 * Check whether a directory looks like an AgentX root
 * (contains both AGENTS.md and .agentx/).
 */
function isAgentXRoot(dir) {
    return fs.existsSync(path.join(dir, 'AGENTS.md'))
        && fs.existsSync(path.join(dir, '.agentx'));
}
/**
 * Recursively search for an AgentX root inside `dir`, up to `depth` levels.
 * Returns the first match or undefined.
 */
function findAgentXRootInDir(dir, depth) {
    if (isAgentXRoot(dir)) {
        return dir;
    }
    if (depth <= 0) {
        return undefined;
    }
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return undefined; // permission error, symlink loop, etc.
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        // Skip hidden dirs (except .agentx which we already checked above),
        // node_modules, and other noisy directories.
        if (entry.name.startsWith('.') || entry.name === 'node_modules'
            || entry.name === 'dist' || entry.name === 'out'
            || entry.name === 'build' || entry.name === '__pycache__') {
            continue;
        }
        const found = findAgentXRootInDir(path.join(dir, entry.name), depth - 1);
        if (found) {
            return found;
        }
    }
    return undefined;
}
/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
class AgentXContext {
    extensionContext;
    /** Cached AgentX root path (invalidated on config / workspace change). */
    _cachedRoot;
    _cacheValid = false;
    /** Core infrastructure services. */
    eventBus;
    thinkingLog;
    contextCompactor;
    /** Optional services set after construction via setServices(). */
    _services;
    constructor(extensionContext, eventBus, thinkingLog, contextCompactor) {
        this.extensionContext = extensionContext;
        this.eventBus = eventBus ?? new eventBus_1.AgentEventBus();
        this.thinkingLog = thinkingLog ?? new thinkingLog_1.ThinkingLog(this.eventBus);
        this.contextCompactor = contextCompactor ?? new contextCompactor_1.ContextCompactor(this.eventBus);
        // Invalidate cache when configuration or workspace folders change.
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('agentx')) {
                this.invalidateCache();
            }
        });
        vscode.workspace.onDidChangeWorkspaceFolders(() => this.invalidateCache());
    }
    /**
     * Inject optional services (channelRouter, taskScheduler) after construction.
     */
    setServices(services) {
        this._services = services;
    }
    /** Get the channel router (if available). */
    get channelRouter() {
        return this._services?.channelRouter;
    }
    /** Get the task scheduler (if available). */
    get taskScheduler() {
        return this._services?.taskScheduler;
    }
    /** Get the plugin manager (if available). */
    get pluginManager() {
        return this._services?.pluginManager;
    }
    /** Invalidate the cached root so the next access re-discovers it. */
    invalidateCache() {
        this._cacheValid = false;
        this._cachedRoot = undefined;
    }
    /**
     * Returns the first workspace folder path (used by the initialize command
     * which always installs into the top-level workspace folder).
     */
    get firstWorkspaceFolder() {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    /**
     * Returns the detected AgentX project root.
     *
     * Resolution order:
     * 1. Explicit `agentx.rootPath` setting (if set and valid).
     * 2. Search every workspace folder root for AGENTS.md + .agentx/.
     * 3. Search subdirectories of each workspace folder up to
     *    `agentx.searchDepth` levels (default 2).
     * 4. Fall back to the first workspace folder (legacy behaviour).
     */
    get workspaceRoot() {
        if (this._cacheValid) {
            return this._cachedRoot;
        }
        const config = vscode.workspace.getConfiguration('agentx');
        // 1. Explicit override
        const explicit = config.get('rootPath', '').trim();
        if (explicit && fs.existsSync(explicit) && isAgentXRoot(explicit)) {
            this._cachedRoot = explicit;
            this._cacheValid = true;
            return this._cachedRoot;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            this._cachedRoot = undefined;
            this._cacheValid = true;
            return undefined;
        }
        // 2. Check each workspace folder root directly
        for (const folder of folders) {
            if (isAgentXRoot(folder.uri.fsPath)) {
                this._cachedRoot = folder.uri.fsPath;
                this._cacheValid = true;
                return this._cachedRoot;
            }
        }
        // 3. Search subdirectories up to configured depth
        const searchDepth = config.get('searchDepth', 2);
        for (const folder of folders) {
            const found = findAgentXRootInDir(folder.uri.fsPath, searchDepth);
            if (found) {
                this._cachedRoot = found;
                this._cacheValid = true;
                return this._cachedRoot;
            }
        }
        // 4. Fallback to first workspace folder (for initialize command)
        this._cachedRoot = folders[0].uri.fsPath;
        this._cacheValid = true;
        return this._cachedRoot;
    }
    /** Check if AgentX is initialized in the current workspace. */
    async checkInitialized() {
        const root = this.workspaceRoot;
        if (!root) {
            return false;
        }
        return isAgentXRoot(root);
    }
    /** Get the configured mode (github, local). */
    getMode() {
        return vscode.workspace.getConfiguration('agentx').get('mode', 'local');
    }
    /** Get the configured shell (auto, pwsh, bash). */
    getShell() {
        return vscode.workspace.getConfiguration('agentx').get('shell', 'auto');
    }
    /** Resolve the AgentX CLI command path for the current platform. */
    getCliCommand() {
        const root = this.workspaceRoot;
        if (!root) {
            return '';
        }
        const shell = this.getShell();
        if (shell === 'bash' || (shell === 'auto' && process.platform !== 'win32')) {
            return path.join(root, '.agentx', 'agentx.sh');
        }
        return path.join(root, '.agentx', 'agentx.ps1');
    }
    /**
     * Execute an AgentX CLI subcommand and return stdout.
     *
     * @param subcommand - The CLI subcommand (e.g. 'workflow', 'deps').
     * @param namedArgs  - Key-value pairs formatted as `-Key value` for PowerShell
     *                     or as positional `value` args for bash.
     * @param extraArgs  - Raw argument strings appended as-is (for both shells).
     */
    async runCli(subcommand, namedArgs = {}, extraArgs = []) {
        const root = this.workspaceRoot;
        if (!root) {
            throw new Error('No workspace open.');
        }
        const cliPath = this.getCliCommand();
        const shell = this.getShell();
        const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');
        // Build argument string adapted to the target shell
        const parts = [];
        for (const [key, value] of Object.entries(namedArgs)) {
            if (isPwsh) {
                parts.push(`-${key} ${value}`);
            }
            else {
                parts.push(value);
            }
        }
        parts.push(...extraArgs);
        const argStr = parts.length > 0 ? ' ' + parts.join(' ') : '';
        const cmd = isPwsh
            ? `& "${cliPath}" ${subcommand}${argStr}`
            : `bash "${cliPath}" ${subcommand}${argStr}`;
        return (0, shell_1.execShell)(cmd, root, isPwsh ? 'pwsh' : 'bash');
    }
    /** Read an agent definition file and return parsed frontmatter fields. */
    async readAgentDef(agentFile) {
        const root = this.workspaceRoot;
        if (!root) {
            return undefined;
        }
        const filePath = path.join(root, '.github', 'agents', agentFile);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) {
            return undefined;
        }
        const frontmatter = match[1];
        const get = (key) => {
            const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
            return m ? m[1].replace(/^['"]|['"]$/g, '').trim() : '';
        };
        return {
            name: get('name'),
            description: get('description'),
            maturity: get('maturity'),
            mode: get('mode'),
            model: get('model'),
            fileName: agentFile,
        };
    }
    /** List all agent definition files. */
    async listAgents() {
        const root = this.workspaceRoot;
        if (!root) {
            return [];
        }
        const agentsDir = path.join(root, '.github', 'agents');
        if (!fs.existsSync(agentsDir)) {
            return [];
        }
        const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.md'));
        const agents = [];
        for (const file of files) {
            const def = await this.readAgentDef(file);
            if (def) {
                agents.push(def);
            }
        }
        return agents;
    }
}
exports.AgentXContext = AgentXContext;
//# sourceMappingURL=agentxContext.js.map