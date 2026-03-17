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
      score: { percent: 84, passedChecks: 21, totalChecks: 25 },
      coverage: { percent: 73 },
      dominantAttribution: 'workflow',
      observations: [{ label: 'Plans', detail: '2 observed' }],
      checks: [
        { label: 'Plans', summary: 'present', passed: true, attribution: 'clear' },
        { label: 'Evidence', summary: 'missing', passed: false, attribution: 'workflow' },
      ],
    } as any);
    const agentx = {
      workspaceRoot: 'c:/repo',
      listExecutionPlanFiles: () => ['docs/execution/plans/EXEC-PLAN-1.md'],
      getStatePath: (fileName: string) => `c:/repo/.agentx/state/${fileName}`,
    } as any;

    const report = evaluateHarnessQuality(agentx);

    assert.equal(report?.score.percent, 84);
    assert.equal(getEvaluationSummary(agentx), '84% (21/25 checks)');
    assert.equal(getEvaluationTooltip(agentx), 'Evidence: missing');
    assert.equal(getCoverageSummary(agentx), '73% observed');
    assert.equal(getCoverageTooltip(agentx), 'Plans: 2 observed');
    assert.equal(getAttributionSummary(agentx), 'workflow');
    assert.equal(getAttributionTooltip(agentx), 'Evidence: missing');
  });
});