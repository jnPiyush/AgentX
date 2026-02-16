import * as vscode from 'vscode';
/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
export declare class AgentXContext {
    readonly extensionContext: vscode.ExtensionContext;
    constructor(extensionContext: vscode.ExtensionContext);
    /** Returns the current workspace root, or undefined if none open. */
    get workspaceRoot(): string | undefined;
    /** Check if AgentX is initialized in the current workspace. */
    checkInitialized(): Promise<boolean>;
    /** Get the configured profile (full, minimal, python, dotnet, react). */
    getProfile(): string;
    /** Get the configured mode (github, local). */
    getMode(): string;
    /** Get the configured shell (auto, pwsh, bash). */
    getShell(): string;
    /** Resolve the AgentX CLI command path for the current platform. */
    getCliCommand(): string;
    /** Execute an AgentX CLI subcommand and return stdout. */
    runCli(subcommand: string, args?: string[]): Promise<string>;
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
//# sourceMappingURL=agentxContext.d.ts.map