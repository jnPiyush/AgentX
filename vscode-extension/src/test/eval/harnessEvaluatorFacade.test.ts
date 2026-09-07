import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as internals from '../../eval/harnessEvaluatorInternals';
import {
  evaluateHarnessQuality,
  getAttributionSummary,
  getAttributionTooltip,
  getCoverageSummary,
  getCoverageTooltip,
  getEvaluationSummary,
  getEvaluationTooltip,
} from '../../eval/harnessEvaluator';
import { AgentXContext } from '../../agentxContext';
import { EvaluationReport } from '../../eval/types';

describe('harnessEvaluator facade', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns undefined and fallback strings when no workspace is open', () => {
    const agentx = { workspaceRoot: undefined } as unknown as AgentXContext;

    assert.equal(evaluateHarnessQuality(agentx), undefined);
    assert.equal(getEvaluationSummary(agentx), 'No evaluation');
    assert.equal(getEvaluationTooltip(agentx), 'No workspace open for evaluation.');
    assert.equal(getCoverageSummary(agentx), '0% observed');
    assert.equal(getCoverageTooltip(agentx), 'No workspace open for coverage analysis.');
    assert.equal(getAttributionSummary(agentx), 'unknown');
    assert.equal(getAttributionTooltip(agentx), 'No workspace open for attribution analysis.');
  });

  it('maps workspace inputs through to the evaluator internals and formats summaries', () => {
    const stubbedReport: EvaluationReport = {
      scores: {
        workflowCompliance: { earned: 3, max: 4, percent: 84, passedChecks: 3, totalChecks: 4 },
        evidenceStrength: { earned: 2, max: 3, percent: 73, passedChecks: 2, totalChecks: 3 },
        outputConfidence: { earned: 2, max: 3, percent: 68, passedChecks: 2, totalChecks: 3 },
      },
      coverage: { observed: 73, total: 100, percent: 73 },
      dominantAttribution: 'policy',
      observations: [{ id: 'plans', label: 'Plans', mode: 'observed', present: true, detail: '2 observed' }],
      checks: [
        {
          id: 'plans-check', dimension: 'workflowCompliance', pillar: 'planning',
          label: 'Plans', summary: 'present', passed: true, score: 1, maxScore: 1, attribution: 'clear',
        },
        {
          id: 'evidence-check', dimension: 'evidenceStrength', pillar: 'evidence',
          label: 'Evidence', summary: 'missing', passed: false, score: 0, maxScore: 1, attribution: 'policy',
        },
      ],
    };
    sandbox.stub(internals, 'evaluateHarnessQualityFromInput').returns(stubbedReport);
    const agentx = {
      workspaceRoot: 'c:/repo',
      listExecutionPlanFiles: () => ['docs/execution/plans/EXEC-PLAN-1.md'],
      getStatePath: (fileName: string) => `c:/repo/.agentx/state/${fileName}`,
    } as unknown as AgentXContext;

    const report = evaluateHarnessQuality(agentx);

    assert.equal(report?.scores.workflowCompliance.percent, 84);
    assert.equal(getEvaluationSummary(agentx), 'Workflow 84% | Evidence 73% | Confidence 68%');
    assert.equal(getEvaluationTooltip(agentx), [
      'Workflow compliance: 84% (3/4 checks)',
      'Evidence strength: 73% (2/3 checks)',
      'Output confidence: 68% (2/3 checks)',
      'Confidence reflects the deterministic evidence behind the reported state, not semantic correctness of the output.',
      'Evidence: missing',
    ].join('\n'));
    assert.equal(getCoverageSummary(agentx), '73% observed');
    assert.equal(getCoverageTooltip(agentx), 'Plans: 2 observed');
    assert.equal(getAttributionSummary(agentx), 'policy');
    assert.equal(getAttributionTooltip(agentx), 'Evidence: missing');
  });
});