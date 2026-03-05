import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execShell } from './utils/shell';
import { AgentEventBus } from './utils/eventBus';
import { ThinkingLog } from './utils/thinkingLog';
import { ContextCompactor } from './utils/contextCompactor';
import { ChannelRouter } from './utils/channelRouter';
import { TaskScheduler } from './utils/taskScheduler';
import { PluginManager } from './utils/pluginManager';
import { GitStorageProvider } from './utils/gitStorageProvider';

/**
 * Check whether a directory looks like a properly initialized AgentX root.
 * Requires .agentx/config.json (created only during full initialization),
 * not just a bare .agentx/ directory which can be created accidentally
 * by services that eagerly ensure their storage directories.
 */
function isAgentXRoot(dir: string): boolean {
 return fs.existsSync(path.join(dir, '.agentx', 'config.json'));
}

/**
 * Recursively search for an AgentX root inside `dir`, up to `depth` levels.
 * Returns the first match or undefined.
 */
function findAgentXRootInDir(dir: string, depth: number): string | undefined {
 if (isAgentXRoot(dir)) { return dir; }
 if (depth <= 0) { return undefined; }

 let entries: fs.Dirent[];
 try {
  entries = fs.readdirSync(dir, { withFileTypes: true });
 } catch {
  return undefined; // permission error, symlink loop, etc.
 }

 for (const entry of entries) {
  if (!entry.isDirectory()) { continue; }
  // Skip hidden dirs (except .agentx which we already checked above),
  // node_modules, and other noisy directories.
  if (entry.name.startsWith('.') || entry.name === 'node_modules'
   || entry.name === 'dist' || entry.name === 'out'
   || entry.name === 'build' || entry.name === '__pycache__') {
   continue;
  }
  const found = findAgentXRootInDir(path.join(dir, entry.name), depth - 1);
  if (found) { return found; }
 }
 return undefined;
}

/**
 * Optional services injected after construction.
 */
interface AgentXServices {
 channelRouter: ChannelRouter;
 taskScheduler: TaskScheduler;
 pluginManager?: PluginManager;
 gitStorageProvider?: GitStorageProvider;
}

/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
export class AgentXContext {
 /** Cached AgentX root path (invalidated on config / workspace change). */
 private _cachedRoot: string | undefined;
 private _cacheValid = false;

 /** Core infrastructure services. */
 readonly eventBus: AgentEventBus;
 readonly thinkingLog: ThinkingLog;
 readonly contextCompactor: ContextCompactor;

 /** Optional services set after construction via setServices(). */
 private _services: AgentXServices | undefined;

 constructor(
  public readonly extensionContext: vscode.ExtensionContext,
  eventBus?: AgentEventBus,
  thinkingLog?: ThinkingLog,
  contextCompactor?: ContextCompactor,
 ) {
  this.eventBus = eventBus ?? new AgentEventBus();
  this.thinkingLog = thinkingLog ?? new ThinkingLog(this.eventBus);
  this.contextCompactor = contextCompactor ?? new ContextCompactor(this.eventBus);

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
 setServices(services: AgentXServices): void {
  this._services = services;
 }

 /** Get the channel router (if available). */
 get channelRouter(): ChannelRouter | undefined {
  return this._services?.channelRouter;
 }

 /** Get the task scheduler (if available). */
 get taskScheduler(): TaskScheduler | undefined {
  return this._services?.taskScheduler;
 }

 /** Get the plugin manager (if available). */
 get pluginManager(): PluginManager | undefined {
  return this._services?.pluginManager;
 }

 /** Get the Git storage provider (if available). */
 get gitStorageProvider(): GitStorageProvider | undefined {
  return this._services?.gitStorageProvider;
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
  * Returns the detected AgentX project root.
  *
  * Resolution order:
  * 1. Explicit `agentx.rootPath` setting (if set and valid).
  * 2. Search every workspace folder root for .agentx/ directory.
  * 3. Search subdirectories of each workspace folder up to
  *    `agentx.searchDepth` levels (default 2).
  * 4. Fall back to the first workspace folder (legacy behaviour).
  */
 get workspaceRoot(): string | undefined {
  if (this._cacheValid) { return this._cachedRoot; }

  const config = vscode.workspace.getConfiguration('agentx');

  // 1. Explicit override
  const explicit = config.get<string>('rootPath', '').trim();
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
  const searchDepth = config.get<number>('searchDepth', 2);
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
 async checkInitialized(): Promise<boolean> {
  const root = this.workspaceRoot;
  if (!root) { return false; }
  return isAgentXRoot(root);
 }

 /** Get the configured mode (github, local). */
 getMode(): string {
 return vscode.workspace.getConfiguration('agentx').get<string>('mode', 'local');
 }

 /** Get the configured shell (auto, pwsh, bash). */
 getShell(): string {
 return vscode.workspace.getConfiguration('agentx').get<string>('shell', 'auto');
 }

 /** Resolve the AgentX CLI command path for the current platform. */
 getCliCommand(): string {
 const root = this.workspaceRoot;
 if (!root) { return ''; }
 const shell = this.getShell();
 if (shell === 'bash' || (shell === 'auto' && process.platform !== 'win32')) {
 return path.join(root, '.agentx', 'agentx.sh');
 }
 return path.join(root, '.agentx', 'agentx.ps1');
 }

 /**
  * Execute an AgentX CLI subcommand and return stdout.
  *
   * Both the PowerShell and Bash wrappers delegate to `agentx-cli.ps1`,
   * so arguments are always passed in CLI format (positional args
   * and short flags like `-t`, `-n`, etc.).
   *
   * @param subcommand - The CLI subcommand (e.g. 'workflow', 'deps').
   * @param cliArgs    - Arguments passed directly to agentx-cli.ps1 after the subcommand.
   */
  async runCli(
   subcommand: string,
   cliArgs: string[] = []
  ): Promise<string> {
   const root = this.workspaceRoot;
   if (!root) { throw new Error('No workspace open.'); }

   const cliPath = this.getCliCommand();
   const shell = this.getShell();
   const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');

   const argStr = cliArgs.length > 0 ? ' ' + cliArgs.join(' ') : '';

   const cmd = isPwsh
    ? `& "${cliPath}" ${subcommand}${argStr}`
    : `bash "${cliPath}" ${subcommand}${argStr}`;

   return execShell(cmd, root, isPwsh ? 'pwsh' : 'bash');
  }

 /** Read an agent definition file and return parsed frontmatter fields. */
 async readAgentDef(agentFile: string): Promise<AgentDefinition | undefined> {
 const root = this.workspaceRoot;
 if (!root) { return undefined; }
 const filePath = path.join(root, '.github', 'agents', agentFile);
 if (!fs.existsSync(filePath)) { return undefined; }

 const content = fs.readFileSync(filePath, 'utf-8');
 const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
 if (!match) { return undefined; }

 const frontmatter = match[1];
 const get = (key: string): string => {
 const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
 return m ? m[1].replace(/^['"]|['"]$/g, '').trim() : '';
 };

 // Parse YAML list values (lines starting with " - " after a key)
 const getList = (key: string): string[] => {
  const re = new RegExp(`^${key}:\s*\n((?:\s+-\s+.+\n?)*)`, 'm');
  const m = frontmatter.match(re);
  if (!m) { return []; }
  return m[1]
   .split('\n')
   .map(l => l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
   .filter(l => l.length > 0);
 };

 // Parse nested boundary lists (can_modify / cannot_modify under boundaries:)
 const getBoundaryList = (section: string): string[] => {
  const re = new RegExp(`${section}:\s*\n((?:\s+-\s+.+\n?)*)`, 'm');
  const m = frontmatter.match(re);
  if (!m) { return []; }
  return m[1]
   .split('\n')
   .map(l => l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
   .filter(l => l.length > 0);
 };

 // Parse handoffs (YAML list of objects under `handoffs:`).
 // Each entry has: label, agent, prompt, send, context
 const parseHandoffs = (): AgentHandoff[] => {
  const handoffRe = /^handoffs:\s*\n((?:\s+-\s+[\s\S]*?)(?=\n\w|$))/m;
  const hm = frontmatter.match(handoffRe);
  if (!hm) { return []; }
  const entries: AgentHandoff[] = [];
  const blocks = hm[1].split(/\n\s+-\s+/).filter(Boolean);
  for (const block of blocks) {
   const agent = block.match(/agent:\s*(.+)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
   const label = block.match(/label:\s*(.+)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
   const prompt = block.match(/prompt:\s*(.+)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
   const context = block.match(/context:\s*(.+)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
   const sendStr = block.match(/send:\s*(\w+)/)?.[1]?.trim() ?? 'false';
   if (agent) {
    entries.push({ agent, label, prompt, context, send: sendStr === 'true' });
   }
  }
  return entries;
 };

 // Parse tools (YAML array -- may be bracket-style or list-style)
 const parseTools = (): string[] => {
  // Bracket-style: tools: ['a', 'b', 'c']
  const bracketMatch = frontmatter.match(/^tools:\s*\[([^\]]+)\]/m);
  if (bracketMatch) {
   return bracketMatch[1]
    .split(',')
    .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
    .filter(t => t.length > 0);
  }
  // List-style: tools:\n  - a\n  - b
  return getList('tools');
 };

 const inferStr = get('infer');

 return {
 name: get('name'),
 description: get('description'),
 maturity: get('maturity'),
 mode: get('mode'),
 model: get('model'),
 modelFallback: get('modelFallback') || undefined,
 fileName: agentFile,
 constraints: getList('constraints'),
 canModify: getBoundaryList('can_modify'),
 cannotModify: getBoundaryList('cannot_modify'),
 handoffs: parseHandoffs(),
 tools: parseTools(),
 infer: inferStr === 'true',
 };
 }

 /** List all agent definition files. */
 async listAgents(): Promise<AgentDefinition[]> {
 const root = this.workspaceRoot;
 if (!root) { return []; }
 const agentsDir = path.join(root, '.github', 'agents');
 if (!fs.existsSync(agentsDir)) { return []; }

 const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.md'));
 const agents: AgentDefinition[] = [];
 for (const file of files) {
 const def = await this.readAgentDef(file);
 if (def) { agents.push(def); }
 }
 return agents;
 }
}

/**
 * A declared agent-to-agent handoff from frontmatter.
 */
export interface AgentHandoff {
 /** Target agent name (e.g., 'engineer'). */
 readonly agent: string;
 /** Human-readable label (e.g., 'Hand off to Engineer'). */
 readonly label: string;
 /** Prompt/instruction for the target agent. */
 readonly prompt: string;
 /** Context description for when the handoff applies. */
 readonly context: string;
 /** Whether to send context automatically. */
 readonly send: boolean;
}

export interface AgentDefinition {
 name: string;
 description: string;
 maturity: string;
 mode: string;
 model: string;
 /** Fallback model if primary is unavailable. Parsed from `modelFallback` frontmatter. */
 modelFallback?: string;
 fileName: string;
 /** Constraints listed under the `constraints:` key in frontmatter. */
 constraints?: string[];
 /** Directories/patterns the agent can modify. */
 canModify?: string[];
 /** Directories/patterns the agent cannot modify. */
 cannotModify?: string[];
 /** Declared handoffs to other agents. */
 handoffs?: AgentHandoff[];
 /** Declared tool names this agent can access. */
 tools?: string[];
 /** Whether the agent supports automatic context inference. */
 infer?: boolean;
 /**
  * Live runtime status from agent state file (optional).
  * Known values: 'idle' | 'working' | 'clarifying' | 'blocked-clarification'
  */
 runtimeStatus?: string;
}
