import * as fs from 'fs';
import * as path from 'path';
import { compareSemver } from './versionChecker';

export type PluginRuntime = 'pwsh' | 'bash' | 'node';
export type PluginType =
  | 'tool'
  | 'skill'
  | 'agent'
  | 'channel'
  | 'workflow'
  | 'pack-extension'
  | 'mcp-server'
  | 'mcp-app';
export type PluginMaturity = 'experimental' | 'preview' | 'stable' | 'deprecated';
export type PluginPermissionLevel =
  | 'none'
  | 'read'
  | 'write'
  | 'read-write'
  | 'allowlist'
  | 'full';

type JsonRecord = Record<string, unknown>;

export interface PluginArgument {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
  readonly default?: string;
}

export interface PluginPermissions {
  readonly filesystem?: PluginPermissionLevel;
  readonly network?: PluginPermissionLevel;
  readonly process?: PluginPermissionLevel;
  readonly secrets?: PluginPermissionLevel;
  readonly remoteHosts?: readonly string[];
}

export interface PluginDistribution {
  readonly artifactUrl?: string;
  readonly checksum?: string;
  readonly signatureMode?: 'none' | 'optional' | 'required';
  readonly packageSize?: number;
}

export interface PluginManifest {
  readonly schemaVersion?: number;
  readonly name?: string;
  readonly id?: string;
  readonly publisher?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly version?: string;
  readonly author?: string;
  readonly license?: string;
  readonly homepage?: string;
  readonly source?: string;
  readonly bugs?: string;
  readonly type?: PluginType;
  readonly capabilities?: readonly PluginType[];
  readonly entry?: Partial<Record<PluginRuntime, string>>;
  readonly args?: readonly PluginArgument[];
  readonly requires?: readonly string[];
  readonly tags?: readonly string[];
  readonly maturity?: PluginMaturity;
  readonly engines?: {
    readonly agentx?: string;
  };
  readonly permissions?: PluginPermissions;
  readonly distribution?: PluginDistribution;
}

export interface PluginCatalogSummary {
  readonly pluginId: string;
  readonly publisher?: string;
  readonly qualifiedId: string;
  readonly label: string;
  readonly description: string;
  readonly version?: string;
  readonly agentxRange?: string;
}

export interface PluginRegistryRelease {
  readonly version: string;
  readonly artifactUrl: string;
  readonly pluginPath?: string;
  readonly checksum?: string;
  readonly publishedAt?: string;
  readonly engines?: {
    readonly agentx?: string;
  };
}

export interface PluginRegistryEntry {
  readonly publisher: string;
  readonly pluginId: string;
  readonly qualifiedId: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly latestVersion?: string;
  readonly releases: readonly PluginRegistryRelease[];
  readonly tags?: readonly string[];
  readonly maturity?: PluginMaturity;
  readonly capabilities?: readonly PluginType[];
}

export interface PluginRegistryIndex {
  readonly schemaVersion: number;
  readonly generatedAt?: string;
  readonly plugins: readonly PluginRegistryEntry[];
}

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonRecord;
}

function readNonEmptyString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(record: JsonRecord, key: string): readonly string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

function readPluginTypeArray(record: JsonRecord, key: string): readonly PluginType[] | undefined {
  const values = readStringArray(record, key);
  if (!values) {
    return undefined;
  }

  return values as PluginType[];
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function exactVersion(version: string): string | undefined {
  const normalized = normalizeVersion(version);
  return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : undefined;
}

function parseVersionTriple(version: string): [number, number, number] | undefined {
  const normalized = exactVersion(version);
  if (!normalized) {
    return undefined;
  }

  const parts = normalized.split('.').map(Number);
  return [parts[0], parts[1], parts[2]];
}

function compareNormalizedSemver(left: string, right: string): -1 | 0 | 1 {
  return compareSemver(normalizeVersion(left), normalizeVersion(right));
}

function matchesWildcardRange(range: string, hostVersion: string): boolean {
  const match = range.trim().match(/^(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i);
  if (!match) {
    return false;
  }

  const hostParts = parseVersionTriple(hostVersion);
  if (!hostParts) {
    return false;
  }

  const rangeParts = [match[1], match[2], match[3]];
  return rangeParts.every((part, index) => {
    if (!part || part === 'x' || part === '*') {
      return true;
    }

    return Number(part) === hostParts[index];
  });
}

function expandCaretRange(range: string): readonly string[] | undefined {
  const version = parseVersionTriple(range.slice(1));
  if (!version) {
    return undefined;
  }

  const [major, minor, patch] = version;
  if (major > 0) {
    return [`>=${major}.${minor}.${patch}`, `<${major + 1}.0.0`];
  }
  if (minor > 0) {
    return [`>=${major}.${minor}.${patch}`, `<${major}.${minor + 1}.0`];
  }

  return [`>=${major}.${minor}.${patch}`, `<${major}.${minor}.${patch + 1}`];
}

function expandTildeRange(range: string): readonly string[] | undefined {
  const version = parseVersionTriple(range.slice(1));
  if (!version) {
    return undefined;
  }

  const [major, minor, patch] = version;
  return [`>=${major}.${minor}.${patch}`, `<${major}.${minor + 1}.0`];
}

function evaluateComparator(token: string, hostVersion: string): boolean {
  const normalizedToken = token.trim();
  if (!normalizedToken || normalizedToken === '*') {
    return true;
  }

  if (normalizedToken.startsWith('^')) {
    const expanded = expandCaretRange(normalizedToken);
    return expanded ? expanded.every((part) => evaluateComparator(part, hostVersion)) : false;
  }

  if (normalizedToken.startsWith('~')) {
    const expanded = expandTildeRange(normalizedToken);
    return expanded ? expanded.every((part) => evaluateComparator(part, hostVersion)) : false;
  }

  if (/[x\*]/i.test(normalizedToken)) {
    return matchesWildcardRange(normalizedToken, hostVersion);
  }

  const comparator = normalizedToken.match(/^(>=|<=|>|<|=)?(.+)$/);
  if (!comparator) {
    return false;
  }

  const operator = comparator[1] ?? '=';
  const version = exactVersion(comparator[2]);
  if (!version) {
    return false;
  }

  const comparison = compareNormalizedSemver(hostVersion, version);
  switch (operator) {
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    case '=':
      return comparison === 0;
    default:
      return false;
  }
}

function parseEntry(record: JsonRecord): Partial<Record<PluginRuntime, string>> | undefined {
  const entryRecord = asRecord(record.entry);
  if (!entryRecord) {
    return undefined;
  }

  const entry: Partial<Record<PluginRuntime, string>> = {};
  for (const runtime of ['pwsh', 'bash', 'node'] as const) {
    const value = readNonEmptyString(entryRecord, runtime);
    if (value) {
      entry[runtime] = value;
    }
  }

  return Object.keys(entry).length > 0 ? entry : undefined;
}

function parseArgs(record: JsonRecord): readonly PluginArgument[] | undefined {
  const rawArgs = record.args;
  if (!Array.isArray(rawArgs)) {
    return undefined;
  }

  const args: PluginArgument[] = [];
  for (const item of rawArgs) {
    const argRecord = asRecord(item);
    if (!argRecord) {
      continue;
    }

    const name = readNonEmptyString(argRecord, 'name');
    const description = readNonEmptyString(argRecord, 'description');
    if (!name || !description) {
      continue;
    }

    const required = typeof argRecord.required === 'boolean' ? argRecord.required : undefined;
    const defaultValue = readNonEmptyString(argRecord, 'default');

    args.push({
      name,
      description,
      required,
      default: defaultValue,
    });
  }

  return args.length > 0 ? args : undefined;
}

function parsePermissions(record: JsonRecord): PluginPermissions | undefined {
  const permissionsRecord = asRecord(record.permissions);
  if (!permissionsRecord) {
    return undefined;
  }

  const filesystem = readNonEmptyString(permissionsRecord, 'filesystem') as
    | PluginPermissionLevel
    | undefined;
  const network = readNonEmptyString(permissionsRecord, 'network') as
    | PluginPermissionLevel
    | undefined;
  const process = readNonEmptyString(permissionsRecord, 'process') as
    | PluginPermissionLevel
    | undefined;
  const secrets = readNonEmptyString(permissionsRecord, 'secrets') as
    | PluginPermissionLevel
    | undefined;
  const remoteHosts = readStringArray(permissionsRecord, 'remoteHosts');

  if (!filesystem && !network && !process && !secrets && !remoteHosts) {
    return undefined;
  }

  return {
    filesystem,
    network,
    process,
    secrets,
    remoteHosts,
  };
}

function parseDistribution(record: JsonRecord): PluginDistribution | undefined {
  const distributionRecord = asRecord(record.distribution);
  if (!distributionRecord) {
    return undefined;
  }

  const artifactUrl = readNonEmptyString(distributionRecord, 'artifactUrl');
  const checksum = readNonEmptyString(distributionRecord, 'checksum');
  const signatureMode = readNonEmptyString(distributionRecord, 'signatureMode') as
    | 'none'
    | 'optional'
    | 'required'
    | undefined;
  const packageSize = typeof distributionRecord.packageSize === 'number'
    ? distributionRecord.packageSize
    : undefined;

  if (!artifactUrl && !checksum && !signatureMode && packageSize === undefined) {
    return undefined;
  }

  return {
    artifactUrl,
    checksum,
    signatureMode,
    packageSize,
  };
}

function parseEngines(record: JsonRecord): { readonly agentx?: string } | undefined {
  const enginesRecord = asRecord(record.engines);
  if (!enginesRecord) {
    return undefined;
  }

  const agentx = readNonEmptyString(enginesRecord, 'agentx');
  return agentx ? { agentx } : undefined;
}

function parseRegistryRelease(value: unknown): PluginRegistryRelease | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const version = readNonEmptyString(record, 'version');
  const artifactUrl = readNonEmptyString(record, 'artifactUrl');
  if (!version || !artifactUrl) {
    return undefined;
  }

  return {
    version,
    artifactUrl,
    pluginPath: readNonEmptyString(record, 'pluginPath'),
    checksum: readNonEmptyString(record, 'checksum'),
    publishedAt: readNonEmptyString(record, 'publishedAt'),
    engines: parseEngines(record),
  };
}

export function parsePluginManifest(raw: unknown): PluginManifest | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }

  const name = readNonEmptyString(record, 'name');
  const id = readNonEmptyString(record, 'id');
  const description = readNonEmptyString(record, 'description');
  const version = readNonEmptyString(record, 'version');
  const type = readNonEmptyString(record, 'type') as PluginType | undefined;
  const entry = parseEntry(record);

  if (!name && !id) {
    return undefined;
  }
  if (!description || !version) {
    return undefined;
  }
  if (!type && !readPluginTypeArray(record, 'capabilities')) {
    return undefined;
  }
  if (!entry) {
    return undefined;
  }

  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : undefined,
    name,
    id,
    publisher: readNonEmptyString(record, 'publisher'),
    displayName: readNonEmptyString(record, 'displayName'),
    description,
    version,
    author: readNonEmptyString(record, 'author'),
    license: readNonEmptyString(record, 'license'),
    homepage: readNonEmptyString(record, 'homepage'),
    source: readNonEmptyString(record, 'source'),
    bugs: readNonEmptyString(record, 'bugs'),
    type,
    capabilities: readPluginTypeArray(record, 'capabilities') ?? (type ? [type] : undefined),
    entry,
    args: parseArgs(record),
    requires: readStringArray(record, 'requires'),
    tags: readStringArray(record, 'tags'),
    maturity: readNonEmptyString(record, 'maturity') as PluginMaturity | undefined,
    engines: parseEngines(record),
    permissions: parsePermissions(record),
    distribution: parseDistribution(record),
  };
}

export function readPluginManifestFromDir(pluginDir: string): PluginManifest | undefined {
  const manifestPath = path.join(pluginDir, 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
    return parsePluginManifest(raw);
  } catch {
    return undefined;
  }
}

export function summarizePluginManifest(
  manifest: PluginManifest | undefined,
  fallbackName: string,
): PluginCatalogSummary {
  const pluginId = manifest?.id ?? manifest?.name ?? fallbackName;
  const publisher = manifest?.publisher;
  const qualifiedId = publisher ? `${publisher}.${pluginId}` : pluginId;
  const label = manifest?.displayName ?? qualifiedId;
  const description = manifest?.description ?? 'AgentX plugin';

  return {
    pluginId,
    publisher,
    qualifiedId,
    label,
    description,
    version: manifest?.version,
    agentxRange: manifest?.engines?.agentx,
  };
}

export function isAgentXVersionSupported(range: string | undefined, hostVersion: string): boolean {
  if (!range || range.trim().length === 0) {
    return true;
  }

  const normalizedHost = normalizeVersion(hostVersion);
  if (!exactVersion(normalizedHost)) {
    return false;
  }

  return range
    .split('||')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .some((part) => {
      const tokens = part.split(/\s+/).filter((token) => token.length > 0);
      return tokens.every((token) => evaluateComparator(token, normalizedHost));
    });
}

export function parsePluginRegistryIndex(raw: unknown): PluginRegistryIndex | undefined {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.plugins)) {
    return undefined;
  }

  const plugins: PluginRegistryEntry[] = [];
  for (const entry of record.plugins) {
    const entryRecord = asRecord(entry);
    if (!entryRecord) {
      continue;
    }

    const publisher = readNonEmptyString(entryRecord, 'publisher');
    const pluginId = readNonEmptyString(entryRecord, 'pluginId')
      ?? readNonEmptyString(entryRecord, 'id');
    if (!publisher || !pluginId) {
      continue;
    }

    const releases: PluginRegistryRelease[] = [];
    if (Array.isArray(entryRecord.releases)) {
      for (const release of entryRecord.releases) {
        const parsedRelease = parseRegistryRelease(release);
        if (parsedRelease) {
          releases.push(parsedRelease);
        }
      }
    }

    if (releases.length === 0) {
      continue;
    }

    plugins.push({
      publisher,
      pluginId,
      qualifiedId: `${publisher}.${pluginId}`,
      displayName: readNonEmptyString(entryRecord, 'displayName'),
      description: readNonEmptyString(entryRecord, 'description'),
      latestVersion: readNonEmptyString(entryRecord, 'latestVersion'),
      releases,
      tags: readStringArray(entryRecord, 'tags'),
      maturity: readNonEmptyString(entryRecord, 'maturity') as PluginMaturity | undefined,
      capabilities: readPluginTypeArray(entryRecord, 'capabilities'),
    });
  }

  if (plugins.length === 0) {
    return undefined;
  }

  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : 1,
    generatedAt: readNonEmptyString(record, 'generatedAt'),
    plugins,
  };
}

export function getLatestCompatibleRelease(
  entry: PluginRegistryEntry,
  hostVersion: string,
): PluginRegistryRelease | undefined {
  return [...entry.releases]
    .sort((left, right) => compareNormalizedSemver(right.version, left.version))
    .find((release) => isAgentXVersionSupported(release.engines?.agentx, hostVersion));
}
