import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execShell, execShellStreaming } from './utils/shell';
import {
  buildCliCommand,
  buildCliInvocation,
  collectAgentDefinitionFiles,
  getConfiguredShell,
  hasConfiguredAdoAdapter,
  hasCliRuntime,
  hasConfiguredIntegration,
  listExecutionPlanFilesForRoot,
  parseAgentDefinition,
  resolveWorkspaceRoot,
  resolveAgentDefinitionPath,
} from './agentxContextInternals';
import {
  AgentDefinition,
  PendingClarificationState,
} from './agentxContextTypes';
export type {
  AgentBoundaries,
  AgentDefinition,
  AgentHandoff,
  PendingClarificationState,
} from './agentxContextTypes';

const PENDING_CLARIFICATION_KEY = 'agentx.pendingClarification';
const AGENTX_WORKSPACE_ROOT_ENV = 'AGENTX_WORKSPACE_ROOT';

/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, integrations, and provides CLI access.
 *
 * Integrations are additive (not modal). GitHub MCP and the ADO provider can be
 * active simultaneously. GitHub connectivity is detected from .vscode/mcp.json,
 * while ADO connectivity is detected from .agentx/config.json.
 */
export class AgentXContext {
 /** Cached workspace root path (invalidated on config / workspace change). */
 private _cachedRoot: string | undefined;
 private _cacheValid = false;

 constructor(public readonly extensionContext: vscode.ExtensionContext) {
  vscode.workspace.onDidChangeConfiguration(e => {
   if (e.affectsConfiguration('agentx')) {
    this.invalidateCache();
   }
  });
  vscode.workspace.onDidChangeWorkspaceFolders(() => this.invalidateCache());
 }

 /** Invalidate the cached root so the next access re-discovers it. */
 invalidateCache(): void {
  this._cacheValid = false;
  this._cachedRoot = undefined;
 }

 /**
  * Returns the first workspace folder path (used by the initialize command
  * which always installs into the top-level workspace folder).
  */
 get firstWorkspaceFolder(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
 }

 /**
  * Returns the workspace root for AgentX.
  *
  * Resolution order:
  * 1. Explicit `agentx.rootPath` setting (if set and valid).
  * 2. CLI runtime search (workspace folder roots, then subdirs).
  * 3. Fall back to first workspace folder.
  */
 get workspaceRoot(): string | undefined {
  if (this._cacheValid) { return this._cachedRoot; }

  const config = vscode.workspace.getConfiguration('agentx');

  this._cachedRoot = resolveWorkspaceRoot(config, vscode.workspace.workspaceFolders);
  this._cacheValid = true;
  return this._cachedRoot;
 }

 /**
  * Check if AgentX is ready in the current workspace.
  * Always returns true when a workspace folder is open -- AgentX works
  * out of the box with zero configuration. Integrations are additive.
  */
 async checkInitialized(): Promise<boolean> {
  const root = this.workspaceRoot;
  return !!root;
 }

 /** Check whether the current workspace contains the AgentX CLI runtime. */
 hasCliRuntime(): boolean {
  const root = this.workspaceRoot;
  return !!root && hasCliRuntime(root);
 }

 /**
  * Check whether a specific MCP integration is configured.
  * Reads .vscode/mcp.json from the workspace root and checks for a
  * matching server entry.
  *
  * @param integration - Server name to look for (e.g. 'github', 'ado').
  */
 hasIntegration(integration: string): boolean {
  return hasConfiguredIntegration(this.firstWorkspaceFolder, integration);
 }

 /** Check if GitHub MCP integration is configured. */
 get githubConnected(): boolean { return this.hasIntegration('github'); }

 /** Check if the ADO provider is configured in AgentX workspace config. */
 get adoConnected(): boolean {
  return hasConfiguredAdoAdapter(this.workspaceRoot ?? this.firstWorkspaceFolder);
 }

 /** Get the configured shell (auto, pwsh, bash). */
 getShell(): string {
  return getConfiguredShell(vscode.workspace.getConfiguration('agentx'));
 }

 /** Resolve the AgentX CLI command path for the current platform. */
 getCliCommand(): string {
  return buildCliCommand(this.extensionContext.extensionPath, this.getShell());
 }

 /**
  * Execute an AgentX CLI subcommand and return stdout.
  */
 async runCli(subcommand: string, cliArgs: string[] = []): Promise<string> {
  const root = this.workspaceRoot;
  if (!root) { throw new Error('No workspace open.'); }

  const cliPath = this.getCliCommand();
  const shell = this.getShell();
  const invocation = buildCliInvocation(cliPath, shell, subcommand, cliArgs);

  return execShell(invocation.command, root, invocation.shellKind, {
   [AGENTX_WORKSPACE_ROOT_ENV]: root,
  });
 }

 /**
  * Execute an AgentX CLI subcommand and stream line output in real time.
  */
 async runCliStreaming(
  subcommand: string,
  cliArgs: string[] = [],
  onLine?: (line: string, source: 'stdout' | 'stderr') => void,
  envOverrides?: NodeJS.ProcessEnv,
 ): Promise<string> {
  const root = this.workspaceRoot;
  if (!root) { throw new Error('No workspace open.'); }

  const cliPath = this.getCliCommand();
  const shell = this.getShell();
  const invocation = buildCliInvocation(cliPath, shell, subcommand, cliArgs);

  return execShellStreaming(invocation.command, root, invocation.shellKind, onLine, {
   ...envOverrides,
   [AGENTX_WORKSPACE_ROOT_ENV]: root,
  });
 }

 async getPendingClarification(): Promise<PendingClarificationState | undefined> {
  return this.extensionContext.workspaceState.get<PendingClarificationState>(PENDING_CLARIFICATION_KEY);
 }

 async setPendingClarification(state: PendingClarificationState): Promise<void> {
  await this.extensionContext.workspaceState.update(PENDING_CLARIFICATION_KEY, state);
 }

 async clearPendingClarification(): Promise<void> {
  await this.extensionContext.workspaceState.update(PENDING_CLARIFICATION_KEY, undefined);
 }

 /** Resolve a file path under .agentx/state for the current workspace. */
 getStatePath(fileName: string): string | undefined {
  const root = this.workspaceRoot;
  if (!root) { return undefined; }
  return path.join(root, '.agentx', 'state', fileName);
 }

 /** List known execution plan files relative to the workspace root. */
 listExecutionPlanFiles(): string[] {
  return listExecutionPlanFilesForRoot(this.workspaceRoot);
 }

 /** Read an agent definition file and return parsed frontmatter fields.
  *  Looks in workspace first, then falls back to extension-bundled agents.
  *  Also checks internal/ subdirectories for invisible sub-agents. */
 async readAgentDef(agentFile: string): Promise<AgentDefinition | undefined> {
    const filePath = resolveAgentDefinitionPath(
     this.workspaceRoot,
     this.extensionContext.extensionPath,
     agentFile,
    );
  if (!filePath) { return undefined; }

  const content = fs.readFileSync(filePath, 'utf-8');
    return parseAgentDefinition(content, agentFile);
 }

 /** List all agent definition files.
  *  Merges workspace agents with extension-bundled agents (workspace wins).
  *  Also includes internal/ subdirectory agents. */
 async listAgents(): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];
  for (const file of collectAgentDefinitionFiles(this.workspaceRoot, this.extensionContext.extensionPath)) {
   const def = await this.readAgentDef(file);
   if (def) { agents.push(def); }
  }
  return agents;
 }

 /** List only user-visible agents (filters out internal/invisible sub-agents). */
 async listVisibleAgents(): Promise<AgentDefinition[]> {
  const all = await this.listAgents();
  return all.filter(a => a.visibility !== 'internal');
 }
}
