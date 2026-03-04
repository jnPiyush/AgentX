// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: GitObservationStore
// ---------------------------------------------------------------------------
//
// Git-backed implementation of IObservationStore. Uses GitStorageProvider to
// persist observations on an orphan branch. All writes create Git commits,
// giving full version history and sync capability.
//
// Storage layout on the data branch:
//   memory/manifest.json       -- compact index (ObservationIndex[])
//   memory/issue-{n}.json      -- full observations for issue n
//
// This replaces JsonObservationStore when persistence mode is 'git'.
// The API is identical -- callers do not need to change.
// ---------------------------------------------------------------------------

import {
  GitStorageProvider,
} from '../utils/gitStorageProvider';
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
// Constants
// ---------------------------------------------------------------------------

const MEMORY_DIR = 'memory';
const MANIFEST_PATH = `${MEMORY_DIR}/manifest.json`;

/** All known categories with zero counts (for StoreStats). */
const ALL_CATEGORIES: readonly ObservationCategory[] = [
  'decision', 'code-change', 'error', 'key-fact', 'compaction-summary',
];

// ---------------------------------------------------------------------------
// GitObservationStore
// ---------------------------------------------------------------------------

/**
 * IObservationStore implementation backed by Git orphan branch.
 *
 * Manifest is cached in-memory for MANIFEST_CACHE_TTL_MS (30s).
 * Every write creates a Git commit on the data branch for full history.
 */
export class GitObservationStore implements IObservationStore {
  private readonly git: GitStorageProvider;

  /** In-memory manifest cache. */
  private manifestCache: ObservationIndex[] | null = null;
  /** Timestamp of last manifest load. */
  private manifestLoadedAt = 0;

  constructor(gitProvider: GitStorageProvider) {
    this.git = gitProvider;
  }

  // -------------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------------

  /**
   * Persist observations to Git. Groups by issue, updates per-issue files
   * and manifest in a single atomic commit.
   */
  async store(observations: Observation[]): Promise<void> {
    if (observations.length === 0) { return; }

    const byIssue = this.groupByIssue(observations);
    const filesToWrite: Array<{ filePath: string; content: string }> = [];

    // Read current manifest.
    const manifest = await this.readManifest();

    for (const [issueNumber, issueObs] of byIssue) {
      // Read existing issue file.
      const issueFile = this.issueFilePath(issueNumber);
      const existing = await this.readIssueFile(issueNumber);
      existing.observations.push(...issueObs);
      existing.updatedAt = new Date().toISOString();

      filesToWrite.push({
        filePath: issueFile,
        content: JSON.stringify(existing, null, 2) + '\n',
      });

      // Update manifest with new index entries.
      for (const obs of issueObs) {
        manifest.push({
          id: obs.id,
          agent: obs.agent,
          issueNumber: obs.issueNumber,
          category: obs.category,
          summary: obs.summary,
          tokens: obs.tokens,
          timestamp: obs.timestamp,
        });
      }
    }

    // Write updated manifest.
    const manifestData: ManifestFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: manifest,
    };
    filesToWrite.push({
      filePath: MANIFEST_PATH,
      content: JSON.stringify(manifestData, null, 2) + '\n',
    });

    // Atomic commit of all changes.
    const issueNums = Array.from(byIssue.keys()).join(', ');
    await this.git.writeFiles(
      filesToWrite,
      `memory: store ${observations.length} observations for issues ${issueNums}`,
    );

    // Invalidate cache.
    this.manifestCache = null;
  }

  // -------------------------------------------------------------------------
  // Read operations (IObservationStore interface)
  // -------------------------------------------------------------------------

  /** Load all observations for a specific issue. */
  async getByIssue(issueNumber: number): Promise<Observation[]> {
    const file = await this.readIssueFile(issueNumber);
    return file.observations;
  }

  /** Load a single observation by ID. */
  async getById(id: string): Promise<Observation | null> {
    const manifest = await this.readManifest();
    const entry = manifest.find(e => e.id === id);
    if (!entry) { return null; }

    const file = await this.readIssueFile(entry.issueNumber);
    return file.observations.find(o => o.id === id) ?? null;
  }

  /**
   * Full-text search across manifest summaries.
   * Whitespace-separated terms, all must match (case-insensitive).
   */
  async search(query: string, limit = 20): Promise<ObservationIndex[]> {
    const manifest = await this.readManifest();
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) {
      return manifest.slice(0, limit);
    }

    const filtered = manifest.filter(entry => {
      const text = `${entry.summary} ${entry.agent} ${entry.category} ${entry.id}`.toLowerCase();
      return terms.every(term => text.includes(term));
    });

    // Sort newest first.
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return filtered.slice(0, limit);
  }

  /** List manifest entries for a specific agent, newest first. */
  async listByAgent(agent: string): Promise<ObservationIndex[]> {
    const manifest = await this.readManifest();
    return manifest
      .filter(e => e.agent === agent)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /** List manifest entries for a specific category, newest first. */
  async listByCategory(category: ObservationCategory): Promise<ObservationIndex[]> {
    const manifest = await this.readManifest();
    return manifest
      .filter(e => e.category === category)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Remove a single observation by ID.
   * Updates both the per-issue file and the manifest atomically.
   */
  async remove(id: string): Promise<boolean> {
    const manifest = await this.readManifest();
    const idx = manifest.findIndex(e => e.id === id);
    if (idx === -1) { return false; }

    const entry = manifest[idx];
    const issueFile = await this.readIssueFile(entry.issueNumber);
    const obsIdx = issueFile.observations.findIndex(o => o.id === id);
    if (obsIdx === -1) { return false; }

    // Remove from both.
    manifest.splice(idx, 1);
    issueFile.observations.splice(obsIdx, 1);
    issueFile.updatedAt = new Date().toISOString();

    const filesToWrite: Array<{ filePath: string; content: string }> = [
      {
        filePath: this.issueFilePath(entry.issueNumber),
        content: JSON.stringify(issueFile, null, 2) + '\n',
      },
      {
        filePath: MANIFEST_PATH,
        content: JSON.stringify(
          { version: 1, updatedAt: new Date().toISOString(), entries: manifest } as ManifestFile,
          null, 2,
        ) + '\n',
      },
    ];

    await this.git.writeFiles(filesToWrite, `memory: remove observation ${id}`);
    this.manifestCache = null;
    return true;
  }

  /** Return aggregate statistics about the store. */
  async getStats(): Promise<StoreStats> {
    const manifest = await this.readManifest();
    const byAgent = new Map<string, number>();
    const byCategory: Record<ObservationCategory, number> = {
      'decision': 0,
      'code-change': 0,
      'error': 0,
      'key-fact': 0,
      'compaction-summary': 0,
    };
    const issueNumbers = new Set<number>();
    let totalTokens = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    for (const entry of manifest) {
      byAgent.set(entry.agent, (byAgent.get(entry.agent) ?? 0) + 1);
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      issueNumbers.add(entry.issueNumber);
      totalTokens += entry.tokens;

      if (oldest === null || entry.timestamp < oldest) { oldest = entry.timestamp; }
      if (newest === null || entry.timestamp > newest) { newest = entry.timestamp; }
    }

    return {
      totalObservations: manifest.length,
      totalTokens,
      issueCount: issueNumbers.size,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      byAgent: Object.fromEntries(byAgent),
      byCategory,
    };
  }

  // -------------------------------------------------------------------------
  // Extended operations (not in IObservationStore)
  // -------------------------------------------------------------------------

  /**
   * Get the full history of changes for a specific issue's observations.
   * Returns Git commit metadata.
   */
  async getIssueHistory(
    issueNumber: number,
    limit = 10,
  ): Promise<Array<{ hash: string; date: string; message: string }>> {
    return this.git.getHistory(this.issueFilePath(issueNumber), limit);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private issueFilePath(issueNumber: number): string {
    return `${MEMORY_DIR}/issue-${issueNumber}.json`;
  }

  private async readManifest(): Promise<ObservationIndex[]> {
    // Check cache.
    if (
      this.manifestCache !== null &&
      Date.now() - this.manifestLoadedAt < MANIFEST_CACHE_TTL_MS
    ) {
      return [...this.manifestCache];
    }

    const data = await this.git.readJson<ManifestFile>(MANIFEST_PATH);
    const entries = data?.entries ?? [];
    this.manifestCache = entries;
    this.manifestLoadedAt = Date.now();
    return [...entries];
  }

  private async readIssueFile(issueNumber: number): Promise<IssueObservationFile> {
    const filePath = this.issueFilePath(issueNumber);
    const data = await this.git.readJson<IssueObservationFile>(filePath);
    return data ?? {
      version: 1 as const,
      issueNumber,
      observations: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private groupByIssue(
    observations: Observation[],
  ): Map<number, Observation[]> {
    const map = new Map<number, Observation[]>();
    for (const obs of observations) {
      const list = map.get(obs.issueNumber) ?? [];
      list.push(obs);
      map.set(obs.issueNumber, list);
    }
    return map;
  }
}
