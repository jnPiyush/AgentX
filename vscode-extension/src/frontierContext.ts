import * as vscode from 'vscode';
import * as fs from 'fs';
import { execShell, execShellStreaming, type ShellExecutionOptions } from './utils/shell';
import { resolveFrontierStatePath } from './utils/frontierPaths';
import {
  buildCliCommand,
  buildCliInvocation,
  collectAgentDefinitionFiles,
  getConfiguredLlmProviderRecord,
  getConfiguredShell,
  getConfiguredLlmProvider,
  hasConfiguredAdoAdapter,
  hasCliRuntime,
  hasConfiguredIntegration,
  listExecutionPlanFilesForRoot,
  parseAgentDefinition,
  resolveWorkspaceRoot,
  resolveAgentDefinitionPath,
} from './frontierContextInternals';
import {
  AgentDefinition,
  PendingClarificationState,
  PendingSetupState,
} from './frontierContextTypes';
export type {
  AgentBoundaries,
  AgentDefinition,
  PendingClarificationState,
  PendingSetupState,
} from './frontierContextTypes';

const PENDING_CLARIFICATION_KEY = 'frontier.pendingClarification';
const PENDING_SETUP_KEY = 'frontier.pendingSetup';
const FRONTIER_WORKSPACE_ROOT_ENV = 'FRONTIER_WORKSPACE_ROOT';
const OPENAI_SECRET_STORAGE_KEY = 'frontier.llm.openai-api';
const ANTHROPIC_SECRET_STORAGE_KEY = 'frontier.llm.anthropic-api';
const CLAUDE_CODE_SECRET_STORAGE_KEY = 'frontier.llm.claude-code';

function getWorkspaceScopedSecretKey(root: string, providerId: string): string {
  return `${providerId}::${root.toLowerCase()}`;
}

function getFrontierConfiguration(): vscode.WorkspaceConfiguration {
  const current = vscode.workspace.getConfiguration('frontier');
  const transitional = vscode.workspace.getConfiguration('hve');
  const legacy = vscode.workspace.getConfiguration('agentx');
  return {
    get: <T>(section: string, defaultValue?: T): T | undefined => {
      const inspected = current.inspect<T>(section);
      const currentValue = current.get<T>(section);
      const hasCurrentValue = inspected
        ? inspected.workspaceFolderValue !== undefined
          || inspected.workspaceValue !== undefined
          || inspected.globalValue !== undefined
        : currentValue !== undefined;
      return hasCurrentValue
        ? currentValue ?? defaultValue
        : transitional.get<T>(section) ?? legacy.get<T>(section, defaultValue as T);
    },
      has: (section: string): boolean => current.has(section) || transitional.has(section) || legacy.has(section),
      inspect: <T>(section: string) => current.inspect<T>(section) ?? transitional.inspect<T>(section) ?? legacy.inspect<T>(section),
    update: <T>(section: string, value: T, target?: vscode.ConfigurationTarget | boolean | null, overrideInLanguage?: boolean) => current.update(section, value, target, overrideInLanguage),
  } as vscode.WorkspaceConfiguration;
}

/**
 * Shared context for all Frontier extension components.
 * Detects workspace state, integrations, and provides CLI access.
 *
 * Integrations are additive (not modal). GitHub MCP and the ADO provider can be
 * active simultaneously. GitHub connectivity is detected from .vscode/mcp.json,
 * while ADO connectivity is detected from .agentx/config.json.
 */
export class FrontierContext {
 /** Cached workspace root path (invalidated on config / workspace change). */
 private _cachedRoot: string | undefined;
 private _cacheValid = false;

 constructor(public readonly extensionContext: vscode.ExtensionContext) {
  vscode.workspace.onDidChangeConfiguration(e => {
   if (e.affectsConfiguration('frontier') || e.affectsConfiguration('agentx')) {
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
  * Returns the workspace root for Frontier.
  *
  * Resolution order:
  * 1. Explicit `frontier.rootPath` setting (if set and valid).
  * 2. CLI runtime search (workspace folder roots, then subdirs).
  * 3. Fall back to first workspace folder.
  */
 get workspaceRoot(): string | undefined {
  if (this._cacheValid) { return this._cachedRoot; }

  const config = getFrontierConfiguration();

  this._cachedRoot = resolveWorkspaceRoot(config, vscode.workspace.workspaceFolders);
  this._cacheValid = true;
  return this._cachedRoot;
 }

 /**
  * Check if Frontier is ready in the current workspace.
  * Always returns true when a workspace folder is open -- Frontier works
  * out of the box with zero configuration. Integrations are additive.
  */
 async checkInitialized(): Promise<boolean> {
  const root = this.workspaceRoot;
  return !!root;
 }

 /** Check whether the current workspace contains the Frontier CLI runtime. */
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

 /** Check if the ADO provider is configured in Frontier workspace config. */
 get adoConnected(): boolean {
  return hasConfiguredAdoAdapter(this.workspaceRoot ?? this.firstWorkspaceFolder);
 }

 get llmProvider(): string {
  return getConfiguredLlmProvider(this.workspaceRoot ?? this.firstWorkspaceFolder) ?? 'copilot';
 }

 /** Get the configured shell (auto, pwsh, bash). */
 getShell(): string {
  return getConfiguredShell(getFrontierConfiguration());
 }

 /** Resolve the Frontier CLI command path for the current platform. */
 getCliCommand(): string {
  return buildCliCommand(this.extensionContext.extensionPath, this.getShell());
 }

 private async getWorkspaceSecret(
  storageKey: string,
  providerId: string,
  root = this.workspaceRoot ?? this.firstWorkspaceFolder,
 ): Promise<string | undefined> {
  if (!root || !this.extensionContext.secrets?.get) {
    return undefined;
  }

  for (const candidate of [storageKey, storageKey.replace(/^frontier\./, 'hve.'), storageKey.replace(/^frontier\./, 'agentx.')]) {
    const secret = await this.extensionContext.secrets.get(
      getWorkspaceScopedSecretKey(root, `${candidate}:${providerId}`),
    );
    if (secret) {
      return secret;
    }
  }
  return undefined;
 }

 async storeWorkspaceLlmSecret(providerId: 'openai-api' | 'anthropic-api' | 'claude-code', secret: string, root = this.workspaceRoot ?? this.firstWorkspaceFolder): Promise<void> {
  if (!root || !this.extensionContext.secrets?.store) {
    return;
  }

  const storageKey = providerId === 'openai-api'
    ? OPENAI_SECRET_STORAGE_KEY
    : providerId === 'claude-code'
      ? CLAUDE_CODE_SECRET_STORAGE_KEY
    : ANTHROPIC_SECRET_STORAGE_KEY;
  await this.extensionContext.secrets.store(
    getWorkspaceScopedSecretKey(root, `${storageKey}:${providerId}`),
    secret,
  );
 }

 async deleteWorkspaceLlmSecret(providerId: 'openai-api' | 'anthropic-api' | 'claude-code', root = this.workspaceRoot ?? this.firstWorkspaceFolder): Promise<void> {
  if (!root || !this.extensionContext.secrets?.delete) {
    return;
  }

  const storageKey = providerId === 'openai-api'
    ? OPENAI_SECRET_STORAGE_KEY
    : providerId === 'claude-code'
      ? CLAUDE_CODE_SECRET_STORAGE_KEY
    : ANTHROPIC_SECRET_STORAGE_KEY;
  for (const candidate of [storageKey, storageKey.replace(/^frontier\./, 'hve.'), storageKey.replace(/^frontier\./, 'agentx.')]) {
    await this.extensionContext.secrets.delete(
      getWorkspaceScopedSecretKey(root, `${candidate}:${providerId}`),
    );
  }
 }

 async hasWorkspaceLlmSecret(providerId: 'openai-api' | 'anthropic-api' | 'claude-code', root = this.workspaceRoot ?? this.firstWorkspaceFolder): Promise<boolean> {
  const storageKey = providerId === 'openai-api'
    ? OPENAI_SECRET_STORAGE_KEY
    : providerId === 'claude-code'
      ? CLAUDE_CODE_SECRET_STORAGE_KEY
    : ANTHROPIC_SECRET_STORAGE_KEY;
  return !!(await this.getWorkspaceSecret(storageKey, providerId, root));
 }

 private async getWorkspaceLlmEnvOverrides(root = this.workspaceRoot ?? this.firstWorkspaceFolder): Promise<NodeJS.ProcessEnv> {
  if (!root) {
    return {};
  }

  const env: NodeJS.ProcessEnv = {};
  const provider = getConfiguredLlmProvider(root);
  if (provider) {
    env.AGENTX_LLM_PROVIDER = provider;
  }

  const openAiRecord = getConfiguredLlmProviderRecord(root, 'openai-api');
  if (openAiRecord) {
    const baseUrl = typeof openAiRecord.baseUrl === 'string' ? openAiRecord.baseUrl.trim() : '';
    const defaultModel = typeof openAiRecord.defaultModel === 'string'
      ? openAiRecord.defaultModel.trim()
      : '';
    if (baseUrl) {
      env.AGENTX_OPENAI_BASE_URL = baseUrl;
    }
    if (defaultModel) {
      env.AGENTX_OPENAI_MODEL = defaultModel;
    }
  }

  const anthropicRecord = getConfiguredLlmProviderRecord(root, 'anthropic-api');
  if (anthropicRecord) {
    const baseUrl = typeof anthropicRecord.baseUrl === 'string' ? anthropicRecord.baseUrl.trim() : '';
    const defaultModel = typeof anthropicRecord.defaultModel === 'string'
      ? anthropicRecord.defaultModel.trim()
      : '';
    const version = typeof anthropicRecord.anthropicVersion === 'string'
      ? anthropicRecord.anthropicVersion.trim()
      : '';
    if (baseUrl) {
      env.AGENTX_ANTHROPIC_BASE_URL = baseUrl;
    }
    if (defaultModel) {
      env.AGENTX_ANTHROPIC_MODEL = defaultModel;
    }
    if (version) {
      env.AGENTX_ANTHROPIC_VERSION = version;
    }
  }

  const claudeCodeRecord = getConfiguredLlmProviderRecord(root, 'claude-code');
  if (claudeCodeRecord) {
    const profile = typeof claudeCodeRecord.profile === 'string' ? claudeCodeRecord.profile.trim() : '';
    const baseUrl = typeof claudeCodeRecord.baseUrl === 'string' ? claudeCodeRecord.baseUrl.trim() : '';
    const defaultModel = typeof claudeCodeRecord.defaultModel === 'string'
      ? claudeCodeRecord.defaultModel.trim()
      : '';
    const modelRouting = typeof claudeCodeRecord.modelRouting === 'string'
      ? claudeCodeRecord.modelRouting.trim()
      : '';
    const customModelName = typeof claudeCodeRecord.customModelName === 'string'
      ? claudeCodeRecord.customModelName.trim()
      : '';
    const customModelDescription = typeof claudeCodeRecord.customModelDescription === 'string'
      ? claudeCodeRecord.customModelDescription.trim()
      : '';
    const disableExperimentalBetas = claudeCodeRecord.disableExperimentalBetas === true;

    if (profile) {
      env.AGENTX_CLAUDE_CODE_PROFILE = profile;
    }
    if (defaultModel) {
      env.AGENTX_CLAUDE_CODE_MODEL = defaultModel;
      env.ANTHROPIC_CUSTOM_MODEL_OPTION = defaultModel;
    }
    if (baseUrl) {
      env.AGENTX_CLAUDE_CODE_BASE_URL = baseUrl;
      env.ANTHROPIC_BASE_URL = baseUrl;
    }
    if (modelRouting) {
      env.AGENTX_CLAUDE_CODE_MODEL_ROUTING = modelRouting;
    }
    if (customModelName) {
      env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = customModelName;
    }
    if (customModelDescription) {
      env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = customModelDescription;
    }
    if (disableExperimentalBetas) {
      env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = '1';
    }
  }

  const openAiSecret = await this.getWorkspaceSecret(OPENAI_SECRET_STORAGE_KEY, 'openai-api', root);
  if (openAiSecret) {
    env.OPENAI_API_KEY = openAiSecret;
  }

  const anthropicSecret = await this.getWorkspaceSecret(ANTHROPIC_SECRET_STORAGE_KEY, 'anthropic-api', root);
  if (anthropicSecret) {
    env.ANTHROPIC_API_KEY = anthropicSecret;
  }

  const claudeCodeSecret = await this.getWorkspaceSecret(CLAUDE_CODE_SECRET_STORAGE_KEY, 'claude-code', root);
  if (claudeCodeSecret) {
    env.ANTHROPIC_AUTH_TOKEN = claudeCodeSecret;
  }

  return env;
 }

 /**
  * Execute an Frontier CLI subcommand and return stdout.
  */
 async runCli(subcommand: string, cliArgs: string[] = [], root = this.workspaceRoot): Promise<string> {
  if (!root) { throw new Error('No workspace open.'); }

  const cliPath = this.getCliCommand();
  const shell = this.getShell();
  const invocation = buildCliInvocation(cliPath, shell, subcommand, cliArgs);
  const llmEnv = await this.getWorkspaceLlmEnvOverrides(root);

  return execShell(invocation.command, root, invocation.shellKind, {
   ...llmEnv,
    [FRONTIER_WORKSPACE_ROOT_ENV]: root,
    AGENTX_WORKSPACE_ROOT: root,
  });
 }

 /**
  * Execute an Frontier CLI subcommand and stream line output in real time.
  */
 async runCliStreaming(
  subcommand: string,
  cliArgs: string[] = [],
  onLine?: (line: string, source: 'stdout' | 'stderr') => void,
  envOverrides?: NodeJS.ProcessEnv,
  root = this.workspaceRoot,
  execution: ShellExecutionOptions = {},
 ): Promise<string> {
  if (!root) { throw new Error('No workspace open.'); }

  const cliPath = this.getCliCommand();
  const shell = this.getShell();
  const invocation = buildCliInvocation(cliPath, shell, subcommand, cliArgs);
    const llmEnv = await this.getWorkspaceLlmEnvOverrides(root);

  return execShellStreaming(invocation.command, root, invocation.shellKind, onLine, {
     ...llmEnv,
   ...envOverrides,
   [FRONTIER_WORKSPACE_ROOT_ENV]: root,
   AGENTX_WORKSPACE_ROOT: root,
  }, { timeoutMs: subcommand === 'run' ? 30 * 60_000 : undefined, ...execution });
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

 async getPendingSetup(): Promise<PendingSetupState | undefined> {
  return this.extensionContext.workspaceState.get<PendingSetupState>(PENDING_SETUP_KEY);
 }

 async setPendingSetup(state: PendingSetupState): Promise<void> {
  await this.extensionContext.workspaceState.update(PENDING_SETUP_KEY, state);
 }

 async clearPendingSetup(): Promise<void> {
  await this.extensionContext.workspaceState.update(PENDING_SETUP_KEY, undefined);
 }

 /** Resolve a file path under .agentx/state for the current workspace. */
 getStatePath(fileName: string): string | undefined {
  const root = this.workspaceRoot;
  if (!root) { return undefined; }
  return resolveFrontierStatePath(root, 'state', fileName);
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
