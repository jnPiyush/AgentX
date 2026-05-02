import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { promptAgentDetails, resolveAgentOutputDir } from './addAgentInternals';
import { generateAgentContent } from './scaffoldGeneration';

export function registerAddAgentCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.addAgent', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Open a workspace to add an agent.');
        return;
      }

      const details = await promptAgentDetails();
      if (!details) { return; }

      const outputDir = resolveAgentOutputDir(root);
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to create agents directory: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }

      const targetPath = path.join(outputDir, `${details.id}.agent.md`);
      if (fs.existsSync(targetPath)) {
        vscode.window.showWarningMessage(
          `Agent '${details.id}' already exists at ${path.relative(root, targetPath)}.`,
        );
        return;
      }

      const content = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generating agent definition for ${details.name}...`,
          cancellable: true,
        },
        async (_progress, token) => generateAgentContent(details, token),
      );

      try {
        fs.writeFileSync(targetPath, content, 'utf8');
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to write agent file: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }

      const doc = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        `Agent '${details.name}' created at ${path.relative(root, targetPath)}.`,
      );
    }),
  );
}
