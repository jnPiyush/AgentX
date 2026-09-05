import * as vscode from 'vscode';

/**
 * Runtime host-capability diagnostic.
 *
 * AgentX delivers its value through the `chatAgents`, `chatSkills`,
 * `chatInstructions` and `chatPromptFiles` contribution points. A host that
 * predates those points ignores all of them **silently**: the user sees the
 * tree views and the chat participant but none of the 26 agents or 134 skills,
 * with no error anywhere.
 *
 * `engines.vscode` is the primary guard -- the Marketplace refuses to install
 * into an older host. This probe is defence in depth for the paths that bypass
 * it (side-loaded VSIX, pre-release channels, remote hosts reporting an older
 * API surface) and turns a silent failure into a single actionable warning.
 */

const STATE_KEY_LAST_WARNED = 'agentx.hostCapability.lastWarnedVersion';

/** Minimum VS Code version that implements the AgentX agent surface. */
export const MINIMUM_HOST_VERSION = '1.134.0';

/**
 * Compare two dotted version strings. Returns a negative number when `a` is
 * older than `b`, zero when equal, positive when newer. Non-numeric suffixes
 * (for example `-insider`) are ignored.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string): number[] =>
    String(value)
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) { return diff; }
  }
  return 0;
}

/** True when the host is older than the version AgentX requires. */
export function isHostBelowMinimum(hostVersion: string, minimum = MINIMUM_HOST_VERSION): boolean {
  return compareVersions(hostVersion, minimum) < 0;
}

export function buildUnsupportedHostMessage(hostVersion: string): string {
  return (
    `AgentX requires VS Code ${MINIMUM_HOST_VERSION} or newer, but this host reports ${hostVersion}. ` +
    'The AgentX agents, skills and instructions are not registered on this version. ' +
    'Update VS Code, or use the GitHub Copilot CLI distribution instead.'
  );
}

/**
 * Warn once per host version when the running host cannot register the AgentX
 * contribution points. Never throws: a diagnostic must not break activation.
 */
export async function warnIfHostUnsupported(
  context: vscode.ExtensionContext,
  hostVersion: string = vscode.version,
): Promise<boolean> {
  try {
    if (!isHostBelowMinimum(hostVersion)) { return false; }

    const lastWarned = context.globalState.get<string>(STATE_KEY_LAST_WARNED);
    if (lastWarned === hostVersion) { return false; }

    await context.globalState.update(STATE_KEY_LAST_WARNED, hostVersion);
    void vscode.window.showWarningMessage(buildUnsupportedHostMessage(hostVersion));
    return true;
  } catch {
    return false;
  }
}
