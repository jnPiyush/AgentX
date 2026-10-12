import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  __resetLmTimeoutForTests,
  __setLmTimeoutForTests,
  classifyIntentWithLM,
} from '../../chat/lmIntentClassifier';

describe('classifyIntentWithLM deadline', () => {
  afterEach(() => {
    sinon.restore();
    __resetLmTimeoutForTests();
  });

  it('bounds stalled model selection with the classifier deadline', async () => {
    sinon.stub(vscode.lm, 'selectChatModels').returns(new Promise(() => { /* never resolves */ }) as never);
    __setLmTimeoutForTests(20);
    const started = Date.now();
    const result = await classifyIntentWithLM('show status');
    assert.equal(result, undefined);
    assert.ok(Date.now() - started < 1000, 'selection must not outlive the deadline');
  });

  it('clears the deadline timer when classification finishes first', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    sinon.stub(vscode.lm, 'selectChatModels').resolves([] as never);
    __setLmTimeoutForTests(60000);
    const result = await classifyIntentWithLM('show status');
    assert.equal(result, undefined);
    assert.equal(clock.countTimers(), 0, 'no deadline timer may remain pending');
  });

  it('returns immediately when the request is already cancelled', async () => {
    const select = sinon.stub(vscode.lm, 'selectChatModels').resolves([] as never);
    const token = { isCancellationRequested: true, onCancellationRequested: () => ({ dispose() { /* noop */ } }) };
    const result = await classifyIntentWithLM('show status', token as unknown as vscode.CancellationToken);
    assert.equal(result, undefined);
    assert.equal(select.called, false, 'a cancelled request makes no model selection call');
  });
});
