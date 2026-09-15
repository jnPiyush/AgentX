// ---------------------------------------------------------------------------
// Frontier -- Path Sandbox
// ---------------------------------------------------------------------------
//
// Validates file paths before tools access them, preventing path traversal
// attacks and access to sensitive system directories/files outside the
// workspace.
//
// All functions are pure (no VS Code API dependency) and resolve paths
// against the workspace root before checking constraints.
// ---------------------------------------------------------------------------

import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of a path validation check.
 */
export interface PathValidationResult {
  readonly allowed: boolean;
  readonly resolvedPath: string;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Default blocked lists (pre-compiled for performance)
// ---------------------------------------------------------------------------

/**
 * Directory name segments that are never allowed.
 * Checked against normalized POSIX path components.
 */
const BLOCKED_DIR_SEGMENTS: readonly string[] = [
  '.ssh',
  '.aws',
  '.gnupg',
  '.azure',
  '.kube',
  '.config/gh',
];

/**
 * Compiled path traversal detector.
 * Matches ../ and ..\ sequences in the raw input before resolution.
 */
const TRAVERSAL_RE = /(?:^|[/\\])\.\.(?:[/\\]|$)/;

/**
 * Predicates for blocked file basenames (lower-cased before matching).
 */
type FilenamePredicate = (lowerBasename: string) => boolean;

const BLOCKED_FILE_PREDICATES: readonly FilenamePredicate[] = [
  // .env and .env.* variants
  (n) => n === '.env' || n.startsWith('.env.'),
  // PEM certificates
  (n) => n.endsWith('.pem'),
  // Private keys
  (n) => n.endsWith('.key'),
  // Anything containing "password"
  (n) => n.includes('password'),
  // Anything containing "secret"
  (n) => n.includes('secret'),
  // PKCS#12 bundles
  (n) => n.endsWith('.pfx'),
  (n) => n.endsWith('.p12'),
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the raw input path contains traversal sequences BEFORE
 * resolution. This catches encoded and relative traversal attempts.
 *
 * @pure
 */
export function isTraversalAttempt(inputPath: string): boolean {
  if (!inputPath) { return false; }

  // Reset lastIndex because the regex uses no flags that would matter,
  // but guard against accidental stateful reuse if ever extended.
  TRAVERSAL_RE.lastIndex = 0;

  // Direct pattern check (covers a/../../b)
  if (TRAVERSAL_RE.test(inputPath)) { return true; }

  // Simple substring checks for the two most common forms
  if (inputPath.includes('../') || inputPath.includes('..\\')) { return true; }

  // Bare ".." component at end of path
  if (inputPath === '..' || inputPath.endsWith('/..') || inputPath.endsWith('\\..')) {
    return true;
  }

  return false;
}

/**
 * Validate whether the given path is allowed for file access.
 *
 * Checks (in order):
 *  1. Path traversal detection on the raw input
 *  2. Workspace containment after resolution
 *  3. Blocked sensitive directory segments
 *  4. Blocked sensitive file patterns
 *
 * @param inputPath - User-supplied or LLM-supplied path (relative or absolute)
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns PathValidationResult with allowed flag, resolved path, and optional reason
 * @pure
 */
export function validatePath(inputPath: string, workspaceRoot: string): PathValidationResult {
  // Phase 1: detect traversal in raw input before resolution
  if (isTraversalAttempt(inputPath)) {
    const resolvedPath = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(workspaceRoot, inputPath);
    return {
      allowed: false,
      resolvedPath,
      reason: 'Path traversal attempt detected',
    };
  }

  // Phase 2: resolve to absolute and check workspace containment
  const resolvedPath = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workspaceRoot, inputPath);

  const normalizedRoot = path.resolve(workspaceRoot);
  const rel = path.relative(normalizedRoot, resolvedPath);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return {
      allowed: false,
      resolvedPath,
      reason: 'Path is outside workspace root',
    };
  }

  // Phase 3: check blocked directory segments using POSIX separators
  const posixResolved = resolvedPath.replace(/\\/g, '/');

  for (const blocked of BLOCKED_DIR_SEGMENTS) {
    const normalizedBlocked = blocked.replace(/\\/g, '/');
    // Match as a complete directory segment: /blocked/ or ends with /blocked
    if (
      posixResolved.includes('/' + normalizedBlocked + '/')
      || posixResolved.endsWith('/' + normalizedBlocked)
    ) {
      return {
        allowed: false,
        resolvedPath,
        reason: `Access to sensitive directory is blocked: ${blocked}`,
      };
    }
  }

  // Phase 4: check blocked file patterns against lowercased basename
  const lowerBasename = path.basename(resolvedPath).toLowerCase();

  for (const predicate of BLOCKED_FILE_PREDICATES) {
    if (predicate(lowerBasename)) {
      return {
        allowed: false,
        resolvedPath,
        reason: `Access to sensitive file pattern is blocked: ${path.basename(resolvedPath)}`,
      };
    }
  }

  return { allowed: true, resolvedPath };
}
