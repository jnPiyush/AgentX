import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  getLatestCompatibleRelease,
  parsePluginRegistryIndex,
  readPluginManifestFromDir,
  summarizePluginManifest,
  type PluginManifest,
  type PluginCatalogSummary,
  type PluginRegistryEntry,
} from '../utils/pluginCatalog';
import { verifyFileChecksum } from '../utils/pluginIntegrity';
import {
  appendPluginInstallRecord,
  buildPermissionFingerprint,
  getLatestPluginInstallRecord,
  readPluginInstallAuditState,
  type PluginTrustDecision,
} from '../utils/pluginInstallState';
import { readInstalledVersion } from '../utils/versionChecker';
import {
 ARCHIVE_URL,
 BRANCH,
 copyDirRecursive,
 downloadFile,
 extractZip,
 promptWorkspaceRoot,
} from './initializeInternals';

export const PLUGIN_REGISTRY_URL = `https://raw.githubusercontent.com/jnPiyush/AgentX/${BRANCH}/.agentx/plugins/registry.json`;

interface BasePluginPick extends vscode.QuickPickItem {
 readonly sourceKind: 'local' | 'registry';
 readonly targetDirName: string;
 readonly pluginId: string;
 readonly qualifiedId: string;
 readonly publisher?: string;
 readonly version?: string;
}

interface LocalPluginPick extends BasePluginPick {
 readonly sourceKind: 'local';
 readonly pluginDir: string;
}

interface RegistryPluginPick extends BasePluginPick {
 readonly sourceKind: 'registry';
 readonly artifactUrl: string;
 readonly pluginPath?: string;
 readonly checksum?: string;
 readonly publishedAt?: string;
}

type PluginPick = LocalPluginPick | RegistryPluginPick;

interface CatalogSelection {
 readonly source: 'archive' | 'registry';
 readonly picks: PluginPick[];
}

function buildPluginDescription(summary: PluginCatalogSummary, source: 'archive' | 'registry'): string {
  const versionSuffix = summary.version ? ` v${summary.version}` : '';
  const compatibilitySuffix = summary.agentxRange
    ? ` | AgentX ${summary.agentxRange}`
    : '';
  const sourceSuffix = source === 'registry' ? ' | registry' : '';
  return `${summary.description}${versionSuffix}${compatibilitySuffix}${sourceSuffix}`;
}

export function getLocalPluginPicks(pluginsRoot: string): LocalPluginPick[] {
  return fs.readdirSync(pluginsRoot, { withFileTypes: true })
   .filter((entry) => entry.isDirectory())
   .map((entry) => {
    const pluginDir = path.join(pluginsRoot, entry.name);
    const manifest = readPluginManifestFromDir(pluginDir);
    const summary = summarizePluginManifest(manifest, entry.name);

    return {
      sourceKind: 'local',
     pluginId: summary.pluginId,
     qualifiedId: summary.qualifiedId,
     publisher: summary.publisher,
     version: summary.version,
     label: summary.label,
     description: buildPluginDescription(summary, 'archive'),
     pluginDir,
     targetDirName: path.basename(pluginDir),
    } satisfies LocalPluginPick;
   })
   .sort((left, right) => left.label.localeCompare(right.label));
}

function buildRegistrySummary(entry: PluginRegistryEntry, hostVersion: string): PluginCatalogSummary | undefined {
  const release = getLatestCompatibleRelease(entry, hostVersion);
  if (!release) {
    return undefined;
  }

  return {
    pluginId: entry.pluginId,
    publisher: entry.publisher,
    qualifiedId: entry.qualifiedId,
    label: entry.displayName ?? entry.qualifiedId,
    description: entry.description ?? 'AgentX plugin',
    version: release.version,
    agentxRange: release.engines?.agentx,
  };
}

export function getRegistryPluginPicks(
  rawRegistry: unknown,
  hostVersion: string,
): RegistryPluginPick[] {
  const registry = parsePluginRegistryIndex(rawRegistry);
  if (!registry) {
    return [];
  }

  const picks: RegistryPluginPick[] = [];
  for (const entry of registry.plugins) {
    const release = getLatestCompatibleRelease(entry, hostVersion);
    const summary = buildRegistrySummary(entry, hostVersion);
    if (!release || !summary) {
      continue;
    }

    picks.push({
      sourceKind: 'registry',
      pluginId: summary.pluginId,
      qualifiedId: summary.qualifiedId,
      publisher: summary.publisher,
      version: summary.version,
      label: summary.label,
      description: buildPluginDescription(summary, 'registry'),
      artifactUrl: release.artifactUrl,
      pluginPath: release.pluginPath,
      checksum: release.checksum,
      publishedAt: release.publishedAt,
      targetDirName: entry.pluginId,
    });
  }

  return picks.sort((left, right) => left.label.localeCompare(right.label));
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
}

function cleanUpFile(targetPath: string): void {
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch {
    // ignore cleanup failures
  }
}

function cleanUpDir(targetPath: string): void {
  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup failures
  }
}

function resolveArchiveRoot(extractRoot: string): string {
  const entries = fs.readdirSync(extractRoot, { withFileTypes: true });
  const archiveRoot = entries.find((entry) => entry.isDirectory());
  return archiveRoot ? path.join(extractRoot, archiveRoot.name) : extractRoot;
}

function isPluginDirectory(candidate: string): boolean {
  return fs.existsSync(candidate)
    && fs.statSync(candidate).isDirectory()
    && !!readPluginManifestFromDir(candidate);
}

export function resolvePluginDirectoryFromArtifact(
  extractRoot: string,
  pluginPath?: string,
): string | undefined {
  const archiveRoot = resolveArchiveRoot(extractRoot);
  const candidates: string[] = [];

  if (pluginPath) {
    const pathParts = pluginPath.split(/[\\/]+/).filter((part) => part.length > 0);
    candidates.push(path.join(archiveRoot, ...pathParts));
    candidates.push(path.join(extractRoot, ...pathParts));
  }

  candidates.push(archiveRoot);
  candidates.push(extractRoot);

  for (const candidate of candidates) {
    if (isPluginDirectory(candidate)) {
      return candidate;
    }
  }

  const archiveChildren = fs.readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(archiveRoot, entry.name))
    .filter((candidate) => isPluginDirectory(candidate));

  return archiveChildren.length === 1 ? archiveChildren[0] : undefined;
}

async function loadRegistryPluginPicks(root: string, hostVersion: string): Promise<RegistryPluginPick[]> {
  const registryFile = path.join(root, '.agentx-plugin-registry.json');
  cleanUpFile(registryFile);
  await downloadFile(PLUGIN_REGISTRY_URL, registryFile);
  const picks = getRegistryPluginPicks(readJsonFile(registryFile), hostVersion);
  cleanUpFile(registryFile);
  return picks;
}

async function loadArchivePluginPicks(root: string): Promise<LocalPluginPick[]> {
  const rawDir = path.join(root, '.agentx-plugin-install-raw');
  const zipFile = path.join(root, '.agentx-plugin-install.zip');

  cleanUpDir(rawDir);
  cleanUpFile(zipFile);

  await downloadFile(ARCHIVE_URL, zipFile);
  await extractZip(zipFile, rawDir);

  const pluginsRoot = path.join(resolveArchiveRoot(rawDir), '.agentx', 'plugins');
  if (!fs.existsSync(pluginsRoot)) {
    throw new Error('No AgentX plugins were found in the source archive.');
  }

  const picks = getLocalPluginPicks(pluginsRoot);
  cleanUpDir(rawDir);
  cleanUpFile(zipFile);
  return picks;
}

export async function selectCatalogPicks(
  loadRegistry: () => Promise<RegistryPluginPick[]>,
  loadArchive: () => Promise<LocalPluginPick[]>,
): Promise<CatalogSelection> {
  try {
    const registryPicks = await loadRegistry();
    if (registryPicks.length > 0) {
      return { source: 'registry', picks: registryPicks };
    }
  } catch {
    // fall back to the legacy archive catalog
  }

  return { source: 'archive', picks: await loadArchive() };
}

function resolveHostVersion(root: string, extensionVersion: string): string {
  return readInstalledVersion(root)?.version ?? extensionVersion;
}

function readPluginManifestOrThrow(pluginDir: string): PluginManifest {
  const manifest = readPluginManifestFromDir(pluginDir);
  if (!manifest) {
    throw new Error('The plugin package did not contain a valid plugin.json manifest.');
  }

  return manifest;
}

export function getPublishedPluginSummaryOrThrow(
  manifest: PluginManifest,
  pick: RegistryPluginPick,
): PluginCatalogSummary {
  const summary = summarizePluginManifest(manifest, pick.targetDirName);
  if (summary.pluginId !== pick.pluginId) {
    throw new Error(
      `Published plugin id mismatch. Registry declares "${pick.pluginId}" but artifact declares "${summary.pluginId}".`,
    );
  }

  if (!summary.publisher || summary.publisher !== pick.publisher) {
    throw new Error(
      `Published plugin publisher mismatch. Registry declares "${pick.publisher ?? 'unknown'}" but artifact declares "${summary.publisher ?? 'unknown'}".`,
    );
  }

  if (summary.qualifiedId !== pick.qualifiedId) {
    throw new Error(
      `Published plugin identity mismatch. Registry declares "${pick.qualifiedId}" but artifact declares "${summary.qualifiedId}".`,
    );
  }

  if (pick.version && summary.version && pick.version !== summary.version) {
    throw new Error(
      `Published plugin version mismatch. Registry declares "${pick.version}" but artifact declares "${summary.version}".`,
    );
  }

  return summary;
}

function formatPermissionValue(value: string | undefined): string {
  return value ?? 'none declared';
}

function buildTrustPromptDetail(
  summary: PluginCatalogSummary,
  manifest: PluginManifest,
  pick: RegistryPluginPick,
  trustDecisionReason: PluginTrustDecision['reason'],
): string {
  const remoteHosts = manifest.permissions?.remoteHosts?.join(', ') ?? 'none declared';
  const requires = manifest.requires?.join(', ') ?? 'none declared';
  const policyReason = trustDecisionReason === 'permissions-changed'
    ? 'Permission footprint changed since the last approved install.'
    : trustDecisionReason === 'reinstall'
      ? 'Reinstalling a previously approved published plugin.'
      : 'First published install for this plugin.';

  return [
    `Publisher: ${summary.publisher ?? pick.publisher ?? 'unknown'}`,
    `Plugin: ${summary.qualifiedId}`,
    `Version: ${summary.version ?? pick.version ?? 'unknown'}`,
    `Policy reason: ${policyReason}`,
    `Checksum: ${pick.checksum ?? 'missing'}`,
    `Filesystem: ${formatPermissionValue(manifest.permissions?.filesystem)}`,
    `Network: ${formatPermissionValue(manifest.permissions?.network)}`,
    `Process: ${formatPermissionValue(manifest.permissions?.process)}`,
    `Secrets: ${formatPermissionValue(manifest.permissions?.secrets)}`,
    `Remote hosts: ${remoteHosts}`,
    `Requires: ${requires}`,
    `Source: ${manifest.source ?? 'not declared'}`,
  ].join('\n');
}

async function confirmPublishedPluginTrust(
  root: string,
  pick: RegistryPluginPick,
  summary: PluginCatalogSummary,
  manifest: PluginManifest,
): Promise<PluginTrustDecision> {
  const state = readPluginInstallAuditState(root);
  const latest = getLatestPluginInstallRecord(state, summary.qualifiedId);
  const permissionFingerprint = buildPermissionFingerprint(manifest);
  const reason: PluginTrustDecision['reason'] = !latest
    ? 'first-install'
    : latest.trustDecision.permissionFingerprint !== permissionFingerprint
      ? 'permissions-changed'
      : 'reinstall';

  const action = await vscode.window.showWarningMessage(
    `Review trust and policy details before installing published plugin "${pick.label}".`,
    {
      modal: true,
      detail: buildTrustPromptDetail(summary, manifest, pick, reason),
    },
    'Install Published Plugin',
    'Cancel',
  );

  if (action !== 'Install Published Plugin') {
    throw new Error('Published plugin installation was cancelled during trust review.');
  }

  return {
    kind: 'approved',
    prompted: true,
    reason,
    approvedAt: new Date().toISOString(),
    permissionFingerprint,
  };
}

function writePluginInstallAuditRecord(
  root: string,
  pluginTarget: string,
  pick: PluginPick,
  manifest: PluginManifest,
  trustDecision: PluginTrustDecision,
  extensionVersion: string,
  hostVersion: string,
  checksumVerified: boolean,
): void {
  const summary = summarizePluginManifest(manifest, pick.targetDirName);
  appendPluginInstallRecord(root, {
    qualifiedId: summary.qualifiedId,
    pluginId: summary.pluginId,
    publisher: summary.publisher,
    displayName: summary.label,
    version: summary.version,
    sourceKind: pick.sourceKind,
    installedAt: new Date().toISOString(),
    installedByExtensionVersion: extensionVersion,
    hostVersion,
    installPath: pluginTarget,
    targetDirName: pick.targetDirName,
    artifactUrl: pick.sourceKind === 'registry' ? pick.artifactUrl : undefined,
    artifactChecksum: pick.sourceKind === 'registry' ? pick.checksum : undefined,
    checksumVerified,
    sourceRepository: manifest.source,
    license: manifest.license,
    capabilities: manifest.capabilities,
    requires: manifest.requires,
    permissions: manifest.permissions,
    trustDecision,
  });
}

async function installRegistryPlugin(
  root: string,
  pick: RegistryPluginPick,
  extensionVersion: string,
  hostVersion: string,
): Promise<void> {
  if (!pick.artifactUrl.startsWith('https://')) {
    throw new Error('Published plugin artifact URL must use HTTPS.');
  }

  const rawDir = path.join(root, '.agentx-plugin-install-raw');
  const zipFile = path.join(root, '.agentx-plugin-install.zip');

  cleanUpDir(rawDir);
  cleanUpFile(zipFile);

  try {
    await downloadFile(pick.artifactUrl, zipFile);
    if (!pick.checksum) {
      throw new Error('Published plugin releases must declare a checksum in registry.json.');
    }

    const verification = verifyFileChecksum(zipFile, pick.checksum);
    if (!verification.matches) {
      throw new Error(`Checksum verification failed for published plugin artifact (${verification.algorithm}).`);
    }

    await extractZip(zipFile, rawDir);

    const pluginSource = resolvePluginDirectoryFromArtifact(rawDir, pick.pluginPath);
    if (!pluginSource) {
      throw new Error('The published plugin artifact did not contain a valid plugin.json.');
    }

    const manifest = readPluginManifestOrThrow(pluginSource);
    const summary = getPublishedPluginSummaryOrThrow(manifest, pick);
    const trustDecision = await confirmPublishedPluginTrust(root, pick, summary, manifest);

    const pluginTarget = path.join(root, '.agentx', 'plugins', pick.targetDirName);
    fs.mkdirSync(path.dirname(pluginTarget), { recursive: true });
    copyDirRecursive(pluginSource, pluginTarget, true);
    writePluginInstallAuditRecord(
      root,
      pluginTarget,
      pick,
      manifest,
      trustDecision,
      extensionVersion,
      hostVersion,
      true,
    );
  } finally {
    cleanUpDir(rawDir);
    cleanUpFile(zipFile);
  }
}

export async function runAddPluginCommand(
 context: vscode.ExtensionContext,
 _agentx: AgentXContext,
): Promise<void> {
 const root = await promptWorkspaceRoot('AgentX - Add Plugin');
 if (!root) {
  return;
 }

 if (!fs.existsSync(path.join(root, '.agentx', 'config.json'))) {
  vscode.window.showWarningMessage(
   'AgentX plugins require workspace initialization. Run "AgentX: Initialize Local Runtime" first.',
  );
  return;
 }

 try {
  const extensionVersion = context.extension?.packageJSON?.version ?? '0.0.0';
  const hostVersion = resolveHostVersion(root, extensionVersion);
  let catalog: CatalogSelection | undefined;

  await vscode.window.withProgress(
   {
    location: vscode.ProgressLocation.Notification,
    title: 'AgentX: Loading plugin catalog...',
    cancellable: false,
   },
   async (progress) => {
    progress.report({ message: 'Resolving published plugin catalog...' });
    catalog = await selectCatalogPicks(
      () => loadRegistryPluginPicks(root, hostVersion),
      async () => {
        progress.report({ message: 'Falling back to bundled plugin catalog...', increment: 40 });
        return loadArchivePluginPicks(root);
      },
    );
   },
  );

  const picks = catalog?.picks ?? [];
  if (picks.length === 0) {
   throw new Error('No AgentX plugins are available to install.');
  }

  const pick = await vscode.window.showQuickPick(picks, {
   placeHolder: 'Select a plugin to install',
    title: catalog?.source === 'registry'
      ? 'AgentX - Add Published Plugin'
      : 'AgentX - Add Plugin',
  });
  if (!pick) {
   return;
  }

  const pluginTarget = path.join(root, '.agentx', 'plugins', pick.targetDirName);
  if (fs.existsSync(pluginTarget)) {
   const overwrite = await vscode.window.showWarningMessage(
    `AgentX plugin \"${pick.label}\" is already installed. Reinstall?`,
    'Reinstall',
    'Cancel',
   );
   if (overwrite !== 'Reinstall') {
    return;
   }
  }

  await vscode.window.withProgress(
   {
    location: vscode.ProgressLocation.Notification,
    title: 'AgentX: Installing plugin...',
    cancellable: false,
   },
   async (progress) => {
    progress.report({ message: `Installing ${pick.label}...` });

    if (pick.sourceKind === 'registry') {
      await installRegistryPlugin(root, pick, extensionVersion, hostVersion);
      return;
    }

    fs.mkdirSync(path.dirname(pluginTarget), { recursive: true });
    copyDirRecursive(pick.pluginDir, pluginTarget, true);
    const localManifest = readPluginManifestOrThrow(pick.pluginDir);
    writePluginInstallAuditRecord(
      root,
      pluginTarget,
      pick,
      localManifest,
      {
        kind: 'workspace-local',
        prompted: false,
        reason: 'local-catalog',
        approvedAt: new Date().toISOString(),
        permissionFingerprint: buildPermissionFingerprint(localManifest),
      },
      extensionVersion,
      hostVersion,
      false,
    );
   },
  );

  vscode.window.showInformationMessage(`AgentX plugin installed: ${pick.label}`);
  vscode.commands.executeCommand('agentx.refresh');
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`AgentX plugin install failed: ${message}`);
 }
}
