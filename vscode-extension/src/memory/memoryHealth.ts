// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Memory Health
// ---------------------------------------------------------------------------
//
// Phase 1 implementation of IMemoryHealth for diagnostic scanning and repair
// of the memory store directories (observations, outcomes, sessions).
//
// Checks for:
//   - Orphaned files (on disk but missing from manifest)
//   - Missing files (in manifest but not on disk)
//   - Corrupt files (invalid JSON or schema violation)
//   - Stale records (older than STALE_THRESHOLD_DAYS)
//
// Repair actions:
//   - Rebuild manifests from disk files
//   - Quarantine corrupt files to .archive/
//   - Remove orphaned manifest entries
//
// See SPEC-Phase1-Cognitive-Foundation.md Section 4.3 for module spec.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import {
  readJsonSafe,
  writeJsonLocked,
} from '../utils/fileLock';
import {
  type IMemoryHealth,
  type HealthReport,
  type RepairResult,
  type SubsystemHealth,
  STALE_THRESHOLD_DAYS,
  ARCHIVE_DIR,
} from './healthTypes';
import {
  type OutcomeManifest,
  type OutcomeRecord,
  OUTCOMES_DIR,
  OUTCOME_MANIFEST_FILE,
} from './outcomeTypes';
import {
  type SessionManifest,
  type SessionRecord,
  SESSIONS_DIR,
  SESSION_MANIFEST_FILE,
} from './sessionTypes';
import {
  type ManifestFile,
  type Observation,
  type ObservationCategory,
} from './types';

// ---------------------------------------------------------------------------
// MemoryHealth
// ---------------------------------------------------------------------------

/**
 * Phase 1 IMemoryHealth implementation.
 * Scans the .agentx/memory/ tree and reports anomalies.
 */
export class MemoryHealth implements IMemoryHealth {
  private readonly memoryDir: string;

  /**
   * @param memoryDir - Absolute path to the memory directory (`.agentx/memory`)
   */
  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
  }

  // -------------------------------------------------------------------------
  // IMemoryHealth.scan()
  // -------------------------------------------------------------------------

  async scan(): Promise<HealthReport> {
    const startTime = new Date();
    const start = Date.now();

    const observations = await this.scanObservations();
    const outcomes = await this.scanOutcomes();
    const sessions = await this.scanSessions();

    const diskSizeBytes = this.calculateDiskSize();
    const durationMs = Date.now() - start;

    // Collect all issues
    const issues: string[] = [];
    this.collectIssues(issues, 'observations', observations);
    this.collectIssues(issues, 'outcomes', outcomes);
    this.collectIssues(issues, 'sessions', sessions);

    const healthy = issues.length === 0;

    return {
      scanTime: startTime.toISOString(),
      durationMs,
      observations,
      outcomes,
      sessions,
      diskSizeBytes,
      healthy,
      issues,
    };
  }

  // -------------------------------------------------------------------------
  // IMemoryHealth.repair()
  // -------------------------------------------------------------------------

  async repair(): Promise<RepairResult> {
    const startTime = new Date();
    const start = Date.now();
    const actions: string[] = [];

    // Ensure archive directory exists
    const archiveDir = path.join(this.memoryDir, ARCHIVE_DIR);
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Repair observations
    await this.repairObservations(actions, archiveDir);

    // Repair outcomes
    await this.repairOutcomes(actions, archiveDir);

    // Repair sessions
    await this.repairSessions(actions, archiveDir);

    const durationMs = Date.now() - start;

    // Re-scan to verify
    const postReport = await this.scan();

    return {
      repairTime: startTime.toISOString(),
      durationMs,
      actions,
      healthyAfterRepair: postReport.healthy,
    };
  }

  // -------------------------------------------------------------------------
  // Observation scanning
  // -------------------------------------------------------------------------

  private async scanObservations(): Promise<SubsystemHealth> {
    const manifestPath = path.join(this.memoryDir, 'manifest.json');
    const manifest = readJsonSafe<ManifestFile>(manifestPath);
    const manifestEntries = manifest?.entries ?? [];

    // Find issue files on disk
    const issueFiles = this.listFiles(this.memoryDir, /^issue-\d+\.json$/);

    // Validate manifest entries against disk
    let total = manifestEntries.length;
    let stale = 0;
    let orphaned = 0;
    let corrupt = 0;
    let missing = 0;

    const staleThreshold = Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    // Check for stale entries
    for (const entry of manifestEntries) {
      if (new Date(entry.timestamp).getTime() < staleThreshold) {
        stale++;
      }
    }

    // Check each issue file for validity
    const manifestIssueNumbers = new Set(manifestEntries.map((e) => e.issueNumber));
    for (const file of issueFiles) {
      const filePath = path.join(this.memoryDir, file);
      const data = readJsonSafe<{ version: number; observations: unknown[] }>(filePath);
      if (!data || !Array.isArray(data.observations)) {
        corrupt++;
        continue;
      }

      // Check if issue file has entries not in manifest (orphaned observations)
      const match = file.match(/^issue-(\d+)\.json$/);
      if (match && !manifestIssueNumbers.has(Number(match[1]))) {
        orphaned++;
      }
    }

    // Check for missing issue files referenced by manifest
    const diskIssueNumbers = new Set(
      issueFiles
        .map((f) => f.match(/^issue-(\d+)\.json$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => Number(m[1])),
    );
    for (const issueNum of manifestIssueNumbers) {
      if (!diskIssueNumbers.has(issueNum)) {
        missing++;
      }
    }

    return { total, stale, orphaned, corrupt, missing };
  }

  // -------------------------------------------------------------------------
  // Outcome scanning
  // -------------------------------------------------------------------------

  private async scanOutcomes(): Promise<SubsystemHealth> {
    const outcomesDir = path.join(this.memoryDir, OUTCOMES_DIR);
    if (!fs.existsSync(outcomesDir)) {
      return { total: 0, stale: 0, orphaned: 0, corrupt: 0, missing: 0 };
    }

    const manifestPath = path.join(outcomesDir, OUTCOME_MANIFEST_FILE);
    const manifest = readJsonSafe<OutcomeManifest>(manifestPath);
    const manifestEntries = manifest?.entries ?? [];
    const manifestIds = new Set(manifestEntries.map((e) => e.id));

    // Find record files on disk
    const recordFiles = this.listFiles(outcomesDir, /^out-.*\.json$/)
      .filter((f) => f !== OUTCOME_MANIFEST_FILE);

    const staleThreshold = Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    let stale = 0;
    let orphaned = 0;
    let corrupt = 0;
    let missing = 0;

    // Check stale manifest entries
    for (const entry of manifestEntries) {
      if (new Date(entry.timestamp).getTime() < staleThreshold) {
        stale++;
      }
    }

    // Check disk files
    const diskIds = new Set<string>();
    for (const file of recordFiles) {
      const filePath = path.join(outcomesDir, file);
      const data = readJsonSafe<OutcomeRecord>(filePath);
      if (!data || !data.id || !data.agent) {
        corrupt++;
        continue;
      }
      diskIds.add(data.id);
      if (!manifestIds.has(data.id)) {
        orphaned++;
      }
    }

    // Check for missing files
    for (const entry of manifestEntries) {
      const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const expectedFile = path.join(outcomesDir, `${safeId}.json`);
      if (!fs.existsSync(expectedFile)) {
        missing++;
      }
    }

    return {
      total: manifestEntries.length,
      stale,
      orphaned,
      corrupt,
      missing,
    };
  }

  // -------------------------------------------------------------------------
  // Session scanning
  // -------------------------------------------------------------------------

  private async scanSessions(): Promise<SubsystemHealth> {
    const sessionsDir = path.join(this.memoryDir, SESSIONS_DIR);
    if (!fs.existsSync(sessionsDir)) {
      return { total: 0, stale: 0, orphaned: 0, corrupt: 0, missing: 0 };
    }

    const manifestPath = path.join(sessionsDir, SESSION_MANIFEST_FILE);
    const manifest = readJsonSafe<SessionManifest>(manifestPath);
    const manifestEntries = manifest?.entries ?? [];
    const manifestIds = new Set(manifestEntries.map((e) => e.id));

    // Find record files on disk
    const recordFiles = this.listFiles(sessionsDir, /^ses-.*\.json$/)
      .filter((f) => f !== SESSION_MANIFEST_FILE);

    const staleThreshold = Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    let stale = 0;
    let orphaned = 0;
    let corrupt = 0;
    let missing = 0;

    // Check stale
    for (const entry of manifestEntries) {
      if (new Date(entry.endTime).getTime() < staleThreshold) {
        stale++;
      }
    }

    // Check disk files
    for (const file of recordFiles) {
      const filePath = path.join(sessionsDir, file);
      const data = readJsonSafe<SessionRecord>(filePath);
      if (!data || !data.id || !data.agent) {
        corrupt++;
        continue;
      }
      if (!manifestIds.has(data.id)) {
        orphaned++;
      }
    }

    // Check for missing files
    for (const entry of manifestEntries) {
      const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const expectedFile = path.join(sessionsDir, `${safeId}.json`);
      if (!fs.existsSync(expectedFile)) {
        missing++;
      }
    }

    return {
      total: manifestEntries.length,
      stale,
      orphaned,
      corrupt,
      missing,
    };
  }

  // -------------------------------------------------------------------------
  // Repair implementations
  // -------------------------------------------------------------------------

  private async repairObservations(actions: string[], archiveDir: string): Promise<void> {
    const manifestPath = path.join(this.memoryDir, 'manifest.json');

    // Find all issue files
    const issueFiles = this.listFiles(this.memoryDir, /^issue-\d+\.json$/);

    // Quarantine corrupt files and rebuild manifest from valid files
    const validEntries: Array<{ id: string; agent: string; issueNumber: number; category: ObservationCategory; summary: string; tokens: number; timestamp: string }> = [];

    for (const file of issueFiles) {
      const filePath = path.join(this.memoryDir, file);
      const data = readJsonSafe<{ version: number; observations: Observation[] }>(filePath);

      if (!data || !Array.isArray(data.observations)) {
        // Quarantine corrupt file
        const archivePath = path.join(archiveDir, `corrupt-${Date.now()}-${file}`);
        try {
          fs.renameSync(filePath, archivePath);
          actions.push(`[PASS] Quarantined corrupt file ${file} to .archive/`);
        } catch {
          actions.push(`[WARN] Failed to quarantine ${file}`);
        }
        continue;
      }

      // Add valid observations to rebuilt manifest
      for (const obs of data.observations) {
        if (obs.id && obs.agent && obs.timestamp) {
          validEntries.push({
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
    }

    // Rebuild manifest
    const manifest: ManifestFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: validEntries,
    };
    writeJsonLocked(manifestPath, manifest);
    actions.push(`[PASS] Rebuilt observation manifest (${validEntries.length} entries)`);
  }

  private async repairOutcomes(actions: string[], archiveDir: string): Promise<void> {
    const outcomesDir = path.join(this.memoryDir, OUTCOMES_DIR);
    if (!fs.existsSync(outcomesDir)) { return; }

    const manifestPath = path.join(outcomesDir, OUTCOME_MANIFEST_FILE);
    const recordFiles = this.listFiles(outcomesDir, /^out-.*\.json$/)
      .filter((f) => f !== OUTCOME_MANIFEST_FILE);

    const validEntries: Array<{ id: string; agent: string; issueNumber: number; result: string; actionSummary: string; timestamp: string; labels: readonly string[] }> = [];

    for (const file of recordFiles) {
      const filePath = path.join(outcomesDir, file);
      const data = readJsonSafe<OutcomeRecord>(filePath);

      if (!data || !data.id || !data.agent) {
        const archivePath = path.join(archiveDir, `corrupt-${Date.now()}-${file}`);
        try {
          fs.renameSync(filePath, archivePath);
          actions.push(`[PASS] Quarantined corrupt outcome file ${file}`);
        } catch {
          actions.push(`[WARN] Failed to quarantine outcome ${file}`);
        }
        continue;
      }

      validEntries.push({
        id: data.id,
        agent: data.agent,
        issueNumber: data.issueNumber,
        result: data.result,
        actionSummary: data.actionSummary,
        timestamp: data.timestamp,
        labels: data.labels,
      });
    }

    const manifest: OutcomeManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: validEntries as any,
    };
    writeJsonLocked(manifestPath, manifest);
    actions.push(`[PASS] Rebuilt outcome manifest (${validEntries.length} entries)`);
  }

  private async repairSessions(actions: string[], archiveDir: string): Promise<void> {
    const sessionsDir = path.join(this.memoryDir, SESSIONS_DIR);
    if (!fs.existsSync(sessionsDir)) { return; }

    const manifestPath = path.join(sessionsDir, SESSION_MANIFEST_FILE);
    const recordFiles = this.listFiles(sessionsDir, /^ses-.*\.json$/)
      .filter((f) => f !== SESSION_MANIFEST_FILE);

    const validEntries: Array<{ id: string; agent: string; issueNumber: number | null; startTime: string; endTime: string; summaryPreview: string; messageCount: number }> = [];

    for (const file of recordFiles) {
      const filePath = path.join(sessionsDir, file);
      const data = readJsonSafe<SessionRecord>(filePath);

      if (!data || !data.id || !data.agent) {
        const archivePath = path.join(archiveDir, `corrupt-${Date.now()}-${file}`);
        try {
          fs.renameSync(filePath, archivePath);
          actions.push(`[PASS] Quarantined corrupt session file ${file}`);
        } catch {
          actions.push(`[WARN] Failed to quarantine session ${file}`);
        }
        continue;
      }

      validEntries.push({
        id: data.id,
        agent: data.agent,
        issueNumber: data.issueNumber,
        startTime: data.startTime,
        endTime: data.endTime,
        summaryPreview: (data.summary ?? '').substring(0, 80),
        messageCount: data.messageCount,
      });
    }

    const manifest: SessionManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: validEntries,
    };
    writeJsonLocked(manifestPath, manifest);
    actions.push(`[PASS] Rebuilt session manifest (${validEntries.length} entries)`);
  }

  // -------------------------------------------------------------------------
  // Utility helpers
  // -------------------------------------------------------------------------

  private listFiles(dir: string, pattern: RegExp): string[] {
    if (!fs.existsSync(dir)) { return []; }
    try {
      return fs.readdirSync(dir).filter((f) => pattern.test(f));
    } catch {
      return [];
    }
  }

  private calculateDiskSize(): number {
    let totalSize = 0;
    const walkDir = (dir: string): void => {
      if (!fs.existsSync(dir)) { return; }
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            try {
              const stat = fs.statSync(fullPath);
              totalSize += stat.size;
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    };
    walkDir(this.memoryDir);
    return totalSize;
  }

  private collectIssues(
    issues: string[],
    subsystem: string,
    health: SubsystemHealth,
  ): void {
    if (health.orphaned > 0) {
      issues.push(`[WARN] ${health.orphaned} orphaned ${subsystem} file(s) (not in manifest)`);
    }
    if (health.missing > 0) {
      issues.push(`[WARN] ${health.missing} missing ${subsystem} file(s) (in manifest but not on disk)`);
    }
    if (health.corrupt > 0) {
      issues.push(`[WARN] ${health.corrupt} corrupt ${subsystem} file(s) (invalid JSON)`);
    }
    if (health.stale > 0) {
      issues.push(`[WARN] ${health.stale} stale ${subsystem} record(s) (> ${STALE_THRESHOLD_DAYS} days)`);
    }
  }
}
