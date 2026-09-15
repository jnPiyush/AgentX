export type WorkflowCheckpoint =
  | 'Brainstorm'
  | 'Plan'
  | 'Work'
  | 'Review'
  | 'Compound Capture'
  | 'Done';

export interface WorkflowCheckpointContext {
  readonly issueNumber?: number;
  readonly issueTitle?: string;
  readonly issueStatus?: string;
  readonly hasPlanEvidence: boolean;
  readonly hasReviewEvidence: boolean;
  readonly hasCompoundEvidence: boolean;
  readonly loopComplete: boolean;
  readonly issueClosed: boolean;
}

export interface WorkflowRecommendation {
  readonly action: string;
  readonly command?: string;
  readonly commandTitle?: string;
  readonly rationale: string;
  readonly blockers: readonly string[];
}

export interface WorkflowRecommendationContext {
  readonly currentCheckpoint: WorkflowCheckpoint;
  readonly issueNumber?: number;
  readonly hasPlanEvidence: boolean;
  readonly hasReviewEvidence: boolean;
  readonly hasCompoundEvidence: boolean;
  readonly loopComplete: boolean;
  readonly pendingClarification: boolean;
  readonly planDeepeningBlockers: readonly string[];
  readonly reviewKickoffAllowed: boolean;
  readonly reviewKickoffBlockers: readonly string[];
}

interface WorkflowCheckpointRule {
  readonly checkpoint: WorkflowCheckpoint;
  readonly matches: (context: WorkflowCheckpointContext) => boolean;
}

const WORKFLOW_CHECKPOINT_RULES: readonly WorkflowCheckpointRule[] = [
  {
    checkpoint: 'Brainstorm',
    matches: (context) => !context.issueNumber && !context.issueTitle,
  },
  {
    checkpoint: 'Done',
    matches: (context) => context.issueClosed && context.hasReviewEvidence && context.hasCompoundEvidence,
  },
  {
    checkpoint: 'Compound Capture',
    matches: (context) => context.issueClosed && context.hasReviewEvidence,
  },
  {
    checkpoint: 'Review',
    matches: (context) => context.hasReviewEvidence || context.loopComplete,
  },
  {
    checkpoint: 'Work',
    matches: (context) => context.hasPlanEvidence,
  },
  {
    checkpoint: 'Plan',
    matches: () => true,
  },
];

export function resolveWorkflowCheckpoint(context: WorkflowCheckpointContext): WorkflowCheckpoint {
  for (const rule of WORKFLOW_CHECKPOINT_RULES) {
    if (rule.matches(context)) {
      return rule.checkpoint;
    }
  }

  return 'Plan';
}

export function resolveWorkflowRecommendation(
  context: WorkflowRecommendationContext,
): WorkflowRecommendation {
  if (context.pendingClarification) {
    return {
      action: 'Resolve the pending clarification before advancing the workflow',
      command: 'frontier.showPendingClarification',
      commandTitle: 'Show Pending Clarification',
      rationale: 'The current session is waiting on human guidance, so Frontier should fail closed instead of guessing the next transition.',
      blockers: ['A pending clarification must be resolved before the next checkpoint is reliable.'],
    };
  }

  switch (context.currentCheckpoint) {
  case 'Brainstorm':
    return {
      action: 'Frame the work with the brainstorm guide',
      command: 'frontier.showBrainstormGuide',
      commandTitle: 'Show Brainstorm Guide',
      rationale: 'No active issue or durable plan evidence is linked yet, so the safest next move is to tighten scope before planning.',
      blockers: context.issueNumber ? [] : ['No active issue or harness thread is linked to the workflow.'],
    };
  case 'Plan':
    return {
      action: 'Deepen the plan before implementation continues',
      command: 'frontier.deepenPlan',
      commandTitle: 'Deepen Plan',
      rationale: 'The workflow has scope context but is missing a durable plan or progress pair, so planning should be made explicit first.',
      blockers: context.planDeepeningBlockers,
    };
  case 'Work':
    if (context.loopComplete && context.reviewKickoffAllowed) {
      return {
        action: 'Kick off review with the current issue and plan context',
        command: 'frontier.kickoffReview',
        commandTitle: 'Kick Off Review',
        rationale: 'The quality loop is complete and the plan is linked, so review is the next bounded checkpoint.',
        blockers: context.reviewKickoffBlockers,
      };
    }
    return {
      action: 'Continue implementation and validation evidence',
      rationale: context.hasPlanEvidence
        ? 'The plan is linked, but review readiness is not yet fully supported by validation evidence.'
        : 'Implementation should not outrun planning evidence.',
      blockers: context.loopComplete ? [] : ['The quality loop is not complete yet, so review kickoff should wait.'],
    };
  case 'Review':
    return {
      action: context.hasCompoundEvidence
        ? 'Resolve any remaining review follow-up before marking the work done'
        : 'Capture reusable learning or record the explicit skip rationale',
      command: context.hasCompoundEvidence ? undefined : 'frontier.createLearningCapture',
      commandTitle: context.hasCompoundEvidence ? undefined : 'Create Learning Capture',
      rationale: context.hasReviewEvidence
        ? 'Review evidence exists, so the workflow should preserve what was learned before closure drifts.'
        : 'Review is active, so the next safe move is to settle the review outcome and capture what should compound forward.',
      blockers: context.hasCompoundEvidence ? [] : ['No curated learning capture exists for the current issue yet.'],
    };
  case 'Compound Capture':
    return {
      action: 'Record the curated learning capture before final closeout',
      command: 'frontier.createLearningCapture',
      commandTitle: 'Create Learning Capture',
      rationale: 'The issue is effectively closed, but the compound-capture step remains unresolved.',
      blockers: context.hasCompoundEvidence ? [] : ['A curated learning capture is still missing.'],
    };
  case 'Done':
    return {
      action: 'Review the rollout scorecard before promoting the next slice',
      command: 'frontier.showWorkflowRolloutScorecard',
      commandTitle: 'Show Workflow Rollout Scorecard',
      rationale: 'The active issue is complete, so the next decision is a governance decision rather than another workflow transition.',
      blockers: [],
    };
  }
}