import * as fs from 'fs';
import * as path from 'path';
import { readHarnessState } from '../utils/harnessState';
import { checkHandoffGate } from '../utils/loopStateChecker';
import {
 ArtifactObservation,
 EvaluationAttribution,
 EvaluationCheckResult,
 EvaluationReport,
} from './types';

interface CheckContext {
 readonly root: string;
 readonly observations: ReadonlyArray<ArtifactObservation>;
 readonly planFiles: ReadonlyArray<string>;
 readonly progressFiles: ReadonlyArray<string>;
 readonly handoffAllowed: boolean;
 readonly handoffReason: string;
 readonly harnessThreadCount: number;
 readonly harnessEvidenceCount: number;
}

interface DeterministicCheck {
 readonly id: string;
 readonly pillar: EvaluationCheckResult['pillar'];
 readonly label: string;
 readonly maxScore: number;
 run(context: CheckContext): EvaluationCheckResult;
}

export interface HarnessEvaluationInput {
 readonly root: string;
 readonly planFiles: ReadonlyArray<string>;
 readonly loopStatePath: string | undefined;
 readonly harnessStatePath: string | undefined;
}

interface HarnessPolicy {
 readonly disabledChecks: ReadonlySet<string>;
}

function fileExists(filePath: string | undefined): boolean {
 return !!filePath && fs.existsSync(filePath);
}

function countMarkdownFiles(dirPath: string): string[] {
 if (!fs.existsSync(dirPath)) {
  return [];
 }

 return fs.readdirSync(dirPath, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name)
  .sort();
}

function formatCount(label: string, count: number): string {
 return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function readHarnessPolicy(root: string): HarnessPolicy {
 const configPath = path.join(root, '.agentx', 'config.json');
 if (!fs.existsSync(configPath)) {
  return { disabledChecks: new Set<string>() };
 }

 try {
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
   harness?: { disabledChecks?: unknown };
   harnessDisabledChecks?: unknown;
  };
  const rawValue = parsed.harness?.disabledChecks ?? parsed.harnessDisabledChecks;
  const disabledChecks = new Set<string>();

  if (Array.isArray(rawValue)) {
   for (const entry of rawValue) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
     disabledChecks.add(entry.trim().toLowerCase());
    }
   }
  } else if (typeof rawValue === 'string') {
   for (const entry of rawValue.split(/[;,\r\n]+/)) {
    const normalized = entry.trim().toLowerCase();
    if (normalized.length > 0) {
     disabledChecks.add(normalized);
    }
   }
  }

  return { disabledChecks };
 } catch {
  return { disabledChecks: new Set<string>() };
 }
}

function buildObservations(input: HarnessEvaluationInput): {
 readonly observations: ReadonlyArray<ArtifactObservation>;
 readonly progressFiles: ReadonlyArray<string>;
} {
 const progressDir = path.join(input.root, 'docs', 'execution', 'progress');
 const progressFiles = countMarkdownFiles(progressDir).map((name) => `docs/execution/progress/${name}`);

 const observations: ArtifactObservation[] = [
  {
   id: 'execution-plan',
   label: 'Execution plan',
   mode: input.planFiles.length > 0 ? 'observed' : 'inferred',
   present: input.planFiles.length > 0,
   detail: input.planFiles.length > 0
    ? `${formatCount('plan file', input.planFiles.length)} discovered`
    : 'No execution plans discovered',
  },
  {
   id: 'progress-log',
   label: 'Progress log',
   mode: progressFiles.length > 0 ? 'observed' : 'inferred',
   present: progressFiles.length > 0,
   detail: progressFiles.length > 0
    ? `${formatCount('progress log', progressFiles.length)} discovered`
    : 'No progress log found under docs/execution/progress',
  },
  {
   id: 'loop-state',
   label: 'Loop state',
   mode: fileExists(input.loopStatePath) ? 'observed' : 'inferred',
   present: fileExists(input.loopStatePath),
   detail: fileExists(input.loopStatePath)
    ? 'Loop state file observed'
    : 'Loop state file missing',
  },
  {
   id: 'harness-state',
   label: 'Harness state',
   mode: fileExists(input.harnessStatePath) ? 'observed' : 'inferred',
   present: fileExists(input.harnessStatePath),
   detail: fileExists(input.harnessStatePath)
    ? 'Harness state file observed'
    : 'Harness state file missing',
  },
 ];

 return { observations, progressFiles };
}

const CHECKS: ReadonlyArray<DeterministicCheck> = [
 {
  id: 'execution-plan-present',
  pillar: 'planning',
  label: 'Execution plan linked',
  maxScore: 20,
  run: (context) => ({
   id: 'execution-plan-present',
   pillar: 'planning',
   label: 'Execution plan linked',
   passed: context.planFiles.length > 0,
   score: context.planFiles.length > 0 ? 20 : 0,
   maxScore: 20,
   attribution: context.planFiles.length > 0 ? 'clear' : 'harness',
   summary: context.planFiles.length > 0
    ? `${formatCount('plan file', context.planFiles.length)} available for evaluation`
    : 'No execution plan found for the current workspace',
  }),
 },
 {
  id: 'progress-log-present',
  pillar: 'planning',
  label: 'Progress log tracked',
  maxScore: 20,
  run: (context) => ({
   id: 'progress-log-present',
   pillar: 'planning',
   label: 'Progress log tracked',
   passed: context.progressFiles.length > 0,
   score: context.progressFiles.length > 0 ? 20 : 0,
   maxScore: 20,
   attribution: context.progressFiles.length > 0 ? 'clear' : 'harness',
   summary: context.progressFiles.length > 0
    ? `${formatCount('progress log', context.progressFiles.length)} available for evaluation`
    : 'No progress log found under docs/progress',
  }),
 },
 {
  id: 'loop-complete',
  pillar: 'execution',
  label: 'Loop gate satisfied',
  maxScore: 20,
  run: (context) => ({
   id: 'loop-complete',
   pillar: 'execution',
   label: 'Loop gate satisfied',
   passed: context.handoffAllowed,
   score: context.handoffAllowed ? 20 : 0,
   maxScore: 20,
   attribution: context.handoffAllowed ? 'clear' : 'policy',
   summary: context.handoffAllowed ? 'Quality loop completed successfully' : context.handoffReason,
  }),
 },
 {
  id: 'harness-thread-recorded',
  pillar: 'execution',
  label: 'Harness thread captured',
  maxScore: 20,
  run: (context) => ({
   id: 'harness-thread-recorded',
   pillar: 'execution',
   label: 'Harness thread captured',
   passed: context.harnessThreadCount > 0,
   score: context.harnessThreadCount > 0 ? 20 : 0,
   maxScore: 20,
   attribution: context.harnessThreadCount > 0 ? 'clear' : 'harness',
   summary: context.harnessThreadCount > 0
    ? `${formatCount('thread', context.harnessThreadCount)} recorded in harness state`
    : 'Harness state has no recorded threads',
  }),
 },
 {
  id: 'evidence-recorded',
  pillar: 'evidence',
  label: 'Evidence captured',
  maxScore: 20,
  run: (context) => ({
   id: 'evidence-recorded',
   pillar: 'evidence',
   label: 'Evidence captured',
   passed: context.harnessEvidenceCount > 0,
   score: context.harnessEvidenceCount > 0 ? 20 : 0,
   maxScore: 20,
   attribution: context.harnessEvidenceCount > 0 ? 'clear' : 'harness',
   summary: context.harnessEvidenceCount > 0
    ? `${formatCount('evidence item', context.harnessEvidenceCount)} available for evaluation`
    : 'Harness state has no recorded evidence',
  }),
 },
];

function determineDominantAttribution(
 checks: ReadonlyArray<EvaluationCheckResult>,
): EvaluationAttribution {
 const failed = checks.filter((check) => !check.passed);
 if (failed.length === 0) {
  return 'clear';
 }

 const totals = new Map<EvaluationAttribution, number>();
 for (const check of failed) {
  totals.set(check.attribution, (totals.get(check.attribution) ?? 0) + check.maxScore);
 }

 return [...totals.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'unknown';
}

export function evaluateHarnessQualityFromInput(
 input: HarnessEvaluationInput,
): EvaluationReport {
 const { observations, progressFiles } = buildObservations(input);
 const harnessState = readHarnessState(input.root);
 const policy = readHarnessPolicy(input.root);
 const handoff = checkHandoffGate(input.root);
 const context: CheckContext = {
  root: input.root,
  observations,
  planFiles: input.planFiles,
  progressFiles,
  handoffAllowed: handoff.allowed,
  handoffReason: handoff.reason,
  harnessThreadCount: harnessState.threads.length,
  harnessEvidenceCount: harnessState.evidence.length,
 };

 const checks = CHECKS
  .filter((check) => !policy.disabledChecks.has(check.id))
  .map((check) => check.run(context));
 const earned = checks.reduce((sum, check) => sum + check.score, 0);
 const max = checks.reduce((sum, check) => sum + check.maxScore, 0);
 const observed = observations.filter((observation) => observation.mode === 'observed' && observation.present).length;

 return {
  score: {
   earned,
   max,
   percent: max === 0 ? 0 : Math.round((earned / max) * 100),
   passedChecks: checks.filter((check) => check.passed).length,
   totalChecks: checks.length,
  },
  dominantAttribution: determineDominantAttribution(checks),
  coverage: {
   observed,
   total: observations.length,
   percent: observations.length === 0 ? 0 : Math.round((observed / observations.length) * 100),
  },
  observations,
  checks,
 };
}