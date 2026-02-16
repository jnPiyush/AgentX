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
/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
class AgentXContext {
 extensionContext;
 constructor(extensionContext) {
 this.extensionContext = extensionContext;
 }
 /** Returns the current workspace root, or undefined if none open. */
 get workspaceRoot() {
 return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
 }
 /** Check if AgentX is initialized in the current workspace. */
 async checkInitialized() {
 const root = this.workspaceRoot;
 if (!root) {
 return false;
 }
 return fs.existsSync(path.join(root, 'AGENTS.md'))
 && fs.existsSync(path.join(root, '.agentx'));
 }
 /** Get the configured profile (full, minimal, python, dotnet, react). */
 getProfile() {
 return vscode.workspace.getConfiguration('agentx').get('profile', 'full');
 }
 /** Get the configured mode (github, local). */
 getMode() {
 return vscode.workspace.getConfiguration('agentx').get('mode', 'github');
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
 /** Execute an AgentX CLI subcommand and return stdout. */
 async runCli(subcommand, args = []) {
 const root = this.workspaceRoot;
 if (!root) {
 throw new Error('No workspace open.');
 }
 const cliPath = this.getCliCommand();
 const shell = this.getShell();
 const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');
 let cmd;
 if (isPwsh) {
 const argStr = args.length > 0 ? ' ' + args.join(' ') : '';
 cmd = `& "${cliPath}" ${subcommand}${argStr}`;
 }
 else {
 const argStr = args.length > 0 ? ' ' + args.join(' ') : '';
 cmd = `bash "${cliPath}" ${subcommand}${argStr}`;
 }
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