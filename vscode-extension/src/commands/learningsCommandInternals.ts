import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import {
 LearningsIntent,
 getLearningCaptureTarget,
 getDefaultLearningsQuery,
 rankLearnings,
 renderBrainstormGuidanceMarkdown,
 renderCompoundLoopMarkdown,
 renderCaptureGuidanceMarkdown,
 renderRankedLearningsText,
} from '../utils/learnings';
import {
 evaluateWorkflowGuidance,
 fetchProviderAwareIssues,
 renderOperatorEnablementChecklistMarkdown,
 renderWorkflowEntryPointMarkdown,
 renderWorkflowGuidanceMarkdown,
 renderWorkflowRolloutScorecardMarkdown,
} from '../utils/workflowGuidance';

let learningsChannel: vscode.OutputChannel | undefined;

export function getLearningsChannel(): vscode.OutputChannel {
 if (!learningsChannel) {
  learningsChannel = vscode.window.createOutputChannel('AgentX Learnings');
 }
 return learningsChannel;
}

export async function showRankedLearnings(
 agentx: AgentXContext,
 intent: LearningsIntent,
 query?: string,
): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to show learnings.');
  return;
 }

 const resolvedQuery = (query ?? getDefaultLearningsQuery(root, intent)).trim();
 const results = rankLearnings(root, intent, resolvedQuery);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderRankedLearningsText(intent, results, resolvedQuery));
 channel.show(true);
}

export async function showCaptureGuidance(agentx: AgentXContext): Promise<void> {
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderCaptureGuidanceMarkdown(agentx.workspaceRoot));
 channel.show(true);
}

export async function showBrainstorm(agentx: AgentXContext, query?: string): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to brainstorm.');
  return;
 }

 const resolvedQuery = (query ?? getDefaultLearningsQuery(root, 'planning')).trim();
 const results = rankLearnings(root, 'planning', resolvedQuery);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderBrainstormGuidanceMarkdown(root, resolvedQuery, results));
 channel.show(true);
}

export async function showCompoundLoop(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to show the compound loop.');
  return;
 }

 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderCompoundLoopMarkdown(root));
 channel.show(true);
}

export async function showWorkflowNextStep(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to resolve the next workflow step.');
  return;
 }

 const issues = await fetchProviderAwareIssues((sub, args) => agentx.runCli(sub, args), root);
 const snapshot = evaluateWorkflowGuidance(root, !!(await agentx.getPendingClarification?.()), issues);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderWorkflowGuidanceMarkdown(snapshot));
 channel.show(true);
}

export async function showWorkflowRolloutScorecard(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to show the workflow rollout scorecard.');
  return;
 }

 const issues = await fetchProviderAwareIssues((sub, args) => agentx.runCli(sub, args), root);
 const snapshot = evaluateWorkflowGuidance(root, !!(await agentx.getPendingClarification?.()), issues);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderWorkflowRolloutScorecardMarkdown(snapshot));
 channel.show(true);
}

export async function showOperatorEnablementChecklist(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to show the operator enablement checklist.');
  return;
 }

 const issues = await fetchProviderAwareIssues((sub, args) => agentx.runCli(sub, args), root);
 const snapshot = evaluateWorkflowGuidance(root, !!(await agentx.getPendingClarification?.()), issues);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderOperatorEnablementChecklistMarkdown(snapshot));
 channel.show(true);
}

export async function launchPlanDeepening(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to prepare plan deepening.');
  return;
 }

 const issues = await fetchProviderAwareIssues((sub, args) => agentx.runCli(sub, args), root);
 const snapshot = evaluateWorkflowGuidance(root, !!(await agentx.getPendingClarification?.()), issues);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderWorkflowEntryPointMarkdown(snapshot, 'plan-deepening'));
 channel.show(true);
}

export async function launchReviewKickoff(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to prepare review kickoff.');
  return;
 }

 const issues = await fetchProviderAwareIssues((sub, args) => agentx.runCli(sub, args), root);
 const snapshot = evaluateWorkflowGuidance(root, !!(await agentx.getPendingClarification?.()), issues);
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(renderWorkflowEntryPointMarkdown(snapshot, 'review-kickoff'));
 channel.show(true);
}

function toSlug(value: string): string {
 return value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);
}

export function buildLearningTemplate(
 issueNumber: number,
 title: string,
 planPath?: string,
): string {
 const keywords = ['compound capture', 'review', 'reuse'];
 const slug = toSlug(title);
 if (slug) {
  keywords.push(slug.replace(/-/g, ' '));
 }

 const sources = ['docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md'];
 if (planPath) {
  sources.push(planPath);
 }

 return [
  '---',
  `id: LEARNING-${issueNumber}`,
  `title: ${title}`,
  'category: workflow-contract',
  'subcategory: compound-capture',
  'phases: review,capture',
  'validation: draft',
  'evidence: medium',
  'mode: shared',
  `keywords: ${keywords.join(',')}`,
  `sources: ${sources.join(',')}`,
  '---',
  '',
  '## Summary',
  '',
  '{Summarize the solved problem and why it should compound future work.}',
  '',
  '## Guidance',
  '',
  '- {What should future agents or operators do?}',
  '- {What evidence made this learning trustworthy?}',
  '',
  '## Use When',
  '',
  '- {When should this learning be surfaced?}',
  '',
  '## Avoid',
  '',
  '- {What anti-pattern, weak inference, or duplicate capture should be avoided?}',
  '',
 ].join('\n');
}

export async function createLearningCapture(agentx: AgentXContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('AgentX needs an open workspace to create a learning capture.');
  return;
 }

 const target = getLearningCaptureTarget(root);
 const defaultIssue = target?.issueNumber ? String(target.issueNumber) : '';
 const issueInput = defaultIssue || await vscode.window.showInputBox({
  title: 'AgentX - Learning Capture',
  prompt: 'Issue number for the learning capture',
  placeHolder: '163',
  validateInput: (value) => /^\d+$/.test(value.trim()) ? undefined : 'Enter a numeric issue number.',
 });
 if (!issueInput) {
  return;
 }

 const issueNumber = Number(issueInput.trim());
 const defaultTitle = target?.title ?? `Capture solved problem from issue #${issueNumber}`;
 const title = await vscode.window.showInputBox({
  title: 'AgentX - Learning Capture',
  prompt: 'Learning title',
  value: defaultTitle,
  validateInput: (value) => value.trim().length > 0 ? undefined : 'Title is required.',
 });
 if (!title) {
  return;
 }

 const relativePath = `docs/artifacts/learnings/LEARNING-${issueNumber}.md`;
 const filePath = path.join(root, ...relativePath.split('/'));
 fs.mkdirSync(path.dirname(filePath), { recursive: true });

 let created = false;
 if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, buildLearningTemplate(issueNumber, title.trim(), target?.planPath), 'utf-8');
  created = true;
 }

 const document = await vscode.workspace.openTextDocument(filePath);
 await vscode.window.showTextDocument(document, { preview: false });
 vscode.window.showInformationMessage(
  created
   ? `AgentX: created ${relativePath}.`
   : `AgentX: opened existing ${relativePath}.`,
 );
}