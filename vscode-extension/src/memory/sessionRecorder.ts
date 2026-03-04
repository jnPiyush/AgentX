// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Session Recorder
// ---------------------------------------------------------------------------
//
// Phase 1 implementation of ISessionRecorder backed by per-session JSON files
// and a global session-manifest.json index.
//
// Storage layout:
//   .agentx/memory/sessions/
//     session-manifest.json              -- compact index (SessionIndex[])
//     session-{YYYYMMDD}-{6char}.json    -- full SessionRecord
//
// Design decisions:
//   - Per-session files for fast individual lookups
//   - Manifest cached in-memory with 30s TTL
//   - capture() wrapped in try/catch -- never throws to callers
//   - Oldest sessions pruned when MAX_SESSIONS_RETAINED exceeded
//
// See SPEC-Phase1-Cognitive-Foundation.md Section 4.2 for module spec.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import {
  FileLockManager,
  readJsonSafe,
  writeJsonLocked,
} from '../utils/fileLock';
import {
  type ISessionRecorder,
  type SessionRecord,
  type SessionIndex,
  type SessionManifest,
  MAX_SESSIONS_RETAINED,
  MAX_SESSION_SUMMARY_CHARS,
  MAX_SUMMARY_PREVIEW_CHARS,
  SESSIONS_DIR,
  SESSION_MANIFEST_FILE,
  SESSION_MANIFEST_CACHE_TTL_MS,
} from './sessionTypes';

// ---------------------------------------------------------------------------
// SessionRecorder
// ---------------------------------------------------------------------------

/**
 * Phase 1 ISessionRecorder implementation backed by per-session JSON files.
 *
 * Manifest is cached in-memory for SESSION_MANIFEST_CACHE_TTL_MS (30s) to
 * avoid redundant disk reads. Cache is invalidated on any write operation.
 */
export class SessionRecorder implements ISessionRecorder {
  private readonly sessionsDir: string;
  private readonly lockManager: FileLockManager;

  /** In-memory manifest cache. */
  private manifestCache: SessionIndex[] | null = null;
  /** Timestamp of last manifest load. */
  private manifestLoadedAt = 0;

  /**
   * @param memoryDir - Absolute path to the memory directory (`.agentx/memory`)
   * @param lockManager - Shared FileLockManager instance
   */
  constructor(memoryDir: string, lockManager?: FileLockManager) {
    this.sessionsDir = path.join(memoryDir, SESSIONS_DIR);
    this.lockManager = lockManager ?? new FileLockManager();
  }

  // -------------------------------------------------------------------------
  // ISessionRecorder -- write
  // -------------------------------------------------------------------------

  async capture(session: SessionRecord): Promise<void> {
    try {
      this.ensureDir();

      const sanitized = sanitizeSession(session);
      const recordFile = this.recordFilePath(sanitized.id);
      const manifestFile = this.manifestFilePath();

      await this.lockManager.withSafeLock(manifestFile, 'session-capture', async () => {
        // Write individual session file
        writeJsonLocked(recordFile, sanitized);

        // Update manifest
        const manifest = this.readManifestSync();
        manifest.entries.push(toIndexEntry(sanitized));
        manifest.updatedAt = new Date().toISOString();

        // Enforce retention cap
        this.enforceRetentionCap(manifest);

        writeJsonLocked(manifestFile, manifest);
      });

      this.invalidateCache();
    } catch (err) {
      // Session capture should never throw -- log and swallow
      console.warn('AgentX: Session capture failed:', err);
    }
  }

  // -------------------------------------------------------------------------
  // ISessionRecorder -- read
  // -------------------------------------------------------------------------

  async list(limit = 50): Promise<SessionIndex[]> {
    const manifest = await this.loadManifest();
    return manifest
      .slice()
      .sort((a, b) => b.endTime.localeCompare(a.endTime))
      .slice(0, limit);
  }

  async listByIssue(issueNumber: number): Promise<SessionIndex[]> {
    const manifest = await this.loadManifest();
    return manifest
      .filter((e) => e.issueNumber === issueNumber)
      .sort((a, b) => b.endTime.localeCompare(a.endTime));
  }

  async getById(id: string): Promise<SessionRecord | null> {
    const recordFile = this.recordFilePath(id);
    if (!fs.existsSync(recordFile)) {
      return null;
    }
    return readJsonSafe<SessionRecord>(recordFile) ?? null;
  }

  async getMostRecent(issueNumber?: number): Promise<SessionRecord | null> {
    const manifest = await this.loadManifest();
    let entries = manifest;

    if (issueNumber !== undefined) {
      entries = entries.filter((e) => e.issueNumber === issueNumber);
    }

    if (entries.length === 0) {
      return null;
    }

    // Sort newest-first
    const sorted = entries
      .slice()
      .sort((a, b) => b.endTime.localeCompare(a.endTime));

    return this.getById(sorted[0].id);
  }

  async search(query: string, limit = 20): Promise<SessionIndex[]> {
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
        entry.summaryPreview,
        entry.agent,
        String(entry.issueNumber ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    return results
      .slice()
      .sort((a, b) => b.endTime.localeCompare(a.endTime))
      .slice(0, limit);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private ensureDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private manifestFilePath(): string {
    return path.join(this.sessionsDir, SESSION_MANIFEST_FILE);
  }

  private recordFilePath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.sessionsDir, `${safeId}.json`);
  }

  private async loadManifest(): Promise<SessionIndex[]> {
    const now = Date.now();
    if (
      this.manifestCache !== null &&
      now - this.manifestLoadedAt < SESSION_MANIFEST_CACHE_TTL_MS
    ) {
      return this.manifestCache;
    }

    this.ensureDir();
    const raw = readJsonSafe<SessionManifest>(this.manifestFilePath());
    const entries = raw?.entries ?? [];
    this.manifestCache = entries;
    this.manifestLoadedAt = now;
    return entries;
  }

  private invalidateCache(): void {
    this.manifestCache = null;
    this.manifestLoadedAt = 0;
  }

  private readManifestSync(): SessionManifest {
    const raw = readJsonSafe<SessionManifest>(this.manifestFilePath());
    if (raw) { return raw; }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
  }

  /**
   * Enforce MAX_SESSIONS_RETAINED cap by removing oldest sessions.
   */
  private enforceRetentionCap(manifest: SessionManifest): void {
    if (manifest.entries.length <= MAX_SESSIONS_RETAINED) { return; }

    // Sort oldest-first
    const sorted = manifest.entries
      .slice()
      .sort((a, b) => a.endTime.localeCompare(b.endTime));
    const toRemove = new Set(
      sorted.slice(0, sorted.length - MAX_SESSIONS_RETAINED).map((e) => e.id),
    );

    // Remove from manifest
    manifest.entries = manifest.entries.filter((e) => !toRemove.has(e.id));

    // Remove stale session files (best effort)
    for (const id of toRemove) {
      const filePath = this.recordFilePath(id);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Best effort cleanup
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Private module helpers
// ---------------------------------------------------------------------------

/** Convert a full SessionRecord to its lightweight index entry. */
function toIndexEntry(record: SessionRecord): SessionIndex {
  return {
    id: record.id,
    agent: record.agent,
    issueNumber: record.issueNumber,
    startTime: record.startTime,
    endTime: record.endTime,
    summaryPreview: record.summary.substring(0, MAX_SUMMARY_PREVIEW_CHARS),
    messageCount: record.messageCount,
  };
}

/** Truncate fields to spec limits. */
function sanitizeSession(session: SessionRecord): SessionRecord {
  return {
    ...session,
    summary: session.summary.substring(0, MAX_SESSION_SUMMARY_CHARS),
  };
}
