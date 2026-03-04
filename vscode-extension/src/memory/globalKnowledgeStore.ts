// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Global Knowledge Store
// ---------------------------------------------------------------------------
//
// User-level global knowledge base at ~/.agentx/knowledge/. Promotes
// high-value observations and outcomes from workspace-scoped memory
// for cross-project learning.
//
// Deduplication uses Jaccard similarity on title/content tokens.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.5 and 4.3.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  type IGlobalKnowledgeStore,
  type KnowledgeEntry,
  type KnowledgeIndex,
  type KnowledgeCategory,
  type KnowledgeStats,
  type GlobalKnowledgeManifest,
  GLOBAL_KNOWLEDGE_DIR_NAME,
  GLOBAL_MANIFEST_FILE,
  DEDUP_SIMILARITY_THRESHOLD,
  PRUNE_UNUSED_AFTER_DAYS,
  MAX_GLOBAL_STORE_BYTES,
  MAX_KNOWLEDGE_TITLE_CHARS,
  MAX_KNOWLEDGE_CONTENT_CHARS,
} from './globalKnowledgeTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `GK-${crypto.randomBytes(4).toString('hex')}`;
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) { return null; }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonSync(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// GlobalKnowledgeStore
// ---------------------------------------------------------------------------

/**
 * Persists knowledge entries to `~/.agentx/knowledge/` for cross-project
 * pattern reuse. Each entry is stored as `GK-{hash}.json` alongside
 * a manifest `global-manifest.json`.
 */
export class GlobalKnowledgeStore implements IGlobalKnowledgeStore {
  private readonly knowledgeDir: string;
  private manifestCache: GlobalKnowledgeManifest | undefined;
  private manifestCacheTime = 0;
  private static readonly MANIFEST_CACHE_TTL_MS = 60_000;

  constructor(knowledgeDirOverride?: string) {
    this.knowledgeDir = knowledgeDirOverride
      ?? path.join(os.homedir(), GLOBAL_KNOWLEDGE_DIR_NAME);
  }

  // -----------------------------------------------------------------------
  // IGlobalKnowledgeStore
  // -----------------------------------------------------------------------

  async promote(
    input: Omit<KnowledgeEntry, 'id' | 'promotedAt' | 'usageCount' | 'lastUsedAt'>,
  ): Promise<KnowledgeEntry | null> {
    // Validate size constraints
    const title = input.title.slice(0, MAX_KNOWLEDGE_TITLE_CHARS);
    const content = input.content.slice(0, MAX_KNOWLEDGE_CONTENT_CHARS);

    // Check deduplication
    const manifest = await this.loadManifest();
    const isDuplicate = await this.checkDuplicate(title, content, manifest);
    if (isDuplicate) {
      return null;
    }

    // Check global store size cap
    const stats = await this.getStats();
    if (stats.sizeBytes >= MAX_GLOBAL_STORE_BYTES) {
      // Auto-prune before rejecting
      await this.prune();
      const afterPrune = await this.getStats();
      if (afterPrune.sizeBytes >= MAX_GLOBAL_STORE_BYTES) {
        return null; // Still over cap after pruning
      }
    }

    const entry: KnowledgeEntry = {
      id: generateId(),
      category: input.category,
      title,
      content,
      sourceProject: input.sourceProject,
      sourceIssue: input.sourceIssue,
      sourceObservationId: input.sourceObservationId,
      promotedAt: new Date().toISOString(),
      promotionType: input.promotionType,
      usageCount: 0,
      lastUsedAt: null,
      labels: input.labels,
    };

    // Write entry file
    const entryPath = path.join(this.knowledgeDir, `${entry.id}.json`);
    writeJsonSync(entryPath, entry);

    // Update manifest
    const index: KnowledgeIndex = {
      id: entry.id,
      category: entry.category,
      title: entry.title,
      sourceProject: entry.sourceProject,
      labels: entry.labels,
      usageCount: 0,
      promotedAt: entry.promotedAt,
    };
    manifest.entries.push(index);
    manifest.updatedAt = new Date().toISOString();
    await this.saveManifest(manifest);

    return entry;
  }

  async search(query: string, labels?: string[], limit?: number): Promise<KnowledgeIndex[]> {
    const manifest = await this.loadManifest();
    const maxResults = limit ?? 20;
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    let filtered = manifest.entries;

    // Filter by labels if provided
    if (labels && labels.length > 0) {
      const labelSet = new Set(labels.map((l) => l.toLowerCase()));
      filtered = filtered.filter(
        (e) => e.labels.some((l) => labelSet.has(l.toLowerCase())),
      );
    }

    // Filter by search terms (all terms must match title or labels)
    if (terms.length > 0) {
      filtered = filtered.filter((e) => {
        const searchable = [e.title, ...e.labels, e.sourceProject]
          .join(' ')
          .toLowerCase();
        return terms.every((t) => searchable.includes(t));
      });
    }

    // Sort by usageCount descending (most useful first)
    return filtered
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, maxResults);
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    const entryPath = path.join(this.knowledgeDir, `${id}.json`);
    return readJsonSafe<KnowledgeEntry>(entryPath);
  }

  async recordUsage(id: string): Promise<void> {
    const entry = await this.getById(id);
    if (!entry) { return; }

    const updated: KnowledgeEntry = {
      ...entry,
      usageCount: entry.usageCount + 1,
      lastUsedAt: new Date().toISOString(),
    };

    const entryPath = path.join(this.knowledgeDir, `${id}.json`);
    writeJsonSync(entryPath, updated);

    // Update manifest usageCount
    const manifest = await this.loadManifest();
    const idx = manifest.entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      manifest.entries[idx] = {
        ...manifest.entries[idx]!,
        usageCount: updated.usageCount,
      };
      manifest.updatedAt = new Date().toISOString();
      await this.saveManifest(manifest);
    }
  }

  async list(category?: KnowledgeCategory, limit?: number): Promise<KnowledgeIndex[]> {
    const manifest = await this.loadManifest();
    let entries = manifest.entries;

    if (category) {
      entries = entries.filter((e) => e.category === category);
    }

    return entries
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit ?? 100);
  }

  async remove(id: string): Promise<boolean> {
    const manifest = await this.loadManifest();
    const idx = manifest.entries.findIndex((e) => e.id === id);
    if (idx < 0) { return false; }

    manifest.entries.splice(idx, 1);
    manifest.updatedAt = new Date().toISOString();
    await this.saveManifest(manifest);

    // Remove entry file
    const entryPath = path.join(this.knowledgeDir, `${id}.json`);
    try {
      if (fs.existsSync(entryPath)) {
        fs.unlinkSync(entryPath);
      }
    } catch {
      // Non-critical -- manifest is already updated
    }

    return true;
  }

  async prune(): Promise<number> {
    const manifest = await this.loadManifest();
    const now = Date.now();
    const threshold = PRUNE_UNUSED_AFTER_DAYS * 24 * 60 * 60 * 1000;
    let pruned = 0;

    const toRemove: string[] = [];

    for (const entry of manifest.entries) {
      // Load full entry to check lastUsedAt
      const full = await this.getById(entry.id);
      if (!full) {
        toRemove.push(entry.id);
        continue;
      }

      // Never used and promoted > threshold ago
      if (full.usageCount === 0) {
        const promotedAge = now - new Date(full.promotedAt).getTime();
        if (promotedAge > threshold) {
          toRemove.push(entry.id);
        }
      } else if (full.lastUsedAt) {
        // Used before, but not recently
        const lastUsedAge = now - new Date(full.lastUsedAt).getTime();
        if (lastUsedAge > threshold) {
          toRemove.push(entry.id);
        }
      }
    }

    for (const id of toRemove) {
      await this.remove(id);
      pruned++;
    }

    return pruned;
  }

  async getStats(): Promise<KnowledgeStats> {
    const manifest = await this.loadManifest();

    const byCategory: Record<KnowledgeCategory, number> = {
      pattern: 0,
      pitfall: 0,
      convention: 0,
      insight: 0,
    };

    for (const entry of manifest.entries) {
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    }

    // Compute disk size
    let sizeBytes = 0;
    try {
      if (fs.existsSync(this.knowledgeDir)) {
        const files = fs.readdirSync(this.knowledgeDir);
        for (const file of files) {
          try {
            const stat = fs.statSync(path.join(this.knowledgeDir, file));
            sizeBytes += stat.size;
          } catch {
            // Skip files that cannot be stat'd
          }
        }
      }
    } catch {
      // Directory read failure
    }

    return {
      total: manifest.entries.length,
      byCategory,
      sizeBytes,
    };
  }

  async formatForPrompt(query: string, labels?: string[]): Promise<string> {
    const matches = await this.search(query, labels, 5);
    if (matches.length === 0) { return ''; }

    const lines: string[] = ['[Global Knowledge]'];
    for (const match of matches) {
      const entry = await this.getById(match.id);
      if (entry) {
        lines.push(`- [${entry.category}] ${entry.title}: ${entry.content}`);
        // Record usage for recall tracking
        await this.recordUsage(entry.id);
      }
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Manifest I/O (cached)
  // -----------------------------------------------------------------------

  private async loadManifest(): Promise<GlobalKnowledgeManifest> {
    const now = Date.now();
    if (this.manifestCache && (now - this.manifestCacheTime) < GlobalKnowledgeStore.MANIFEST_CACHE_TTL_MS) {
      return this.manifestCache;
    }

    const manifestPath = path.join(this.knowledgeDir, GLOBAL_MANIFEST_FILE);
    const loaded = readJsonSafe<GlobalKnowledgeManifest>(manifestPath);

    if (loaded && loaded.version === 1) {
      this.manifestCache = loaded;
      this.manifestCacheTime = now;
      return loaded;
    }

    const fresh: GlobalKnowledgeManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
    this.manifestCache = fresh;
    this.manifestCacheTime = now;
    return fresh;
  }

  private async saveManifest(manifest: GlobalKnowledgeManifest): Promise<void> {
    const manifestPath = path.join(this.knowledgeDir, GLOBAL_MANIFEST_FILE);
    writeJsonSync(manifestPath, manifest);
    this.manifestCache = manifest;
    this.manifestCacheTime = Date.now();
  }

  // -----------------------------------------------------------------------
  // Deduplication
  // -----------------------------------------------------------------------

  /**
   * Checks if a candidate entry is a near-duplicate of any existing entry
   * using Jaccard similarity on title + content tokens.
   */
  private async checkDuplicate(
    title: string,
    content: string,
    manifest: GlobalKnowledgeManifest,
  ): Promise<boolean> {
    if (manifest.entries.length === 0) { return false; }

    const candidateTokens = this.tokenize(`${title} ${content}`);

    for (const existing of manifest.entries) {
      // Quick check: title exact match
      if (existing.title.toLowerCase() === title.toLowerCase()) {
        return true;
      }

      // Jaccard on title tokens
      const existingTokens = this.tokenize(existing.title);
      const similarity = this.jaccard(candidateTokens, existingTokens);
      if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3),
    );
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) { return 0; }
    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) { intersection++; }
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
