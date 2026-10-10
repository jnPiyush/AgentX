const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseRuntimeResult, startArguments, responseArguments, samePendingRequest, formatPending,
} = require('../src/guidedInteraction');

function pendingPlan() {
  return {
    sessionId: 'engineer-fixture', agent: 'engineer', inputId: 'a'.repeat(32),
    kind: 'plan', phase: 'awaiting_plan', planVersion: 1, digest: 'b'.repeat(64),
    plan: {
      sessionId: 'engineer-fixture', agent: 'engineer', version: 1, mode: 'guided', engine: 'native',
      goal: 'Add a health endpoint', scope: ['src/server.js'], nonGoals: [], assumptions: [],
      steps: [{ id: 's1', title: 'Implement endpoint', verification: 'Inspect response contract' }],
    },
  };
}

test('a native input-required result is pending, not a completed task', () => {
  const pending = pendingPlan();
  const result = parseRuntimeResult({ ok: false, exitCode: 2, stdout: JSON.stringify({
    sessionId: pending.sessionId, pendingInteraction: pending,
  }) });
  assert.equal(result.ok, false);
  assert.deepEqual(result.pendingInteraction, pending);
  assert.match(formatPending(pending, 'job-id'), /respond job-id approve/);
  assert.match(formatPending(pending), /Inspect response contract/);
});

test('task starts stay guided and approval uses the exact native input identity', () => {
  assert.deepEqual(startArguments('engineer', 'Task'), ['run', '-a', 'engineer', '-p', 'Task', '--json']);
  assert.deepEqual(responseArguments(pendingPlan(), 'approve'), [
    'run', '--resume-session', 'engineer-fixture', '--input-id', 'a'.repeat(32),
    '--input-decision', 'approve', '--plan-version', '1', '--plan-digest', 'b'.repeat(64), '--json',
  ]);
  assert.throws(() => responseArguments(pendingPlan(), 'approve', 'but change the goal'));
  assert.throws(() => responseArguments(pendingPlan(), 'answer', 'yes'));
  assert.throws(() => startArguments('--engine', 'Task'));
});

test('malformed, mismatched and stale records cannot become approvals', () => {
  const pending = pendingPlan();
  assert.throws(() => parseRuntimeResult({ exitCode: 2, stdout: '{}' }));
  assert.throws(() => parseRuntimeResult({ ok: true, exitCode: 0, stdout: '{}' }));
  assert.throws(() => parseRuntimeResult({ exitCode: 2, stdout: JSON.stringify({
    sessionId: 'different', pendingInteraction: pending,
  }) }));
  assert.equal(samePendingRequest(pending, { ...pending, inputId: 'c'.repeat(32) }), false);
  assert.equal(samePendingRequest(pending, pending), true);
  assert.throws(() => responseArguments({ ...pending, digest: 'wrong' }, 'approve'));
});

test('inspection is not execution success and cancelled metadata is explicit', () => {
  for (const phase of ['executing', 'discovery', 'completed', 'cancelled']) {
    const result = parseRuntimeResult({
      ok: true, exitCode: 0, stdout: JSON.stringify({ sessionId: 'engineer-fixture', phase, pendingInteraction: null }),
    }, { inspection: true });
    assert.equal(result.ok, false);
    assert.equal(result.inspection, true);
    assert.equal(result.cancelled, phase === 'cancelled');
  }
  assert.throws(() => parseRuntimeResult({
    ok: false, exitCode: 1, stdout: JSON.stringify({ sessionId: 'engineer-fixture', phase: 'cancelled' }),
  }, { inspection: true }), /inspection failed/);
});
