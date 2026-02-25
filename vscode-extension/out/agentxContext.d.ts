import * as vscode from 'vscode';
import { AgentEventBus } from './utils/eventBus';
import { ThinkingLog } from './utils/thinkingLog';
import { ContextCompactor } from './utils/contextCompactor';
import { ChannelRouter } from './utils/channelRouter';
import { TaskScheduler } from './utils/taskScheduler';
/**
 * Optional services injected after construction.
 */
interface AgentXServices {
    channelRouter: ChannelRouter;
    taskScheduler: TaskScheduler;
}
/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
export declare class AgentXContext {
    readonly extensionContext: vscode.ExtensionContext;
    /** Cached AgentX root path (invalidated on config / workspace change). */
    private _cachedRoot;
    private _cacheValid;
    /** Core infrastructure services. */
    readonly eventBus: AgentEventBus;
    readonly thinkingLog: ThinkingLog;
    readonly contextCompactor: ContextCompactor;
    /** Optional services set after construction via setServices(). */
    private _services;
    constructor(extensionContext: vscode.ExtensionContext, eventBus?: AgentEventBus, thinkingLog?: ThinkingLog, contextCompactor?: ContextCompactor);
    /**
     * Inject optional services (channelRouter, taskScheduler) after construction.
     */
    setServices(services: AgentXServices): void;
    /** Get the channel router (if available). */
    get channelRouter(): ChannelRouter | undefined;
    /** Get the task scheduler (if available). */
    get taskScheduler(): TaskScheduler | undefined;
    /** Invalidate the cached root so the next access re-discovers it. */
    invalidateCache(): void;
    /**
     * Returns the first workspace folder path (used by the initialize command
     * which always installs into the top-level workspace folder).
     */
    get firstWorkspaceFolder(): string | undefined;
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
    get workspaceRoot(): string | undefined;
    /** Check if AgentX is initialized in the current workspace. */
    checkInitialized(): Promise<boolean>;
    /** Get the configured mode (github, local). */
    getMode(): string;
    /** Get the configured shell (auto, pwsh, bash). */
    getShell(): string;
    /** Resolve the AgentX CLI command path for the current platform. */
    getCliCommand(): string;
    /**
     * Execute an AgentX CLI subcommand and return stdout.
     *
     * @param subcommand - The CLI subcommand (e.g. 'workflow', 'deps').
     * @param namedArgs  - Key-value pairs formatted as `-Key value` for PowerShell
     *                     or as positional `value` args for bash.
     * @param extraArgs  - Raw argument strings appended as-is (for both shells).
     */
    runCli(subcommand: string, namedArgs?: Record<string, string>, extraArgs?: string[]): Promise<string>;
    /** Read an agent definition file and return parsed frontmatter fields. */
    readAgentDef(agentFile: string): Promise<AgentDefinition | undefined>;
    /** List all agent definition files. */
    listAgents(): Promise<AgentDefinition[]>;
}
export interface AgentDefinition {
    name: string;
    description: string;
    maturity: string;
    mode: string;
    model: string;
    fileName: string;
}
export {};
//# sourceMappingURL=agentxContext.d.ts.map