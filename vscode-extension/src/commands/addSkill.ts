import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

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

      // Scaffold a custom skill
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Open a workspace to scaffold a skill.');
        return;
      }

      // Prefer workspace-local scaffold script; fall back to the bundled copy inside the extension.
      const workspaceScript = path.join(root, '.github', 'skills', 'development', 'skill-creator', 'scripts', 'init-skill.ps1');
      const bundledScript = path.join(context.extensionUri.fsPath, '.github', 'agentx', 'skills', 'development', 'skill-creator', 'scripts', 'init-skill.ps1');
      const scriptPath = fs.existsSync(workspaceScript) ? workspaceScript : bundledScript;

      const terminal = vscode.window.createTerminal('AgentX Add Skill');
      terminal.show();
      terminal.sendText(`cd "${root}"`);
      terminal.sendText(`pwsh -NoProfile -File "${scriptPath}"`);
    }),
  );
}
