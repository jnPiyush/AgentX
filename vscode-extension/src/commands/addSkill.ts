import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { promptSkillDetails, resolveSkillOutputDir } from './addSkillInternals';
import { generateSkillContent } from './scaffoldGeneration';

export function registerAddSkillCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.addSkill', async () => {
      const choices = [
        { label: 'Install from Plugin Registry', description: 'Browse and install skills from the AgentX registry', value: 'registry' },
        { label: 'Scaffold Custom Skill', description: 'Create a new skill from template', value: 'scaffold' },
      ];

      const pick = await vscode.window.showQuickPick(choices, {
        placeHolder: 'How would you like to add a skill?',
        title: 'AgentX: Add Skill',
      });
      if (!pick) { return; }

      if (pick.value === 'registry') {
        await vscode.commands.executeCommand('agentx.addPlugin');
        return;
      }

      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Open a workspace to scaffold a skill.');
        return;
      }

      const details = await promptSkillDetails();
      if (!details) { return; }

      const outputDir = resolveSkillOutputDir(root, details.category, details.slug);
      if (fs.existsSync(outputDir)) {
        vscode.window.showWarningMessage(
          `Skill '${details.slug}' already exists at ${path.relative(root, outputDir)}.`,
        );
        return;
      }

      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to create skill directory: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }

      const content = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generating SKILL.md for ${details.name}...`,
          cancellable: true,
        },
        async (_progress, token) => generateSkillContent(details, token),
      );

      const targetPath = path.join(outputDir, 'SKILL.md');
      try {
        fs.writeFileSync(targetPath, content, 'utf8');
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to write SKILL.md: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }

      // Scaffold canonical skill substructure (per Skills.md): scripts/, references/, assets/
      // with .gitkeep placeholders so the layout is discoverable immediately.
      for (const sub of ['scripts', 'references', 'assets']) {
        try {
          const subDir = path.join(outputDir, sub);
          fs.mkdirSync(subDir, { recursive: true });
          fs.writeFileSync(path.join(subDir, '.gitkeep'), '', 'utf8');
        } catch {
          // non-fatal: SKILL.md is the deliverable; subdirs are conveniences
        }
      }

      const doc = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        `Skill '${details.name}' created at ${path.relative(root, targetPath)}.`,
      );
    }),
  );
}
