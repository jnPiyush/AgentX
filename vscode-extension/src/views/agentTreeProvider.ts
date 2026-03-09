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

/**
 * Tree data provider for the Agents sidebar view.
 * Shows all agent definitions with their model and handoffs.
 */
export class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
 this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: AgentTreeItem): vscode.TreeItem {
 return element;
 }

 async getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]> {
 if (element) {
 // Child items: show details
 return element.children || [];
 }

 // Always show agents (bundled in extension), even without workspace init
  const agents = await this.agentx.listVisibleAgents();
 if (agents.length === 0) { return []; }
 return agents.map(a => this.createAgentItem(a));
 }

 private resolveSkillPath(relativePath: string): string | undefined {
  const root = this.agentx.workspaceRoot;
  const workspacePath = root ? path.join(root, relativePath) : '';
  const bundledRelative = relativePath.replace('.github/', '.github/agentx/');
  const bundledPath = path.join(this.agentx.extensionContext.extensionPath, bundledRelative);
  if (workspacePath && fs.existsSync(workspacePath)) {
   return workspacePath;
  }
  if (fs.existsSync(bundledPath)) {
   return bundledPath;
  }
  return undefined;
 }

 private createAgentItem(agent: AgentDefinition): AgentTreeItem {
 const label = agent.name || agent.fileName.replace('.agent.md', '');
 const item = new AgentTreeItem(
 label,
 vscode.TreeItemCollapsibleState.Collapsed,
 agent
 );

 // Build full file path for click-to-open (workspace first, then bundled; check internal/ too)
 if (agent.fileName) {
  const root = this.agentx.workspaceRoot;
  const wsPath = root ? path.join(root, '.github', 'agents', agent.fileName) : '';
  const wsInternalPath = root ? path.join(root, '.github', 'agents', 'internal', agent.fileName) : '';
  const bundledPath = path.join(this.agentx.extensionContext.extensionPath, '.github', 'agentx', 'agents', agent.fileName);
  const bundledInternalPath = path.join(this.agentx.extensionContext.extensionPath, '.github', 'agentx', 'agents', 'internal', agent.fileName);
  const filePath = (wsPath && fs.existsSync(wsPath)) ? wsPath
  : (wsInternalPath && fs.existsSync(wsInternalPath)) ? wsInternalPath
  : fs.existsSync(bundledPath) ? bundledPath
  : bundledInternalPath;
  item.command = {
  command: 'vscode.open',
  title: 'Open Agent Definition',
  arguments: [vscode.Uri.file(filePath)],
  };
 }

 item.tooltip = agent.description;
 item.contextValue = 'agent';
 item.iconPath = new vscode.ThemeIcon('circle-outline');

 // Children with details
 const children: AgentTreeItem[] = [];

 // Description
 if (agent.description) {
 children.push(AgentTreeItem.detail('info', agent.description));
 }

 // Model
 if (agent.model) {
 children.push(AgentTreeItem.detail('symbol-method', `Model: ${agent.model}`));
 }

 // Constraints
 if (agent.constraints && agent.constraints.length > 0) {
 const constraintGroup = new AgentTreeItem(
  `Constraints (${agent.constraints.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 constraintGroup.iconPath = new vscode.ThemeIcon('shield');
 constraintGroup.children = agent.constraints.map(c => AgentTreeItem.detail('circle-small', c));
 children.push(constraintGroup);
 }

 // Boundaries
 if (agent.boundaries) {
 const boundaryGroup = new AgentTreeItem(
  'Boundaries',
  vscode.TreeItemCollapsibleState.Collapsed
 );
 boundaryGroup.iconPath = new vscode.ThemeIcon('lock');
 const bChildren: AgentTreeItem[] = [];
 if (agent.boundaries.canModify.length > 0) {
  const canMod = new AgentTreeItem(`Can modify (${agent.boundaries.canModify.length})`, vscode.TreeItemCollapsibleState.Collapsed);
  canMod.iconPath = new vscode.ThemeIcon('check');
  canMod.children = agent.boundaries.canModify.map(p => AgentTreeItem.detail('file', p));
  bChildren.push(canMod);
 }
 if (agent.boundaries.cannotModify.length > 0) {
  const cannotMod = new AgentTreeItem(`Cannot modify (${agent.boundaries.cannotModify.length})`, vscode.TreeItemCollapsibleState.Collapsed);
  cannotMod.iconPath = new vscode.ThemeIcon('close');
  cannotMod.children = agent.boundaries.cannotModify.map(p => AgentTreeItem.detail('file', p));
  bChildren.push(cannotMod);
 }
 boundaryGroup.children = bChildren;
 children.push(boundaryGroup);
 }

 // Agents (delegation scope)
 if (agent.agents && agent.agents.length > 0) {
 const agentsGroup = new AgentTreeItem(
  `Delegates to (${agent.agents.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 agentsGroup.iconPath = new vscode.ThemeIcon('organization');
 agentsGroup.children = agent.agents.map(a => AgentTreeItem.detail('person', a));
 children.push(agentsGroup);
 }

 // Handoffs
 if (agent.handoffs && agent.handoffs.length > 0) {
 const handoffGroup = new AgentTreeItem(
  `Handoffs (${agent.handoffs.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 handoffGroup.iconPath = new vscode.ThemeIcon('arrow-right');
 handoffGroup.children = agent.handoffs.map(h =>
  AgentTreeItem.detail('arrow-right', `${h.label} -> ${h.agent}`)
 );
 children.push(handoffGroup);
 }

 // Tools
 if (agent.tools && agent.tools.length > 0) {
 const toolGroup = new AgentTreeItem(
  `Tools (${agent.tools.length})`,
  vscode.TreeItemCollapsibleState.Collapsed
 );
 toolGroup.iconPath = new vscode.ThemeIcon('tools');
 toolGroup.children = agent.tools.map(t => AgentTreeItem.detail('wrench', t));
 children.push(toolGroup);
 }

 const recommendedSkills = AGENT_SKILL_MAP[agent.fileName] ?? [];
 if (recommendedSkills.length > 0) {
  const skillGroup = new AgentTreeItem(
   `Suggested skills (${recommendedSkills.length})`,
   vscode.TreeItemCollapsibleState.Collapsed
  );
  skillGroup.iconPath = new vscode.ThemeIcon('library');
  skillGroup.children = recommendedSkills
   .map((skill) => {
    const filePath = this.resolveSkillPath(skill.relativePath);
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
  if (skillGroup.children.length > 0) {
   children.push(skillGroup);
  }
 }

 item.children = children;

 return item;
 }

}

export class AgentTreeItem extends vscode.TreeItem {
 children?: AgentTreeItem[];

 constructor(
 public readonly label: string,
 public readonly collapsibleState: vscode.TreeItemCollapsibleState,
 public readonly agent?: AgentDefinition
 ) {
 super(label, collapsibleState);
 }

 /**
  * Create a non-collapsible detail child item with an icon.
  */
 static detail(iconId: string, text: string): AgentTreeItem {
 const item = new AgentTreeItem(text, vscode.TreeItemCollapsibleState.None);
 item.iconPath = new vscode.ThemeIcon(iconId);
 return item;
 }
}
