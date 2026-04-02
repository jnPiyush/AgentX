import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import {
  generateAgentContent,
  promptAgentDetails,
  resolveAgentOutputDir,
} from './hireAgentInternals';

export function registerHireAgentCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.hireAgent', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Open a workspace to hire an agent.');
        return;
      }

      const details = await promptAgentDetails();
      if (!details) { return; }

      const outputDir = resolveAgentOutputDir(root);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const fileName = `${details.id}.agent.md`;
      const filePath = path.join(outputDir, fileName);

      if (fs.existsSync(filePath)) {
        const overwrite = await vscode.window.showWarningMessage(
          `Agent "${details.id}" already exists. Overwrite?`,
          'Overwrite',
          'Cancel',
        );
        if (overwrite !== 'Overwrite') { return; }
      }

      const content = generateAgentContent(details);
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to write agent file: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(`Agent "${details.name}" hired at ${fileName}`);
      await vscode.commands.executeCommand('agentx.refresh');
    }),
  );
}
