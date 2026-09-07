import { strict as assert } from 'assert';
import {
  assessBoundedParallelDelivery,
  reconcileBoundedParallelRun,
  startBoundedParallelDelivery,
} from '../../parallel/parallel-delivery';
import { AgentXContext } from '../../agentxContext';

describe('bounded parallel facade', () => {
  it('parses an eligibility assessment run', async () => {
    const agentx = {
      runCli: async () => JSON.stringify({
        parallel_id: 'parallel-1',
        title: 'Parallel work',
        mode: 'opt-in',
        priority: 'p1',
        parent_context: { issue_number: 42, source: 'explicit-issue' },
        assessment: {
          scope_independence: 'independent',
          dependency_coupling: 'low',
          artifact_overlap: 'low',
          review_complexity: 'bounded',
          recovery_complexity: 'recoverable',
          decision: 'eligible',
          required_review_level: 'tightened',
        },
        units: [],
        reconciliation: {
          state: 'pending',
          overlap_review: 'pending',
          conflict_review: 'pending',
          acceptance_evidence: 'pending',
          owner_approval: 'pending',
          follow_up_disposition: 'none',
          follow_up_references: [],
          final_decision: 'blocked',
        },
        parent_summary: {
          unit_count: 0,
          blocked_count: 0,
          ready_for_reconciliation_count: 0,
          summary_state: 'assessed',
          closeout_ready: false,
        },
        created_at: '2026-03-13T00:00:00.000Z',
        updated_at: '2026-03-13T00:00:00.000Z',
      }),
    } as unknown as AgentXContext;

    const run = await assessBoundedParallelDelivery(agentx, {
      scopeIndependence: 'independent',
      dependencyCoupling: 'low',
      artifactOverlap: 'low',
      reviewComplexity: 'bounded',
      recoveryComplexity: 'recoverable',
    });

    assert.equal(run.parallelId, 'parallel-1');
    assert.equal(run.assessment.decision, 'eligible');
  });

  it('parses started units and parent summary', async () => {
    const agentx = {
      runCli: async () => JSON.stringify({
        parallel_id: 'parallel-1',
        title: 'Parallel work',
        mode: 'opt-in',
        priority: 'p1',
        parent_context: { issue_number: 42, source: 'explicit-issue' },
        assessment: {
          scope_independence: 'independent',
          dependency_coupling: 'low',
          artifact_overlap: 'low',
          review_complexity: 'bounded',
          recovery_complexity: 'recoverable',
          decision: 'eligible',
          required_review_level: 'tightened',
        },
        units: [
          {
            unit_id: 'unit-01',
            title: 'Unit A',
            scope_boundary: 'docs only',
            owner: 'engineer',
            isolation_mode: 'logical',
            status: 'Done',
            merge_readiness: 'Do Not Merge',
            recovery_guidance: 'retry sequentially',
            summary_signal: 'blocked',
          },
        ],
        reconciliation: {
          state: 'pending',
          overlap_review: 'pending',
          conflict_review: 'pending',
          acceptance_evidence: 'pending',
          owner_approval: 'pending',
          follow_up_disposition: 'none',
          follow_up_references: [],
          final_decision: 'blocked',
        },
        parent_summary: {
          unit_count: 1,
          blocked_count: 0,
          ready_for_reconciliation_count: 0,
          summary_state: 'active',
          closeout_ready: false,
        },
        created_at: '2026-03-13T00:00:00.000Z',
        updated_at: '2026-03-13T00:00:00.000Z',
      }),
    } as unknown as AgentXContext;

    const run = await startBoundedParallelDelivery(agentx, {
      parallelId: 'parallel-1',
      units: [{ title: 'Unit A', scopeBoundary: 'docs only', owner: 'engineer', recoveryGuidance: 'retry sequentially' }],
    });

    assert.equal(run.units[0].mergeReadiness, 'Do Not Merge');
    assert.equal(run.parentSummary.summaryState, 'active');
  });

  it('parses reconciliation results with follow-up references', async () => {
    const agentx = {
      runCli: async () => JSON.stringify({
        parallel_id: 'parallel-1',
        title: 'Parallel work',
        mode: 'opt-in',
        priority: 'p1',
        parent_context: { issue_number: 42, source: 'explicit-issue' },
        assessment: {
          scope_independence: 'independent',
          dependency_coupling: 'low',
          artifact_overlap: 'low',
          review_complexity: 'bounded',
          recovery_complexity: 'recoverable',
          decision: 'eligible',
          required_review_level: 'tightened',
        },
        units: [],
        reconciliation: {
          state: 'blocked',
          overlap_review: 'fail',
          conflict_review: 'pass',
          acceptance_evidence: 'pass',
          owner_approval: 'approved',
          follow_up_disposition: 'captured',
          follow_up_references: ['#73'],
          final_decision: 'blocked',
        },
        parent_summary: {
          unit_count: 1,
          blocked_count: 0,
          ready_for_reconciliation_count: 0,
          summary_state: 'active',
          closeout_ready: false,
        },
        created_at: '2026-03-13T00:00:00.000Z',
        updated_at: '2026-03-13T00:00:00.000Z',
      }),
    } as unknown as AgentXContext;

    const run = await reconcileBoundedParallelRun(agentx, {
      parallelId: 'parallel-1',
      overlapReview: 'fail',
      conflictReview: 'pass',
      acceptanceEvidence: 'pass',
      ownerApproval: 'approved',
      followUpTarget: 'story',
      followUpTitle: 'Resolve overlap',
    });

    assert.equal(run.reconciliation.finalDecision, 'blocked');
    assert.equal(run.reconciliation.followUpReferences[0], '#73');
  });
});