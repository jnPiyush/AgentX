const SESSION = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const AGENT = /^[a-z][a-z0-9-]{0,63}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sessionId = value => typeof value === 'string' && SESSION.test(value);
const agentId = value => typeof value === 'string' && AGENT.test(value);
const textList = value => Array.isArray(value) && value.length <= 10
  && value.every(item => typeof item === 'string' && item.trim() && item.length <= 300);

function validatePending(value) {
  if (!record(value) || !sessionId(value.sessionId) || !agentId(value.agent)
    || typeof value.inputId !== 'string' || !/^[a-f0-9]{32}$/.test(value.inputId)) {
    throw new Error('Invalid native pending-input identity.');
  }
  if (value.kind === 'question') {
    if (value.phase !== 'awaiting_input' || typeof value.question !== 'string'
      || !value.question.trim() || value.question.length > 1500 || !textList(value.choices)
      || value.choices.length === 1 || value.choices.length > 5) {
      throw new Error('Invalid native clarification request.');
    }
  } else if (value.kind === 'plan') {
    const plan = value.plan;
    if (value.phase !== 'awaiting_plan' || !Number.isSafeInteger(value.planVersion) || value.planVersion < 1
      || typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest)
      || !record(plan) || plan.sessionId !== value.sessionId || plan.agent !== value.agent
      || plan.version !== value.planVersion || plan.mode !== 'guided' || plan.engine !== 'native'
      || typeof plan.goal !== 'string' || !plan.goal.trim() || plan.goal.length > 1500
      || !textList(plan.scope) || !plan.scope.length || !textList(plan.nonGoals) || !textList(plan.assumptions)
      || !Array.isArray(plan.steps) || !plan.steps.length || plan.steps.length > 10
      || !plan.steps.every((step, index) => record(step) && step.id === `s${index + 1}`
        && typeof step.title === 'string' && step.title.trim() && step.title.length <= 300
        && typeof step.verification === 'string' && step.verification.trim() && step.verification.length <= 600)
      || JSON.stringify(plan).length > 40000) {
      throw new Error('Invalid native plan identity or content.');
    }
  } else {
    throw new Error('Unsupported native pending-input kind.');
  }
  return value;
}

function parseRuntimeResult(result, expected = {}) {
  if (!result || result.terminationConfirmed === false) throw new Error('Runtime termination was not confirmed.');
  const clean = String(result.stdout ?? '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').trim();
  const line = clean.split(/\r?\n/).at(-1) ?? '';
  let payload;
  try { payload = JSON.parse(line); } catch {
    throw new Error('Frontier returned no valid final session JSON. Inspect the local runtime output.');
  }
  if (!record(payload) || !sessionId(payload.sessionId) || !Number.isInteger(result.exitCode)
    || (expected.sessionId && payload.sessionId !== expected.sessionId)
    || (expected.agent && payload.agent !== undefined && payload.agent !== expected.agent)) {
    throw new Error('Native result does not match the requested session.');
  }
  const pending = payload.pendingInteraction == null ? undefined : validatePending(payload.pendingInteraction);
  if (pending && (pending.sessionId !== payload.sessionId || (expected.agent && pending.agent !== expected.agent))) {
    throw new Error('Native pending request belongs to another session or agent.');
  }
  if (expected.inspection === true && (result.exitCode !== 0 || result.ok !== true)) {
    throw new Error('Native session inspection failed; no lifecycle decision or response was applied.');
  }
  if (result.exitCode === 2 && !pending) throw new Error('Native input-required result has no pending request.');
  if (pending && ![0, 2].includes(result.exitCode)) throw new Error('Failed runtime output cannot authorize a pending response.');
  return {
    ...result, sessionId: payload.sessionId, pendingInteraction: pending,
    exitReason: payload.exitReason, phase: payload.phase,
    finalText: typeof payload.finalText === 'string' ? payload.finalText : '',
    inspection: expected.inspection === true,
    cancelled: result.exitCode === 4 || payload.exitReason === 'cancelled'
      || (expected.inspection === true && payload.phase === 'cancelled'),
    ok: expected.inspection !== true && result.exitCode === 0 && result.ok === true && !pending,
  };
}

function startArguments(agent, instruction) {
  if (!agentId(agent) || typeof instruction !== 'string' || !instruction.trim()
    || instruction.length > 12000 || instruction.trimStart().startsWith('-')) {
    throw new Error('A valid agent and bounded instruction are required.');
  }
  return ['run', '-a', agent, '-p', instruction, '--json'];
}

function inspectArguments(sessionId) {
  if (typeof sessionId !== 'string' || !SESSION.test(sessionId)) throw new Error('Invalid session identifier.');
  return ['run', '--session-info', sessionId, '--json'];
}

function responseArguments(pending, decision, text = '') {
  validatePending(pending);
  if (!['answer', 'approve', 'revise', 'cancel'].includes(decision)
    || typeof text !== 'string' || text.length > 12000) throw new Error('Invalid native response.');
  if (decision === 'answer' && pending.kind !== 'question') throw new Error('Answer cannot approve a plan.');
  if (['approve', 'revise'].includes(decision) && pending.kind !== 'plan') throw new Error('A question cannot approve a plan.');
  if (['answer', 'revise'].includes(decision) && !text.trim()) throw new Error('A nonempty answer or revision is required.');
  if (['approve', 'cancel'].includes(decision) && text.trim()) throw new Error('Approval and cancellation cannot include edits.');
  return ['run', '--resume-session', pending.sessionId, '--input-id', pending.inputId,
    '--input-decision', decision,
    ...(pending.kind === 'plan' ? ['--plan-version', String(pending.planVersion), '--plan-digest', pending.digest] : []),
    ...(text ? ['--clarification-response', text] : []), '--json'];
}

function samePendingRequest(first, second) {
  if (!first || !second) return false;
  validatePending(first);
  validatePending(second);
  return first.sessionId === second.sessionId && first.agent === second.agent
    && first.inputId === second.inputId && first.kind === second.kind
    && (first.kind !== 'plan' || (first.planVersion === second.planVersion && first.digest === second.digest));
}

function formatPending(pending, reference = pending.sessionId) {
  validatePending(pending);
  const detail = pending.kind === 'plan'
    ? `Plan v${pending.planVersion}\n${JSON.stringify(pending.plan, null, 2)}`
    : `Question: ${pending.question}${pending.choices.length ? `\nChoices: ${pending.choices.join(' | ')}` : ''}`;
  const reply = pending.kind === 'plan'
    ? `respond ${reference} approve\nrespond ${reference} revise <feedback>`
    : `respond ${reference} answer <your answer>`;
  return `Awaiting your input.\n${detail}\n\n${reply}\nrespond ${reference} cancel\nResponses require a new confirmation; task confirmation is not plan approval.`;
}

module.exports = {
  SESSION, AGENT, validatePending, parseRuntimeResult, startArguments,
  inspectArguments, responseArguments, samePendingRequest, formatPending,
};
