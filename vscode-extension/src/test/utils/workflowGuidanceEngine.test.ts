// ---------------------------------------------------------------------------
// Tests -- Workflow Guidance Engine
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import {
  resolveWorkflowCheckpoint,
  resolveWorkflowRecommendation,
} from '../../utils/workflowGuidanceEngine';
import type {
  WorkflowCheckpoint,
  WorkflowCheckpointContext,
  WorkflowRecommendationContext,
} from '../../utils/workflowGuidanceEngine';

function makeContext(overrides: Partial<WorkflowCheckpointContext> = {}): WorkflowCheckpointContext {
  return {
    hasPlanEvidence: false,
    hasReviewEvidence: false,
    hasCompoundEvidence: false,
    loopComplete: false,
    issueClosed: false,
    ...overrides,
  };
}

function makeRecommendationContext(
  overrides: Partial<WorkflowRecommendationContext> = {},
): WorkflowRecommendationContext {
  return {
    currentCheckpoint: 'Plan',
    hasPlanEvidence: false,
    hasReviewEvidence: false,
    hasCompoundEvidence: false,
    loopComplete: false,
    pendingClarification: false,
    planDeepeningBlockers: [],
    reviewKickoffAllowed: false,
    reviewKickoffBlockers: [],
    ...overrides,
  };
}

describe('WorkflowGuidanceEngine', () => {
  // -----------------------------------------------------------------------
  // resolveWorkflowCheckpoint
  // -----------------------------------------------------------------------
  describe('resolveWorkflowCheckpoint', () => {
    it('should resolve to Brainstorm when no issue context exists', () => {
      const result = resolveWorkflowCheckpoint(makeContext());
      assert.equal(result, 'Brainstorm');
    });

    it('should resolve to Plan when issue exists but no plan evidence', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        issueTitle: 'Test issue',
      }));
      assert.equal(result, 'Plan');
    });

    it('should resolve to Work when plan evidence exists', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        hasPlanEvidence: true,
      }));
      assert.equal(result, 'Work');
    });

    it('should resolve to Review when loop is complete', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        hasPlanEvidence: true,
        loopComplete: true,
      }));
      assert.equal(result, 'Review');
    });

    it('should resolve to Review when review evidence exists', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        hasReviewEvidence: true,
      }));
      assert.equal(result, 'Review');
    });

    it('should resolve to Compound Capture when issue is closed with review but no compound evidence', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        issueClosed: true,
        hasReviewEvidence: true,
      }));
      assert.equal(result, 'Compound Capture');
    });

    it('should resolve to Done when all evidence is present and issue is closed', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        issueClosed: true,
        hasReviewEvidence: true,
        hasCompoundEvidence: true,
      }));
      assert.equal(result, 'Done');
    });

    it('should not resolve to Done without compound evidence', () => {
      const result = resolveWorkflowCheckpoint(makeContext({
        issueNumber: 42,
        issueClosed: true,
        hasReviewEvidence: true,
        hasCompoundEvidence: false,
      }));
      assert.notEqual(result, 'Done');
    });
  });

  // -----------------------------------------------------------------------
  // resolveWorkflowRecommendation
  // -----------------------------------------------------------------------
  describe('resolveWorkflowRecommendation', () => {
    it('should recommend resolving clarification when pending', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        pendingClarification: true,
      }));
      assert.ok(result.action.toLowerCase().includes('clarification'));
      assert.ok(result.blockers.length > 0);
    });

    it('should recommend brainstorm guide for Brainstorm checkpoint', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        currentCheckpoint: 'Brainstorm',
      }));
      assert.ok(result.action.toLowerCase().includes('brainstorm'));
      assert.equal(result.command, 'agentx.showBrainstormGuide');
    });

    it('should recommend deepening plan for Plan checkpoint', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        currentCheckpoint: 'Plan',
      }));
      assert.ok(result.action.toLowerCase().includes('plan'));
      assert.equal(result.command, 'agentx.deepenPlan');
    });

    it('should recommend review kickoff when Work checkpoint and loop complete', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        currentCheckpoint: 'Work',
        hasPlanEvidence: true,
        loopComplete: true,
        reviewKickoffAllowed: true,
      }));
      assert.ok(result.action.toLowerCase().includes('review'));
      assert.equal(result.command, 'agentx.kickoffReview');
    });

    it('should recommend continuing implementation when Work and loop not complete', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        currentCheckpoint: 'Work',
        hasPlanEvidence: true,
        loopComplete: false,
      }));
      assert.ok(result.action.toLowerCase().includes('implementation') || result.action.toLowerCase().includes('continue'));
    });

    it('should recommend learning capture for Compound Capture checkpoint', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        currentCheckpoint: 'Compound Capture',
      }));
      assert.equal(result.command, 'agentx.createLearningCapture');
    });

    it('should recommend rollout scorecard for Done checkpoint', () => {
      const result = resolveWorkflowRecommendation(makeRecommendationContext({
        currentCheckpoint: 'Done',
      }));
      assert.ok(result.action.toLowerCase().includes('rollout') || result.action.toLowerCase().includes('scorecard'));
      assert.deepEqual(result.blockers, []);
    });

    it('should always return an action string', () => {
      const checkpoints: WorkflowCheckpoint[] = [
        'Brainstorm', 'Plan', 'Work', 'Review', 'Compound Capture', 'Done',
      ];
      for (const cp of checkpoints) {
        const result = resolveWorkflowRecommendation(makeRecommendationContext({
          currentCheckpoint: cp,
        }));
        assert.ok(result.action.length > 0, `Empty action for checkpoint: ${cp}`);
        assert.ok(result.rationale.length > 0, `Empty rationale for checkpoint: ${cp}`);
      }
    });
  });
});