// ---------------------------------------------------------------------------
// AgentX -- Persistent Cross-Session Memory Store
// ---------------------------------------------------------------------------
//
// JSONL-based persistent storage for agent observations that survives across
// VS Code sessions. Stores entries with TTL-based expiry and tag-based lookup.
//
// Storage location: .agentx/memory/observations.jsonl
//
// Each entry is a single JSON line in the file, enabling append-only writes
// and streaming reads without loading the entire file into memory.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single persistent memory entry.
 */
export interface MemoryEntry {
  /** Unique identifier (mem-{agent}-{timestamp}-{rand6}). */
  readonly key: string;
  /** The stored observation or fact. */
  readonly value: string;
  /** Categorization tags for lookup. */
  readonly tags: readonly string[];
  /** Unix timestamp (ms) of when the entry was created. */
  readonly createdAt: number;
  /** Unix timestamp (ms) when the entry expires (0 = never). */
  readonly expiresAt: number;
  /** Which agent stored this entry. */
  readonly agent: string;
}

/**
 * Options for querying the memory store.
 */
export interface MemoryQuery {
  /** Filter by tags (entries must have ALL specified tags). */
  readonly tags?: readonly string[];
  /** Filter by agent name. */
  readonly agent?: string;
  /** Maximum number of results (default: 50). */
  readonly limit?: number;
  /** Include expired entries (default: false). */
  readonly includeExpired?: boolean;
}

/**
 * Statistics about the memory store.
 */
export interface MemoryStats {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly expiredEntries: number;
  readonly sizeBytes: number;
  readonly agents: readonly string[];
  readonly tags: readonly string[];
}

/**
 * Configuration for the persistent store.
 */
export interface PersistentStoreConfig {
  /** Directory for memory storage (default: .agentx/memory). */
  readonly memoryDir: string;
  /** Default TTL in milliseconds (default: 7 days, 0 = never expire). */
  readonly defaultTtlMs: number;
  /** Maximum entries before auto-prune (default: 1000). */
  readonly maxEntries: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: PersistentStoreConfig = {
  memoryDir: '.agentx/memory',
  defaultTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxEntries: 1000,
};

const STORE_FILENAME = 'observations.jsonl';

// ---------------------------------------------------------------------------
// PersistentStore
// ---------------------------------------------------------------------------

/**
 * JSONL-based persistent memory store for cross-session agent observations.
 *
 * Thread-safety: single-writer model (VS Code extension is single-threaded).
 * Concurrency: append-only writes; reads scan the file each time for freshness.
 */
export class PersistentStore {
  private readonly config: PersistentStoreConfig;
  private readonly storePath: string;

  constructor(workspaceRoot: string, config?: Partial<PersistentStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const memDir = path.isAbsolute(this.config.memoryDir)
      ? this.config.memoryDir
      : path.join(workspaceRoot, this.config.memoryDir);
    this.storePath = path.join(memDir, STORE_FILENAME);
  }

  /**
   * Store a new observation in persistent memory.
   *
   * @param value - The observation text
   * @param agent - Agent name that produced this observation
   * @param tags - Categorization tags
   * @param ttlMs - Time-to-live in ms (overrides default; 0 = never expire)
   * @returns The stored entry
   */
  store(value: string, agent: string, tags: string[] = [], ttlMs?: number): MemoryEntry {
    const now = Date.now();
    const ttl = ttlMs ?? this.config.defaultTtlMs;
    const rand = crypto.randomBytes(3).toString('hex');

    const entry: MemoryEntry = {
      key: `mem-${agent}-${now}-${rand}`,
      value,
      tags: [...tags],
      createdAt: now,
      expiresAt: ttl > 0 ? now + ttl : 0,
      agent,
    };

    this.ensureDir();
    fs.appendFileSync(this.storePath, JSON.stringify(entry) + '\n', 'utf-8');

    // Auto-prune if over max entries
    const all = this.readAll();
    if (all.length > this.config.maxEntries) {
      this.prune();
    }

    return entry;
  }

  /**
   * Query persistent memory with optional filters.
   *
   * @param query - Query filters
   * @returns Matching entries, newest first
   */
  query(query: MemoryQuery = {}): MemoryEntry[] {
    const now = Date.now();
    const limit = query.limit ?? 50;
    let entries = this.readAll();

    // Filter expired
    if (!query.includeExpired) {
      entries = entries.filter((e) => e.expiresAt === 0 || e.expiresAt > now);
    }

    // Filter by agent
    if (query.agent) {
      entries = entries.filter((e) => e.agent === query.agent);
    }

    // Filter by tags (ALL tags must match)
    if (query.tags && query.tags.length > 0) {
      const requiredTags = new Set(query.tags);
      entries = entries.filter((e) =>
        [...requiredTags].every((t) => e.tags.includes(t)),
      );
    }

    // Sort newest first, limit
    entries.sort((a, b) => b.createdAt - a.createdAt);
    return entries.slice(0, limit);
  }

  /**
   * Get a single entry by key.
   *
   * @param key - Entry key
   * @returns The entry, or undefined if not found
   */
  get(key: string): MemoryEntry | undefined {
    return this.readAll().find((e) => e.key === key);
  }

  /**
   * Delete a single entry by key.
   *
   * @param key - Entry key to delete
   * @returns true if found and deleted
   */
  delete(key: string): boolean {
    const entries = this.readAll();
    const filtered = entries.filter((e) => e.key !== key);
    if (filtered.length === entries.length) {
      return false;
    }
    this.writeAll(filtered);
    return true;
  }

  /**
   * Remove expired entries and entries beyond maxEntries.
   *
   * @returns Number of entries pruned
   */
  prune(): number {
    const now = Date.now();
    const entries = this.readAll();
    const active = entries.filter((e) => e.expiresAt === 0 || e.expiresAt > now);

    // If still over max, remove oldest entries
    active.sort((a, b) => b.createdAt - a.createdAt);
    const kept = active.slice(0, this.config.maxEntries);

    const pruned = entries.length - kept.length;
    if (pruned > 0) {
      this.writeAll(kept);
    }
    return pruned;
  }

  /**
   * Get statistics about the memory store.
   */
  getStats(): MemoryStats {
    const now = Date.now();
    const entries = this.readAll();
    const active = entries.filter((e) => e.expiresAt === 0 || e.expiresAt > now);
    const expired = entries.length - active.length;
    const agents = new Set(entries.map((e) => e.agent));
    const tags = new Set(entries.flatMap((e) => [...e.tags]));

    let sizeBytes = 0;
    try {
      const stat = fs.statSync(this.storePath);
      sizeBytes = stat.size;
    } catch { /* file may not exist */ }

    return {
      totalEntries: entries.length,
      activeEntries: active.length,
      expiredEntries: expired,
      sizeBytes,
      agents: [...agents].sort(),
      tags: [...tags].sort(),
    };
  }

  /**
   * Clear all entries from the store.
   */
  clear(): void {
    try {
      fs.writeFileSync(this.storePath, '', 'utf-8');
    } catch { /* file may not exist */ }
  }

  /**
   * Check if the store file exists.
   */
  exists(): boolean {
    return fs.existsSync(this.storePath);
  }

  /**
   * Get the store file path (for diagnostics).
   */
  getStorePath(): string {
    return this.storePath;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private ensureDir(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private readAll(): MemoryEntry[] {
    if (!fs.existsSync(this.storePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const entries: MemoryEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as MemoryEntry;
          if (entry.key && entry.value !== undefined) {
            entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  private writeAll(entries: readonly MemoryEntry[]): void {
    this.ensureDir();
    const content = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length > 0 ? '\n' : '');
    fs.writeFileSync(this.storePath, content, 'utf-8');
  }
}
