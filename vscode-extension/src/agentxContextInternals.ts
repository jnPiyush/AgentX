import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentBoundaries, AgentDefinition, AgentHandoff } from './agentxContextTypes';

interface McpConfig {
  servers?: Record<string, { type?: string; url?: string; command?: string }>;
}

export function readMcpConfig(root: string): McpConfig {
  const mcpPath = path.join(root, '.vscode', 'mcp.json');
  if (!fs.existsSync(mcpPath)) { return {}; }

  try {
    const raw = fs.readFileSync(mcpPath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch {
      let stripped = '';
      let inString = false;
      let escape = false;

      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (escape) {
          stripped += ch;
          escape = false;
          continue;
        }
        if (inString) {
          if (ch === '\\') {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
          stripped += ch;
          continue;
        }
        if (ch === '"') {
          inString = true;
          stripped += ch;
          continue;
        }
        if (ch === '/' && raw[i + 1] === '/') {
          while (i < raw.length && raw[i] !== '\n') { i++; }
          continue;
        }
        if (ch === '/' && raw[i + 1] === '*') {
          i += 2;
          while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) { i++; }
          i++;
          continue;
        }
        stripped += ch;
      }

      return JSON.parse(stripped);
    }
  } catch {
    return {};
  }
}

export function hasCliRuntime(dir: string): boolean {
  return fs.existsSync(path.join(dir, '.agentx', 'config.json'));
}

export function findCliRuntimeInDir(dir: string, depth: number): string | undefined {
  if (hasCliRuntime(dir)) { return dir; }
  if (depth <= 0) { return undefined; }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) { continue; }
    if (
      entry.name.startsWith('.')
      || entry.name === 'node_modules'
      || entry.name === 'dist'
      || entry.name === 'out'
      || entry.name === 'build'
      || entry.name === '__pycache__'
    ) {
      continue;
    }

    const found = findCliRuntimeInDir(path.join(dir, entry.name), depth - 1);
    if (found) { return found; }
  }

  return undefined;
}

export function collectMatchingFiles(
  dir: string,
  predicate: (name: string) => boolean,
  results: string[],
): void {
  if (!fs.existsSync(dir)) { return; }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMatchingFiles(fullPath, predicate, results);
      continue;
    }
    if (entry.isFile() && predicate(entry.name)) {
      results.push(fullPath);
    }
  }
}

export function resolveAgentDefinitionPath(
  workspaceRoot: string | undefined,
  extensionPath: string,
  agentFile: string,
): string | undefined {
  const workspacePath = workspaceRoot ? path.join(workspaceRoot, '.github', 'agents', agentFile) : '';
  const workspaceInternalPath = workspaceRoot
    ? path.join(workspaceRoot, '.github', 'agents', 'internal', agentFile)
    : '';
  const bundledPath = path.join(extensionPath, '.github', 'agentx', 'agents', agentFile);
  const bundledInternalPath = path.join(extensionPath, '.github', 'agentx', 'agents', 'internal', agentFile);

  if (workspacePath && fs.existsSync(workspacePath)) { return workspacePath; }
  if (workspaceInternalPath && fs.existsSync(workspaceInternalPath)) { return workspaceInternalPath; }
  if (fs.existsSync(bundledPath)) { return bundledPath; }
  if (fs.existsSync(bundledInternalPath)) { return bundledInternalPath; }
  return undefined;
}

export function parseAgentDefinition(content: string, agentFile: string): AgentDefinition | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) { return undefined; }

  const frontmatter = match[1];
  const get = (key: string): string => {
    const valueMatch = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return valueMatch ? valueMatch[1].replace(/^['"]|['"]$/g, '').trim() : '';
  };

  const getList = (key: string): string[] => {
    const re = new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm');
    const listMatch = frontmatter.match(re);
    if (!listMatch) { return []; }
    return listMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
      .filter((line) => line.length > 0);
  };

  const parseHandoffs = (): AgentHandoff[] => {
    const handoffRe = /^handoffs:\s*\n((?:\s+-\s+[\s\S]*?)(?=\n\w|$))/m;
    const handoffMatch = frontmatter.match(handoffRe);
    if (!handoffMatch) { return []; }

    const entries: AgentHandoff[] = [];
    const blocks = handoffMatch[1].split(/\n\s+-\s+/).filter(Boolean);
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
        .map((tool) => tool.trim().replace(/^['"]|['"]$/g, ''))
        .filter((tool) => tool.length > 0);
    }
    return getList('tools');
  };

  const parseBoundaries = (): AgentBoundaries | undefined => {
    const boundariesMatch = frontmatter.match(/^boundaries:\s*\n((?:\s+\w[\s\S]*?)(?=\n\w|$))/m);
    if (!boundariesMatch) { return undefined; }
    const block = boundariesMatch[1];
    const extractPaths = (key: string): string[] => {
      const re = new RegExp(`${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm');
      const pathMatch = block.match(re);
      if (!pathMatch) { return []; }
      return pathMatch[1]
        .split('\n')
        .map((line) => line.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
        .filter((line) => line.length > 0);
    };
    return { canModify: extractPaths('can_modify'), cannotModify: extractPaths('cannot_modify') };
  };

  const fmName = get('name') || undefined;
  const frontmatterStart = match.index ?? 0;
  const bodyAfterFm = content.substring(frontmatterStart + match[0].length);
  const headingMatch = bodyAfterFm.match(/^#\s+(.+)$/m);
  const displayName = fmName || (headingMatch ? headingMatch[1].trim() : undefined);

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

export function resolveWorkspaceRoot(
  config: vscode.WorkspaceConfiguration,
  folders: readonly vscode.WorkspaceFolder[] | undefined,
): string | undefined {
  const explicit = config.get<string>('rootPath', '').trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  if (!folders || folders.length === 0) {
    return undefined;
  }

  for (const folder of folders) {
    if (hasCliRuntime(folder.uri.fsPath)) {
      return folder.uri.fsPath;
    }
  }

  const searchDepth = config.get<number>('searchDepth', 2);
  for (const folder of folders) {
    const found = findCliRuntimeInDir(folder.uri.fsPath, searchDepth);
    if (found) {
      return found;
    }
  }

  return folders[0].uri.fsPath;
}

export function hasConfiguredIntegration(root: string | undefined, integration: string): boolean {
  if (!root) {
    return false;
  }

  const mcpConfig = readMcpConfig(root);
  if (!mcpConfig.servers) {
    return false;
  }

  return Object.keys(mcpConfig.servers).some(
    (name) => name.toLowerCase().includes(integration.toLowerCase()),
  );
}

export function getConfiguredShell(config: vscode.WorkspaceConfiguration): string {
  return config.get<string>('shell', 'auto');
}

export function buildCliCommand(root: string | undefined, shell: string): string {
  if (!root) {
    return '';
  }

  if (shell === 'bash' || (shell === 'auto' && process.platform !== 'win32')) {
    return path.join(root, '.agentx', 'agentx.sh');
  }

  return path.join(root, '.agentx', 'agentx.ps1');
}

function safeQuoteArg(arg: string): string {
  const trimmed = arg.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return arg; // already quoted by caller
  }
  return /\s/.test(arg) ? `"${arg}"` : arg;
}

export function buildCliInvocation(
  cliPath: string,
  shell: string,
  subcommand: string,
  cliArgs: string[],
): { command: string; shellKind: 'pwsh' | 'bash' } {
  const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');
  const argStr = cliArgs.length > 0 ? ' ' + cliArgs.map(safeQuoteArg).join(' ') : '';

  return {
    command: isPwsh
      ? `& "${cliPath}" ${subcommand}${argStr}`
      : `bash "${cliPath}" ${subcommand}${argStr}`,
    shellKind: isPwsh ? 'pwsh' : 'bash',
  };
}

export function listExecutionPlanFilesForRoot(root: string | undefined): string[] {
  if (!root) {
    return [];
  }

  const candidates: string[] = [];
  // Primary canonical location (docs/execution/plans/)
  collectMatchingFiles(path.join(root, 'docs', 'execution', 'plans'), (name) => name.endsWith('.md'), candidates);
  // Legacy shim paths retained for migration compatibility
  collectMatchingFiles(path.join(root, 'docs', 'plans'), (name) => name.endsWith('.md'), candidates);
  collectMatchingFiles(path.join(root, 'docs'), (name) => /^EXEC-PLAN.+\.md$/i.test(name), candidates);

  return candidates
    .map((candidate) => path.relative(root, candidate).replace(/\\/g, '/'))
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .sort();
}

export function collectAgentDefinitionFiles(
  workspaceRoot: string | undefined,
  extensionPath: string,
): string[] {
  const fileSet = new Set<string>();

  const bundledDir = path.join(extensionPath, '.github', 'agentx', 'agents');
  if (fs.existsSync(bundledDir)) {
    for (const file of fs.readdirSync(bundledDir).filter((entry) => entry.endsWith('.agent.md'))) {
      fileSet.add(file);
    }
  }

  const bundledInternalDir = path.join(bundledDir, 'internal');
  if (fs.existsSync(bundledInternalDir)) {
    for (const file of fs.readdirSync(bundledInternalDir).filter((entry) => entry.endsWith('.agent.md'))) {
      fileSet.add(file);
    }
  }

  if (workspaceRoot) {
    const workspaceDir = path.join(workspaceRoot, '.github', 'agents');
    if (fs.existsSync(workspaceDir)) {
      for (const file of fs.readdirSync(workspaceDir).filter((entry) => entry.endsWith('.agent.md'))) {
        fileSet.add(file);
      }
    }

    const workspaceInternalDir = path.join(workspaceDir, 'internal');
    if (fs.existsSync(workspaceInternalDir)) {
      for (const file of fs.readdirSync(workspaceInternalDir).filter((entry) => entry.endsWith('.agent.md'))) {
        fileSet.add(file);
      }
    }
  }

  return [...fileSet];
}