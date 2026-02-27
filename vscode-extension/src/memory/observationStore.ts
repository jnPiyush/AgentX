// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: JsonObservationStore
// ---------------------------------------------------------------------------
//
// Phase 1 implementation of IObservationStore backed by per-issue JSON files
// and a global manifest index. Uses FileLockManager for safe concurrent access
// from multiple VS Code windows and CLI sessions.
//
// Storage layout:
//   .agentx/memory/
//     manifest.json          -- compact index (ObservationIndex[])
//     issue-{n}.json         -- full observations for issue n (Observation[])
//
// See ADR-29.md for storage decision rationale.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import {
  FileLockManager,
  readJsonSafe,
  writeJsonLocked,
} from '../utils/fileLock';
import {
  IObservationStore,
  IssueObservationFile,
  MANIFEST_CACHE_TTL_MS,
  ManifestFile,
  Observation,
  ObservationCategory,
  ObservationIndex,
  StoreStats,
} from './types';

// ---------------------------------------------------------------------------
// JsonObservationStore
// ---------------------------------------------------------------------------

/**
 * Phase 1 IObservationStore implementation backed by per-issue JSON files.
 *
 * Manifest is cached in-memory for MANIFEST_CACHE_TTL_MS (30s) to avoid
 * redundant disk reads during burst searches. The cache is invalidated on
 * any write.
 */
export class JsonObservationStore implements IObservationStore {
  private readonly memoryDir: string;
  private readonly lockManager: FileLockManager;

  /** In-memory manifest cache. */
  private manifestCache: ObservationIndex[] | null = null;
  /** Timestamp of last manifest load. */
  private manifestLoadedAt = 0;

  /**
   * @param memoryDir - Absolute path to the memory directory (`.agentx/memory`)
   * @param lockManager - Shared FileLockManager instance (singleton in extension)
   */
  constructor(memoryDir: string, lockManager?: FileLockManager) {
    this.memoryDir = memoryDir;
    this.lockManager = lockManager ?? new FileLockManager();
  }

  // -------------------------------------------------------------------------
  // IObservationStore -- write operations
  // -------------------------------------------------------------------------

  /**
   * Persist observations to the per-issue file and update the manifest.
   *
   * Lock order (deterministic, prevents deadlock):
   *   1. manifest.json  -- always first
   *   2. issue-{n}.json -- always second
   *
   * Each unique issueNumber gets its own nested lock call so that observations
   * for different issues can be written in one store() call without conflict.
   */
  async store(observations: Observation[]): Promise<void> {
    if (observations.length === 0) { return; }
    this.ensureDir();

    // Group by issue number so we take the manifest lock once per store() call.
    const byIssue = groupByIssue(observations);

    for (const [issueNumber, issueObs] of byIssue) {
      const issueFile = this.issueFilePath(issueNumber);
      const manifestFile = this.manifestFilePath();

      // Lock manifest first, then issue file (consistent ordering).
      await this.lockManager.withSafeLock(manifestFile, 'memory-store', async () => {
        // Write observations to issue file.
        await this.lockManager.withSafeLock(issueFile, 'memory-store', async () => {
          const existing = this.readIssueFileSync(issueNumber);
          existing.observations.push(...issueObs);
          existing.updatedAt = new Date().toISOString();
          writeJsonLocked(issueFile, existing);
        });

        // Update manifest with new index entries.
        const manifest = this.readManifestSync();
        const newEntries: ObservationIndex[] = issueObs.map(toIndexEntry);
        manifest.entries.push(...newEntries);
        manifest.updatedAt = new Date().toISOString();
        writeJsonLocked(manifestFile, manifest);
      });
    }

    // Invalidate cache after write.
    this.invalidateCache();
  }

  /**
   * Remove a single observation by ID.
   * Removes from both the issue file and the manifest.
   * Returns true if the observation was found and removed.
   */
  async remove(id: string): Promise<boolean> {
    // Find which issue owns this observation via manifest.
    const manifest = await this.loadManifest();
    const entry = manifest.find((e) => e.id === id);
    if (!entry) { return false; }

    const issueNumber = entry.issueNumber;
    const issueFile = this.issueFilePath(issueNumber);
    const manifestFile = this.manifestFilePath();

    let removed = false;

    await this.lockManager.withSafeLock(manifestFile, 'memory-store', async () => {
      // Remove from issue file.
      await this.lockManager.withSafeLock(issueFile, 'memory-store', async () => {
        const issueData = this.readIssueFileSync(issueNumber);
        const before = issueData.observations.length;
        issueData.observations = issueData.observations.filter((o) => o.id !== id);
        removed = issueData.observations.length < before;
        if (removed) {
          issueData.updatedAt = new Date().toISOString();
          writeJsonLocked(issueFile, issueData);
        }
      });

      if (removed) {
        // Remove from manifest.
        const currentManifest = this.readManifestSync();
        currentManifest.entries = currentManifest.entries.filter((e) => e.id !== id);
        currentManifest.updatedAt = new Date().toISOString();
        writeJsonLocked(manifestFile, currentManifest);
      }
    });

    if (removed) {
      this.invalidateCache();
    }

    return removed;
  }

  // -------------------------------------------------------------------------
  // IObservationStore -- read operations
  // -------------------------------------------------------------------------

  /**
   * Load all observations for a specific issue number.
   */
  async getByIssue(issueNumber: number): Promise<Observation[]> {
    this.ensureDir();
    return this.readIssueFileSync(issueNumber).observations;
  }

  /**
   * Load a single observation by its ID.
   * Scans the issue file identified via manifest. Returns null if not found.
   */
  async getById(id: string): Promise<Observation | null> {
    const manifest = await this.loadManifest();
    const entry = manifest.find((e) => e.id === id);
    if (!entry) { return null; }

    const obsInFile = await this.getByIssue(entry.issueNumber);
    return obsInFile.find((o) => o.id === id) ?? null;
  }

  /**
   * Full-text search across manifest index summaries.
   * All whitespace-separated query terms must match (AND logic), case-insensitive.
   *
   * @param query - Search string.
   * @param limit - Max results (default 20).
   */
  async search(query: string, limit = 20): Promise<ObservationIndex[]> {
    const manifest = await this.loadManifest();
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (terms.length === 0) {
      return manifest.slice(-limit).reverse();
    }

    const results = manifest.filter((entry) => {
      const haystack = [
        entry.summary,
        entry.agent,
        entry.category,
        String(entry.issueNumber),
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    // Return newest-first, up to limit.
    return results
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  /**
   * List all manifest entries for a specific agent, newest-first.
   */
  async listByAgent(agent: string): Promise<ObservationIndex[]> {
    const manifest = await this.loadManifest();
    return manifest
      .filter((e) => e.agent === agent)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * List all manifest entries for a specific category, newest-first.
   */
  async listByCategory(category: ObservationCategory): Promise<ObservationIndex[]> {
    const manifest = await this.loadManifest();
    return manifest
      .filter((e) => e.category === category)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Return aggregate statistics about the observation store.
   */
  async getStats(): Promise<StoreStats> {
    const manifest = await this.loadManifest();

    if (manifest.length === 0) {
      const empty: Record<ObservationCategory, number> = {
        decision: 0,
        'code-change': 0,
        error: 0,
        'key-fact': 0,
        'compaction-summary': 0,
      };
      return {
        totalObservations: 0,
        totalTokens: 0,
        issueCount: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        byCategory: empty,
        byAgent: {},
      };
    }

    const byCategory: Record<string, number> = {
      decision: 0,
      'code-change': 0,
      error: 0,
      'key-fact': 0,
      'compaction-summary': 0,
    };
    const byAgent: Record<string, number> = {};
    const issueNumbers = new Set<number>();
    let totalTokens = 0;

    const sorted = manifest.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const entry of manifest) {
      totalTokens += entry.tokens;
      issueNumbers.add(entry.issueNumber);
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      byAgent[entry.agent] = (byAgent[entry.agent] ?? 0) + 1;
    }

    return {
      totalObservations: manifest.length,
      totalTokens,
      issueCount: issueNumbers.size,
      oldestTimestamp: sorted[0]?.timestamp ?? null,
      newestTimestamp: sorted[sorted.length - 1]?.timestamp ?? null,
      byCategory: byCategory as Record<ObservationCategory, number>,
      byAgent,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private ensureDir(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  private manifestFilePath(): string {
    return path.join(this.memoryDir, 'manifest.json');
  }

  private issueFilePath(issueNumber: number): string {
    return path.join(this.memoryDir, `issue-${issueNumber}.json`);
  }

  /**
   * Load the manifest from cache or disk.
   */
  private async loadManifest(): Promise<ObservationIndex[]> {
    const now = Date.now();
    if (this.manifestCache !== null && (now - this.manifestLoadedAt) < MANIFEST_CACHE_TTL_MS) {
      return this.manifestCache;
    }

    this.ensureDir();
    const raw = readJsonSafe<ManifestFile>(this.manifestFilePath());
    const entries = raw?.entries ?? [];
    this.manifestCache = entries;
    this.manifestLoadedAt = now;
    return entries;
  }

  private invalidateCache(): void {
    this.manifestCache = null;
    this.manifestLoadedAt = 0;
  }

  /**
   * Read manifest synchronously (used inside lock callbacks -- must not await).
   * Returns the current file content or an empty manifest structure.
   */
  private readManifestSync(): ManifestFile {
    const raw = readJsonSafe<ManifestFile>(this.manifestFilePath());
    if (raw) { return raw; }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
  }

  /**
   * Read issue file synchronously (used inside lock callbacks).
   * Returns an empty structure if the file does not exist.
   */
  private readIssueFileSync(issueNumber: number): IssueObservationFile {
    const filePath = this.issueFilePath(issueNumber);
    const raw = readJsonSafe<IssueObservationFile>(filePath);
    if (raw) { return raw; }
    return {
      version: 1,
      issueNumber,
      updatedAt: new Date().toISOString(),
      observations: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Private module helpers
// ---------------------------------------------------------------------------

/** Convert a full Observation to its lightweight index entry. */
function toIndexEntry(obs: Observation): ObservationIndex {
  return {
    id: obs.id,
    agent: obs.agent,
    issueNumber: obs.issueNumber,
    category: obs.category,
    summary: obs.summary,
    tokens: obs.tokens,
    timestamp: obs.timestamp,
  };
}

/** Group observations by issueNumber for batch writes. */
function groupByIssue(observations: Observation[]): Map<number, Observation[]> {
  const map = new Map<number, Observation[]>();
  for (const obs of observations) {
    const existing = map.get(obs.issueNumber) ?? [];
    existing.push(obs);
    map.set(obs.issueNumber, existing);
  }
  return map;
}
