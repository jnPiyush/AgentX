import { FrontierContext } from '../frontierContext';
import {
  EvaluationReport,
} from './types';
import { evaluateHarnessQualityFromInput } from './harnessEvaluatorInternals';

export function evaluateHarnessQuality(agentx: FrontierContext): EvaluationReport | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return evaluateHarnessQualityFromInput({
    root,
    planFiles: agentx.listExecutionPlanFiles(),
    loopStatePath: agentx.getStatePath('loop-state.json'),
    harnessStatePath: agentx.getStatePath('harness-state.json'),
  });
}

export function getEvaluationSummary(agentx: FrontierContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No evaluation';
  }

  return `Workflow ${report.scores.workflowCompliance.percent}% | Evidence ${report.scores.evidenceStrength.percent}% | Confidence ${report.scores.outputConfidence.percent}%`;
}

export function getEvaluationTooltip(agentx: FrontierContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No workspace open for evaluation.';
  }

  const failingChecks = report.checks.filter((check) => !check.passed);
  const summaryLines = [
    `Workflow compliance: ${report.scores.workflowCompliance.percent}% (${report.scores.workflowCompliance.passedChecks}/${report.scores.workflowCompliance.totalChecks} checks)`,
    `Evidence strength: ${report.scores.evidenceStrength.percent}% (${report.scores.evidenceStrength.passedChecks}/${report.scores.evidenceStrength.totalChecks} checks)`,
    `Output confidence: ${report.scores.outputConfidence.percent}% (${report.scores.outputConfidence.passedChecks}/${report.scores.outputConfidence.totalChecks} checks)`,
    'Confidence reflects the deterministic evidence behind the reported state, not semantic correctness of the output.',
  ];
  if (failingChecks.length === 0) {
    return `${summaryLines.join('\n')}\nAll deterministic harness checks passed.`;
  }

  return `${summaryLines.join('\n')}\n${failingChecks.map((check) => `${check.label}: ${check.summary}`).join('\n')}`;
}

export function getCoverageSummary(agentx: FrontierContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return '0% observed';
  }
  return `${report.coverage.percent}% observed`;
}

export function getCoverageTooltip(agentx: FrontierContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No workspace open for coverage analysis.';
  }

  return report.observations.map((observation) => `${observation.label}: ${observation.detail}`).join('\n');
}

export function getAttributionSummary(agentx: FrontierContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'unknown';
  }
  return report.dominantAttribution;
}

export function getAttributionTooltip(agentx: FrontierContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No workspace open for attribution analysis.';
  }

  if (report.dominantAttribution === 'clear') {
    return 'No dominant failure attribution. All deterministic checks passed.';
  }

  const checks = report.checks
    .filter((check) => !check.passed && check.attribution === report.dominantAttribution)
    .map((check) => `${check.label}: ${check.summary}`);

  return checks.length > 0
    ? checks.join('\n')
    : 'No dominant attribution details available.';
}