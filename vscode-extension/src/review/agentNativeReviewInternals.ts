import * as fs from 'fs';
import * as path from 'path';
import { assetExistsInWorkspaceOrBundle } from '../utils/runtimeAssets';

export type ReviewPillar = 'action-parity' | 'context-parity' | 'workspace-parity';
export type ReviewSeverity = 'none' | 'low' | 'medium' | 'high';

const WORKFLOW_GUIDE_PATH = 'docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md';

export interface CapabilityMapEntry {
 readonly id: string;
 readonly label: string;
 readonly userSurface: boolean;
 readonly agentSurface: boolean;
 readonly sharedArtifacts: boolean;
 readonly summary: string;
 readonly severity: ReviewSeverity;
}

export interface ParityCheckResult {
 readonly id: string;
 readonly pillar: ReviewPillar;
 readonly label: string;
 readonly passed: boolean;
 readonly score: number;
 readonly maxScore: number;
 readonly severity: ReviewSeverity;
 readonly summary: string;
}

export interface AgentNativeReviewReport {
 readonly score: {
  readonly earned: number;
  readonly max: number;
  readonly percent: number;
 };
 readonly pillars: ReadonlyArray<{
  readonly pillar: ReviewPillar;
  readonly earned: number;
  readonly max: number;
  readonly percent: number;
 }>;
 readonly capabilityMap: ReadonlyArray<CapabilityMapEntry>;
 readonly checks: ReadonlyArray<ParityCheckResult>;
 readonly dominantSeverity: ReviewSeverity;
}

interface ReviewSignals {
 readonly root: string;
 readonly packageJson: string;
 readonly chatParticipant: string;
 readonly requestRouter: string;
 readonly requestRouterInternals: string;
 readonly workTreeProvider: string;
 readonly statusTreeProvider: string;
 readonly agentxContext: string;
}

interface CapabilityDefinition {
 readonly id: string;
 readonly label: string;
 readonly userSignals: ReadonlyArray<string>;
 readonly agentSignals: ReadonlyArray<string>;
 readonly sharedSignals: ReadonlyArray<string>;
 readonly summary: string;
}

const CAPABILITIES: ReadonlyArray<CapabilityDefinition> = [
 {
  id: 'brainstorm-guidance',
  label: 'Brainstorm guidance',
  userSignals: ['agentx.showBrainstormGuide', 'Brainstorm'],
  agentSignals: ['brainstorm', 'tryHandleBrainstormRequest'],
  sharedSignals: ['docs/artifacts/learnings', 'workspaceRoot'],
  summary: 'Brainstorm guidance should be available through both command surfaces and chat against the same learning corpus.',
 },
 {
  id: 'workflow-execution',
  label: 'Workflow execution',
  userSignals: ['agentx.runWorkflow', 'Show workflow steps'],
  agentSignals: ['run engineer', 'run reviewer', 'run architect'],
  sharedSignals: ['workspaceRoot', 'listExecutionPlanFiles'],
  summary: 'Workflow execution should exist for both operator-triggered commands and agent-triggered review flows.',
 },
 {
  id: 'review-learnings',
  label: 'Review learnings retrieval',
  userSignals: ['agentx.showReviewLearnings', 'Review learnings'],
  agentSignals: ['learnings review', 'showReviewLearnings'],
  sharedSignals: ['docs/artifacts/learnings', 'workspaceRoot'],
  summary: 'Review surfaces should expose the same ranked learnings guidance to users and agents.',
 },
 {
  id: 'compound-loop',
  label: 'Compound loop visibility',
  userSignals: ['agentx.showCompoundLoop', 'Compound loop'],
  agentSignals: ['compound', 'tryHandleCompoundRequest'],
  sharedSignals: [WORKFLOW_GUIDE_PATH, 'docs/artifacts/reviews/findings', 'workspaceRoot'],
  summary: 'Compound loop status should be reachable in both the sidebar/command surface and chat with the same supporting artifacts.',
 },
 {
  id: 'knowledge-capture',
  label: 'Knowledge capture guidance',
  userSignals: ['agentx.showKnowledgeCaptureGuidance', 'Capture guidance'],
  agentSignals: ['capture guidance', 'showKnowledgeCaptureGuidance'],
  sharedSignals: [WORKFLOW_GUIDE_PATH],
  summary: 'Both surfaces should be able to resolve the same post-review capture guidance and artifact rules.',
 },
 {
  id: 'task-bundles',
  label: 'Task bundle visibility',
  userSignals: ['agentx.showTaskBundles'],
  agentSignals: ['task bundles', 'tryHandleTaskBundleRequest'],
  sharedSignals: ['docs/guides/WORKFLOW-PILOT-ORDER.md', 'workspaceRoot'],
  summary: 'Task bundle review surfaces should be visible in command mode and queryable in chat against the same workspace state.',
 },
 {
  id: 'bounded-parallel',
  label: 'Bounded parallel visibility',
  userSignals: ['agentx.showBoundedParallelRuns'],
  agentSignals: ['bounded parallel', 'tryHandleBoundedParallelRequest'],
  sharedSignals: ['docs/guides/WORKFLOW-PILOT-ORDER.md', 'workspaceRoot'],
  summary: 'Bounded parallel delivery status should be inspectable from both command surfaces and chat via the same workspace-backed records.',
 },
];

function readText(filePath: string): string {
 if (!fs.existsSync(filePath)) {
  return '';
 }

 return fs.readFileSync(filePath, 'utf-8');
}

function readSignals(root: string): ReviewSignals {
 return {
  root,
  packageJson: readText(path.join(root, 'vscode-extension', 'package.json')),
  chatParticipant: readText(path.join(root, 'vscode-extension', 'src', 'chat', 'chatParticipant.ts')),
  requestRouter: readText(path.join(root, 'vscode-extension', 'src', 'chat', 'requestRouter.ts')),
  requestRouterInternals: readText(path.join(root, 'vscode-extension', 'src', 'chat', 'requestRouterInternals.ts')),
  workTreeProvider: readText(path.join(root, 'vscode-extension', 'src', 'views', 'workTreeProvider.ts')),
  statusTreeProvider: readText(path.join(root, 'vscode-extension', 'src', 'views', 'statusTreeProvider.ts')),
  agentxContext: readText(path.join(root, 'vscode-extension', 'src', 'agentxContext.ts')),
 };
}

function hasAllSignals(content: string, signals: ReadonlyArray<string>): boolean {
 return signals.every((signal) => content.includes(signal));
}

function fileExists(root: string, extensionPath: string | undefined, relativePath: string): boolean {
 return assetExistsInWorkspaceOrBundle(root, extensionPath, relativePath)
  || fs.existsSync(path.join(root, ...relativePath.split('/')));
}

function getSeverity(userSurface: boolean, agentSurface: boolean, sharedArtifacts: boolean): ReviewSeverity {
 if (!userSurface || !agentSurface) {
  return 'high';
 }
 if (!sharedArtifacts) {
  return 'medium';
 }
 return 'none';
}

function buildCapabilityMap(signals: ReviewSignals): CapabilityMapEntry[] {
 return CAPABILITIES.map((capability) => {
  const userSurface = hasAllSignals(`${signals.packageJson}\n${signals.workTreeProvider}`, capability.userSignals);
  const agentSurface = hasAllSignals(
   `${signals.chatParticipant}\n${signals.requestRouter}\n${signals.requestRouterInternals}`,
   capability.agentSignals,
  );
  const sharedArtifacts = capability.sharedSignals.every((signal) => {
   if (signal.startsWith('docs/')) {
    return fileExists(signals.root, undefined, signal);
   }
   return signals.agentxContext.includes(signal);
  });
  const severity = getSeverity(userSurface, agentSurface, sharedArtifacts);
  const summary = userSurface && agentSurface && sharedArtifacts
   ? capability.summary
   : [
    !userSurface ? 'user-visible surface missing' : '',
    !agentSurface ? 'agent surface missing' : '',
    !sharedArtifacts ? 'shared artifact or context signal missing' : '',
   ].filter((value) => value.length > 0).join('; ');

  return {
   id: capability.id,
   label: capability.label,
   userSurface,
   agentSurface,
   sharedArtifacts,
   summary,
   severity,
  } satisfies CapabilityMapEntry;
 });
}

function buildChecks(
 root: string,
 extensionPath: string | undefined,
 capabilityMap: ReadonlyArray<CapabilityMapEntry>,
): ParityCheckResult[] {
 const contextSignals = readText(path.join(root, 'vscode-extension', 'src', 'agentxContext.ts'));
 const workspaceGuideExists = fileExists(root, extensionPath, WORKFLOW_GUIDE_PATH);
 const reviewTemplateExists = fileExists(root, extensionPath, '.github/templates/REVIEW-TEMPLATE.md');
 const archReviewTemplateExists = fileExists(root, extensionPath, '.github/templates/ARCH-REVIEW-TEMPLATE.md');
 const reviewSurfaceExists = readText(path.join(root, 'vscode-extension', 'src', 'views', 'statusTreeProvider.ts')).includes('showAgentNativeReview');

 const actionMatches = capabilityMap.filter((entry) => entry.userSurface && entry.agentSurface).length;
 const actionScore = actionMatches * 10;
 const actionMax = capabilityMap.length * 10;

 return [
  {
   id: 'action-parity',
   pillar: 'action-parity',
   label: 'Action parity',
   passed: actionMatches === capabilityMap.length,
   score: actionScore,
   maxScore: actionMax,
   severity: actionMatches === capabilityMap.length ? 'none' : 'high',
   summary: `${actionMatches}/${capabilityMap.length} capability rows expose both user and agent surfaces.`,
  },
  {
   id: 'context-parity',
   pillar: 'context-parity',
   label: 'Context parity',
   passed: ['workspaceRoot', 'getPendingClarification', 'listExecutionPlanFiles', 'getStatePath']
    .every((signal) => contextSignals.includes(signal)),
   score: ['workspaceRoot', 'getPendingClarification', 'listExecutionPlanFiles', 'getStatePath']
    .filter((signal) => contextSignals.includes(signal)).length * 10,
   maxScore: 40,
   severity: ['workspaceRoot', 'getPendingClarification', 'listExecutionPlanFiles', 'getStatePath']
    .every((signal) => contextSignals.includes(signal)) ? 'none' : 'medium',
   summary: 'Shared context depends on workspace root, pending clarification state, execution plans, and state-file access.',
  },
  {
   id: 'workspace-parity',
   pillar: 'workspace-parity',
   label: 'Shared workspace expectations',
   passed: workspaceGuideExists && reviewTemplateExists && archReviewTemplateExists && reviewSurfaceExists,
   score: [workspaceGuideExists, reviewTemplateExists, archReviewTemplateExists, reviewSurfaceExists].filter(Boolean).length * 10,
   maxScore: 40,
   severity: workspaceGuideExists && reviewTemplateExists && archReviewTemplateExists && reviewSurfaceExists ? 'none' : 'medium',
   summary: 'Review guidance, code review template, architecture review template, and an attached review surface should all point to the same repo-local contract.',
  },
 ];
}

function getDominantSeverity(checks: ReadonlyArray<ParityCheckResult>): ReviewSeverity {
 if (checks.some((check) => check.severity === 'high')) {
  return 'high';
 }
 if (checks.some((check) => check.severity === 'medium')) {
  return 'medium';
 }
 if (checks.some((check) => check.severity === 'low')) {
  return 'low';
 }
 return 'none';
}

export function evaluateAgentNativeReviewFromRoot(
 root: string,
 extensionPath?: string,
): AgentNativeReviewReport {
 const signals = readSignals(root);
 const capabilityMap = buildCapabilityMap(signals);
 const checks = buildChecks(root, extensionPath, capabilityMap);
 const earned = checks.reduce((sum, check) => sum + check.score, 0);
 const max = checks.reduce((sum, check) => sum + check.maxScore, 0);
 const percent = max === 0 ? 0 : Math.round((earned / max) * 100);

 const pillars: AgentNativeReviewReport['pillars'] = checks.map((check) => ({
  pillar: check.pillar,
  earned: check.score,
  max: check.maxScore,
  percent: check.maxScore === 0 ? 0 : Math.round((check.score / check.maxScore) * 100),
 }));

 return {
  score: { earned, max, percent },
  pillars,
  capabilityMap,
  checks,
  dominantSeverity: getDominantSeverity(checks),
 };
}

export function renderAgentNativeReviewMarkdown(report: AgentNativeReviewReport): string {
 const lines: string[] = [
  '**Agent-Native Review**',
  '',
  'This output is advisory-first. It highlights architectural parity gaps rather than stylistic preferences.',
  '',
  `Score: ${report.score.percent}% (${report.score.earned}/${report.score.max})`,
  `Dominant severity: ${report.dominantSeverity}`,
  '',
  'Capability map:',
 ];

 for (const entry of report.capabilityMap) {
  lines.push(`- ${entry.label}: user=${entry.userSurface ? 'yes' : 'no'}, agent=${entry.agentSurface ? 'yes' : 'no'}, shared=${entry.sharedArtifacts ? 'yes' : 'no'}`);
  lines.push(`  Summary: ${entry.summary}`);
 }

 lines.push('', 'Scoring rubric:');
 for (const pillar of report.pillars) {
  lines.push(`- ${pillar.pillar}: ${pillar.percent}% (${pillar.earned}/${pillar.max})`);
 }

 const failingChecks = report.checks.filter((check) => !check.passed);
 lines.push('', failingChecks.length === 0 ? 'Findings: no parity gaps detected.' : 'Findings:');
 for (const check of failingChecks) {
  lines.push(`- ${check.label}: ${check.summary} [${check.severity}]`);
 }

 lines.push('', `Reference guide: ${WORKFLOW_GUIDE_PATH}`);
 return lines.join('\n');
}

export function renderAgentNativeReviewText(report: AgentNativeReviewReport): string {
 return renderAgentNativeReviewMarkdown(report).replace(/\*\*/g, '');
}