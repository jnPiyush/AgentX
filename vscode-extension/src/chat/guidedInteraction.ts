import { PendingInteraction, InteractionPlan } from '../frontierContextTypes';
import { stripAnsi } from '../utils/stripAnsi';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isPlan(value: unknown): value is InteractionPlan {
  return isRecord(value)
    && typeof value.sessionId === 'string' && typeof value.workspaceRoot === 'string'
    && typeof value.agent === 'string' && value.engine === 'native' && value.mode === 'guided'
    && Number.isInteger(value.version) && typeof value.goal === 'string'
    && isTextList(value.scope) && isTextList(value.nonGoals) && isTextList(value.assumptions)
    && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.length <= 10
    && value.steps.every((step, index) => isRecord(step) && step.id === `s${index + 1}`
      && typeof step.title === 'string' && typeof step.verification === 'string');
}

export function isPendingInteraction(value: unknown): value is PendingInteraction {
  if (!isRecord(value) || typeof value.sessionId !== 'string'
    || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value.sessionId)
    || typeof value.agent !== 'string' || typeof value.inputId !== 'string'
    || !/^[a-f0-9]{32}$/.test(value.inputId)
    || typeof value.phase !== 'string' || typeof value.message !== 'string') {
    return false;
  }
  if (value.kind === 'question') {
    return value.phase === 'awaiting_input' && typeof value.question === 'string'
      && isTextList(value.choices);
  }
  return value.kind === 'plan' && value.phase === 'awaiting_plan'
    && typeof value.planVersion === 'number' && Number.isInteger(value.planVersion)
    && value.planVersion > 0 && typeof value.digest === 'string'
    && /^[a-f0-9]{64}$/.test(value.digest) && isPlan(value.plan)
    && value.plan.sessionId === value.sessionId && value.plan.agent === value.agent
    && value.plan.version === value.planVersion;
}

export function readPendingInteraction(output: string): PendingInteraction | undefined {
  const clean = stripAnsi(output).trim();
  const lastLine = clean.split(/\r?\n/).at(-1) ?? '';
  if (!lastLine.startsWith('{')) {
    if (clean.includes('[FRONTIER INPUT]')) {
      throw new Error('The runtime input record has no final JSON result. No decision was applied.');
    }
    return undefined;
  }
  const result: unknown = JSON.parse(lastLine);
  if (!isRecord(result)) { throw new Error('Invalid runtime result.'); }
  if (!('pendingInteraction' in result) || result.pendingInteraction === null) { return undefined; }
  if (!isPendingInteraction(result.pendingInteraction)
    || result.sessionId !== result.pendingInteraction.sessionId) {
    throw new Error('Invalid pending input identity. Inspect the native session before continuing.');
  }
  return result.pendingInteraction;
}

export function renderPendingInteraction(pending: PendingInteraction): string {
  const title = pending.kind === 'plan'
    ? `Plan v${pending.planVersion} awaiting your approval`
    : 'Clarification required';
  const body = JSON.stringify(pending.kind === 'plan' ? pending.plan : {
    question: pending.question, choices: pending.choices,
  }, null, 2);
  const fence = '`'.repeat(Math.max(3, ...Array.from(body.matchAll(/`+/g),
    match => match[0].length + 1)));
  const instruction = pending.kind === 'plan'
    ? 'Reply `approve` to execute this unchanged plan, describe changes to revise it, or `cancel` to stop. Approval does not waive separate review or test consent.'
    : 'Reply with your answer, or `cancel task` to stop. Answering this question does not approve a plan.';
  return `**${title}**\n\n${fence}json\n${body}\n${fence}\n\n${instruction}`;
}

export function buildInteractionResumeArgs(pending: PendingInteraction, text: string): string[] {
  const response = text.trim();
  if (!response) { throw new Error('A user response is required; the task remains pending.'); }
  const args = ['--resume-session', pending.sessionId, '--input-id', pending.inputId];
  if (pending.kind === 'question') {
    const matchesChoice = pending.choices.some(choice =>
      choice.toLocaleLowerCase() === response.toLocaleLowerCase());
    if (/^cancel task[.!]?$/i.test(response) || (!matchesChoice && /^cancel[.!]?$/i.test(response))) {
      return [...args, '--input-decision', 'cancel', '--json'];
    }
    return [...args, '--input-decision', 'answer', '--clarification-response', response, '--json'];
  }
  if (/^(cancel(?: task)?|stop|abort)[.!]?$/i.test(response)) {
    return [...args, '--input-decision', 'cancel', '--json'];
  }
  const approve = /^(approve(?: the plan)?|yes|go ahead|proceed)[.!]?$/i.test(response);
  if (/^(no|decline|reject)[.!]?$/i.test(response)) {
    throw new Error('Plan not approved. Describe the required changes, or cancel the task.');
  }
  return [...args, '--input-decision', approve ? 'approve' : 'revise',
    '--plan-version', String(pending.planVersion), '--plan-digest', pending.digest,
    ...(approve ? [] : ['--clarification-response', response]), '--json'];
}
