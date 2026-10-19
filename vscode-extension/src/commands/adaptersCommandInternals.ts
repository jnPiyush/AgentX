import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import { promptWorkspaceRoot, readJsonWithComments } from './initializeInternals';
import { runCriticalPreCheck } from './setupWizard';
import { isPrivateFrontierState, resolveFrontierStatePath } from '../utils/frontierPaths';

export type AdapterMode = 'github' | 'ado' | 'local';

interface AdapterPick extends vscode.QuickPickItem {
  readonly value: AdapterMode;
}

interface FrontierConfig {
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
  { label: 'ado', value: 'ado', description: 'Azure DevOps work items and boards (MCP-backed)' },
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
  const patterns = [
    /dev\.azure\.com\/(?<org>[^/]+)\/(?<project>[^/]+)\/_git\/(?<repo>[^/]+)/i,
    /https:\/\/(?<org>[^/.]+)\.visualstudio\.com\/(?<project>[^/]+)\/_git\/(?<repo>[^/]+)/i,
    /ssh\.dev\.azure\.com:v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?<repo>[^/]+)/i,
    /vs-ssh\.visualstudio\.com:v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?<repo>[^/]+)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.groups?.org && match.groups.project) {
      return {
        organization: match.groups.org,
        project: match.groups.project,
      };
    }
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

function writeAdapterConfig(
  root: string,
  mode: AdapterMode,
  mutate?: (existingConfig: FrontierConfig, existingAdapters: Record<string, unknown>) => Record<string, unknown>,
): boolean {
  const configFile = resolveFrontierStatePath(root, 'config.json');
  const existingConfig = readJsonWithComments<FrontierConfig>(configFile) ?? {};
  const existingAdapters = { ...(existingConfig.adapters as Record<string, unknown> | undefined) };
  const extraFields = mutate ? mutate(existingConfig, existingAdapters) : {};

  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    provider: mode,
    integration: mode,
    mode,
    ...extraFields,
    created: existingConfig.created ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return writeJsonIfChanged(configFile, nextConfig);
}

function upsertGitHubAdapterConfig(root: string, settings: GitHubAdapterSettings): boolean {
  return writeAdapterConfig(root, 'github', (existingConfig, existingAdapters) => {
    const currentGithubAdapter = (existingAdapters.github ?? {}) as Record<string, unknown>;
    const projectNum = settings.projectNum ?? normalizeProjectNumber(currentGithubAdapter.project ?? existingConfig.project);
    existingAdapters.github = {
      repo: settings.repoSlug,
      project: projectNum,
    };
    return {
      repo: settings.repoSlug,
      project: projectNum,
      adapters: existingAdapters,
    };
  });
}

function upsertAdoAdapterConfig(root: string, settings: AdoAdapterSettings): boolean {
  return writeAdapterConfig(root, 'ado', (_existingConfig, existingAdapters) => {
    existingAdapters.ado = {
      organization: settings.organization,
      project: settings.project,
    };
    return {
      organization: settings.organization,
      project: settings.project,
      adapters: existingAdapters,
    };
  });
}

function switchToLocalAdapterConfig(root: string): boolean {
  return writeAdapterConfig(root, 'local');
}

async function refreshAdapterContexts(agentx: FrontierContext): Promise<void> {
  agentx.invalidateCache();
  await vscode.commands.executeCommand('setContext', 'frontier.initialized', true);
  await vscode.commands.executeCommand('setContext', 'frontier.githubConnected', agentx.githubConnected);
  await vscode.commands.executeCommand('setContext', 'frontier.adoConnected', agentx.adoConnected);
}

export async function applyRemoteAdapterConfiguration(
  agentx: FrontierContext,
  root: string,
  mode: AdapterMode,
  settings?: GitHubAdapterSettings | AdoAdapterSettings,
  options?: { readonly runPreCheck?: boolean },
): Promise<RemoteAdapterApplyResult> {
  root = await agentx.ensureWorkspaceReady(root);
  const changed = await agentx.workspaceState.withMutation(root, async () => mode === 'local'
    ? switchToLocalAdapterConfig(root)
    : await upsertRemoteAdapter(root, mode, settings as GitHubAdapterSettings | AdoAdapterSettings));

  await refreshAdapterContexts(agentx);

  let preCheckPassed = true;
  if ((options?.runPreCheck ?? true) && mode !== 'local') {
    const preCheck = await runCriticalPreCheck(agentx, true, root);
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
  const mcpChanged = mode === 'github' && !isPrivateFrontierState(root)
    ? upsertMcpServer(root, mode) : false;
  const configChanged = mode === 'github'
    ? upsertGitHubAdapterConfig(root, settings as GitHubAdapterSettings)
    : upsertAdoAdapterConfig(root, settings as AdoAdapterSettings);

  return mcpChanged || configChanged;
}

async function syncDetectedRemoteAdapter<TSettings extends GitHubAdapterSettings | AdoAdapterSettings>(
  agentx: FrontierContext,
  mode: 'github' | 'ado',
  detect: (root: string) => Promise<TSettings | undefined>,
  formatNotification: (settings: TSettings) => string,
  options?: { readonly notify?: boolean; readonly root?: string },
): Promise<boolean> {
  const root = options?.root ?? agentx.workspaceRoot ?? agentx.firstWorkspaceFolder;
  if (!root || !vscode.workspace.isTrusted || isPrivateFrontierState(root)) {
    return false;
  }

  const configFile = resolveFrontierStatePath(root, 'config.json');
  if (!fs.existsSync(configFile)) {
    return false;
  }

  const detectedSettings = await detect(root);
  if (!detectedSettings) {
    return false;
  }

  const changed = await upsertRemoteAdapter(root, mode, detectedSettings);
  if (!changed) {
    return false;
  }

  await refreshAdapterContexts(agentx);

  if (options?.notify) {
    vscode.window.showInformationMessage(formatNotification(detectedSettings));
  }

  return true;
}

export async function syncDetectedGitHubAdapter(
  agentx: FrontierContext,
  options?: { readonly notify?: boolean; readonly root?: string },
): Promise<boolean> {
  return syncDetectedRemoteAdapter(
    agentx,
    'github',
    async (root) => {
      const repoSlug = await detectGitHubOriginRepo(root);
      return repoSlug ? { repoSlug } : undefined;
    },
    (settings) => `Frontier: GitHub remote detected. Active mode switched to GitHub (${settings.repoSlug}).`,
    options,
  );
}

export async function syncDetectedAdoAdapter(
  agentx: FrontierContext,
  options?: { readonly notify?: boolean; readonly root?: string },
): Promise<boolean> {
  return syncDetectedRemoteAdapter(
    agentx,
    'ado',
    detectAdoOrigin,
    (settings) => `Frontier: Azure DevOps remote detected. Active mode switched to Azure DevOps (${settings.organization}/${settings.project}).`,
    options,
  );
}

async function promptUseDetectedRemote(
  detectedLabel: string,
  manualDescription: string,
  placeHolder: string,
  title: string,
): Promise<'detected' | 'manual' | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: detectedLabel, description: 'Detected from git remote' },
      { label: 'Enter manually...', description: manualDescription },
    ],
    { placeHolder, title },
  );
  if (!picked) {
    return undefined;
  }
  return picked.label === 'Enter manually...' ? 'manual' : 'detected';
}

async function promptGitHubSettings(root: string): Promise<{ repoSlug?: string; projectNum?: number } | undefined> {
  const detectedRepo = await detectGitHubOriginRepo(root);

  let repoSlug: string | undefined;
  if (detectedRepo) {
    const choice = await promptUseDetectedRemote(
      detectedRepo,
      'Type a different owner/repo',
      'GitHub repository (owner/repo)',
      'Frontier - GitHub Adapter',
    );
    if (!choice) {
      return undefined;
    }
    if (choice === 'detected') {
      repoSlug = detectedRepo;
    }
  }
  if (!repoSlug) {
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
    const choice = await promptUseDetectedRemote(
      `${detectedAdo.organization}/${detectedAdo.project}`,
      'Type a different organization/project',
      'Azure DevOps organization/project',
      'Frontier - Azure DevOps Adapter',
    );
    if (!choice) {
      return undefined;
    }

    if (choice === 'detected') {
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
    title: 'Frontier - Add Remote Adapter',
  });

  return picked?.value;
}

export async function runAddRemoteAdapterCommand(
  agentx: FrontierContext,
  preferredMode?: AdapterMode,
): Promise<void> {
  const root = await promptWorkspaceRoot('Frontier - Add Remote Adapter');
  if (!root) {
    return;
  }

  await agentx.ensureWorkspaceReady(root);

  const mode = await promptAdapterMode(preferredMode);
  if (!mode) {
    return;
  }

  if (mode === 'local') {
    const result = await applyRemoteAdapterConfiguration(agentx, root, 'local', undefined, { runPreCheck: false });

    const suffix = result.changed ? 'Active mode switched to local.' : 'Local mode is already active for this workspace.';
    vscode.window.showInformationMessage(`Frontier: ${suffix}`);
    vscode.commands.executeCommand('frontier.refresh');
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
      `Frontier: ${mode === 'github' ? 'GitHub' : 'Azure DevOps'} adapter added and active mode switched, but some required dependencies still need attention.`,
    );
    return;
  }

  vscode.window.showInformationMessage(
    `Frontier: ${mode === 'github' ? 'GitHub' : 'Azure DevOps'} adapter added. Active mode switched to ${mode === 'github' ? 'GitHub' : 'Azure DevOps'}.`,
  );
  vscode.commands.executeCommand('frontier.refresh');
}