import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

export type ReviewPillar = 'action-parity' | 'context-parity' | 'workspace-parity';
export type ReviewSeverity = 'none' | 'low' | 'medium' | 'high';

const workflowGuidePath = 'docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md';

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
  readonly workTreeProvider: string;
  readonly qualityTreeProvider: string;
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
    id: 'workflow-execution',
    label: 'Workflow execution',
    userSignals: ['agentx.runWorkflow', 'Run workflow'],
    agentSignals: ['run engineer', 'run reviewer', 'run architect'],
    sharedSignals: ['workspaceRoot', 'listExecutionPlanFiles'],
    summary: 'Workflow execution should exist for both operator-triggered commands and agent-triggered review flows.',
  },
  {
    id: 'review-learnings',
    label: 'Review learnings retrieval',
    userSignals: ['agentx.showReviewLearnings', 'Review learnings'],
    agentSignals: ['learnings review', 'showReviewLearnings'],
    sharedSignals: ['docs/learnings', 'workspaceRoot'],
    summary: 'Review surfaces should expose the same ranked learnings guidance to users and agents.',
  },
  {
    id: 'knowledge-capture',
    label: 'Knowledge capture guidance',
    userSignals: ['agentx.showKnowledgeCaptureGuidance', 'Capture guidance'],
    agentSignals: ['capture guidance', 'showKnowledgeCaptureGuidance'],
    sharedSignals: [workflowGuidePath],
    summary: 'Both surfaces should be able to resolve the same post-review capture guidance and artifact rules.',
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
    workTreeProvider: readText(path.join(root, 'vscode-extension', 'src', 'views', 'workTreeProvider.ts')),
    qualityTreeProvider: readText(path.join(root, 'vscode-extension', 'src', 'views', 'qualityTreeProvider.ts')),
    agentxContext: readText(path.join(root, 'vscode-extension', 'src', 'agentxContext.ts')),
  };
}

function hasAllSignals(content: string, signals: ReadonlyArray<string>): boolean {
  return signals.every((signal) => content.includes(signal));
}

function fileExists(root: string, relativePath: string): boolean {
  return fs.existsSync(path.join(root, ...relativePath.split('/')));
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
    const agentSurface = hasAllSignals(signals.chatParticipant, capability.agentSignals);
    const sharedArtifacts = capability.sharedSignals.every((signal) => {
      if (signal.startsWith('docs/')) {
        return fileExists(signals.root, signal);
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

function buildChecks(root: string, capabilityMap: ReadonlyArray<CapabilityMapEntry>): ParityCheckResult[] {
  const actionEntries = capabilityMap;
  const contextSignals = readText(path.join(root, 'vscode-extension', 'src', 'agentxContext.ts'));
  const workspaceGuideExists = fileExists(root, workflowGuidePath);
  const reviewTemplateExists = fileExists(root, '.github/templates/REVIEW-TEMPLATE.md');
  const reviewSurfaceExists = readText(path.join(root, 'vscode-extension', 'src', 'views', 'qualityTreeProvider.ts')).includes('showAgentNativeReview');

  const actionMatches = actionEntries.filter((entry) => entry.userSurface && entry.agentSurface).length;
  const actionScore = actionMatches * 10;
  const actionMax = actionEntries.length * 10;

  const checks: ParityCheckResult[] = [
    {
      id: 'action-parity',
      pillar: 'action-parity',
      label: 'Action parity',
      passed: actionMatches === actionEntries.length,
      score: actionScore,
      maxScore: actionMax,
      severity: actionMatches === actionEntries.length ? 'none' : 'high',
      summary: `${actionMatches}/${actionEntries.length} capability rows expose both user and agent surfaces.`,
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
      passed: workspaceGuideExists && reviewTemplateExists && reviewSurfaceExists,
      score: [workspaceGuideExists, reviewTemplateExists, reviewSurfaceExists].filter(Boolean).length * 10,
      maxScore: 30,
      severity: workspaceGuideExists && reviewTemplateExists && reviewSurfaceExists ? 'none' : 'medium',
      summary: 'Review guidance, the review template, and an attached review surface should point to the same repo-local contract.',
    },
  ];

  return checks;
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

export function evaluateAgentNativeReview(agentx: AgentXContext): AgentNativeReviewReport | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  const signals = readSignals(root);
  const capabilityMap = buildCapabilityMap(signals);
  const checks = buildChecks(root, capabilityMap);
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

export function getAgentNativeReviewSummary(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'No review';
  }
  return `${report.score.percent}% (${report.score.earned}/${report.score.max})`;
}

export function getAgentNativeReviewTooltip(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'No workspace open for agent-native review.';
  }

  return report.checks.map((check) => `${check.label}: ${check.summary}`).join('\n');
}

export function getAgentNativeGapSummary(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'unknown';
  }

  const failingEntries = report.capabilityMap.filter((entry) => entry.severity !== 'none').length;
  return failingEntries === 0 ? 'no gaps' : `${failingEntries} gap${failingEntries === 1 ? '' : 's'}`;
}

export function getAgentNativeGapTooltip(agentx: AgentXContext): string {
  const report = evaluateAgentNativeReview(agentx);
  if (!report) {
    return 'No workspace open for agent-native review.';
  }

  const failingEntries = report.capabilityMap.filter((entry) => entry.severity !== 'none');
  if (failingEntries.length === 0) {
    return 'No action, context, or shared-workspace parity gaps detected.';
  }

  return failingEntries.map((entry) => `${entry.label}: ${entry.summary}`).join('\n');
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

  lines.push('', `Reference guide: ${workflowGuidePath}`);
  return lines.join('\n');
}

export function renderAgentNativeReviewText(report: AgentNativeReviewReport): string {
  return renderAgentNativeReviewMarkdown(report).replace(/\*\*/g, '');
}
