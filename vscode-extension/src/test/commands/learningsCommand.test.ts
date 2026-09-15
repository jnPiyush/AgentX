import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerLearningsCommands } from '../../commands/learnings';
import { FrontierContext } from '../../frontierContext';
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
    registerLearningsCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, {} as FrontierContext);

    assert.ok(Object.keys(callbacks).includes('frontier.showBrainstormGuide'));
    assert.ok(Object.keys(callbacks).includes('frontier.showPlanningLearnings'));
    assert.ok(Object.keys(callbacks).includes('frontier.showReviewLearnings'));
    assert.ok(Object.keys(callbacks).includes('frontier.createLearningCapture'));
  });

  it('delegates command callbacks to the learnings internals', async () => {
    const agentx = {} as FrontierContext;
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

    await callbacks['frontier.showBrainstormGuide']!('prompt');
    await callbacks['frontier.showPlanningLearnings']!('plan');
    await callbacks['frontier.showReviewLearnings']!('review');
    await callbacks['frontier.showKnowledgeCaptureGuidance']!();
    await callbacks['frontier.showCompoundLoop']!();
    await callbacks['frontier.showWorkflowNextStep']!();
    await callbacks['frontier.deepenPlan']!();
    await callbacks['frontier.kickoffReview']!();
    await callbacks['frontier.showWorkflowRolloutScorecard']!();
    await callbacks['frontier.showOperatorEnablementChecklist']!();
    await callbacks['frontier.createLearningCapture']!();

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