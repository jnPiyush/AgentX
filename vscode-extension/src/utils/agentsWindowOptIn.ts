import * as vscode from 'vscode';

/**
 * Runtime opt-in for the VS Code Agents Window (Preview).
 *
 * Background: `extensions.supportAgentsWindow` is a user-side `settings.json`
 * setting (an object map keyed by extension id), not an author-side package.json
 * field. See:
 *   https://code.visualstudio.com/docs/copilot/agents/agents-window#_use-an-extension-as-an-agent
 *
 * Strategy (CONTRACT-400-agents-window-slice2, Option A2):
 *   - On every activation, check whether `jnPiyush.agentx` is already opted in.
 *   - If not, AND the user has not permanently declined, AND we have not
 *     already prompted in this major version, show a one-time information
 *     message with: Enable / Not now / Don't ask again.
 *   - On Enable: merge `{ "jnPiyush.agentx": true }` into the existing object
 *     (preserving every other entry verbatim) and offer a window reload.
 *   - On Don't ask again: persist a permanent decline in `globalState`.
 *   - On any prompt outcome (including dismissal): record the major version
 *     so we only re-prompt on a major bump.
 *
 * This mirrors the existing companion-extension prompt pattern used for the
 * Azure MCP Extension in `companionExtensions.ts`.
 */

const EXTENSION_ID = 'jnPiyush.agentx';
const STATE_KEY_DECLINED = 'agentx.agentsWindowOptIn.permanentlyDeclined';
const STATE_KEY_LAST_PROMPTED_MAJOR = 'agentx.agentsWindowOptIn.lastPromptedMajor';

/**
 * Read the AgentX entry from `extensions.supportAgentsWindow`. Returns the raw
 * object so callers can detect both "missing" and "explicitly false".
 */
function readSupportMap(): Record<string, boolean> {
  const config = vscode.workspace.getConfiguration('extensions');
  const value = config.get<Record<string, boolean>>('supportAgentsWindow');
  return value && typeof value === 'object' ? value : {};
}

/**
 * Idempotent merge: set `jnPiyush.agentx: true` in the global
 * `extensions.supportAgentsWindow` map without overwriting other entries.
 * Used by both the prompt's Enable action and the manual command.
 */
export async function enableInAgentsWindow(): Promise<void> {
  const config = vscode.workspace.getConfiguration('extensions');
  const current = readSupportMap();
  const next: Record<string, boolean> = { ...current, [EXTENSION_ID]: true };
  await config.update('supportAgentsWindow', next, vscode.ConfigurationTarget.Global);
}

/**
 * One-time prompt offering to enable AgentX in the Agents Window. Safe to call
 * unconditionally on every activation; this function self-gates on
 * `globalState` and on the major-version bump rule.
 *
 * `currentVersion` should be the extension's full semver string (e.g. from
 * `context.extension.packageJSON.version`). Only the major component is used.
 *
 * This function never throws -- any unexpected failure is swallowed so that a
 * UX nicety never blocks activation.
 */
export async function maybePromptForAgentsWindow(
  context: vscode.ExtensionContext,
  currentVersion: string,
): Promise<void> {
  try {
    if (context.globalState.get<boolean>(STATE_KEY_DECLINED) === true) {
      return;
    }

    const support = readSupportMap();
    if (support[EXTENSION_ID] === true) {
      return;
    }

    const currentMajor = String(currentVersion).split('.')[0] || '0';
    const lastPromptedMajor = context.globalState.get<string>(STATE_KEY_LAST_PROMPTED_MAJOR);
    if (lastPromptedMajor === currentMajor) {
      return;
    }

    const enable = 'Enable in Agents Window';
    const notNow = 'Not now';
    const never = "Don't ask again";

    // Record the prompt-major BEFORE awaiting the user. If two activations
    // race against the same globalState, only one of them will pass the
    // `lastPromptedMajor === currentMajor` gate and show a prompt; the other
    // will short-circuit on its next read. Doing this after the await would
    // let both invocations show duplicate prompts.
    await context.globalState.update(STATE_KEY_LAST_PROMPTED_MAJOR, currentMajor);

    const choice = await vscode.window.showInformationMessage(
      'AgentX can run inside the new VS Code Agents Window. Enable it for this user (you can change this any time in Settings)?',
      enable,
      notNow,
      never,
    );

    if (choice === enable) {
      await enableInAgentsWindow();
      const reload = 'Reload Window';
      const later = 'Later';
      const reloadChoice = await vscode.window.showInformationMessage(
        'AgentX is now enabled in the Agents Window. Reload the window to apply?',
        reload,
        later,
      );
      if (reloadChoice === reload) {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } else if (choice === never) {
      await context.globalState.update(STATE_KEY_DECLINED, true);
    }
  } catch {
    // Non-fatal: never block activation on a UX nicety.
  }
}

// Exported for tests.
export const __internals = {
  EXTENSION_ID,
  STATE_KEY_DECLINED,
  STATE_KEY_LAST_PROMPTED_MAJOR,
};
