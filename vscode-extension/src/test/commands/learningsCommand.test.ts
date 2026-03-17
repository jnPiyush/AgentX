import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerLearningsCommands } from '../../commands/learnings';
import { AgentXContext } from '../../agentxContext';
import * as learningsInternals from '../../commands/learningsCommandInternals';

describe('registerLearningsCommands', () => {
  let sandbox: sinon.SinonSandbox;
  let callbacks: Record<string, (...args: unknown[]) => Promise<void>>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    callbacks = {};
    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (command: string, callback: (...args: unknown[]) => Promise<void>) => {
        callbacks[command] = callback;
        return { dispose: () => undefined };
      },
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('registers the learnings-related commands', () => {
    registerLearningsCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, {} as AgentXContext);

    assert.ok(Object.keys(callbacks).includes('agentx.showBrainstormGuide'));
    assert.ok(Object.keys(callbacks).includes('agentx.showPlanningLearnings'));
    assert.ok(Object.keys(callbacks).includes('agentx.showReviewLearnings'));
    assert.ok(Object.keys(callbacks).includes('agentx.createLearningCapture'));
  });

  it('delegates command callbacks to the learnings internals', async () => {
    const agentx = {} as AgentXContext;
    const showBrainstorm = sandbox.stub(learningsInternals, 'showBrainstorm').resolves();
    const showRankedLearnings = sandbox.stub(learningsInternals, 'showRankedLearnings').resolves();
    const showCaptureGuidance = sandbox.stub(learningsInternals, 'showCaptureGuidance').resolves();
    const showCompoundLoop = sandbox.stub(learningsInternals, 'showCompoundLoop').resolves();
    const showWorkflowNextStep = sandbox.stub(learningsInternals, 'showWorkflowNextStep').resolves();
    const launchPlanDeepening = sandbox.stub(learningsInternals, 'launchPlanDeepening').resolves();
    const launchReviewKickoff = sandbox.stub(learningsInternals, 'launchReviewKickoff').resolves();
    const showWorkflowRolloutScorecard = sandbox.stub(learningsInternals, 'showWorkflowRolloutScorecard').resolves();
    const showOperatorEnablementChecklist = sandbox.stub(learningsInternals, 'showOperatorEnablementChecklist').resolves();
    const createLearningCapture = sandbox.stub(learningsInternals, 'createLearningCapture').resolves();

    registerLearningsCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, agentx);

    await callbacks['agentx.showBrainstormGuide']!('prompt');
    await callbacks['agentx.showPlanningLearnings']!('plan');
    await callbacks['agentx.showReviewLearnings']!('review');
    await callbacks['agentx.showKnowledgeCaptureGuidance']!();
    await callbacks['agentx.showCompoundLoop']!();
    await callbacks['agentx.showWorkflowNextStep']!();
    await callbacks['agentx.deepenPlan']!();
    await callbacks['agentx.kickoffReview']!();
    await callbacks['agentx.showWorkflowRolloutScorecard']!();
    await callbacks['agentx.showOperatorEnablementChecklist']!();
    await callbacks['agentx.createLearningCapture']!();

    assert.ok(showBrainstorm.calledWith(agentx, 'prompt'));
    assert.ok(showRankedLearnings.calledWith(agentx, 'planning', 'plan'));
    assert.ok(showRankedLearnings.calledWith(agentx, 'review', 'review'));
    assert.ok(showCaptureGuidance.calledWith(agentx));
    assert.ok(showCompoundLoop.calledWith(agentx));
    assert.ok(showWorkflowNextStep.calledWith(agentx));
    assert.ok(launchPlanDeepening.calledWith(agentx));
    assert.ok(launchReviewKickoff.calledWith(agentx));
    assert.ok(showWorkflowRolloutScorecard.calledWith(agentx));
    assert.ok(showOperatorEnablementChecklist.calledWith(agentx));
    assert.ok(createLearningCapture.calledWith(agentx));
  });
});