import * as fs from 'fs';
import * as path from 'path';

/**
 * Loader for JSON sidecar registries under `.github/registries/`.
 *
 * The registries (`skills.json`, `templates.json`, `routing.json`,
 * `pipelines.json`) are additive: Markdown files under `.github/skills`,
 * `.github/templates`, etc. remain the source of truth. The JSON sidecars
 * are a faster lookup for the VS Code extension and other tools.
 *
 * Resolution order:
 *   1. Workspace: `<workspaceRoot>/.github/registries/<name>.json`
 *   2. Extension bundle: `<extensionPath>/.github/agentx/registries/<name>.json`
 *
 * The loader returns `null` on any miss or parse error so callers can fall
 * back to the existing filesystem scan paths without breaking.
 */

export interface SkillRegistryEntry {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly path: string;
  readonly description: string;
}

export interface SkillsRegistry {
  readonly $schemaVersion: number;
  readonly generated?: string;
  readonly source?: string;
  readonly totalCount: number;
  readonly skills: ReadonlyArray<SkillRegistryEntry>;
}

export interface TemplateRegistryEntry {
  readonly name: string;
  readonly path: string;
  readonly declaredInputs?: ReadonlyArray<string>;
}

export interface TemplatesRegistry {
  readonly $schemaVersion: number;
  readonly generated?: string;
  readonly source?: string;
  readonly totalCount: number;
  readonly templates: ReadonlyArray<TemplateRegistryEntry>;
}

interface CacheEntry<T> {
  readonly mtimeMs: number;
  readonly absolutePath: string;
  readonly value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();

function candidatePaths(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
  fileName: string,
): string[] {
  const paths: string[] = [];
  if (workspaceRoot) {
    paths.push(path.join(workspaceRoot, '.github', 'registries', fileName));
  }
  if (extensionPath) {
    paths.push(path.join(extensionPath, '.github', 'agentx', 'registries', fileName));
  }
  return paths;
}

function readRegistry<T>(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
  fileName: string,
): T | null {
  for (const candidate of candidatePaths(workspaceRoot, extensionPath, fileName)) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(candidate);
    } catch {
      continue;
    }
    if (!stat.isFile()) {
      continue;
    }

    const cached = cache.get(candidate) as CacheEntry<T> | undefined;
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.value;
    }

    try {
      const raw = fs.readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw) as T;
      cache.set(candidate, { mtimeMs: stat.mtimeMs, absolutePath: candidate, value: parsed });
      return parsed;
    } catch {
      // Defensive: never break callers on a malformed registry.
      continue;
    }
  }
  return null;
}

/**
 * Load `.github/registries/skills.json`. Returns `null` if the registry is
 * missing or malformed -- callers should fall back to a filesystem scan.
 */
export function loadSkillsRegistry(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
): SkillsRegistry | null {
  const registry = readRegistry<SkillsRegistry>(workspaceRoot, extensionPath, 'skills.json');
  if (!registry || !Array.isArray(registry.skills)) {
    return null;
  }
  return registry;
}

/**
 * Load `.github/registries/templates.json`. Returns `null` if the registry
 * is missing or malformed.
 */
export function loadTemplatesRegistry(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
): TemplatesRegistry | null {
  const registry = readRegistry<TemplatesRegistry>(workspaceRoot, extensionPath, 'templates.json');
  if (!registry || !Array.isArray(registry.templates)) {
    return null;
  }
  return registry;
}

/**
 * Resolve a workspace-relative registry path (e.g.
 * `.github/skills/development/testing/SKILL.md`) to an absolute path that
 * exists on disk. Checks the workspace root first, then the bundled
 * extension copy under `.github/agentx/`. Returns `null` when neither
 * exists.
 */
export function resolveRegistryAssetPath(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
  relativePath: string,
): string | null {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

  if (workspaceRoot) {
    const workspaceCandidate = path.join(workspaceRoot, ...normalized.split('/'));
    if (fs.existsSync(workspaceCandidate)) {
      return workspaceCandidate;
    }
  }

  if (extensionPath && normalized.startsWith('.github/')) {
    const bundled = `.github/agentx/${normalized.substring('.github/'.length)}`;
    const bundledCandidate = path.join(extensionPath, ...bundled.split('/'));
    if (fs.existsSync(bundledCandidate)) {
      return bundledCandidate;
    }
  }

  return null;
}

/** Clear the in-process cache. Intended for tests. */
export function clearRegistryCache(): void {
  cache.clear();
}
