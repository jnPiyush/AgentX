import * as fs from 'fs';
import * as path from 'path';
import { readHarnessState } from './harnessState';
import { assetExistsInWorkspaceRuntime, resolveWorkspaceRuntimeAssetPath } from './runtimeAssets';
import { checkHandoffGate, readLoopState } from './loopStateChecker';
import {
  resolveWorkflowCheckpoint,
  resolveWorkflowRecommendation,
} from './workflowGuidanceEngine';
import type { WorkflowCheckpoint } from './workflowGuidanceEngine';

export type { WorkflowCheckpoint } from './workflowGuidanceEngine';

export interface WorkflowEntryPoint {
  readonly label: string;
  readonly command: string;
  readonly chatPrompt: string;
  readonly allowed: boolean;
  readonly rationale: string;
  readonly blockers: readonly string[];
  readonly contextLines: readonly string[];
}

export interface RolloutScorecardRow {
  readonly sliceName: string;
  readonly owner: string;
  readonly sequenceOrder: number;
  readonly state: 'pilot-ready' | 'active' | 'queued' | 'blocked';
  readonly summary: string;
  readonly successSignals: readonly string[];
  readonly warningSignals: readonly string[];
  readonly recoveryPath: string;
}

export interface OperatorChecklistItem {
  readonly checkpoint: WorkflowCheckpoint;
  readonly surface: string;
  readonly operatorAction: string;
  readonly artifactExpectation: string;
}

export interface WorkflowGuidanceSnapshot {
  readonly issueNumber?: number;
  readonly issueTitle?: string;
  readonly issueStatus?: string;
  readonly currentCheckpoint: WorkflowCheckpoint;
  readonly recommendedAction: string;
  readonly recommendedCommand?: string;
  readonly recommendedCommandTitle?: string;
  readonly rationale: string;
  readonly blockers: readonly string[];
  readonly pendingClarification: boolean;
  readonly activePlanPath?: string;
  readonly progressPath?: string;
  readonly reviewPath?: string;
  readonly reviewFindingPaths: readonly string[];
  readonly learningPath?: string;
  readonly planDeepening: WorkflowEntryPoint;
  readonly reviewKickoff: WorkflowEntryPoint;
  readonly rolloutScorecardPath: string;
  readonly pilotOrderPath: string;
  readonly operatorChecklistPath: string;
  readonly rolloutRows: readonly RolloutScorecardRow[];
  readonly operatorChecklist: readonly OperatorChecklistItem[];
}

interface LocalIssue {
  readonly number?: number;
  readonly title?: string;
  readonly status?: string;
  readonly state?: string;
}

const ROLLOUT_SCORECARD_PATH = 'docs/guides/WORKFLOW-ROLLOUT-SCORECARD.md';
const PILOT_ORDER_PATH = 'docs/guides/WORKFLOW-PILOT-ORDER.md';
const OPERATOR_CHECKLIST_PATH = 'docs/guides/WORKFLOW-OPERATOR-CHECKLIST.md';
const REVIEW_FINDINGS_DIR = 'docs/artifacts/reviews/findings';
const REVIEW_ARTIFACTS_DIR = 'docs/artifacts/reviews';
const LEARNINGS_DIR = 'docs/artifacts/learnings';

export function evaluateWorkflowGuidance(
  workspaceRoot: string | undefined,
  pendingClarification = false,
): WorkflowGuidanceSnapshot | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const harnessState = readHarnessState(workspaceRoot);
  const preferredThread = [...harnessState.threads]
    .sort((left, right) => compareThreads(left.status, right.status, left.updatedAt, right.updatedAt))[0];
  const issues = getLocalIssues(workspaceRoot);
  const issue = preferredThread?.issueNumber
    ? issues.find((candidate) => candidate.number === preferredThread.issueNumber)
    : issues.find((candidate) => (candidate.state ?? 'open') !== 'closed') ?? issues[0];
  const issueNumber = preferredThread?.issueNumber ?? issue?.number;
  const issueTitle = preferredThread?.title ?? issue?.title;
  const issueStatus = issue?.status ?? issue?.state ?? preferredThread?.status;

  const activePlanPath = resolveExistingPath(
    workspaceRoot,
    preferredThread?.planPath,
    getKnownPlanPaths(workspaceRoot)[0],
  );
  const progressPath = inferProgressPath(workspaceRoot, activePlanPath);
  const reviewPath = issueNumber
    ? resolveExistingPath(workspaceRoot, `${REVIEW_ARTIFACTS_DIR}/REVIEW-${issueNumber}.md`)
    : undefined;
  const reviewFindingPaths = issueNumber ? getReviewFindingPaths(workspaceRoot, issueNumber) : [];
  const learningPath = issueNumber
    ? resolveExistingPath(workspaceRoot, `${LEARNINGS_DIR}/LEARNING-${issueNumber}.md`)
    : undefined;
  const loopState = readLoopState(workspaceRoot);
  const loopComplete = checkHandoffGate(workspaceRoot, issueNumber ?? null).allowed;
  const issueClosed = normalizeText(issue?.state) === 'closed' || preferredThread?.status === 'complete';
  const statusText = normalizeText(issueStatus);
  const hasPlanEvidence = !!activePlanPath;
  const hasReviewEvidence = !!reviewPath || reviewFindingPaths.length > 0 || statusText.includes('review');
  const hasCompoundEvidence = !!learningPath;

  const currentCheckpoint = resolveWorkflowCheckpoint({
    issueNumber,
    issueTitle,
    issueStatus,
    hasPlanEvidence,
    hasReviewEvidence,
    hasCompoundEvidence,
    loopComplete,
    issueClosed,
  });

  const planDeepening = buildPlanDeepeningEntryPoint(
    issueNumber,
    issueTitle,
    currentCheckpoint,
    activePlanPath,
    progressPath,
    pendingClarification,
  );
  const reviewKickoff = buildReviewKickoffEntryPoint(
    issueNumber,
    issueTitle,
    currentCheckpoint,
    activePlanPath,
    progressPath,
    reviewPath,
    reviewFindingPaths,
    loopComplete,
    pendingClarification,
  );

  const rolloutArtifactsReady = [
    ROLLOUT_SCORECARD_PATH,
    PILOT_ORDER_PATH,
    OPERATOR_CHECKLIST_PATH,
  ].every((relativePath) => assetExistsInWorkspaceRuntime(workspaceRoot, relativePath));
  const rolloutRows = buildRolloutRows(rolloutArtifactsReady);
  const operatorChecklist = buildOperatorChecklist();

  const recommended = resolveWorkflowRecommendation({
    currentCheckpoint,
    issueNumber,
    hasPlanEvidence,
    hasReviewEvidence,
    hasCompoundEvidence,
    loopComplete,
    pendingClarification,
    planDeepeningBlockers: planDeepening.blockers,
    reviewKickoffAllowed: reviewKickoff.allowed,
    reviewKickoffBlockers: reviewKickoff.blockers,
  });

  return {
    issueNumber,
    issueTitle,
    issueStatus,
    currentCheckpoint,
    recommendedAction: recommended.action,
    recommendedCommand: recommended.command,
    recommendedCommandTitle: recommended.commandTitle,
    rationale: recommended.rationale,
    blockers: recommended.blockers,
    pendingClarification,
    activePlanPath,
    progressPath,
    reviewPath,
    reviewFindingPaths,
    learningPath,
    planDeepening,
    reviewKickoff,
    rolloutScorecardPath: resolveWorkspaceRuntimeAssetPath(workspaceRoot, ROLLOUT_SCORECARD_PATH) ?? ROLLOUT_SCORECARD_PATH,
    pilotOrderPath: resolveWorkspaceRuntimeAssetPath(workspaceRoot, PILOT_ORDER_PATH) ?? PILOT_ORDER_PATH,
    operatorChecklistPath: resolveWorkspaceRuntimeAssetPath(workspaceRoot, OPERATOR_CHECKLIST_PATH) ?? OPERATOR_CHECKLIST_PATH,
    rolloutRows,
    operatorChecklist,
  };
}

export function renderWorkflowGuidanceMarkdown(
  snapshot: WorkflowGuidanceSnapshot | undefined,
): string {
  if (!snapshot) {
    return 'No workspace is open, so AgentX cannot resolve workflow guidance.';
  }

  const lines = [
    '# Workflow Guidance',
    '',
    `- Current checkpoint: ${snapshot.currentCheckpoint}`,
    `- Recommended action: ${snapshot.recommendedAction}`,
    `- Rationale: ${snapshot.rationale}`,
  ];

  if (snapshot.issueNumber || snapshot.issueTitle) {
    lines.push(
      `- Active issue: ${formatIssueLabel(snapshot.issueNumber, snapshot.issueTitle)}`,
      `- Issue status: ${snapshot.issueStatus ?? 'unknown'}`,
    );
  }

  lines.push(
    `- Pending clarification: ${snapshot.pendingClarification ? 'yes' : 'no'}`,
    `- Plan: ${snapshot.activePlanPath ?? 'none linked'}`,
    `- Progress: ${snapshot.progressPath ?? 'none linked'}`,
    `- Review: ${snapshot.reviewPath ?? 'none yet'}`,
    `- Compound capture: ${snapshot.learningPath ?? 'none yet'}`,
    '',
    '## Entry Points',
    '',
    renderEntryPointSummary(snapshot.planDeepening),
    renderEntryPointSummary(snapshot.reviewKickoff),
  );

  if (snapshot.blockers.length > 0) {
    lines.push('', '## Blockers', '');
    for (const blocker of snapshot.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push(
    '',
    '## Rollout Support',
    '',
    `- Scorecard: ${snapshot.rolloutScorecardPath}`,
    `- Pilot order: ${snapshot.pilotOrderPath}`,
    `- Operator checklist: ${snapshot.operatorChecklistPath}`,
  );

  return lines.join('\n');
}

export function renderWorkflowEntryPointMarkdown(
  snapshot: WorkflowGuidanceSnapshot | undefined,
  entryPoint: 'plan-deepening' | 'review-kickoff',
): string {
  if (!snapshot) {
    return 'No workspace is open, so AgentX cannot prepare this workflow entry point.';
  }

  const resolved = entryPoint === 'plan-deepening'
    ? snapshot.planDeepening
    : snapshot.reviewKickoff;
  const lines = [
    `# ${resolved.label}`,
    '',
    `- Allowed: ${resolved.allowed ? 'yes' : 'no'}`,
    `- Command: ${resolved.command}`,
    `- Chat prompt: @agentx ${resolved.chatPrompt}`,
    `- Rationale: ${resolved.rationale}`,
  ];

  if (resolved.contextLines.length > 0) {
    lines.push('', '## Context Package', '');
    for (const line of resolved.contextLines) {
      lines.push(`- ${line}`);
    }
  }

  if (resolved.blockers.length > 0) {
    lines.push('', '## Blockers', '');
    for (const blocker of resolved.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join('\n');
}

export function renderWorkflowRolloutScorecardMarkdown(
  snapshot: WorkflowGuidanceSnapshot | undefined,
): string {
  if (!snapshot) {
    return 'No workspace is open, so AgentX cannot render the rollout scorecard.';
  }

  const lines = [
    '# Workflow Rollout Scorecard',
    '',
    `Reference artifact: ${snapshot.rolloutScorecardPath}`,
    `Pilot order: ${snapshot.pilotOrderPath}`,
    '',
    '| Order | Slice | State | Owner | Summary |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const row of snapshot.rolloutRows) {
    lines.push(`| ${row.sequenceOrder} | ${row.sliceName} | ${row.state} | ${row.owner} | ${row.summary} |`);
  }

  lines.push('', '## Current Pilot Gate', '');
  lines.push('- Workflow cohesion must be pilot-ready before later slices move forward.');
  lines.push('- Later slices stay queued or blocked until the workflow cohesion controls remain stable.');
  lines.push('');
  lines.push('## Recovery Path');
  lines.push('');
  lines.push('- Roll back to the prior stable surface set and keep later slices blocked until the shared contract is repaired.');

  return lines.join('\n');
}

export function renderOperatorEnablementChecklistMarkdown(
  snapshot: WorkflowGuidanceSnapshot | undefined,
): string {
  if (!snapshot) {
    return 'No workspace is open, so AgentX cannot render the operator enablement checklist.';
  }

  const lines = [
    '# Operator Enablement Checklist',
    '',
    `Reference artifact: ${snapshot.operatorChecklistPath}`,
    '',
    '| Checkpoint | Surface | Operator Action | Artifact Expectation |',
    '| --- | --- | --- | --- |',
  ];

  for (const item of snapshot.operatorChecklist) {
    lines.push(`| ${item.checkpoint} | ${item.surface} | ${item.operatorAction} | ${item.artifactExpectation} |`);
  }

  lines.push('', '## Current Next Step', '');
  lines.push(`- ${snapshot.currentCheckpoint} -> ${snapshot.recommendedAction}`);

  return lines.join('\n');
}

function buildPlanDeepeningEntryPoint(
  issueNumber: number | undefined,
  issueTitle: string | undefined,
  checkpoint: WorkflowCheckpoint,
  activePlanPath: string | undefined,
  progressPath: string | undefined,
  pendingClarification: boolean,
): WorkflowEntryPoint {
  const blockers: string[] = [];
  if (!issueNumber && !issueTitle) {
    blockers.push('No active issue or harness thread is available.');
  }
  if (pendingClarification) {
    blockers.push('A pending clarification should be resolved before deepening the plan.');
  }

  return {
    label: 'Deepen Plan',
    command: 'agentx.deepenPlan',
    chatPrompt: 'deepen plan',
    allowed: blockers.length === 0,
    rationale: activePlanPath
      ? `Checkpoint ${checkpoint} already has a durable plan anchor, so this entry point can refine it without losing context.`
      : `Checkpoint ${checkpoint} needs a durable planning artifact before implementation details spread across surfaces.`,
    blockers,
    contextLines: [
      `Issue: ${formatIssueLabel(issueNumber, issueTitle)}`,
      `Checkpoint: ${checkpoint}`,
      `Plan: ${activePlanPath ?? 'none linked yet'}`,
      `Progress: ${progressPath ?? 'none linked yet'}`,
    ],
  };
}

function buildReviewKickoffEntryPoint(
  issueNumber: number | undefined,
  issueTitle: string | undefined,
  checkpoint: WorkflowCheckpoint,
  activePlanPath: string | undefined,
  progressPath: string | undefined,
  reviewPath: string | undefined,
  reviewFindingPaths: readonly string[],
  loopComplete: boolean,
  pendingClarification: boolean,
): WorkflowEntryPoint {
  const blockers: string[] = [];
  if (!issueNumber && !issueTitle) {
    blockers.push('No active issue or harness thread is available.');
  }
  if (!activePlanPath) {
    blockers.push('No linked execution plan is available for review kickoff.');
  }
  if (!loopComplete && checkpoint !== 'Review' && checkpoint !== 'Compound Capture' && checkpoint !== 'Done') {
    blockers.push('The quality loop is not complete yet, so review kickoff should stay advisory.');
  }
  if (pendingClarification) {
    blockers.push('A pending clarification should be resolved before review kickoff.');
  }

  return {
    label: 'Kick Off Review',
    command: 'agentx.kickoffReview',
    chatPrompt: 'kick off review',
    allowed: blockers.length === 0,
    rationale: reviewPath
      ? 'Review evidence already exists, so this entry point helps resume review with the same context package.'
      : 'The entry point packages issue, plan, and progress context so review can start from durable artifacts instead of a transient handoff.',
    blockers,
    contextLines: [
      `Issue: ${formatIssueLabel(issueNumber, issueTitle)}`,
      `Checkpoint: ${checkpoint}`,
      `Plan: ${activePlanPath ?? 'missing'}`,
      `Progress: ${progressPath ?? 'missing'}`,
      `Review artifact: ${reviewPath ?? 'not created yet'}`,
      `Review findings: ${reviewFindingPaths.length}`,
    ],
  };
}

function buildRolloutRows(rolloutArtifactsReady: boolean): readonly RolloutScorecardRow[] {
  return [
    {
      sliceName: 'Workflow cohesion',
      owner: 'engineer',
      sequenceOrder: 1,
      state: rolloutArtifactsReady ? 'pilot-ready' : 'active',
      summary: rolloutArtifactsReady
        ? 'Checkpoint, recommendation, entry-point, and rollout artifacts are present for the phase-one pilot.'
        : 'Core phase-one controls are still being assembled and validated.',
      successSignals: [
        'Shared checkpoint language is present across sidebars, commands, and chat.',
        'Work and Status surfaces render the same next-step payload.',
        'Rollout scorecard, pilot order, and operator checklist artifacts exist.',
      ],
      warningSignals: [
        'Surface guidance drifts by channel.',
        'Entry points launch without the current issue and plan context.',
      ],
      recoveryPath: 'Contain rollout to the prior surface set and repair the shared contract before promoting the next slice.',
    },
    {
      sliceName: 'Task bundles',
      owner: 'architect',
      sequenceOrder: 2,
      state: rolloutArtifactsReady ? 'queued' : 'blocked',
      summary: 'Decomposition work should wait until workflow cohesion remains stable in pilot use.',
      successSignals: ['Workflow cohesion remains pilot-ready through the review window.'],
      warningSignals: ['Bundle logic starts before cohesion is stable.'],
      recoveryPath: 'Keep task-bundle work blocked until workflow cohesion is stable again.',
    },
    {
      sliceName: 'Bounded parallel delivery',
      owner: 'engineer',
      sequenceOrder: 3,
      state: rolloutArtifactsReady ? 'queued' : 'blocked',
      summary: 'Controlled concurrency depends on a stable shared checkpoint and rollout gate.',
      successSignals: ['Task-bundle rules and workflow guidance remain aligned.'],
      warningSignals: ['Parallel work causes state drift or reconciliation gaps.'],
      recoveryPath: 'Return to single-path execution until the control plane is stable again.',
    },
    {
      sliceName: 'Skill packaging',
      owner: 'engineer',
      sequenceOrder: 4,
      state: rolloutArtifactsReady ? 'queued' : 'blocked',
      summary: 'Packaging work follows once the workflow contract is stable enough to publish broadly.',
      successSignals: ['Control-plane language and rollout rules stay consistent.'],
      warningSignals: ['Packaged outputs drift from the checkpoint vocabulary.'],
      recoveryPath: 'Keep packaging repo-local until the workflow contract is stable.',
    },
    {
      sliceName: 'Portability generation',
      owner: 'engineer',
      sequenceOrder: 5,
      state: rolloutArtifactsReady ? 'queued' : 'blocked',
      summary: 'Portability generation is last because it amplifies any contract drift across hosts.',
      successSignals: ['Earlier slices stay stable long enough to trust generated outputs.'],
      warningSignals: ['Host-specific drift appears before the control plane settles.'],
      recoveryPath: 'Pause portability work and re-anchor to the repo-native workflow artifacts.',
    },
  ];
}

function buildOperatorChecklist(): readonly OperatorChecklistItem[] {
  return [
    {
      checkpoint: 'Brainstorm',
      surface: 'Chat and command palette',
      operatorAction: 'Use brainstorm or workflow next-step guidance to frame the scope.',
      artifactExpectation: 'Identify the active issue and current workflow checkpoint before planning.',
    },
    {
      checkpoint: 'Plan',
      surface: 'Command palette and Work sidebar',
      operatorAction: 'Launch Deepen Plan from the shared entry point.',
      artifactExpectation: 'Attach or update the execution plan and progress log.',
    },
    {
      checkpoint: 'Work',
      surface: 'Work and Status sidebars',
      operatorAction: 'Follow the shared next-step recommendation and complete validation evidence.',
      artifactExpectation: 'Keep the active issue, plan, and progress artifacts current.',
    },
    {
      checkpoint: 'Review',
      surface: 'Command palette and chat',
      operatorAction: 'Launch Kick Off Review with the same issue and plan context package.',
      artifactExpectation: 'Create or update the review artifact and any durable findings.',
    },
    {
      checkpoint: 'Compound Capture',
      surface: 'Status sidebar and command palette',
      operatorAction: 'Create a curated learning capture or record the explicit skip rationale.',
      artifactExpectation: 'Add the learning artifact before final closeout.',
    },
    {
      checkpoint: 'Done',
      surface: 'Command palette and docs',
      operatorAction: 'Review the rollout scorecard and pilot order before promoting the next slice.',
      artifactExpectation: 'Keep promotion decisions tied to rollout artifacts.',
    },
  ];
}

function renderEntryPointSummary(entryPoint: WorkflowEntryPoint): string {
  const state = entryPoint.allowed ? 'allowed' : 'blocked';
  return `- ${entryPoint.label}: ${state} | command ${entryPoint.command} | chat @agentx ${entryPoint.chatPrompt}`;
}

function getLocalIssues(root: string): LocalIssue[] {
  const issuesDir = path.join(root, '.agentx', 'issues');
  if (!fs.existsSync(issuesDir)) {
    return [];
  }

  return fs.readdirSync(issuesDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJsonFile<LocalIssue>(path.join(issuesDir, entry)))
    .filter((issue): issue is LocalIssue => !!issue)
    .sort((left, right) => (left.number ?? 0) - (right.number ?? 0));
}

function getKnownPlanPaths(root: string): string[] {
  const candidates: string[] = [];
  collectMarkdownFiles(path.join(root, 'docs', 'plans'), candidates);
  collectMarkdownFiles(path.join(root, 'docs', 'execution', 'plans'), candidates);
  return candidates
    .map((candidate) => toRelativePath(root, candidate))
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .sort();
}

function inferProgressPath(root: string, activePlanPath: string | undefined): string | undefined {
  if (!activePlanPath) {
    return undefined;
  }

  const normalized = activePlanPath.replace(/\\/g, '/');
  const pairedCandidate = normalized.replace('/plans/', '/progress/');
  if (existsRelativePath(root, pairedCandidate)) {
    return pairedCandidate;
  }

  const fileName = path.posix.basename(normalized);
  const progressFileName = fileName.replace(/PLAN/gi, 'PROGRESS');
  if (progressFileName !== fileName) {
    const stemCandidate = path.posix.join(path.posix.dirname(pairedCandidate), progressFileName);
    if (existsRelativePath(root, stemCandidate)) {
      return stemCandidate;
    }
  }

  return undefined;
}

function getReviewFindingPaths(root: string, issueNumber: number): string[] {
  const findingsDir = path.join(root, REVIEW_FINDINGS_DIR);
  if (!fs.existsSync(findingsDir)) {
    return [];
  }

  return fs.readdirSync(findingsDir)
    .filter((entry) => entry.endsWith('.md') && entry.startsWith(`FINDING-${issueNumber}-`))
    .map((entry) => `${REVIEW_FINDINGS_DIR}/${entry}`)
    .sort();
}

function collectMarkdownFiles(dir: string, collector: string[]): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      collectMarkdownFiles(fullPath, collector);
      continue;
    }
    if (entry.endsWith('.md')) {
      collector.push(fullPath);
    }
  }
}

function existsRelativePath(root: string, relativePath: string): boolean {
  return assetExistsInWorkspaceRuntime(root, relativePath) || fs.existsSync(path.join(root, ...relativePath.split('/')));
}

function resolveExistingPath(root: string, ...relativePaths: Array<string | undefined>): string | undefined {
  for (const candidate of relativePaths) {
    if (candidate && existsRelativePath(root, candidate)) {
      return candidate.replace(/\\/g, '/');
    }
  }
  return undefined;
}

function toRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

function compareThreads(
  leftStatus: string,
  rightStatus: string,
  leftUpdatedAt: string,
  rightUpdatedAt: string,
): number {
  const leftPriority = leftStatus === 'active' ? 0 : 1;
  const rightPriority = rightStatus === 'active' ? 0 : 1;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return new Date(rightUpdatedAt).getTime() - new Date(leftUpdatedAt).getTime();
}

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function formatIssueLabel(issueNumber: number | undefined, issueTitle: string | undefined): string {
  if (issueNumber && issueTitle) {
    return `#${issueNumber} ${issueTitle}`;
  }
  if (issueNumber) {
    return `#${issueNumber}`;
  }
  return issueTitle ?? 'none';
}