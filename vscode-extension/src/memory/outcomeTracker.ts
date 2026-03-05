// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Outcome Tracker
// ---------------------------------------------------------------------------
//
// Phase 1 implementation of IOutcomeTracker backed by per-record JSON files
// and a global outcome-manifest.json index.
//
// Storage layout:
//   .agentx/memory/outcomes/
//     outcome-manifest.json                    -- compact index
//     outcome-{agent}-{issue}-{timestamp}.json -- full OutcomeRecord
//
// Design decisions:
//   - Per-record files (not per-issue) so queries across issues are efficient
//   - Manifest cached in-memory with 30s TTL to avoid redundant disk reads
//   - record() is fire-and-forget: callers should not await
//   - Manifest writes use FileLockManager for cross-process safety
//
// See SPEC-AgentX.md (Cognitive Foundation Specification) Section 4.1 for module spec.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import {
  FileLockManager,
  readJsonSafe,
  writeJsonLocked,
} from '../utils/fileLock';
import {
  type IOutcomeTracker,
  type OutcomeRecord,
  type OutcomeIndex,
  type OutcomeManifest,
  type OutcomeQuery,
  type OutcomeStats,
  MAX_OUTCOMES_PER_ISSUE,
  MAX_ACTION_SUMMARY_CHARS,
  MAX_LESSON_CHARS,
  OUTCOMES_DIR,
  OUTCOME_MANIFEST_FILE,
  OUTCOME_MANIFEST_CACHE_TTL_MS,
} from './outcomeTypes';

// ---------------------------------------------------------------------------
// OutcomeTracker
// ---------------------------------------------------------------------------

/**
 * Phase 1 IOutcomeTracker implementation backed by per-record JSON files.
 *
 * Manifest is cached in-memory for OUTCOME_MANIFEST_CACHE_TTL_MS (30s) to
 * avoid redundant disk reads during burst queries. Cache is invalidated
 * on any write operation.
 */
export class OutcomeTracker implements IOutcomeTracker {
  private readonly outcomesDir: string;
  private readonly lockManager: FileLockManager;

  /** In-memory manifest cache. */
  private manifestCache: OutcomeIndex[] | null = null;
  /** Timestamp of last manifest load. */
  private manifestLoadedAt = 0;

  /**
   * @param memoryDir - Absolute path to the memory directory (`.agentx/memory`)
   * @param lockManager - Shared FileLockManager instance
   */
  constructor(memoryDir: string, lockManager?: FileLockManager) {
    this.outcomesDir = path.join(memoryDir, OUTCOMES_DIR);
    this.lockManager = lockManager ?? new FileLockManager();
  }

  // -------------------------------------------------------------------------
  // IOutcomeTracker -- write
  // -------------------------------------------------------------------------

  async record(outcome: OutcomeRecord): Promise<void> {
    this.ensureDir();

    // Validate / truncate fields to spec limits
    const sanitized = sanitizeOutcome(outcome);

    // Write full record to individual file
    const recordFile = this.recordFilePath(sanitized.id);
    const manifestFile = this.manifestFilePath();

    await this.lockManager.withSafeLock(manifestFile, 'outcome-record', async () => {
      // Write individual record file (no lock needed -- unique filename)
      writeJsonLocked(recordFile, sanitized);

      // Update manifest
      const manifest = this.readManifestSync();
      manifest.entries.push(toIndexEntry(sanitized));
      manifest.updatedAt = new Date().toISOString();

      // Enforce per-issue cap
      this.enforcePerIssueCap(manifest, sanitized.issueNumber);

      writeJsonLocked(manifestFile, manifest);
    });

    this.invalidateCache();
  }

  // -------------------------------------------------------------------------
  // IOutcomeTracker -- read
  // -------------------------------------------------------------------------

  async query(filter: OutcomeQuery): Promise<OutcomeIndex[]> {
    const manifest = await this.loadManifest();
    const limit = filter.limit ?? 20;

    let results = manifest;

    if (filter.agent) {
      results = results.filter((e) => e.agent === filter.agent);
    }
    if (filter.issueNumber !== undefined) {
      results = results.filter((e) => e.issueNumber === filter.issueNumber);
    }
    if (filter.result) {
      results = results.filter((e) => e.result === filter.result);
    }
    if (filter.labels && filter.labels.length > 0) {
      const filterLabels = new Set(filter.labels);
      results = results.filter((e) =>
        e.labels.some((l) => filterLabels.has(l)),
      );
    }

    // Return newest-first, up to limit
    return results
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async search(query: string, limit = 20): Promise<OutcomeIndex[]> {
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
        entry.actionSummary,
        entry.agent,
        entry.result,
        String(entry.issueNumber),
        ...entry.labels,
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    return results
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async getById(id: string): Promise<OutcomeRecord | null> {
    const recordFile = this.recordFilePath(id);
    if (!fs.existsSync(recordFile)) {
      return null;
    }
    return readJsonSafe<OutcomeRecord>(recordFile) ?? null;
  }

  async formatLessonsForPrompt(
    agent: string,
    labels?: readonly string[],
  ): Promise<string> {
    const filter: OutcomeQuery = { agent, labels, limit: 10 };
    const recentOutcomes = await this.query(filter);

    if (recentOutcomes.length === 0) {
      return '';
    }

    // Load full records to access lessons
    const records: OutcomeRecord[] = [];
    for (const entry of recentOutcomes) {
      const record = await this.getById(entry.id);
      if (record && record.lesson) {
        records.push(record);
      }
    }

    if (records.length === 0) {
      return '';
    }

    const lines: string[] = [
      '## Lessons from Previous Outcomes',
      '',
    ];

    for (const rec of records) {
      const status = rec.result === 'pass' ? '[PASS]' : rec.result === 'fail' ? '[FAIL]' : '[PARTIAL]';
      lines.push(`- ${status} Issue #${rec.issueNumber}: ${rec.lesson}`);
      if (rec.rootCause) {
        lines.push(`  Root cause: ${rec.rootCause}`);
      }
    }

    lines.push('');
    lines.push('Use these lessons to avoid repeating mistakes and build on successes.');

    return lines.join('\n');
  }

  async getStats(): Promise<OutcomeStats> {
    const manifest = await this.loadManifest();

    if (manifest.length === 0) {
      return {
        totalOutcomes: 0,
        passCount: 0,
        failCount: 0,
        partialCount: 0,
        avgIterationCount: 0,
        byAgent: {},
      };
    }

    let passCount = 0;
    let failCount = 0;
    let partialCount = 0;
    const byAgent: Record<string, number> = {};

    for (const entry of manifest) {
      if (entry.result === 'pass') { passCount++; }
      else if (entry.result === 'fail') { failCount++; }
      else { partialCount++; }
      byAgent[entry.agent] = (byAgent[entry.agent] ?? 0) + 1;
    }

    // For avgIterationCount we need to read records -- use a sampling approach
    // to avoid loading all records. Sample up to 20 recent outcomes.
    const sample = manifest.slice(-20);
    let totalIterations = 0;
    let sampledCount = 0;
    for (const entry of sample) {
      const record = await this.getById(entry.id);
      if (record) {
        totalIterations += record.iterationCount;
        sampledCount++;
      }
    }

    return {
      totalOutcomes: manifest.length,
      passCount,
      failCount,
      partialCount,
      avgIterationCount: sampledCount > 0 ? totalIterations / sampledCount : 0,
      byAgent,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private ensureDir(): void {
    if (!fs.existsSync(this.outcomesDir)) {
      fs.mkdirSync(this.outcomesDir, { recursive: true });
    }
  }

  private manifestFilePath(): string {
    return path.join(this.outcomesDir, OUTCOME_MANIFEST_FILE);
  }

  private recordFilePath(id: string): string {
    // Sanitize ID for filesystem safety
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.outcomesDir, `${safeId}.json`);
  }

  private async loadManifest(): Promise<OutcomeIndex[]> {
    const now = Date.now();
    if (
      this.manifestCache !== null &&
      now - this.manifestLoadedAt < OUTCOME_MANIFEST_CACHE_TTL_MS
    ) {
      return this.manifestCache;
    }

    this.ensureDir();
    const raw = readJsonSafe<OutcomeManifest>(this.manifestFilePath());
    const entries = raw?.entries ?? [];
    this.manifestCache = entries;
    this.manifestLoadedAt = now;
    return entries;
  }

  private invalidateCache(): void {
    this.manifestCache = null;
    this.manifestLoadedAt = 0;
  }

  private readManifestSync(): OutcomeManifest {
    const raw = readJsonSafe<OutcomeManifest>(this.manifestFilePath());
    if (raw) { return raw; }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
  }

  /**
   * Enforce the per-issue cap by removing oldest entries for the given issue
   * when the count exceeds MAX_OUTCOMES_PER_ISSUE.
   */
  private enforcePerIssueCap(manifest: OutcomeManifest, issueNumber: number): void {
    const issueEntries = manifest.entries.filter((e) => e.issueNumber === issueNumber);
    if (issueEntries.length <= MAX_OUTCOMES_PER_ISSUE) { return; }

    // Sort oldest-first to find entries to remove
    const sorted = issueEntries
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const toRemove = new Set(
      sorted.slice(0, sorted.length - MAX_OUTCOMES_PER_ISSUE).map((e) => e.id),
    );

    // Remove from manifest
    manifest.entries = manifest.entries.filter((e) => !toRemove.has(e.id));

    // Remove stale record files (async cleanup -- best effort)
    for (const id of toRemove) {
      const filePath = this.recordFilePath(id);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Best effort -- ignore cleanup failures
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Private module helpers
// ---------------------------------------------------------------------------

/** Convert a full OutcomeRecord to its lightweight index entry. */
function toIndexEntry(record: OutcomeRecord): OutcomeIndex {
  return {
    id: record.id,
    agent: record.agent,
    issueNumber: record.issueNumber,
    result: record.result,
    actionSummary: record.actionSummary.substring(0, MAX_ACTION_SUMMARY_CHARS),
    timestamp: record.timestamp,
    labels: record.labels,
  };
}

/** Truncate fields to spec limits. */
function sanitizeOutcome(outcome: OutcomeRecord): OutcomeRecord {
  return {
    ...outcome,
    actionSummary: outcome.actionSummary.substring(0, MAX_ACTION_SUMMARY_CHARS),
    lesson: outcome.lesson.substring(0, MAX_LESSON_CHARS),
  };
}
