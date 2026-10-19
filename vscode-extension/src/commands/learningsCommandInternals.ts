import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FrontierContext } from '../frontierContext';
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
  learningsChannel = vscode.window.createOutputChannel('Frontier Learnings');
 }
 return learningsChannel;
}

function showInLearningsChannel(content: string): void {
 const channel = getLearningsChannel();
 channel.clear();
 channel.appendLine(content);
 channel.show(true);
}

function requireWorkspaceRoot(agentx: FrontierContext, actionLabel: string): string | undefined {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage(`Frontier needs an open workspace to ${actionLabel}.`);
  return undefined;
 }
 return root;
}

async function showWorkflowGuidanceReport(
 agentx: FrontierContext,
 actionLabel: string,
 render: (snapshot: ReturnType<typeof evaluateWorkflowGuidance>) => string,
): Promise<void> {
 const root = requireWorkspaceRoot(agentx, actionLabel);
 if (!root) {
  return;
 }

 const issues = await fetchProviderAwareIssues((sub, args) => agentx.runCli(sub, args), root);
 const snapshot = evaluateWorkflowGuidance(root, !!(await agentx.getPendingClarification?.()), issues);
 showInLearningsChannel(render(snapshot));
}

export async function showRankedLearnings(
 agentx: FrontierContext,
 intent: LearningsIntent,
 query?: string,
): Promise<void> {
 const root = requireWorkspaceRoot(agentx, 'show learnings');
 if (!root) {
  return;
 }

 const resolvedQuery = (query ?? getDefaultLearningsQuery(root, intent)).trim();
 const results = rankLearnings(root, intent, resolvedQuery);
 showInLearningsChannel(renderRankedLearningsText(intent, results, resolvedQuery));
}

export async function showCaptureGuidance(agentx: FrontierContext): Promise<void> {
 showInLearningsChannel(renderCaptureGuidanceMarkdown(agentx.workspaceRoot));
}

export async function showBrainstorm(agentx: FrontierContext, query?: string): Promise<void> {
 const root = requireWorkspaceRoot(agentx, 'brainstorm');
 if (!root) {
  return;
 }

 const resolvedQuery = (query ?? getDefaultLearningsQuery(root, 'planning')).trim();
 const results = rankLearnings(root, 'planning', resolvedQuery);
 showInLearningsChannel(renderBrainstormGuidanceMarkdown(root, resolvedQuery, results));
}

export async function showCompoundLoop(agentx: FrontierContext): Promise<void> {
 const root = requireWorkspaceRoot(agentx, 'show the compound loop');
 if (!root) {
  return;
 }

 showInLearningsChannel(renderCompoundLoopMarkdown(root));
}

export async function showWorkflowNextStep(agentx: FrontierContext): Promise<void> {
 await showWorkflowGuidanceReport(agentx, 'resolve the next workflow step', renderWorkflowGuidanceMarkdown);
}

export async function showWorkflowRolloutScorecard(agentx: FrontierContext): Promise<void> {
 await showWorkflowGuidanceReport(agentx, 'show the workflow rollout scorecard', renderWorkflowRolloutScorecardMarkdown);
}

export async function showOperatorEnablementChecklist(agentx: FrontierContext): Promise<void> {
 await showWorkflowGuidanceReport(agentx, 'show the operator enablement checklist', renderOperatorEnablementChecklistMarkdown);
}

export async function launchPlanDeepening(agentx: FrontierContext): Promise<void> {
 await showWorkflowGuidanceReport(
  agentx,
  'prepare plan deepening',
  (snapshot) => renderWorkflowEntryPointMarkdown(snapshot, 'plan-deepening'),
 );
}

export async function launchReviewKickoff(agentx: FrontierContext): Promise<void> {
 await showWorkflowGuidanceReport(
  agentx,
  'prepare review kickoff',
  (snapshot) => renderWorkflowEntryPointMarkdown(snapshot, 'review-kickoff'),
 );
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

export async function createLearningCapture(agentx: FrontierContext): Promise<void> {
 const root = agentx.workspaceRoot;
 if (!root) {
  vscode.window.showWarningMessage('Frontier needs an open workspace to create a learning capture.');
  return;
 }

 const target = getLearningCaptureTarget(root);
 const defaultIssue = target?.issueNumber ? String(target.issueNumber) : '';
 const issueInput = defaultIssue || await vscode.window.showInputBox({
  title: 'Frontier - Learning Capture',
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
  title: 'Frontier - Learning Capture',
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
   ? `Frontier: created ${relativePath}.`
   : `Frontier: opened existing ${relativePath}.`,
 );
}