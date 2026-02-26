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
// Notification (integrated with VS Code UI)
// -----------------------------------------------------------------------

/** Global key used to suppress the prompt for a specific version. */
const DISMISSED_VERSION_KEY = 'agentx.dismissedUpdateVersion';

/**
 * Run the version check and, when an upgrade is available, show an
 * informational notification with an "Update Now" button that opens
 * the Setup Wizard.
 *
 * The prompt is suppressed when the user has dismissed it for the
 * current extension version, or when the `agentx.skipUpdateCheck`
 * setting is true.
 *
 * @param workspaceRoot  - Absolute path to the AgentX project root.
 * @param extensionVersion - The version string from `package.json`.
 * @param globalState    - VS Code `ExtensionContext.globalState` for
 *   persisting dismiss decisions across sessions.
 */
export async function promptIfUpdateAvailable(
  workspaceRoot: string,
  extensionVersion: string,
  globalState: vscode.Memento,
): Promise<void> {
  // Respect user opt-out
  const skip = vscode.workspace
    .getConfiguration('agentx')
    .get<boolean>('skipUpdateCheck', false);
  if (skip) { return; }

  const result = checkVersionMismatch(workspaceRoot, extensionVersion);
  if (!result.updateAvailable) { return; }

  // Check whether the user already dismissed this exact version
  const dismissed = globalState.get<string>(DISMISSED_VERSION_KEY);
  if (dismissed === extensionVersion) { return; }

  const updateNow = 'Update Now';
  const dismiss = 'Dismiss';

  const choice = await vscode.window.showInformationMessage(
    `AgentX framework v${result.installedVersion} is installed, ` +
    `but v${result.extensionVersion} is available. ` +
    `Update to get the latest agents, templates, and workflows.`,
    updateNow,
    dismiss,
  );

  if (choice === updateNow) {
    vscode.commands.executeCommand('agentx.initialize');
  } else if (choice === dismiss) {
    await globalState.update(DISMISSED_VERSION_KEY, extensionVersion);
  }
}
