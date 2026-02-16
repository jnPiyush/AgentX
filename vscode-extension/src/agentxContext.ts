import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execShell } from './utils/shell';

/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
export class AgentXContext {
 constructor(public readonly extensionContext: vscode.ExtensionContext) {}

 /** Returns the current workspace root, or undefined if none open. */
 get workspaceRoot(): string | undefined {
 return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
 }

 /** Check if AgentX is initialized in the current workspace. */
 async checkInitialized(): Promise<boolean> {
 const root = this.workspaceRoot;
 if (!root) { return false; }
 return fs.existsSync(path.join(root, 'AGENTS.md'))
 && fs.existsSync(path.join(root, '.agentx'));
 }

 /** Get the configured profile (full, minimal, python, dotnet, react). */
 getProfile(): string {
 return vscode.workspace.getConfiguration('agentx').get<string>('profile', 'full');
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

 /** Execute an AgentX CLI subcommand and return stdout. */
 async runCli(subcommand: string, args: string[] = []): Promise<string> {
 const root = this.workspaceRoot;
 if (!root) { throw new Error('No workspace open.'); }

 const cliPath = this.getCliCommand();
 const shell = this.getShell();
 const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');

 let cmd: string;
 if (isPwsh) {
 const argStr = args.length > 0 ? ' ' + args.join(' ') : '';
 cmd = `& "${cliPath}" ${subcommand}${argStr}`;
 } else {
 const argStr = args.length > 0 ? ' ' + args.join(' ') : '';
 cmd = `bash "${cliPath}" ${subcommand}${argStr}`;
 }

 return execShell(cmd, root, isPwsh ? 'pwsh' : 'bash');
 }

 /** Read an agent definition file and return parsed frontmatter fields. */
 async readAgentDef(agentFile: string): Promise<AgentDefinition | undefined> {
 const root = this.workspaceRoot;
 if (!root) { return undefined; }
 const filePath = path.join(root, '.github', 'agents', agentFile);
 if (!fs.existsSync(filePath)) { return undefined; }

 const content = fs.readFileSync(filePath, 'utf-8');
 const match = content.match(/^---\n([\s\S]*?)\n---/);
 if (!match) { return undefined; }

 const frontmatter = match[1];
 const get = (key: string): string => {
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

export interface AgentDefinition {
 name: string;
 description: string;
 maturity: string;
 mode: string;
 model: string;
 fileName: string;
}
