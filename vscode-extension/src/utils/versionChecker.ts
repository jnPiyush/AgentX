import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

/** Shape of .agentx/version.json written by the installer / wizard. */
export interface InstalledVersionInfo {
  version: string;
  mode: string;
  installedAt: string;
  updatedAt: string;
}

/** Result of a version comparison check. */
export interface VersionCheckResult {
  /** True when the installed framework is older than the extension. */
  updateAvailable: boolean;
  /** Installed framework version (empty string if not found). */
  installedVersion: string;
  /** Version bundled with the current extension. */
  extensionVersion: string;
}

// -----------------------------------------------------------------------
// Semver helpers (lightweight - avoids external dependency)
// -----------------------------------------------------------------------

/** Parse "major.minor.patch" into a numeric triple. Returns [0,0,0] on failure. */
function parseSemver(version: string): [number, number, number] {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) { return [0, 0, 0]; }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compare two semver strings.
 * Returns  1 when a > b,
 *         -1 when a < b,
 *          0 when equal.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const [aMaj, aMin, aPat] = parseSemver(a);
  const [bMaj, bMin, bPat] = parseSemver(b);

  if (aMaj !== bMaj) { return aMaj > bMaj ? 1 : -1; }
  if (aMin !== bMin) { return aMin > bMin ? 1 : -1; }
  if (aPat !== bPat) { return aPat > bPat ? 1 : -1; }
  return 0;
}

// -----------------------------------------------------------------------
// Core check
// -----------------------------------------------------------------------

/**
 * Read the installed framework version from `.agentx/version.json`
 * in the given workspace root. Returns undefined when the file is
 * missing or unreadable.
 */
export function readInstalledVersion(
  workspaceRoot: string,
): InstalledVersionInfo | undefined {
  const versionFile = path.join(workspaceRoot, '.agentx', 'version.json');
  if (!fs.existsSync(versionFile)) { return undefined; }
  try {
    const raw = fs.readFileSync(versionFile, 'utf-8');
    const data = JSON.parse(raw) as Partial<InstalledVersionInfo>;
    if (!data.version) { return undefined; }
    return data as InstalledVersionInfo;
  } catch {
    return undefined;
  }
}

/**
 * Compare the extension version (from `package.json`) against the
 * installed framework version. Returns a result describing whether
 * an update is available.
 */
export function checkVersionMismatch(
  workspaceRoot: string,
  extensionVersion: string,
): VersionCheckResult {
  const installed = readInstalledVersion(workspaceRoot);
  const installedVersion = installed?.version ?? '';

  if (!installedVersion) {
    // No version file - treat as not installed (no update prompt).
    return { updateAvailable: false, installedVersion: '', extensionVersion };
  }

  const cmp = compareSemver(extensionVersion, installedVersion);
  return {
    updateAvailable: cmp > 0,
    installedVersion,
    extensionVersion,
  };
}

// -----------------------------------------------------------------------
// Silent version sync (replaces notification-based prompt)
// -----------------------------------------------------------------------

/**
 * Silently sync the workspace version.json to match the extension version.
 *
 * When the extension version is newer than the installed framework version,
 * this updates version.json directly -- no user prompt, no download from
 * GitHub, no heavy re-initialization. The bundled agents, instructions,
 * skills, and templates are always read from the extension bundle, so the
 * only thing that needs updating is the version stamp.
 *
 * @param workspaceRoot    - Absolute path to the workspace root.
 * @param extensionVersion - The version string from `package.json`.
 * @param extensionPath    - Absolute path to the extension install directory.
 */
export async function silentVersionSync(
  workspaceRoot: string,
  extensionVersion: string,
  extensionPath: string,
): Promise<void> {
  if (!workspaceRoot) { return; }

  const result = checkVersionMismatch(workspaceRoot, extensionVersion);
  if (!result.updateAvailable) { return; }

  // Update version.json silently
  const versionFile = path.join(workspaceRoot, '.agentx', 'version.json');
  const versionDir = path.join(workspaceRoot, '.agentx');

  if (!fs.existsSync(versionDir)) { return; } // No .agentx/ dir = not initialized

  try {
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(versionFile)) {
      existing = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
    }
    existing.version = extensionVersion;
    existing.updatedAt = new Date().toISOString();
    fs.writeFileSync(versionFile, JSON.stringify(existing, null, 2));
    console.log(`AgentX: Synced workspace version to ${extensionVersion}`);
  } catch {
    // Best-effort -- don't block activation
  }
}
