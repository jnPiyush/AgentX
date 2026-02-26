// ---------------------------------------------------------------------------
// AgentX -- File-Level Locking
// ---------------------------------------------------------------------------
//
// Provides safe concurrent access to JSON state files shared between:
//   - Multiple VS Code windows (separate Node.js processes)
//   - CLI sessions (PowerShell processes)
//   - Async operations within the same VS Code extension process
//
// Architecture:
//   FileLockManager = AsyncMutex (in-process) + JsonFileLock (cross-process)
//
// Lock file format: <target>.lock  e.g. issue-42.json.lock
// Lock content: { pid, timestamp, agent }  -- for diagnostics
//
// Ported semantics match the PowerShell Lock-JsonFile implementation so both
// sides agree on the same .lock file protocol.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Locks older than this are considered stale (crashed process). */
const STALE_LOCK_THRESHOLD_MS = 30_000;

/** Max acquisition attempts before returning false. */
const MAX_LOCK_RETRIES = 5;

/** Base delay for exponential backoff (ms). */
const BASE_LOCK_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Lock file content
// ---------------------------------------------------------------------------

interface LockFileContent {
  pid: number;
  timestamp: string;
  agent: string;
}

// ---------------------------------------------------------------------------
// AsyncMutex -- in-process serialization
// ---------------------------------------------------------------------------

/**
 * Lightweight async mutex for serializing concurrent async operations within
 * the same Node.js process (VS Code extension). Prevents redundant file lock
 * attempts from multiple async chains racing each other.
 */
export class AsyncMutex {
  private readonly locks = new Map<string, Promise<void>>();

  /**
   * Execute fn exclusively per key. Queues callers if the key is busy.
   */
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing holder
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    let resolve!: () => void;
    const lockPromise = new Promise<void>(r => { resolve = r; });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolve();
    }
  }
}

// ---------------------------------------------------------------------------
// JsonFileLock -- cross-process file locking
// ---------------------------------------------------------------------------

/**
 * Cross-process file lock using atomic create (O_CREAT | O_EXCL semantics
 * via Node.js 'wx' flag).
 *
 * Usage:
 * ```ts
 * const lock = new JsonFileLock();
 * const data = await lock.withLock('/path/to/file.json', 'engineer', async () => {
 *   const raw = fs.readFileSync(path, 'utf8');
 *   const obj = JSON.parse(raw);
 *   obj.modified = true;
 *   fs.writeFileSync(path, JSON.stringify(obj, null, 2));
 *   return obj;
 * });
 * ```
 */
export class JsonFileLock {
  private readonly staleThresholdMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(options?: {
    staleThresholdMs?: number;
    maxRetries?: number;
    baseDelayMs?: number;
  }) {
    this.staleThresholdMs = options?.staleThresholdMs ?? STALE_LOCK_THRESHOLD_MS;
    this.maxRetries = options?.maxRetries ?? MAX_LOCK_RETRIES;
    this.baseDelayMs = options?.baseDelayMs ?? BASE_LOCK_DELAY_MS;
  }

  /** Returns the lock file path for the given data file path. */
  lockPath(filePath: string): string {
    return filePath + '.lock';
  }

  private isLockStale(lockPath: string): boolean {
    try {
      const raw = fs.readFileSync(lockPath, 'utf8');
      const content = JSON.parse(raw) as Partial<LockFileContent & { created?: string }>;
      const ts = content.timestamp ?? content.created;
      if (ts) {
        return (Date.now() - new Date(ts).getTime()) > this.staleThresholdMs;
      }
      // No timestamp in content -- fall back to file mtime
      const stat = fs.statSync(lockPath);
      return (Date.now() - stat.mtimeMs) > this.staleThresholdMs;
    } catch {
      return false;
    }
  }

  private cleanStaleLock(lockPath: string): void {
    try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
  }

  private delay(attempt: number): Promise<void> {
    return new Promise<void>(resolve =>
      setTimeout(resolve, this.baseDelayMs * Math.pow(2, attempt))
    );
  }

  /**
   * Acquire the lock for filePath. Returns true on success, false on timeout.
   */
  async acquire(filePath: string, agent: string): Promise<boolean> {
    const lp = this.lockPath(filePath);

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      // Check for stale lock from a crashed process
      if (fs.existsSync(lp) && this.isLockStale(lp)) {
        this.cleanStaleLock(lp);
      }

      // Atomic create: fails with EEXIST if lock already held
      try {
        const fd = fs.openSync(lp, 'wx');
        const content: LockFileContent = {
          pid: process.pid,
          timestamp: new Date().toISOString(),
          agent,
        };
        fs.writeSync(fd, JSON.stringify(content));
        fs.closeSync(fd);
        return true;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') {
          throw err; // Unexpected error -- propagate
        }
      }

      // Backoff before next attempt (skip on last attempt)
      if (attempt < this.maxRetries - 1) {
        await this.delay(attempt);
      }
    }

    return false;
  }

  /**
   * Release the lock. Safe to call even if the lock was not held.
   */
  release(filePath: string): void {
    const lp = this.lockPath(filePath);
    try { fs.unlinkSync(lp); } catch { /* already gone */ }
  }

  /**
   * Acquire lock, run fn, release lock. Throws LOCK_TIMEOUT if acquisition fails.
   */
  async withLock<T>(filePath: string, agent: string, fn: () => Promise<T>): Promise<T> {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const acquired = await this.acquire(filePath, agent);
    if (!acquired) {
      throw new Error(
        `LOCK_TIMEOUT: Failed to acquire lock for ${path.basename(filePath)} ` +
        `after ${this.maxRetries} retries`
      );
    }

    try {
      return await fn();
    } finally {
      this.release(filePath);
    }
  }
}

// ---------------------------------------------------------------------------
// FileLockManager -- combined in-process + cross-process
// ---------------------------------------------------------------------------

/**
 * Combines AsyncMutex (in-process serialization) with JsonFileLock
 * (cross-process file lock) for maximum safety. Use this in all production
 * code rather than using JsonFileLock directly.
 *
 * Usage:
 * ```ts
 * const manager = new FileLockManager();
 * await manager.withSafeLock('/path/to/file.json', 'engineer', async () => {
 *   // read-modify-write safely
 * });
 * ```
 */
export class FileLockManager {
  private readonly fileLock: JsonFileLock;
  private readonly processMutex: AsyncMutex;

  constructor(fileLock?: JsonFileLock) {
    this.fileLock = fileLock ?? new JsonFileLock();
    this.processMutex = new AsyncMutex();
  }

  /**
   * Execute fn with both in-process and cross-process locks held.
   * The in-process mutex is acquired first to avoid redundant file lock
   * contention from multiple concurrent async chains.
   */
  async withSafeLock<T>(filePath: string, agent: string, fn: () => Promise<T>): Promise<T> {
    return this.processMutex.withLock(filePath, () =>
      this.fileLock.withLock(filePath, agent, fn)
    );
  }
}

// ---------------------------------------------------------------------------
// Convenience: Read/write locked JSON
// ---------------------------------------------------------------------------

/**
 * Read a JSON file safely (no lock needed for reads -- file writes are atomic).
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) { return null; }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON file (caller must hold the lock).
 */
export function writeJsonLocked<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
