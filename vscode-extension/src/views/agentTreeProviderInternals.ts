import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentXContext, AgentDefinition } from '../agentxContext';

interface SkillLink {
 readonly label: string;
 readonly relativePath: string;
}

const AGENT_SKILL_MAP: Record<string, SkillLink[]> = {
 'agent-x.agent.md': [
  { label: 'Code Review', relativePath: '.github/skills/development/code-review/SKILL.md' },
  { label: 'Iterative Loop', relativePath: '.github/skills/development/iterative-loop/SKILL.md' },
  { label: 'Error Handling', relativePath: '.github/skills/development/error-handling/SKILL.md' },
 ],
 'agile-coach.agent.md': [
  { label: 'Documentation', relativePath: '.github/skills/development/documentation/SKILL.md' },
  { label: 'UX/UI Design', relativePath: '.github/skills/design/ux-ui-design/SKILL.md' },
 ],
 'architect.agent.md': [
  { label: 'Core Principles', relativePath: '.github/skills/architecture/core-principles/SKILL.md' },
  { label: 'API Design', relativePath: '.github/skills/architecture/api-design/SKILL.md' },
  { label: 'Security', relativePath: '.github/skills/architecture/security/SKILL.md' },
 ],
 'consulting-research.agent.md': [
  { label: 'Documentation', relativePath: '.github/skills/development/documentation/SKILL.md' },
 ],
 'data-scientist.agent.md': [
  { label: 'AI Evaluation', relativePath: '.github/skills/ai-systems/ai-evaluation/SKILL.md' },
  { label: 'Feedback Loops', relativePath: '.github/skills/ai-systems/feedback-loops/SKILL.md' },
  { label: 'Data Drift', relativePath: '.github/skills/ai-systems/data-drift-strategy/SKILL.md' },
 ],
 'devops.agent.md': [
  { label: 'GitHub Actions', relativePath: '.github/skills/operations/github-actions-workflows/SKILL.md' },
  { label: 'YAML Pipelines', relativePath: '.github/skills/operations/yaml-pipelines/SKILL.md' },
  { label: 'Release Management', relativePath: '.github/skills/operations/release-management/SKILL.md' },
 ],
 'engineer.agent.md': [
  { label: 'Testing', relativePath: '.github/skills/development/testing/SKILL.md' },
  { label: 'Error Handling', relativePath: '.github/skills/development/error-handling/SKILL.md' },
  { label: 'Core Principles', relativePath: '.github/skills/architecture/core-principles/SKILL.md' },
  { label: 'Documentation', relativePath: '.github/skills/development/documentation/SKILL.md' },
 ],
 'powerbi-analyst.agent.md': [
  { label: 'Power BI', relativePath: '.github/skills/data/powerbi/SKILL.md' },
  { label: 'Fabric Analytics', relativePath: '.github/skills/data/fabric-analytics/SKILL.md' },
  { label: 'Documentation', relativePath: '.github/skills/development/documentation/SKILL.md' },
 ],
 'product-manager.agent.md': [
  { label: 'Documentation', relativePath: '.github/skills/development/documentation/SKILL.md' },
  { label: 'Context Management', relativePath: '.github/skills/ai-systems/context-management/SKILL.md' },
 ],
 'reviewer.agent.md': [
  { label: 'Code Review', relativePath: '.github/skills/development/code-review/SKILL.md' },
  { label: 'Security', relativePath: '.github/skills/architecture/security/SKILL.md' },
  { label: 'Testing', relativePath: '.github/skills/development/testing/SKILL.md' },
  { label: 'Core Principles', relativePath: '.github/skills/architecture/core-principles/SKILL.md' },
 ],
 'reviewer-auto.agent.md': [
  { label: 'Code Review', relativePath: '.github/skills/development/code-review/SKILL.md' },
  { label: 'Security', relativePath: '.github/skills/architecture/security/SKILL.md' },
  { label: 'Testing', relativePath: '.github/skills/development/testing/SKILL.md' },
 ],
 'tester.agent.md': [
  { label: 'Testing', relativePath: '.github/skills/development/testing/SKILL.md' },
  { label: 'Integration Testing', relativePath: '.github/skills/testing/integration-testing/SKILL.md' },
  { label: 'E2E Testing', relativePath: '.github/skills/testing/e2e-testing/SKILL.md' },
  { label: 'Production Readiness', relativePath: '.github/skills/testing/production-readiness/SKILL.md' },
 ],
 'ux-designer.agent.md': [
  { label: 'UX/UI Design', relativePath: '.github/skills/design/ux-ui-design/SKILL.md' },
  { label: 'Prototype Craft', relativePath: '.github/skills/design/prototype-craft/SKILL.md' },
  { label: 'Frontend UI', relativePath: '.github/skills/design/frontend-ui/SKILL.md' },
  { label: 'React', relativePath: '.github/skills/languages/react/SKILL.md' },
 ],
};

export class AgentTreeItem extends vscode.TreeItem {
 children?: AgentTreeItem[];

 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  public readonly agent?: AgentDefinition
 ) {
  super(label, collapsibleState);
 }

 static detail(iconId: string, text: string): AgentTreeItem {
  const item = new AgentTreeItem(text, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(iconId);
  return item;
 }
}

function resolveSkillPath(agentx: AgentXContext, relativePath: string): string | undefined {
 const root = agentx.workspaceRoot;
 const workspacePath = root ? path.join(root, relativePath) : '';
 const bundledRelative = relativePath.replace('.github/', '.github/agentx/');
 const bundledPath = path.join(agentx.extensionContext.extensionPath, bundledRelative);
 if (workspacePath && fs.existsSync(workspacePath)) {
  return workspacePath;
 }
 if (fs.existsSync(bundledPath)) {
  return bundledPath;
 }
 return undefined;
}

function resolveAgentFilePath(agentx: AgentXContext, fileName: string): string {
 const root = agentx.workspaceRoot;
 const workspacePath = root ? path.join(root, '.github', 'agents', fileName) : '';
 const workspaceInternalPath = root ? path.join(root, '.github', 'agents', 'internal', fileName) : '';
 const bundledPath = path.join(agentx.extensionContext.extensionPath, '.github', 'agentx', 'agents', fileName);
 const bundledInternalPath = path.join(agentx.extensionContext.extensionPath, '.github', 'agentx', 'agents', 'internal', fileName);

 if (workspacePath && fs.existsSync(workspacePath)) {
  return workspacePath;
 }
 if (workspaceInternalPath && fs.existsSync(workspaceInternalPath)) {
  return workspaceInternalPath;
 }
 if (fs.existsSync(bundledPath)) {
  return bundledPath;
 }
 return bundledInternalPath;
}

function createGroup(
 label: string,
 iconId: string,
 children: AgentTreeItem[],
): AgentTreeItem | undefined {
 if (children.length === 0) {
  return undefined;
 }

 const group = new AgentTreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
 group.iconPath = new vscode.ThemeIcon(iconId);
 group.children = children;
 return group;
}

function createBoundaryGroup(agent: AgentDefinition): AgentTreeItem | undefined {
 if (!agent.boundaries) {
  return undefined;
 }

 const children: AgentTreeItem[] = [];
 if (agent.boundaries.canModify.length > 0) {
  const canModify = new AgentTreeItem(
   `Can modify (${agent.boundaries.canModify.length})`,
   vscode.TreeItemCollapsibleState.Collapsed,
  );
  canModify.iconPath = new vscode.ThemeIcon('check');
  canModify.children = agent.boundaries.canModify.map((entry) => AgentTreeItem.detail('file', entry));
  children.push(canModify);
 }

 if (agent.boundaries.cannotModify.length > 0) {
  const cannotModify = new AgentTreeItem(
   `Cannot modify (${agent.boundaries.cannotModify.length})`,
   vscode.TreeItemCollapsibleState.Collapsed,
  );
  cannotModify.iconPath = new vscode.ThemeIcon('close');
  cannotModify.children = agent.boundaries.cannotModify.map((entry) => AgentTreeItem.detail('file', entry));
  children.push(cannotModify);
 }

 return createGroup('Boundaries', 'lock', children);
}

function createSkillGroup(agent: AgentDefinition, agentx: AgentXContext): AgentTreeItem | undefined {
 const recommendedSkills = AGENT_SKILL_MAP[agent.fileName] ?? [];
 const children = recommendedSkills
  .map((skill) => {
   const filePath = resolveSkillPath(agentx, skill.relativePath);
   if (!filePath) {
    return undefined;
   }

   const item = AgentTreeItem.detail('book', skill.label);
   item.description = skill.relativePath.replace('.github/skills/', '');
   item.tooltip = `Open ${skill.label} skill`;
   item.command = {
    command: 'vscode.open',
    title: 'Open Skill',
    arguments: [vscode.Uri.file(filePath)],
   };
   return item;
  })
  .filter((item): item is AgentTreeItem => !!item);

 return createGroup(`Suggested skills (${children.length})`, 'library', children);
}

function createAgentChildren(agent: AgentDefinition, agentx: AgentXContext): AgentTreeItem[] {
 const children: AgentTreeItem[] = [];
 const constraints = agent.constraints ?? [];
 const delegates = agent.agents ?? [];
 const tools = agent.tools ?? [];

 if (agent.description) {
  children.push(AgentTreeItem.detail('info', agent.description));
 }

 if (agent.model) {
  children.push(AgentTreeItem.detail('symbol-method', `Model: ${agent.model}`));
 }

 const constraintsGroup = createGroup(
    `Constraints (${constraints.length})`,
  'shield',
    constraints.map((entry) => AgentTreeItem.detail('circle-small', entry)),
 );
 if (constraintsGroup) {
  children.push(constraintsGroup);
 }

 const boundaryGroup = createBoundaryGroup(agent);
 if (boundaryGroup) {
  children.push(boundaryGroup);
 }

 const agentsGroup = createGroup(
    `Delegates to (${delegates.length})`,
  'organization',
    delegates.map((entry) => AgentTreeItem.detail('person', entry)),
 );
 if (agentsGroup) {
  children.push(agentsGroup);
 }

 const toolsGroup = createGroup(
    `Tools (${tools.length})`,
  'tools',
    tools.map((entry) => AgentTreeItem.detail('wrench', entry)),
 );
 if (toolsGroup) {
  children.push(toolsGroup);
 }

 const skillGroup = createSkillGroup(agent, agentx);
 if (skillGroup) {
  children.push(skillGroup);
 }

 return children;
}

export function createAgentTreeItem(agent: AgentDefinition, agentx: AgentXContext): AgentTreeItem {
 const label = agent.name || agent.fileName.replace('.agent.md', '');
 const item = new AgentTreeItem(label, vscode.TreeItemCollapsibleState.Collapsed, agent);

 if (agent.fileName) {
  item.command = {
   command: 'vscode.open',
   title: 'Open Agent Definition',
   arguments: [vscode.Uri.file(resolveAgentFilePath(agentx, agent.fileName))],
  };
 }

 item.tooltip = agent.description;
 item.contextValue = 'agent';
 item.iconPath = new vscode.ThemeIcon('circle-outline');
 item.children = createAgentChildren(agent, agentx);
 return item;
}