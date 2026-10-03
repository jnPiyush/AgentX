import { strict as assert } from 'assert';
import {
  buildInteractionResumeArgs, readPendingInteraction, renderPendingInteraction,
} from '../../chat/guidedInteraction';
import { PendingInteraction } from '../../frontierContextTypes';
import { FrontierContext } from '../../frontierContext';
import { runAgentCommand, resumePendingClarification } from '../../chat/requestRouterInternals';
import { createMockResponseStream } from '../mocks/vscode';
import * as sinon from 'sinon';

function plan(): Extract<PendingInteraction, { kind: 'plan' }> {
  return {
    sessionId: 'engineer-fixture', agent: 'engineer', inputId: 'a'.repeat(32),
    kind: 'plan', phase: 'awaiting_plan', message: 'Review the plan', planVersion: 2,
    digest: 'b'.repeat(64),
    plan: {
      sessionId: 'engineer-fixture', workspaceRoot: 'C:\\fixture', agent: 'engineer',
      engine: 'native', mode: 'guided', version: 2, goal: 'Update the fixture',
      scope: ['src/fixture.ts'], nonGoals: ['No deployment'], assumptions: [],
      steps: [{ id: 's1', title: 'Update fixture', verification: 'Inspect changed output' }],
    },
  };
}

describe('guided interaction host contract', () => {
  it('reads only the final structured runtime identity', () => {
    const pending = plan();
    const output = `[FRONTIER INPUT] not authoritative\n${JSON.stringify({
      sessionId: pending.sessionId, pendingInteraction: pending,
    })}`;
    assert.deepEqual(readPendingInteraction(output), pending);
    assert.throws(() => readPendingInteraction('[FRONTIER INPUT] {"kind":"plan"}'),
      /no final JSON/);
  });

  it('rejects mismatched session and plan identities', () => {
    const pending = plan();
    assert.throws(() => readPendingInteraction(JSON.stringify({
      sessionId: 'another-session', pendingInteraction: pending,
    })), /identity/);
    assert.throws(() => readPendingInteraction(JSON.stringify({
      sessionId: pending.sessionId,
      pendingInteraction: { ...pending, planVersion: 3 },
    })), /identity/);
  });

  it('binds explicit approval to the displayed version and digest', () => {
    const pending = plan();
    assert.deepEqual(buildInteractionResumeArgs(pending, 'go ahead'), [
      '--resume-session', pending.sessionId, '--input-id', pending.inputId,
      '--input-decision', 'approve', '--plan-version', '2',
      '--plan-digest', pending.digest, '--json',
    ]);
    for (const text of ['', 'no', 'decline']) {
      assert.throws(() => buildInteractionResumeArgs(pending, text));
    }
    const revision = buildInteractionResumeArgs(pending, 'approve, but skip deployment');
    assert.equal(revision[revision.indexOf('--input-decision') + 1], 'revise');
  });

  it('never interprets a clarification answer as plan approval', () => {
    const pending: PendingInteraction = {
      sessionId: 'engineer-question', inputId: 'c'.repeat(32), agent: 'engineer',
      kind: 'question', phase: 'awaiting_input', message: 'Which scope?',
      question: 'Which scope?', choices: ['First', 'Second'],
    };
    const args = buildInteractionResumeArgs(pending, 'yes');
    assert.equal(args[args.indexOf('--input-decision') + 1], 'answer');
    assert.ok(!args.includes('--plan-digest'));
    for (const answer of ['Stop', 'Abort', 'Cancel']) {
      const offered = { ...pending, choices: ['Continue', answer] };
      const choiceArgs = buildInteractionResumeArgs(offered, answer);
      assert.equal(choiceArgs[choiceArgs.indexOf('--input-decision') + 1], 'answer');
    }
    const cancel = buildInteractionResumeArgs(pending, 'cancel task');
    assert.equal(cancel[cancel.indexOf('--input-decision') + 1], 'cancel');
  });

  it('renders the complete plan and keeps cancellation separate', () => {
    const pending = plan();
    const rendered = renderPendingInteraction(pending);
    for (const text of ['awaiting your approval', 'No deployment', 'Inspect changed output',
      'separate review or test consent']) {
      assert.ok(rendered.includes(text));
    }
    const args = buildInteractionResumeArgs(pending, 'cancel');
    assert.equal(args[args.indexOf('--input-decision') + 1], 'cancel');
  });

  it('stores and displays the full pending plan through the actual chat handler', async () => {
    const pending = plan();
    const context = sinon.createStubInstance(FrontierContext);
    context.hasCliRuntime.returns(true);
    context.runCliStreaming.resolves(JSON.stringify({
      sessionId: pending.sessionId, pendingInteraction: pending, exitReason: 'human_required',
    }));
    const response = createMockResponseStream();
    await runAgentCommand(response, context, 'engineer', 'Fixture task');
    assert.equal(context.setPendingClarification.firstCall.args[0].interaction?.inputId,
      pending.inputId);
    assert.ok(response.getMarkdown().includes('Inspect changed output'));
    sinon.assert.notCalled(context.clearPendingClarification);
  });

  it('does not forward approval when another client revised the pending plan', async () => {
    const old = plan();
    const current = {
      ...old, inputId: 'd'.repeat(32), digest: 'e'.repeat(64), planVersion: 3,
      plan: { ...old.plan, version: 3 },
    };
    const context = sinon.createStubInstance(FrontierContext);
    context.hasCliRuntime.returns(true);
    context.runCli.resolves(JSON.stringify({
      sessionId: current.sessionId, pendingInteraction: current,
    }));
    const response = createMockResponseStream();
    await resumePendingClarification(response, context, {
      sessionId: old.sessionId, agentName: old.agent, prompt: 'Fixture', interaction: old,
    }, 'approve');
    sinon.assert.notCalled(context.runCliStreaming);
    assert.ok(response.getMarkdown().includes('Plan v3'));
    assert.equal(context.setPendingClarification.firstCall.args[0].interaction?.inputId,
      current.inputId);
  });

  it('forwards only the confirmed current plan identity through chat resume', async () => {
    const pending = plan();
    const context = sinon.createStubInstance(FrontierContext);
    context.hasCliRuntime.returns(true);
    context.runCli.resolves(JSON.stringify({
      sessionId: pending.sessionId, pendingInteraction: pending,
    }));
    context.runCliStreaming.resolves(JSON.stringify({
      sessionId: pending.sessionId, pendingInteraction: null, exitReason: 'text_response',
    }));
    await resumePendingClarification(createMockResponseStream(), context, {
      sessionId: pending.sessionId, agentName: pending.agent, prompt: 'Fixture',
      interaction: pending,
    }, 'approve');
    assert.deepEqual(context.runCliStreaming.firstCall.args[1],
      buildInteractionResumeArgs(pending, 'approve'));
    sinon.assert.calledOnce(context.clearPendingClarification);
  });
});
