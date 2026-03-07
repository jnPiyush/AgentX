import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execShell } from './utils/shell';

/**
 * Parsed MCP server configuration from .vscode/mcp.json.
 */
interface McpConfig {
 servers?: Record<string, { type?: string; url?: string; command?: string }>;
}

/**
 * Read .vscode/mcp.json from a workspace root and return parsed config.
 * Returns empty object if file does not exist or is invalid.
 */
function readMcpConfig(root: string): McpConfig {
 const mcpPath = path.join(root, '.vscode', 'mcp.json');
 if (!fs.existsSync(mcpPath)) { return {}; }
 try {
  const raw = fs.readFileSync(mcpPath, 'utf-8');
  // Try plain JSON first (most common case)
  try { return JSON.parse(raw); } catch { /* fall through to JSONC */ }
  // Strip JSONC comments only outside of quoted strings
  let stripped = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
   const ch = raw[i];
   if (escape) { stripped += ch; escape = false; continue; }
   if (inString) {
    if (ch === '\\') { escape = true; }
    else if (ch === '"') { inString = false; }
    stripped += ch;
    continue;
   }
   if (ch === '"') { inString = true; stripped += ch; continue; }
   if (ch === '/' && raw[i + 1] === '/') { while (i < raw.length && raw[i] !== '\n') { i++; } continue; }
   if (ch === '/' && raw[i + 1] === '*') { i += 2; while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) { i++; } i++; continue; }
   stripped += ch;
  }
  return JSON.parse(stripped);
 } catch {
  return {};
 }
}

/**
 * Check whether a directory has the AgentX CLI runtime installed.
 * This is only needed for CLI features (issue tracking, loop, etc.).
 * The extension itself works without this.
 */
function hasCliRuntime(dir: string): boolean {
 return fs.existsSync(path.join(dir, '.agentx', 'config.json'));
}

/**
 * Recursively search for an AgentX CLI runtime inside `dir`, up to `depth` levels.
 * Returns the first match or undefined.
 */
function findCliRuntimeInDir(dir: string, depth: number): string | undefined {
 if (hasCliRuntime(dir)) { return dir; }
 if (depth <= 0) { return undefined; }

 let entries: fs.Dirent[];
 try {
  entries = fs.readdirSync(dir, { withFileTypes: true });
 } catch {
  return undefined; // permission error, symlink loop, etc.
 }

 for (const entry of entries) {
  if (!entry.isDirectory()) { continue; }
  if (entry.name.startsWith('.') || entry.name === 'node_modules'
   || entry.name === 'dist' || entry.name === 'out'
   || entry.name === 'build' || entry.name === '__pycache__') {
   continue;
  }
  const found = findCliRuntimeInDir(path.join(dir, entry.name), depth - 1);
  if (found) { return found; }
 }
 return undefined;
}

/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, integrations, and provides CLI access.
 *
 * Integrations are additive (not modal). GitHub and ADO can be active
 * simultaneously. Detection is based on MCP server entries in .vscode/mcp.json.
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

  // 1. Explicit override
  const explicit = config.get<string>('rootPath', '').trim();
  if (explicit && fs.existsSync(explicit)) {
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

  // 2. Check each workspace folder root for CLI runtime
  for (const folder of folders) {
   if (hasCliRuntime(folder.uri.fsPath)) {
    this._cachedRoot = folder.uri.fsPath;
    this._cacheValid = true;
    return this._cachedRoot;
   }
  }

  // 3. Search subdirectories up to configured depth
  const searchDepth = config.get<number>('searchDepth', 2);
  for (const folder of folders) {
   const found = findCliRuntimeInDir(folder.uri.fsPath, searchDepth);
   if (found) {
    this._cachedRoot = found;
    this._cacheValid = true;
    return this._cachedRoot;
   }
  }

  // 4. Fallback to first workspace folder
  this._cachedRoot = folders[0].uri.fsPath;
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

 /**
  * Check whether a specific MCP integration is configured.
  * Reads .vscode/mcp.json from the workspace root and checks for a
  * matching server entry.
  *
  * @param integration - Server name to look for (e.g. 'github', 'ado').
  */
 hasIntegration(integration: string): boolean {
  const root = this.firstWorkspaceFolder;
  if (!root) { return false; }
  const mcpConfig = readMcpConfig(root);
  if (!mcpConfig.servers) { return false; }
  // Match server names that contain the integration name (e.g. 'github', 'ado-prd-to-wit')
  return Object.keys(mcpConfig.servers).some(
   name => name.toLowerCase().includes(integration.toLowerCase())
  );
 }

 /** Check if GitHub MCP integration is configured. */
 get githubConnected(): boolean { return this.hasIntegration('github'); }

 /** Check if ADO MCP integration is configured. */
 get adoConnected(): boolean { return this.hasIntegration('ado'); }

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
  */
 async runCli(subcommand: string, cliArgs: string[] = []): Promise<string> {
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

 /** Read an agent definition file and return parsed frontmatter fields.
  *  Looks in workspace first, then falls back to extension-bundled agents.
  *  Also checks internal/ subdirectories for invisible sub-agents. */
 async readAgentDef(agentFile: string): Promise<AgentDefinition | undefined> {
  const root = this.workspaceRoot;
  const workspacePath = root ? path.join(root, '.github', 'agents', agentFile) : '';
  const workspaceInternalPath = root ? path.join(root, '.github', 'agents', 'internal', agentFile) : '';
  const bundledPath = path.join(this.extensionContext.extensionPath, '.github', 'agentx', 'agents', agentFile);
  const bundledInternalPath = path.join(this.extensionContext.extensionPath, '.github', 'agentx', 'agents', 'internal', agentFile);
  const filePath = (workspacePath && fs.existsSync(workspacePath)) ? workspacePath
   : (workspaceInternalPath && fs.existsSync(workspaceInternalPath)) ? workspaceInternalPath
   : fs.existsSync(bundledPath) ? bundledPath
   : fs.existsSync(bundledInternalPath) ? bundledInternalPath : undefined;
  if (!filePath) { return undefined; }

  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) { return undefined; }

  const frontmatter = match[1];
  const get = (key: string): string => {
   const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
   return m ? m[1].replace(/^['"]|['"]$/g, '').trim() : '';
  };

  const getList = (key: string): string[] => {
   const re = new RegExp(`^${key}:\s*\n((?:\s+-\s+.+\n?)*)`, 'm');
   const m = frontmatter.match(re);
   if (!m) { return []; }
   return m[1]
    .split('\n')
    .map(l => l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
    .filter(l => l.length > 0);
  };

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

  const parseTools = (): string[] => {
   const bracketMatch = frontmatter.match(/^tools:\s*\[([^\]]+)\]/m);
   if (bracketMatch) {
    return bracketMatch[1]
     .split(',')
     .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
     .filter(t => t.length > 0);
   }
   return getList('tools');
  };

  const parseBoundaries = (): AgentBoundaries | undefined => {
   const bm = frontmatter.match(/^boundaries:\s*\n((?:\s+\w[\s\S]*?)(?=\n\w|$))/m);
   if (!bm) { return undefined; }
   const block = bm[1];
   const extractPaths = (key: string): string[] => {
    const re = new RegExp(`${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm');
    const m = block.match(re);
    if (!m) { return []; }
    return m[1]
     .split('\n')
     .map(l => l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
     .filter(l => l.length > 0);
   };
   return { canModify: extractPaths('can_modify'), cannotModify: extractPaths('cannot_modify') };
  };

  // Extract display name from first # heading in body text (after frontmatter)
  const bodyAfterFm = content.substring(match.index! + match[0].length);
  const headingMatch = bodyAfterFm.match(/^#\s+(.+)$/m);
  const displayName = headingMatch ? headingMatch[1].trim() : undefined;

  return {
   name: displayName,
   description: get('description'),
   model: get('model'),
   visibility: (get('visibility') as 'public' | 'internal') || undefined,
   constraints: getList('constraints'),
   boundaries: parseBoundaries(),
   fileName: agentFile,
   handoffs: parseHandoffs(),
   tools: parseTools(),
   agents: getList('agents'),
  };
 }

 /** List all agent definition files.
  *  Merges workspace agents with extension-bundled agents (workspace wins).
  *  Also includes internal/ subdirectory agents. */
 async listAgents(): Promise<AgentDefinition[]> {
  const fileSet = new Set<string>();

  const bundledDir = path.join(this.extensionContext.extensionPath, '.github', 'agentx', 'agents');
  if (fs.existsSync(bundledDir)) {
   for (const f of fs.readdirSync(bundledDir).filter(f => f.endsWith('.agent.md'))) {
    fileSet.add(f);
   }
  }
  const bundledInternalDir = path.join(bundledDir, 'internal');
  if (fs.existsSync(bundledInternalDir)) {
   for (const f of fs.readdirSync(bundledInternalDir).filter(f => f.endsWith('.agent.md'))) {
    fileSet.add(f);
   }
  }

  const root = this.workspaceRoot;
  if (root) {
   const workspaceDir = path.join(root, '.github', 'agents');
   if (fs.existsSync(workspaceDir)) {
    for (const f of fs.readdirSync(workspaceDir).filter(f => f.endsWith('.agent.md'))) {
     fileSet.add(f);
    }
   }
   const workspaceInternalDir = path.join(workspaceDir, 'internal');
   if (fs.existsSync(workspaceInternalDir)) {
    for (const f of fs.readdirSync(workspaceInternalDir).filter(f => f.endsWith('.agent.md'))) {
     fileSet.add(f);
    }
   }
  }

  const agents: AgentDefinition[] = [];
  for (const file of fileSet) {
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

/**
 * A declared agent-to-agent handoff from frontmatter.
 */
export interface AgentHandoff {
 readonly agent: string;
 readonly label: string;
 readonly prompt: string;
 readonly context: string;
 readonly send: boolean;
}

export interface AgentBoundaries {
 readonly canModify: string[];
 readonly cannotModify: string[];
}

export interface AgentDefinition {
 name?: string;
 description: string;
 model: string;
 visibility?: 'public' | 'internal';
 constraints?: string[];
 boundaries?: AgentBoundaries;
 fileName: string;
 handoffs?: AgentHandoff[];
 tools?: string[];
 agents?: string[];
}
