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

describe('harnessEvaluator facade', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns undefined and fallback strings when no workspace is open', () => {
    const agentx = { workspaceRoot: undefined } as any;

    assert.equal(evaluateHarnessQuality(agentx), undefined);
    assert.equal(getEvaluationSummary(agentx), 'No evaluation');
    assert.equal(getEvaluationTooltip(agentx), 'No workspace open for evaluation.');
    assert.equal(getCoverageSummary(agentx), '0% observed');
    assert.equal(getCoverageTooltip(agentx), 'No workspace open for coverage analysis.');
    assert.equal(getAttributionSummary(agentx), 'unknown');
    assert.equal(getAttributionTooltip(agentx), 'No workspace open for attribution analysis.');
  });

  it('maps workspace inputs through to the evaluator internals and formats summaries', () => {
    sandbox.stub(internals, 'evaluateHarnessQualityFromInput').returns({
      scores: {
        workflowCompliance: { percent: 84, passedChecks: 3, totalChecks: 4 },
        evidenceStrength: { percent: 73, passedChecks: 2, totalChecks: 3 },
        outputConfidence: { percent: 68, passedChecks: 2, totalChecks: 3 },
      },
      coverage: { percent: 73 },
      dominantAttribution: 'policy',
      observations: [{ label: 'Plans', detail: '2 observed' }],
      checks: [
        { label: 'Plans', summary: 'present', passed: true, attribution: 'clear' },
        { label: 'Evidence', summary: 'missing', passed: false, attribution: 'policy' },
      ],
    } as any);
    const agentx = {
      workspaceRoot: 'c:/repo',
      listExecutionPlanFiles: () => ['docs/execution/plans/EXEC-PLAN-1.md'],
      getStatePath: (fileName: string) => `c:/repo/.frontier/state/${fileName}`,
    } as any;

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