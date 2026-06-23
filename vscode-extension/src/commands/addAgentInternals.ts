import * as vscode from 'vscode';
import * as path from 'path';
import { AgentScaffoldDetails } from './scaffoldGeneration';

export type AgentDetails = AgentScaffoldDetails;

const MODEL_OPTIONS = [
  { label: 'Claude Opus 4.8 (copilot)', value: 'Claude Opus 4.8 (copilot)' },
  { label: 'Claude Opus 4 (copilot)', value: 'Claude Opus 4 (copilot)' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-5 (copilot)', value: 'GPT-5 (copilot)' },
  { label: 'o4-mini', value: 'o4-mini' },
];

const ROLE_OPTIONS = [
  { label: 'Engineer', description: 'Code implementation, tests, quality loop' },
  { label: 'Architect', description: 'ADRs, tech specs, design decisions' },
  { label: 'Reviewer', description: 'Code and architecture review' },
  { label: 'Product Manager', description: 'PRDs, backlog, product strategy' },
  { label: 'UX Designer', description: 'Wireframes, prototypes, accessibility' },
  { label: 'Researcher', description: 'Research, analysis, documentation' },
  { label: 'Analyst', description: 'Data analysis and reporting' },
  { label: 'DevOps', description: 'CI/CD, infrastructure, deployment' },
  { label: 'Tester', description: 'Test design, certification, QA' },
  { label: 'Data Scientist', description: 'ML pipelines, evals, drift monitoring' },
  { label: 'Custom', description: 'Define your own role' },
];

export async function promptAgentDetails(): Promise<AgentDetails | undefined> {
  const name = await vscode.window.showInputBox({
    prompt: 'Agent name (e.g., "Security Auditor")',
    placeHolder: 'My Custom Agent',
    validateInput: (v) => v.trim().length < 2 ? 'Name must be at least 2 characters' : undefined,
  });
  if (!name) { return undefined; }

  const id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const description = await vscode.window.showInputBox({
    prompt: 'Short description of what this agent does',
    placeHolder: 'Performs security audits and vulnerability assessments',
    validateInput: (v) => v.trim().length < 10 ? 'Description must be at least 10 characters' : undefined,
  });
  if (!description) { return undefined; }

  const rolePick = await vscode.window.showQuickPick(ROLE_OPTIONS, {
    placeHolder: 'Select the agent role',
    title: 'Agent Role',
  });
  if (!rolePick) { return undefined; }

  let role = rolePick.label;
  if (role === 'Custom') {
    const customRole = await vscode.window.showInputBox({
      prompt: 'Enter your custom role name',
      placeHolder: 'Domain Expert',
    });
    if (!customRole) { return undefined; }
    role = customRole;
  }

  const modelPick = await vscode.window.showQuickPick(MODEL_OPTIONS, {
    placeHolder: 'Select the LLM model',
    title: 'Agent Model',
  });
  if (!modelPick) { return undefined; }

  return {
    id,
    name: name.trim(),
    description: description.trim(),
    model: modelPick.value,
    role,
    constraints: [
      'Follow workspace coding standards',
      'Validate all outputs before delivery',
      `Operate within the ${role} domain`,
    ],
  };
}

export function resolveAgentOutputDir(root: string): string {
  return path.join(root, '.github', 'agents');
}
