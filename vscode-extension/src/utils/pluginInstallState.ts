import * as fs from 'fs';
import * as path from 'path';

import type { PluginManifest, PluginPermissions } from './pluginCatalog';

const PLUGIN_INSTALL_STATE_REL = path.join('.agentx', 'state', 'plugin-installs.json');

export interface PluginTrustDecision {
  readonly kind: 'approved' | 'workspace-local';
  readonly prompted: boolean;
  readonly reason: 'first-install' | 'permissions-changed' | 'reinstall' | 'local-catalog';
  readonly approvedAt: string;
  readonly permissionFingerprint: string;
}

export interface PluginInstallRecord {
  readonly qualifiedId: string;
  readonly pluginId: string;
  readonly publisher?: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly sourceKind: 'local' | 'registry';
  readonly installedAt: string;
  readonly installedByExtensionVersion: string;
  readonly hostVersion: string;
  readonly installPath: string;
  readonly targetDirName: string;
  readonly artifactUrl?: string;
  readonly artifactChecksum?: string;
  readonly checksumVerified: boolean;
  readonly sourceRepository?: string;
  readonly license?: string;
  readonly capabilities?: readonly string[];
  readonly requires?: readonly string[];
  readonly permissions?: PluginPermissions;
  readonly trustDecision: PluginTrustDecision;
}

export interface PluginInstallAuditState {
  readonly version: 1;
  readonly installs: PluginInstallRecord[];
}

function getInstallStatePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, PLUGIN_INSTALL_STATE_REL);
}

function normalizeArray(values: readonly string[] | undefined): readonly string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizePermissions(
  permissions: PluginPermissions | undefined,
): PluginPermissions | undefined {
  if (!permissions) {
    return undefined;
  }

  const normalized: PluginPermissions = {
    filesystem: permissions.filesystem,
    network: permissions.network,
    process: permissions.process,
    secrets: permissions.secrets,
    remoteHosts: normalizeArray(permissions.remoteHosts),
  };

  return normalized;
}

export function buildPermissionFingerprint(manifest: PluginManifest): string {
  return JSON.stringify({
    capabilities: normalizeArray(manifest.capabilities),
    requires: normalizeArray(manifest.requires),
    permissions: normalizePermissions(manifest.permissions),
  });
}

export function readPluginInstallAuditState(workspaceRoot: string): PluginInstallAuditState {
  const filePath = getInstallStatePath(workspaceRoot);
  if (!fs.existsSync(filePath)) {
    return { version: 1, installs: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PluginInstallAuditState>;
    return {
      version: 1,
      installs: Array.isArray(parsed.installs)
        ? parsed.installs as PluginInstallRecord[]
        : [],
    };
  } catch {
    return { version: 1, installs: [] };
  }
}

export function getLatestPluginInstallRecord(
  state: PluginInstallAuditState,
  qualifiedId: string,
): PluginInstallRecord | undefined {
  return [...state.installs]
    .reverse()
    .find((record) => record.qualifiedId === qualifiedId);
}

export function appendPluginInstallRecord(
  workspaceRoot: string,
  record: PluginInstallRecord,
): PluginInstallAuditState {
  const current = readPluginInstallAuditState(workspaceRoot);
  const next: PluginInstallAuditState = {
    version: 1,
    installs: [...current.installs, record],
  };

  const filePath = getInstallStatePath(workspaceRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
