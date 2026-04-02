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

      const hasCliRuntime = agentx.hasCliRuntime();
      if (hasCliRuntime) {
        const terminal = vscode.window.createTerminal('AgentX Skill Scaffold');
        terminal.show();
        terminal.sendText(`cd "${root}"`);
        terminal.sendText('pwsh -NoProfile -Command "& ./.github/skills/development/skill-creator/scripts/init-skill.ps1"');
      } else {
        vscode.window.showInformationMessage(
          'Skill scaffolding requires the AgentX CLI runtime. Run "AgentX: Initialize Local Runtime" first.',
        );
      }
    }),
  );
}
