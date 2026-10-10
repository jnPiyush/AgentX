import * as vscode from 'vscode';
import * as fs from 'fs';
import { WorkspaceState } from './workspaceState';
import { execShell, execShellStreaming, type ShellExecutionOptions } from './utils/shell';
import { hasRepositoryState, resolveFrontierStatePath } from './utils/frontierPaths';
import { assertStatePath } from './utils/workspaceProfiles';
import { readBoundedUtf8 } from './utils/boundedFile';
import {
  buildCliCommand,
  buildCliInvocation,
  collectAgentDefinitionFiles,
  getConfiguredLlmProviderRecord,
  getConfiguredShell,
  getConfiguredLlmProvider,
  hasConfiguredAdoAdapter,
  hasConfiguredGitHubAdapter,
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
const OPENAI_SECRET_STORAGE_KEY = 'frontier.llm.openai-api';
const ANTHROPIC_SECRET_STORAGE_KEY = 'frontier.llm.anthropic-api';
const CLAUDE_CODE_SECRET_STORAGE_KEY = 'frontier.llm.claude-code';
const verifiedPrivateRuntimes = new WeakMap<vscode.ExtensionContext, Set<string>>();

function getWorkspaceScopedSecretKey(root: string, providerId: string): string {
  return `${providerId}::${root.toLowerCase()}`;
}

function getFrontierConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('frontier');
}

/**
 * Shared context for all Frontier extension components.
 * Detects workspace state, integrations, and provides CLI access.
 *
 * Integrations are additive (not modal). GitHub MCP and the ADO provider can be
 * active simultaneously. GitHub connectivity is detected from .vscode/mcp.json,
 * while ADO connectivity is detected from .frontier/config.json.
 */
export class FrontierContext {
 /** Cached workspace root path (invalidated on config / workspace change). */
 private _cachedRoot: string | undefined;
 private _cacheValid = false;
 private readonly boundIdentity?: string;
 readonly workspaceState: WorkspaceState;

 constructor(public readonly extensionContext: vscode.ExtensionContext, private readonly boundRoot?: string) {
  this.workspaceState = new WorkspaceState(extensionContext);
  if (boundRoot) { this.boundIdentity = this.workspaceState.identity(boundRoot); return; }
  extensionContext.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
   if (e.affectsConfiguration('frontier')) {
    this.invalidateCache();
   }
  }));
  extensionContext.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.invalidateCache()));
  extensionContext.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
   if ((vscode.workspace.workspaceFolders?.length ?? 0) > 1) { this.invalidateCache(); }
  }));
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
  * 2. Active editor's workspace folder.
  * 3. The only open folder; ambiguous multi-root operations use a folder picker.
  */
 get workspaceRoot(): string | undefined {
  if (this._cacheValid) { return this._cachedRoot; }

  const config = getFrontierConfiguration();

  const active = vscode.window.activeTextEditor?.document.uri;
  const activeFolder = active ? vscode.workspace.getWorkspaceFolder(active) : undefined;
  this._cachedRoot = this.boundRoot
   ?? resolveWorkspaceRoot(config, vscode.workspace.workspaceFolders, activeFolder?.uri.fsPath);
  if (this._cachedRoot) {
   try { this.workspaceState.inspect(this._cachedRoot); }
   catch (error) { console.error('Frontier workspace state is unavailable:', error); }
  }
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
  return (!!root || !!vscode.workspace.workspaceFolders?.length) && vscode.workspace.isTrusted;
 }

 /** Whether workspace state already exists; this never provisions it. */
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
  return hasConfiguredIntegration(this.workspaceRoot, integration);
 }

 /** Check if GitHub MCP integration is configured. */
 get githubConnected(): boolean {
  return this.hasIntegration('github') || hasConfiguredGitHubAdapter(this.workspaceRoot);
 }

 /** Check if the ADO provider is configured in Frontier workspace config. */
 get adoConnected(): boolean {
  return hasConfiguredAdoAdapter(this.workspaceRoot);
 }

 get llmProvider(): string {
  return getConfiguredLlmProvider(this.workspaceRoot) ?? 'copilot';
 }

 /** Get the configured shell (auto, pwsh, bash). */
 getShell(): string {
  return getConfiguredShell(getFrontierConfiguration());
 }

 /** Resolve the Frontier CLI command path for the current platform. */
 getCliCommand(): string {
  return buildCliCommand(this.extensionContext.extensionPath, this.getShell());
 }

 forWorkspace(root: string): FrontierContext {
  return new FrontierContext(this.extensionContext, root);
 }

 private assertWorkspaceScope(root: string): void {
  this.workspaceState.assertAvailable(root);
  if (this.boundIdentity && this.workspaceState.identity(root) !== this.boundIdentity) {
   throw new Error('The workspace identity changed during this operation. Start a new Frontier request.');
  }
 }

 async ensureWorkspaceState(root = this.workspaceRoot): Promise<string> {
  const selecting = !root;
  if (!root) {
   const folder = await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select the workspace for this Frontier operation' });
   root = folder?.uri.fsPath;
  }
  if (!root) { throw new Error('No Frontier workspace selected.'); }
  this.assertWorkspaceScope(root);
  const readyRoot = this.workspaceState.ensure(root);
  if (selecting) { this._cachedRoot = readyRoot; this._cacheValid = true; }
  return readyRoot;
 }

 async ensureWorkspaceReady(root = this.workspaceRoot): Promise<string> {
  const readyRoot = await this.ensureWorkspaceState(root);
  if (!fs.existsSync(this.getCliCommand())) {
   throw new Error('The bundled Frontier runtime is missing. Reinstall the extension.');
  }
  const binding = this.workspaceState.inspect(readyRoot);
  if (binding?.mode === 'private') {
   const key = `${this.getCliCommand()}::${binding.stateRoot}::${binding.identity}`;
   const verified = verifiedPrivateRuntimes.get(this.extensionContext) ?? new Set<string>();
   if (!verified.has(key)) {
    const invocation = buildCliInvocation(this.getCliCommand(), this.getShell(),
     'workspace-state', ['info']);
    const text = await execShell(invocation.command, readyRoot, invocation.shellKind,
     this.workspaceState.environment(readyRoot));
    const metadata: unknown = JSON.parse(text);
    if (!metadata || typeof metadata !== 'object'
      || !('stateRoot' in metadata) || metadata.stateRoot !== binding.stateRoot
      || !('workspaceRoot' in metadata) || metadata.workspaceRoot !== readyRoot
      || !('storageMode' in metadata) || metadata.storageMode !== 'private'
      || !('authority' in metadata) || metadata.authority !== binding.authority) {
     throw new Error('The installed runtime did not confirm private workspace support. Reinstall Frontier; no task was started.');
    }
    this.assertWorkspaceScope(readyRoot);
    verified.add(key);
    verifiedPrivateRuntimes.set(this.extensionContext, verified);
   }
  }
  return readyRoot;
 }

 async getRuntimeEnvironment(root: string): Promise<NodeJS.ProcessEnv> {
  this.assertWorkspaceScope(root);
  const identity = this.workspaceState.identity(root);
  const llmEnv = await this.getWorkspaceLlmEnvOverrides(root);
  this.assertWorkspaceScope(root);
  if (this.workspaceState.identity(root) !== identity) {
   throw new Error('Workspace authority changed while resolving Frontier credentials.');
  }
  return { ...llmEnv, ...this.workspaceState.environment(root) };
 }

 private async getWorkspaceSecret(
  storageKey: string,
  providerId: string,
  root = this.workspaceRoot,
 ): Promise<string | undefined> {
  if (!root || !this.extensionContext.secrets?.get) {
    return undefined;
  }

  const secret = await this.extensionContext.secrets.get(
    `${storageKey}:${providerId}::${this.workspaceState.identity(root)}`,
  );
  if (secret) { return secret; }
  if (process.platform === 'win32' && /^\p{ASCII}+$/u.test(root) && !this.workspaceState.authority(root)
    && this.workspaceState.inspect(root)?.mode !== 'private') {
    return this.extensionContext.secrets.get(
      getWorkspaceScopedSecretKey(root, `${storageKey}:${providerId}`));
  }
  return undefined;
 }

 async storeWorkspaceLlmSecret(providerId: 'openai-api' | 'anthropic-api' | 'claude-code', secret: string, root = this.workspaceRoot): Promise<void> {
  if (!root || !this.extensionContext.secrets?.store) {
    return;
  }
  this.assertWorkspaceScope(root);

  const storageKey = providerId === 'openai-api'
    ? OPENAI_SECRET_STORAGE_KEY
    : providerId === 'claude-code'
      ? CLAUDE_CODE_SECRET_STORAGE_KEY
    : ANTHROPIC_SECRET_STORAGE_KEY;
  await this.extensionContext.secrets.store(
    `${storageKey}:${providerId}::${this.workspaceState.identity(root)}`,
    secret,
  );
 }

 async deleteWorkspaceLlmSecret(providerId: 'openai-api' | 'anthropic-api' | 'claude-code', root = this.workspaceRoot): Promise<void> {
  if (!root || !this.extensionContext.secrets?.delete) {
    return;
  }
  this.assertWorkspaceScope(root);

  const storageKey = providerId === 'openai-api'
    ? OPENAI_SECRET_STORAGE_KEY
    : providerId === 'claude-code'
      ? CLAUDE_CODE_SECRET_STORAGE_KEY
    : ANTHROPIC_SECRET_STORAGE_KEY;
  await this.extensionContext.secrets.delete(
    `${storageKey}:${providerId}::${this.workspaceState.identity(root)}`,
  );
  if (process.platform === 'win32' && /^\p{ASCII}+$/u.test(root) && !this.workspaceState.authority(root)
    && this.workspaceState.inspect(root)?.mode !== 'private') {
    await this.extensionContext.secrets.delete(getWorkspaceScopedSecretKey(root, `${storageKey}:${providerId}`));
  }
 }

 async hasWorkspaceLlmSecret(providerId: 'openai-api' | 'anthropic-api' | 'claude-code', root = this.workspaceRoot): Promise<boolean> {
  const storageKey = providerId === 'openai-api'
    ? OPENAI_SECRET_STORAGE_KEY
    : providerId === 'claude-code'
      ? CLAUDE_CODE_SECRET_STORAGE_KEY
    : ANTHROPIC_SECRET_STORAGE_KEY;
  return !!(await this.getWorkspaceSecret(storageKey, providerId, root));
 }

 private async getWorkspaceLlmEnvOverrides(root = this.workspaceRoot): Promise<NodeJS.ProcessEnv> {
  if (!root) {
    return {};
  }

  const env: NodeJS.ProcessEnv = {};
  const provider = getConfiguredLlmProvider(root);
  if (provider) {
    env.FRONTIER_LLM_PROVIDER = provider;
  }

  const openAiRecord = getConfiguredLlmProviderRecord(root, 'openai-api');
  if (openAiRecord) {
    const baseUrl = typeof openAiRecord.baseUrl === 'string' ? openAiRecord.baseUrl.trim() : '';
    const defaultModel = typeof openAiRecord.defaultModel === 'string'
      ? openAiRecord.defaultModel.trim()
      : '';
    if (baseUrl) {
      env.FRONTIER_OPENAI_BASE_URL = baseUrl;
    }
    if (defaultModel) {
      env.FRONTIER_OPENAI_MODEL = defaultModel;
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
      env.FRONTIER_ANTHROPIC_BASE_URL = baseUrl;
    }
    if (defaultModel) {
      env.FRONTIER_ANTHROPIC_MODEL = defaultModel;
    }
    if (version) {
      env.FRONTIER_ANTHROPIC_VERSION = version;
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
      env.FRONTIER_CLAUDE_CODE_PROFILE = profile;
    }
    if (defaultModel) {
      env.FRONTIER_CLAUDE_CODE_MODEL = defaultModel;
      env.ANTHROPIC_CUSTOM_MODEL_OPTION = defaultModel;
    }
    if (baseUrl) {
      env.FRONTIER_CLAUDE_CODE_BASE_URL = baseUrl;
      env.ANTHROPIC_BASE_URL = baseUrl;
    }
    if (modelRouting) {
      env.FRONTIER_CLAUDE_CODE_MODEL_ROUTING = modelRouting;
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
  root = await this.ensureWorkspaceReady(root);
  if (subcommand === 'context' && cliArgs.some(arg => arg === '--sync' || arg === '--refresh')) {
   return this.runCliStreaming(subcommand, cliArgs, undefined, undefined, root,
    { timeoutMs: 10 * 60_000 });
  }

  const cliPath = this.getCliCommand();
  const shell = this.getShell();
  const invocation = buildCliInvocation(cliPath, shell, subcommand, cliArgs);
  return execShell(invocation.command, root, invocation.shellKind,
   await this.getRuntimeEnvironment(root));
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
  root = await this.ensureWorkspaceReady(root);

  const cliPath = this.getCliCommand();
  const shell = this.getShell();
  const invocation = buildCliInvocation(cliPath, shell, subcommand, cliArgs);
  const environment = await this.getRuntimeEnvironment(root);

  return execShellStreaming(invocation.command, root, invocation.shellKind, onLine, {
   ...environment,
   ...envOverrides,
   ...this.workspaceState.environment(root),
  }, {
    timeoutMs: subcommand === 'run' ? 30 * 60_000 : undefined,
    allowedExitCodes: subcommand === 'run' ? [0, 2, 3, 4] : [0],
    ...execution,
  });
 }

 async getPendingClarification(root = this.workspaceRoot): Promise<PendingClarificationState | undefined> {
  if (!root) { return undefined; }
  const state = this.workspaceState.readInteraction<PendingClarificationState>(root, 'clarification');
  if (state) { return state; }
  const legacy = this.extensionContext.workspaceState.get<PendingClarificationState>(PENDING_CLARIFICATION_KEY);
  if (!legacy || !hasRepositoryState(root) || this.workspaceState.inspect(root)?.mode === 'private') {
   return undefined;
  }
  let boundRoot = legacy.workspaceRoot
   ?? (legacy.interaction?.kind === 'plan' ? legacy.interaction.plan.workspaceRoot : undefined);
  if (!boundRoot && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(legacy.sessionId)) {
   const sessionPath = resolveFrontierStatePath(root, 'sessions', `${legacy.sessionId}.json`);
   assertStatePath(sessionPath);
   const sessionText = readBoundedUtf8(sessionPath, 16 * 1024 * 1024);
   if (sessionText !== undefined) {
    const session: unknown = JSON.parse(sessionText);
    if (session && typeof session === 'object' && 'meta' in session
      && session.meta && typeof session.meta === 'object' && 'interaction' in session.meta) {
     const interaction = session.meta.interaction;
     if (interaction && typeof interaction === 'object' && 'workspaceRoot' in interaction
       && typeof interaction.workspaceRoot === 'string') {
      boundRoot = interaction.workspaceRoot;
     }
    }
   }
  }
  return boundRoot && fs.existsSync(boundRoot)
   && this.workspaceState.identity(boundRoot) === this.workspaceState.identity(root)
   ? { ...legacy, workspaceRoot: root } : undefined;
 }

 async setPendingClarification(state: PendingClarificationState, root = state.workspaceRoot ?? this.workspaceRoot): Promise<void> {
  if (!root) { throw new Error('Cannot save a pending decision without a workspace.'); }
  this.assertWorkspaceScope(root);
  await this.workspaceState.writeInteraction(root, 'clarification', { ...state, workspaceRoot: root });
 }

 async clearPendingClarification(root = this.workspaceRoot): Promise<void> {
  if (!root) { return; }
  await this.workspaceState.writeInteraction(root, 'clarification');
  const legacy = await this.getPendingClarification(root);
  if (legacy) { await this.extensionContext.workspaceState.update(PENDING_CLARIFICATION_KEY, undefined); }
 }

 async getPendingSetup(root = this.workspaceRoot): Promise<PendingSetupState | undefined> {
  if (!root) { return undefined; }
  const state = this.workspaceState.readInteraction<PendingSetupState>(root, 'setup');
  if (state) { return state; }
  const legacy = this.extensionContext.workspaceState.get<PendingSetupState>(PENDING_SETUP_KEY);
  return legacy && vscode.workspace.workspaceFolders?.length === 1 && hasRepositoryState(root)
   && this.workspaceState.inspect(root)?.mode !== 'private' ? { ...legacy, workspaceRoot: root } : undefined;
 }

 async setPendingSetup(state: PendingSetupState, root = state.workspaceRoot ?? this.workspaceRoot): Promise<void> {
  if (!root) { throw new Error('Cannot save pending setup without a workspace.'); }
  this.assertWorkspaceScope(root);
  await this.workspaceState.writeInteraction(root, 'setup', { ...state, workspaceRoot: root });
 }

 async clearPendingSetup(root = this.workspaceRoot): Promise<void> {
  if (!root) { return; }
  await this.workspaceState.writeInteraction(root, 'setup');
  if (await this.getPendingSetup(root)) {
   await this.extensionContext.workspaceState.update(PENDING_SETUP_KEY, undefined);
  }
 }

 /** Resolve a file path under .frontier/state for the current workspace. */
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
