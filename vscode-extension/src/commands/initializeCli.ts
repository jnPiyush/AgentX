import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  COPILOT_CLI_ASSET_DIRS,
  CliAssetMode,
  appendCliSymlinksToGitignore,
  copyCopilotCliAssets,
  createCopilotCliSymlinks,
  promptWorkspaceRoot,
  writeCliAssetState,
} from './initializeInternals';

/**
 * AgentX: Initialize CLI
 *
 * Makes AgentX agent, skill, instruction, prompt, template, and schema
 * trees discoverable from the workspace `.github/` folder for non-VS-Code
 * surfaces (notably GitHub Copilot CLI). Two modes:
 *
 *  - copy (default, safest, team-friendly):
 *    Copies bundled assets into `.github/` so they can be committed and
 *    shared with teammates. Skip-existing semantics preserve user overrides.
 *
 *  - symlink (zero-copy, single-user):
 *    Creates directory junctions (Windows) or symlinks (macOS/Linux) under
 *    `.github/` pointing at the installed extension bundle. Always current,
 *    near-zero disk cost. The symlink destinations are added to .gitignore.
 *    Refreshed automatically on extension activation if the bundle moves.
 *
 * VS Code chat, commands, and the AgentX runtime resolve assets from the
 * extension bundle directly and do NOT need either mode.
 */
export async function runInitializeCliCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): Promise<void> {
  const root = await promptWorkspaceRoot('AgentX - Initialize CLI');
  if (!root) {
    return;
  }

  const runtimeInitialized = fs.existsSync(path.join(root, '.agentx', 'config.json'));
  if (!runtimeInitialized) {
    const choice = await vscode.window.showWarningMessage(
      'AgentX local runtime is not initialized in this workspace. Run "Initialize Local Runtime" first?',
      'Initialize Local Runtime',
      'Cancel',
    );
    if (choice !== 'Initialize Local Runtime') {
      return;
    }
    await vscode.commands.executeCommand('agentx.initializeLocalRuntime');
    if (!fs.existsSync(path.join(root, '.agentx', 'config.json'))) {
      return;
    }
  }

  const configuredMode = vscode.workspace
    .getConfiguration('agentx')
    .get<CliAssetMode>('cliAssetMode', 'copy');

  // Confirm mode -- gives the user a chance to switch from the default.
  const modePick = await vscode.window.showQuickPick(
    [
      {
        label: 'Copy',
        description: 'Copy bundled assets into .github/ (team-friendly, committable)',
        value: 'copy' as CliAssetMode,
      },
      {
        label: 'Symlink',
        description: 'Junction/symlink .github/ entries into the extension bundle (zero-copy)',
        value: 'symlink' as CliAssetMode,
      },
    ],
    {
      placeHolder: `Choose CLI asset mode (default: ${configuredMode})`,
      ignoreFocusOut: true,
    },
  );
  if (!modePick) {
    return;
  }
  const mode = modePick.value;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `AgentX: Seeding repo-local CLI assets (${mode})...`,
      cancellable: false,
    },
    async (progress) => {
      try {
        if (mode === 'symlink') {
          progress.report({ message: 'Creating symlinks into extension bundle...', increment: 70 });
          const result = createCopilotCliSymlinks(context.extensionUri.fsPath, root);
          progress.report({ message: 'Updating .gitignore...', increment: 20 });
          appendCliSymlinksToGitignore(root);
          writeCliAssetState(root, {
            mode: 'symlink',
            extensionRoot: context.extensionUri.fsPath,
            destinations: COPILOT_CLI_ASSET_DIRS.map((a) => a.destination),
            updatedAt: new Date().toISOString(),
          });
          progress.report({ message: 'Finalizing...', increment: 10 });
          agentx.invalidateCache();

          const summary = [
            result.linked.length > 0 ? `Linked: ${result.linked.join(', ')}` : '',
            result.refreshed.length > 0 ? `Refreshed: ${result.refreshed.join(', ')}` : '',
            result.skipped.length > 0 ? `Skipped (already exists): ${result.skipped.join(', ')}` : '',
          ].filter(Boolean).join('; ');
          vscode.window.showInformationMessage(
            `AgentX: CLI assets symlinked into .github/. ${summary}`,
          );
          return;
        }

        progress.report({ message: 'Copying agents, skills, instructions, prompts, templates, schemas...', increment: 80 });
        const created: string[] = [];
        const existing: string[] = [];
        for (const entry of COPILOT_CLI_ASSET_DIRS) {
          const dest = path.join(root, entry.destination);
          (fs.existsSync(dest) ? existing : created).push(entry.destination);
        }
        copyCopilotCliAssets(context.extensionUri.fsPath, root, false);
        writeCliAssetState(root, {
          mode: 'copy',
          extensionRoot: context.extensionUri.fsPath,
          destinations: COPILOT_CLI_ASSET_DIRS.map((a) => a.destination),
          updatedAt: new Date().toISOString(),
        });
        progress.report({ message: 'Finalizing...', increment: 20 });
        agentx.invalidateCache();

        const summary = [
          created.length > 0 ? `Added: ${created.join(', ')}` : '',
          existing.length > 0 ? `Preserved existing: ${existing.join(', ')}` : '',
        ].filter(Boolean).join('; ');
        vscode.window.showInformationMessage(
          `AgentX: CLI assets copied into .github/. ${summary}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`AgentX: Initialize CLI failed: ${message}`);
      }
    },
  );
}

/**
 * Register the AgentX: Initialize CLI command.
 */
export function registerInitializeCliCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  const cmd = vscode.commands.registerCommand('agentx.initializeCli', async () => {
    await runInitializeCliCommand(context, agentx);
  });
  context.subscriptions.push(cmd);
}
