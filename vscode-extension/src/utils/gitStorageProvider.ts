// ---------------------------------------------------------------------------
// AgentX -- Git-Based Storage Provider
// ---------------------------------------------------------------------------
//
// Provides read/write operations on a Git orphan branch without affecting the
// working tree. Used for:
//   - Local issue persistence (issues, state, config)
//   - Memory observation storage (manifest, per-issue observations)
//   - Agent state tracking (loop state, clarification ledger)
//
// Storage layout on the orphan branch (default: agentx/data):
//   issues/{n}.json            -- individual issue data
//   state/agent-status.json    -- agent state tracking
//   state/loop-state.json      -- quality loop state
//   memory/manifest.json       -- observation index
//   memory/issue-{n}.json      -- per-issue observations
//
// All operations use Git plumbing commands (hash-object, read-tree,
// update-index, write-tree, commit-tree, update-ref) so the working
// tree and real index are never touched.
//
// ---------------------------------------------------------------------------

import { execFileSync, ExecFileSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default orphan branch name for AgentX data. */
export const DATA_BRANCH = 'agentx/data';

/** Well-known SHA-1 hash of an empty Git tree object. */
const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf899d15f3277a76d';

/** Maximum Git command timeout in milliseconds. */
const GIT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class GitStorageError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'GitStorageError';
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface GitStorageConfig {
  /** Absolute path to the workspace root (must be a Git repository). */
  readonly workspaceRoot: string;
  /** Branch name for data storage. Default: 'agentx/data'. */
  readonly branch?: string;
  /** Remote name for push/pull. Default: 'origin'. */
  readonly remote?: string;
  /** EventBus for lifecycle events (optional). */
  readonly eventBus?: AgentEventBus;
}

// ---------------------------------------------------------------------------
// File entry for batch operations
// ---------------------------------------------------------------------------

export interface GitFileEntry {
  readonly filePath: string;
  readonly content: string;
}

// ---------------------------------------------------------------------------
// History entry
// ---------------------------------------------------------------------------

export interface GitLogEntry {
  readonly hash: string;
  readonly author: string;
  readonly date: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// GitStorageProvider
// ---------------------------------------------------------------------------

/**
 * Provides read/write operations against a Git orphan branch.
 *
 * The orphan branch is never checked out -- all I/O uses Git plumbing
 * commands so the working tree stays untouched.
 *
 * Thread safety: operations use a temporary index file scoped to each
 * write call. Concurrent reads are safe. Concurrent writes to the same
 * branch should be serialized by the caller (use FileLockManager).
 */
export class GitStorageProvider {
  private readonly workspaceRoot: string;
  private readonly branch: string;
  private readonly remote: string;
  private readonly eventBus?: AgentEventBus;
  private initialized = false;

  constructor(config: GitStorageConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.branch = config.branch ?? DATA_BRANCH;
    this.remote = config.remote ?? 'origin';
    this.eventBus = config.eventBus;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Ensure the orphan data branch exists. Creates it with an empty root
   * commit if missing. Safe to call multiple times (idempotent).
   */
  async init(): Promise<void> {
    if (this.initialized) { return; }

    // Verify the workspace root is a Git repository (or a legitimate
    // subdirectory of one). A random temp dir whose parent happens to be
    // a Git repo must NOT pass: we require a .git directory/file at the
    // workspace root itself.
    const gitMarker = path.join(this.workspaceRoot, '.git');
    try {
      fs.statSync(gitMarker);
    } catch {
      throw new GitStorageError(
        `Not a Git repository: ${this.workspaceRoot}`,
        'init',
      );
    }

    // Check if the data branch already exists.
    if (!this.branchExists()) {
      // Create the empty tree object (may not exist in a fresh repo).
      const emptyTree = this.gitInput(['mktree'], '').trim() || EMPTY_TREE_HASH;
      // Create orphan branch with an empty initial commit.
      const commitHash = this.gitInput(
        ['commit-tree', emptyTree, '-m', 'Initialize agentx data branch'],
        '',
      );
      this.git(['update-ref', `refs/heads/${this.branch}`, commitHash.trim()]);
    }

    this.initialized = true;
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  /**
   * Read a file from the data branch. Returns null if the file does not
   * exist on the branch.
   */
  async readFile(filePath: string): Promise<string | null> {
    await this.init();
    const normalized = this.normalizePath(filePath);
    try {
      return this.git(['show', `${this.branch}:${normalized}`]);
    } catch {
      return null;
    }
  }

  /**
   * Read and parse a JSON file from the data branch. Returns null if
   * the file does not exist or is not valid JSON.
   */
  async readJson<T = unknown>(filePath: string): Promise<T | null> {
    const raw = await this.readFile(filePath);
    if (raw === null) { return null; }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists on the data branch.
   */
  async fileExists(filePath: string): Promise<boolean> {
    await this.init();
    const normalized = this.normalizePath(filePath);
    try {
      this.git(['cat-file', '-e', `${this.branch}:${normalized}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in a directory on the data branch.
   * Returns file names (not full paths) in the directory.
   */
  async listFiles(dirPath: string): Promise<string[]> {
    await this.init();
    const normalized = this.normalizePath(dirPath);
    const prefix = normalized ? `${normalized}/` : '';
    try {
      const output = this.git([
        'ls-tree', '--name-only', `${this.branch}`, `${prefix}`,
      ]);
      return output
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => line.startsWith(prefix) ? line.slice(prefix.length) : line);
    } catch {
      return [];
    }
  }

  /**
   * Get commit history for a specific file on the data branch.
   */
  async getHistory(filePath: string, limit = 10): Promise<GitLogEntry[]> {
    await this.init();
    const normalized = this.normalizePath(filePath);
    try {
      const output = this.git([
        'log', `--max-count=${limit}`,
        '--format=%H|%an|%aI|%s',
        this.branch, '--', normalized,
      ]);
      return output
        .split('\n')
        .filter(l => l.length > 0)
        .map(line => {
          const [hash, author, date, ...msgParts] = line.split('|');
          return { hash, author, date, message: msgParts.join('|') };
        });
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------------

  /**
   * Write a single file to the data branch. Creates a new commit.
   *
   * Uses a temporary index file so the working tree and real Git index
   * are never affected.
   */
  async writeFile(
    filePath: string,
    content: string,
    message: string,
  ): Promise<string> {
    return this.writeFiles([{ filePath, content }], message);
  }

  /**
   * Write a JSON value to the data branch.
   */
  async writeJson(
    filePath: string,
    data: unknown,
    message: string,
  ): Promise<string> {
    const content = JSON.stringify(data, null, 2) + '\n';
    return this.writeFile(filePath, content, message);
  }

  /**
   * Write multiple files in a single atomic commit.
   *
   * This is more efficient than multiple writeFile() calls because it
   * creates only one commit for all changes.
   */
  async writeFiles(
    entries: GitFileEntry[],
    message: string,
  ): Promise<string> {
    await this.init();
    if (entries.length === 0) {
      throw new GitStorageError('No files to write', 'writeFiles');
    }

    const tmpIndex = this.tmpIndexPath();
    const env = this.indexEnv(tmpIndex);

    try {
      // 1. Read current tree into temporary index.
      if (this.branchExists()) {
        this.gitEnv(['read-tree', this.branch], env);
      }

      // 2. Hash each file and add to the temporary index.
      for (const entry of entries) {
        const normalized = this.normalizePath(entry.filePath);
        const blobHash = this.gitInput(
          ['hash-object', '-w', '--stdin'],
          entry.content,
        ).trim();
        this.gitEnv(
          ['update-index', '--add', '--cacheinfo', `100644,${blobHash},${normalized}`],
          env,
        );
      }

      // 3. Write the tree from the temporary index.
      const treeHash = this.gitEnv(['write-tree'], env).trim();

      // 4. Create commit with parent (if branch has commits).
      const parentArgs = this.getParentArgs();
      const commitHash = this.gitInput(
        ['commit-tree', treeHash, ...parentArgs, '-m', message],
        '',
      ).trim();

      // 5. Update the branch ref.
      this.git(['update-ref', `refs/heads/${this.branch}`, commitHash]);

      return commitHash;
    } catch (err) {
      throw new GitStorageError(
        `Failed to write files: ${(err as Error).message}`,
        'writeFiles',
        err as Error,
      );
    } finally {
      // Clean up temporary index file.
      this.cleanTmpIndex(tmpIndex);
    }
  }

  /**
   * Delete a file from the data branch. Creates a new commit.
   * Returns the new commit hash, or null if the file did not exist.
   */
  async deleteFile(filePath: string, message: string): Promise<string | null> {
    return this.deleteFiles([filePath], message);
  }

  /**
   * Delete multiple files in a single atomic commit.
   */
  async deleteFiles(
    filePaths: string[],
    message: string,
  ): Promise<string | null> {
    await this.init();
    if (filePaths.length === 0) { return null; }
    if (!this.branchExists()) { return null; }

    const tmpIndex = this.tmpIndexPath();
    const env = this.indexEnv(tmpIndex);

    try {
      // 1. Read current tree into temporary index.
      this.gitEnv(['read-tree', this.branch], env);

      // 2. Remove each file from the index, only if it actually exists.
      let anyRemoved = false;
      for (const fp of filePaths) {
        const normalized = this.normalizePath(fp);
        // Verify the file exists on the branch first.
        try {
          this.git(['cat-file', '-e', `${this.branch}:${normalized}`]);
        } catch {
          continue; // File does not exist on branch -- skip.
        }
        try {
          this.gitEnv(
            ['update-index', '--force-remove', normalized],
            env,
          );
          anyRemoved = true;
        } catch {
          // File not in index -- skip.
        }
      }

      if (!anyRemoved) { return null; }

      // 3. Write tree, commit, update ref.
      const treeHash = this.gitEnv(['write-tree'], env).trim();
      const parentArgs = this.getParentArgs();
      const commitHash = this.gitInput(
        ['commit-tree', treeHash, ...parentArgs, '-m', message],
        '',
      ).trim();
      this.git(['update-ref', `refs/heads/${this.branch}`, commitHash]);

      return commitHash;
    } catch (err) {
      throw new GitStorageError(
        `Failed to delete files: ${(err as Error).message}`,
        'deleteFiles',
        err as Error,
      );
    } finally {
      this.cleanTmpIndex(tmpIndex);
    }
  }

  // -------------------------------------------------------------------------
  // Sync operations
  // -------------------------------------------------------------------------

  /**
   * Push the data branch to the remote.
   * Returns true on success, false if the remote does not support it.
   */
  async push(): Promise<boolean> {
    await this.init();
    try {
      this.git(['push', this.remote, `${this.branch}:${this.branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch the data branch from the remote (does not merge).
   * Returns true on success.
   */
  async fetch(): Promise<boolean> {
    await this.init();
    try {
      this.git(['fetch', this.remote, `${this.branch}:${this.branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /** Return the branch name used for data storage. */
  getBranch(): string { return this.branch; }

  /** Return true if the data branch exists. */
  branchExists(): boolean {
    try {
      this.git(['rev-parse', '--verify', `refs/heads/${this.branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  /** Return the latest commit hash on the data branch, or null. */
  async getLatestCommit(): Promise<string | null> {
    await this.init();
    try {
      return this.git(['rev-parse', this.branch]).trim();
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Normalize file path to forward slashes (Git convention). */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  /** Get temp index file path (unique per call to avoid conflicts). */
  private tmpIndexPath(): string {
    const rand = Math.random().toString(36).slice(2, 10);
    const gitDir = this.git(['rev-parse', '--git-dir']).trim();
    const absGitDir = path.isAbsolute(gitDir)
      ? gitDir
      : path.join(this.workspaceRoot, gitDir);
    return path.join(absGitDir, `agentx-tmp-index-${rand}`);
  }

  /** Build env object that overrides GIT_INDEX_FILE. */
  private indexEnv(tmpIndex: string): Record<string, string> {
    return { ...process.env as Record<string, string>, GIT_INDEX_FILE: tmpIndex };
  }

  /** Clean up a temporary index file. */
  private cleanTmpIndex(p: string): void {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }

  /** Get parent commit args for commit-tree. */
  private getParentArgs(): string[] {
    try {
      const parent = this.git(['rev-parse', this.branch]).trim();
      return ['-p', parent];
    } catch {
      return [];
    }
  }

  /** Execute a Git command synchronously and return stdout as a string. */
  private git(args: string[]): string {
    const opts: ExecFileSyncOptions = {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    return execFileSync('git', args, opts) as string;
  }

  /** Execute a Git command with a custom environment (e.g., GIT_INDEX_FILE). */
  private gitEnv(args: string[], env: Record<string, string>): string {
    const opts: ExecFileSyncOptions = {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    return execFileSync('git', args, opts) as string;
  }

  /** Execute a Git command with stdin input. */
  private gitInput(args: string[], input: string): string {
    const opts: ExecFileSyncOptions = {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    return execFileSync('git', args, opts) as string;
  }
}
