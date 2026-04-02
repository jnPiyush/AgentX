import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { promptWorkspaceRoot, readJsonWithComments } from './initializeInternals';
import { runCriticalPreCheck } from './setupWizard';

export type AdapterMode = 'github' | 'ado' | 'local';

interface AdapterPick extends vscode.QuickPickItem {
  readonly value: AdapterMode;
}

interface AgentXConfig {
  readonly created?: string;
  readonly adapters?: Record<string, unknown>;
  readonly project?: number | string | null;
  readonly repo?: string | null;
  readonly [key: string]: unknown;
}

export interface GitHubAdapterSettings {
  readonly repoSlug: string;
  readonly projectNum?: number | null;
}

export interface AdoAdapterSettings {
  readonly organization: string;
  readonly project: string;
}

export interface RemoteAdapterApplyResult {
  readonly changed: boolean;
  readonly mode: AdapterMode;
  readonly preCheckPassed: boolean;
}

const ADAPTER_MODE_ITEMS: readonly AdapterPick[] = [
  { label: 'github', value: 'github', description: 'GitHub Actions, PRs, Projects (via MCP)' },
  { label: 'ado', value: 'ado', description: 'Azure DevOps work items and boards (Azure CLI provider)' },
  { label: 'local', value: 'local', description: 'Workspace-only mode without a remote backlog adapter' },
];

async function detectOriginRemoteUrl(root: string): Promise<string | undefined> {
  try {
    const { execShell: exec } = await import('../utils/shell');
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const remoteUrl = await exec('git remote get-url origin', root, shell);
    return remoteUrl.trim();
  } catch {
    return undefined;
  }
}

export async function detectGitHubOriginRepo(root: string): Promise<string | undefined> {
  const remoteUrl = await detectOriginRemoteUrl(root);
  if (!remoteUrl) {
    return undefined;
  }

  try {
    const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (!match) {
      return undefined;
    }

    return match[1].replace(/\.git$/, '');
  } catch {
    return undefined;
  }
}

export async function detectAdoOrigin(root: string): Promise<AdoAdapterSettings | undefined> {
  const remoteUrl = await detectOriginRemoteUrl(root);
  if (!remoteUrl) {
    return undefined;
  }

  const normalized = remoteUrl.replace(/\.git$/, '');

  const httpsMatch = normalized.match(/dev\.azure\.com\/(?<org>[^/]+)\/(?<project>[^/]+)\/_git\/(?<repo>[^/]+)/i);
  if (httpsMatch?.groups?.org && httpsMatch.groups.project) {
    return {
      organization: httpsMatch.groups.org,
      project: httpsMatch.groups.project,
    };
  }

  const legacyHttpsMatch = normalized.match(/https:\/\/(?<org>[^/.]+)\.visualstudio\.com\/(?<project>[^/]+)\/_git\/(?<repo>[^/]+)/i);
  if (legacyHttpsMatch?.groups?.org && legacyHttpsMatch.groups.project) {
    return {
      organization: legacyHttpsMatch.groups.org,
      project: legacyHttpsMatch.groups.project,
    };
  }

  const sshMatch = normalized.match(/ssh\.dev\.azure\.com:v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?<repo>[^/]+)/i);
  if (sshMatch?.groups?.org && sshMatch.groups.project) {
    return {
      organization: sshMatch.groups.org,
      project: sshMatch.groups.project,
    };
  }

  const legacySshMatch = normalized.match(/vs-ssh\.visualstudio\.com:v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?<repo>[^/]+)/i);
  if (legacySshMatch?.groups?.org && legacySshMatch.groups.project) {
    return {
      organization: legacySshMatch.groups.org,
      project: legacySshMatch.groups.project,
    };
  }

  return undefined;
}

function normalizeProjectNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function writeJsonIfChanged(filePath: string, content: unknown): boolean {
  const next = JSON.stringify(content, null, 2);
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : undefined;
  if (current?.trim() === next.trim()) {
    return false;
  }

  fs.writeFileSync(filePath, next);
  return true;
}

function upsertMcpServer(root: string, mode: AdapterMode): boolean {
  const vscodeDir = path.join(root, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });

  const mcpPath = path.join(vscodeDir, 'mcp.json');
  const mcpConfig = readJsonWithComments<{ servers?: Record<string, unknown> }>(mcpPath) ?? {};
  const servers = { ...(mcpConfig.servers ?? {}) };

  servers[mode] = {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
  };

  return writeJsonIfChanged(mcpPath, { ...mcpConfig, servers });
}

function upsertGitHubAdapterConfig(root: string, settings: GitHubAdapterSettings): boolean {
  const configFile = path.join(root, '.agentx', 'config.json');
  const existingConfig = readJsonWithComments<AgentXConfig>(configFile) ?? {};
  const existingAdapters = { ...(existingConfig.adapters as Record<string, unknown> | undefined) };
  const currentGithubAdapter = (existingAdapters.github ?? {}) as Record<string, unknown>;
  const projectNum = settings.projectNum ?? normalizeProjectNumber(currentGithubAdapter.project ?? existingConfig.project);

  existingAdapters.github = {
    repo: settings.repoSlug,
    project: projectNum,
  };

  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    provider: 'github',
    integration: 'github',
    mode: 'github',
    repo: settings.repoSlug,
    project: projectNum,
    adapters: existingAdapters,
    created: existingConfig.created ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return writeJsonIfChanged(configFile, nextConfig);
}

function upsertAdoAdapterConfig(root: string, settings: AdoAdapterSettings): boolean {
  const configFile = path.join(root, '.agentx', 'config.json');
  const existingConfig = readJsonWithComments<AgentXConfig>(configFile) ?? {};
  const existingAdapters = { ...(existingConfig.adapters as Record<string, unknown> | undefined) };

  existingAdapters.ado = {
    organization: settings.organization,
    project: settings.project,
  };

  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    provider: 'ado',
    integration: 'ado',
    mode: 'ado',
    organization: settings.organization,
    project: settings.project,
    adapters: existingAdapters,
    created: existingConfig.created ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return writeJsonIfChanged(configFile, nextConfig);
}

function switchToLocalAdapterConfig(root: string): boolean {
  const configFile = path.join(root, '.agentx', 'config.json');
  const existingConfig = readJsonWithComments<AgentXConfig>(configFile) ?? {};

  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    provider: 'local',
    integration: 'local',
    mode: 'local',
    created: existingConfig.created ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return writeJsonIfChanged(configFile, nextConfig);
}

export async function applyRemoteAdapterConfiguration(
  agentx: AgentXContext,
  root: string,
  mode: AdapterMode,
  settings?: GitHubAdapterSettings | AdoAdapterSettings,
  options?: { readonly runPreCheck?: boolean },
): Promise<RemoteAdapterApplyResult> {
  const changed = mode === 'local'
    ? switchToLocalAdapterConfig(root)
    : await upsertRemoteAdapter(root, mode, settings as GitHubAdapterSettings | AdoAdapterSettings);

  agentx.invalidateCache();
  await vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
  await vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
  await vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

  let preCheckPassed = true;
  if ((options?.runPreCheck ?? true) && mode !== 'local') {
    const preCheck = await runCriticalPreCheck(agentx, true);
    preCheckPassed = preCheck.passed;
  }

  return {
    changed,
    mode,
    preCheckPassed,
  };
}

async function upsertRemoteAdapter(
  root: string,
  mode: AdapterMode,
  settings: GitHubAdapterSettings | AdoAdapterSettings,
): Promise<boolean> {
  const mcpChanged = mode === 'github' ? upsertMcpServer(root, mode) : false;
  const configChanged = mode === 'github'
    ? upsertGitHubAdapterConfig(root, settings as GitHubAdapterSettings)
    : upsertAdoAdapterConfig(root, settings as AdoAdapterSettings);

  return mcpChanged || configChanged;
}

export async function syncDetectedGitHubAdapter(
  agentx: AgentXContext,
  options?: { readonly notify?: boolean },
): Promise<boolean> {
  const root = agentx.workspaceRoot ?? agentx.firstWorkspaceFolder;
  if (!root) {
    return false;
  }

  const configFile = path.join(root, '.agentx', 'config.json');
  if (!fs.existsSync(configFile)) {
    return false;
  }

  const repoSlug = await detectGitHubOriginRepo(root);
  if (!repoSlug) {
    return false;
  }

  const changed = await upsertRemoteAdapter(root, 'github', { repoSlug });
  if (!changed) {
    return false;
  }

  agentx.invalidateCache();
  await vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
  await vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
  await vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

  if (options?.notify) {
    vscode.window.showInformationMessage(`AgentX: GitHub remote detected. Active mode switched to GitHub (${repoSlug}).`);
  }

  return true;
}

export async function syncDetectedAdoAdapter(
  agentx: AgentXContext,
  options?: { readonly notify?: boolean },
): Promise<boolean> {
  const root = agentx.workspaceRoot ?? agentx.firstWorkspaceFolder;
  if (!root) {
    return false;
  }

  const configFile = path.join(root, '.agentx', 'config.json');
  if (!fs.existsSync(configFile)) {
    return false;
  }

  const adoSettings = await detectAdoOrigin(root);
  if (!adoSettings) {
    return false;
  }

  const changed = await upsertRemoteAdapter(root, 'ado', adoSettings);
  if (!changed) {
    return false;
  }

  agentx.invalidateCache();
  await vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
  await vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
  await vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

  if (options?.notify) {
    vscode.window.showInformationMessage(
      `AgentX: Azure DevOps remote detected. Active mode switched to Azure DevOps (${adoSettings.organization}/${adoSettings.project}).`,
    );
  }

  return true;
}

async function promptGitHubSettings(root: string): Promise<{ repoSlug?: string; projectNum?: number } | undefined> {
  const detectedRepo = await detectGitHubOriginRepo(root);

  let repoSlug: string | undefined;
  if (detectedRepo) {
    const useDetected = await vscode.window.showQuickPick(
      [
        { label: detectedRepo, description: 'Detected from git remote' },
        { label: 'Enter manually...', description: 'Type a different owner/repo' },
      ],
      { placeHolder: 'GitHub repository (owner/repo)', title: 'AgentX - GitHub Adapter' },
    );
    if (!useDetected) {
      return undefined;
    }
    if (useDetected.label === 'Enter manually...') {
      repoSlug = await vscode.window.showInputBox({
        prompt: 'GitHub repository (owner/repo)',
        placeHolder: 'myorg/myproject',
      });
    } else {
      repoSlug = useDetected.label;
    }
  } else {
    repoSlug = await vscode.window.showInputBox({
      prompt: 'GitHub repository (owner/repo)',
      placeHolder: 'myorg/myproject',
    });
  }

  if (!repoSlug) {
    return undefined;
  }

  const projectInput = await vscode.window.showInputBox({
    prompt: 'GitHub Project number (leave empty to skip)',
    placeHolder: '1',
    validateInput: (value) => {
      if (value && !/^\d+$/.test(value)) {
        return 'Must be a number';
      }
      return undefined;
    },
  });

  return {
    repoSlug,
    projectNum: projectInput ? parseInt(projectInput, 10) : undefined,
  };
}

async function promptAdoSettings(root: string): Promise<{ organization?: string; project?: string } | undefined> {
  const detectedAdo = await detectAdoOrigin(root);

  let organization: string | undefined;
  let project: string | undefined;

  if (detectedAdo) {
    const useDetected = await vscode.window.showQuickPick(
      [
        {
          label: `${detectedAdo.organization}/${detectedAdo.project}`,
          description: 'Detected from git remote',
        },
        { label: 'Enter manually...', description: 'Type a different organization/project' },
      ],
      { placeHolder: 'Azure DevOps organization/project', title: 'AgentX - Azure DevOps Adapter' },
    );
    if (!useDetected) {
      return undefined;
    }

    if (useDetected.label !== 'Enter manually...') {
      organization = detectedAdo.organization;
      project = detectedAdo.project;
    }
  }

  if (!organization) {
    organization = await vscode.window.showInputBox({
      prompt: 'Azure DevOps organization name (e.g. myorg)',
      placeHolder: 'myorg',
    });
  }
  if (!organization) {
    return undefined;
  }

  if (!project) {
    project = await vscode.window.showInputBox({
      prompt: 'Azure DevOps project name',
      placeHolder: 'MyProject',
    });
  }
  if (!project) {
    return undefined;
  }

  return { organization, project };
}

async function promptAdapterMode(preferredMode?: AdapterMode): Promise<AdapterMode | undefined> {
  if (preferredMode) {
    return preferredMode;
  }

  const picked = await vscode.window.showQuickPick(ADAPTER_MODE_ITEMS, {
    placeHolder: 'Select remote adapter to add or switch',
    title: 'AgentX - Add Remote Adapter',
  });

  return picked?.value;
}

export async function runAddRemoteAdapterCommand(
  agentx: AgentXContext,
  preferredMode?: AdapterMode,
): Promise<void> {
  const root = await promptWorkspaceRoot('AgentX - Add Remote Adapter');
  if (!root) {
    return;
  }

  const configFile = path.join(root, '.agentx', 'config.json');
  if (!fs.existsSync(configFile)) {
    vscode.window.showWarningMessage(
      'AgentX remote adapters require workspace initialization. Run "AgentX: Initialize Local Runtime" first.',
    );
    return;
  }

  const mode = await promptAdapterMode(preferredMode);
  if (!mode) {
    return;
  }

  if (mode === 'local') {
    const result = await applyRemoteAdapterConfiguration(agentx, root, 'local', undefined, { runPreCheck: false });

    const suffix = result.changed ? 'Active mode switched to local.' : 'Local mode is already active for this workspace.';
    vscode.window.showInformationMessage(`AgentX: ${suffix}`);
    vscode.commands.executeCommand('agentx.refresh');
    return;
  }

  const githubSettings = mode === 'github' ? await promptGitHubSettings(root) : undefined;
  if (mode === 'github' && !githubSettings) {
    return;
  }

  const adoSettings = mode === 'ado' ? await promptAdoSettings(root) : undefined;
  if (mode === 'ado' && !adoSettings) {
    return;
  }

  const result = await applyRemoteAdapterConfiguration(
    agentx,
    root,
    mode,
    mode === 'github'
      ? {
          repoSlug: githubSettings?.repoSlug ?? '',
          projectNum: githubSettings?.projectNum ?? null,
        }
      : {
          organization: adoSettings?.organization ?? '',
          project: adoSettings?.project ?? '',
        },
    { runPreCheck: true },
  );

  if (!result.preCheckPassed) {
    vscode.window.showWarningMessage(
      `AgentX: ${mode === 'github' ? 'GitHub' : 'Azure DevOps'} adapter added and active mode switched, but some required dependencies still need attention.`,
    );
    return;
  }

  vscode.window.showInformationMessage(
    `AgentX: ${mode === 'github' ? 'GitHub' : 'Azure DevOps'} adapter added. Active mode switched to ${mode === 'github' ? 'GitHub' : 'Azure DevOps'}.`,
  );
  vscode.commands.executeCommand('agentx.refresh');
}