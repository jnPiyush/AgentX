import * as path from 'path';
import * as vscode from 'vscode';
import { SkillScaffoldDetails } from './scaffoldGeneration';

const CATEGORY_OPTIONS = [
  'ai-systems',
  'architecture',
  'cloud',
  'design',
  'development',
  'operations',
];

export async function promptSkillDetails(): Promise<SkillScaffoldDetails | undefined> {
  const name = await vscode.window.showInputBox({
    prompt: 'Skill name (e.g., "Contract Review Assistant")',
    placeHolder: 'My Custom Skill',
    validateInput: (value) => value.trim().length < 2 ? 'Name must be at least 2 characters' : undefined,
  });
  if (!name) {
    return undefined;
  }

  const category = await vscode.window.showQuickPick(CATEGORY_OPTIONS.map((label) => ({ label })), {
    placeHolder: 'Select the skill category',
    title: 'Skill Category',
  });
  if (!category) {
    return undefined;
  }

  const description = await vscode.window.showInputBox({
    prompt: 'Describe what this skill should help with',
    placeHolder: 'Guides contract review workflows, risk identification, and clause comparison',
    validateInput: (value) => value.trim().length < 10 ? 'Description must be at least 10 characters' : undefined,
  });
  if (!description) {
    return undefined;
  }

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[+]+/g, 'plus')
    .replace(/[#]+/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug)) {
    void vscode.window.showErrorMessage(`Could not derive a valid skill slug from "${name}".`);
    return undefined;
  }

  return {
    name: name.trim(),
    slug,
    category: category.label,
    description: description.trim(),
  };
}

export function resolveSkillOutputDir(root: string, category: string, slug: string): string {
  return path.join(root, '.github', 'skills', category, slug);
}