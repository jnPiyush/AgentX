import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import {
  getLearningCaptureTarget,
  getDefaultLearningsQuery,
  rankLearnings,
  renderBrainstormGuidanceMarkdown,
  renderCompoundLoopMarkdown,
  renderCaptureGuidanceMarkdown,
  renderRankedLearningsMarkdown,
} from '../utils/learnings';
import {
  evaluateWorkflowGuidance,
  renderOperatorEnablementChecklistMarkdown,
  renderWorkflowEntryPointMarkdown,
  renderWorkflowGuidanceMarkdown,
  renderWorkflowRolloutScorecardMarkdown,
  type LocalIssue,
} from '../utils/workflowGuidance';
import {
  evaluateAgentNativeReview,
  renderAgentNativeReviewMarkdown,
} from '../review/agent-native-review';
import {
  loadReviewFindingRecords,
  promoteReviewFinding,
  renderReviewFindingsMarkdown,
} from '../review/review-findings';
import {
  listTaskBundles,
  renderTaskBundlesText,
} from '../taskBundles/task-bundles';
import {
  saveBrainstormRecord,
} from '../utils/clarificationLedger';
import {
  listBoundedParallelRuns,
  renderBoundedParallelRunsText,
} from '../parallel/parallel-delivery';
import { stripAnsi } from '../utils/stripAnsi';

const CHAT_OUTPUT_CHANNEL_NAME = 'Frontier Chat';
const CHAT_OUTPUT_INLINE_LIMIT = 4000;
const CHAT_OUTPUT_PREVIEW_LINES = 8;
const LIVE_STATUS_PATTERN = /\[(?:COMPACTION|CLARIFY(?: RESPONSE| DETAIL| \d+\/\d+)?|SELF-REVIEW(?: SUMMARY)?|EXECUTION SUMMARY|MODEL FALLBACK|LOOP WARNING|CIRCUIT BREAKER|TOOL ERROR|BOUNDARY BLOCKED|FAIL|WARN|PASS|HUMAN ESCALATION|HUMAN REQUIRED|HUMAN RESPONSE|HUMAN REQUIRED SESSION)\]|^\s*Iteration \d+\/\d+|^\s*Tool:/i;
const CHAT_VISIBLE_DISCUSSION_PATTERN = /^\[(?:CLARIFY(?: RESPONSE| DETAIL| \d+\/\d+)?|HUMAN ESCALATION|HUMAN REQUIRED|HUMAN RESPONSE)\]/i;
const HUMAN_REQUIRED_SESSION_PATTERN = /\[HUMAN REQUIRED SESSION\]\s+(.+)$/i;
const EXECUTION_SUMMARY_PATTERN = /^\[EXECUTION SUMMARY\].*$/gim;
const SELF_REVIEW_SUMMARY_PATTERN = /^\[SELF-REVIEW SUMMARY\].*$/gim;

export type PendingClarification = NonNullable<
  Awaited<ReturnType<FrontierContext['getPendingClarification']>>
>;

let chatOutputChannel: vscode.OutputChannel | undefined;

function hasWorkspaceCliRuntime(agentx: FrontierContext): boolean {
  return typeof (agentx as FrontierContext & { hasCliRuntime?: () => boolean }).hasCliRuntime !== 'function'
    || (agentx as FrontierContext & { hasCliRuntime: () => boolean }).hasCliRuntime();
}

function renderMissingRuntimeMessage(): string {
  return [
    '**Frontier workspace initialization is not available in this workspace.**',
    '',
    'This workspace has an open folder, but it has not been initialized with the `.agentx` state and artifact folders needed for `run`, loop execution, or clarification resume.',
    '',
    'To enable formal Frontier execution in this repo, run **Frontier: Initialize Local Runtime** first.',
  ].join('\n');
}

function renderPlainTextMarkdown(title: string, body: string, followup?: ReadonlyArray<string>): string {
  const lines = [
    `**${title}**`,
    '',
    '```text',
    body,
    '```',
  ];

  if (followup && followup.length > 0) {
    lines.push('', ...followup);
  }

  return lines.join('\n');
}

export function resetChatRouterInternalStateForTests(): void {
  chatOutputChannel = undefined;
}

export async function runAgentCommand(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  agentName: string,
  task: string,
  signal?: AbortSignal,
): Promise<vscode.ChatResult> {
  if (signal?.aborted) { return {}; }
  if (!hasWorkspaceCliRuntime(agentx)) {
    response.markdown(renderMissingRuntimeMessage());
    return {};
  }

  try {
    response.progress(`Running ${agentName} agent...`);
    let pendingSessionId = '';
    const visibleDiscussionLines: string[] = [];
    const output = await agentx.runCliStreaming(
      'run',
      [agentName, task],
      (line) => {
        const normalized = normalizeCliLine(line);
        const sessionMatch = normalized.match(HUMAN_REQUIRED_SESSION_PATTERN);
        if (sessionMatch) {
          pendingSessionId = sessionMatch[1].trim();
        }
        if (normalized && shouldSurfaceCliLine(normalized)) {
          response.progress(normalized);
        }
        if (normalized && shouldKeepDiscussionLineInChat(normalized)) {
          visibleDiscussionLines.push(normalized);
        }
      },
      { AGENTX_NONINTERACTIVE_HUMAN: '1' },
      agentx.workspaceRoot,
      { signal },
    );

    writeOutputToChannel(`Frontier Chat Run: ${agentName}`, output);

    if (pendingSessionId) {
      await updatePendingClarification(agentx, {
        sessionId: pendingSessionId,
        agentName,
        prompt: task,
        humanPrompt: stripAnsi(output),
      });
      response.markdown(`${formatChatVisibleOutput(output, visibleDiscussionLines)}\n\n${buildContinueGuidance(agentName)}`);
      return {};
    }

    await clearPendingClarification(agentx);
    response.markdown(formatChatVisibleOutput(output, visibleDiscussionLines));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') { return {}; }
    const msg = err instanceof Error ? err.message : String(err);
    response.markdown(`**Frontier error:** ${msg}`);
  }

  return {};
}

export async function resumePendingClarification(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  pending: PendingClarification,
  guidance: string,
  signal?: AbortSignal,
): Promise<vscode.ChatResult> {
  if (signal?.aborted) { return {}; }
  if (!hasWorkspaceCliRuntime(agentx)) {
    response.markdown(renderMissingRuntimeMessage());
    return {};
  }

  try {
    response.progress(`Resuming ${pending.agentName} agent...`);
    let nextPendingSessionId = '';
    const visibleDiscussionLines: string[] = [];
    const output = await agentx.runCliStreaming(
      'run',
      [
        '--resume-session', pending.sessionId,
        '--clarification-response', guidance,
      ],
      (line) => {
        const normalized = normalizeCliLine(line);
        const sessionMatch = normalized.match(HUMAN_REQUIRED_SESSION_PATTERN);
        if (sessionMatch) {
          nextPendingSessionId = sessionMatch[1].trim();
        }
        if (normalized && shouldSurfaceCliLine(normalized)) {
          response.progress(normalized);
        }
        if (normalized && shouldKeepDiscussionLineInChat(normalized)) {
          visibleDiscussionLines.push(normalized);
        }
      },
      { AGENTX_NONINTERACTIVE_HUMAN: '1' },
      agentx.workspaceRoot,
      { signal },
    );

    writeOutputToChannel(`Frontier Chat Resume: ${pending.agentName}`, output);

    if (nextPendingSessionId) {
      await updatePendingClarification(agentx, {
        sessionId: nextPendingSessionId,
        agentName: pending.agentName,
        prompt: pending.prompt,
        humanPrompt: stripAnsi(output),
      });
      response.markdown(`${formatChatVisibleOutput(output, visibleDiscussionLines)}\n\n${buildContinueGuidance(pending.agentName)}`);
      return {};
    }

    await clearPendingClarification(agentx);
    response.markdown(formatChatVisibleOutput(output, visibleDiscussionLines));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') { return {}; }
    const msg = err instanceof Error ? err.message : String(err);
    response.markdown(`**Frontier error:** ${msg}`);
  }

  return {};
}

export async function getPendingClarification(
  agentx: FrontierContext,
): Promise<PendingClarification | undefined> {
  return typeof agentx.getPendingClarification === 'function'
    ? await agentx.getPendingClarification()
    : undefined;
}

export function buildPendingClarificationMessage(
  pending: {
    agentName: string;
    prompt: string;
    humanPrompt?: string;
    fromAgent?: string;
    targetAgent?: string;
    topic?: string;
    status?: string;
    exchangeCount?: number;
  },
): string {
  const lines = [
    `**Pending clarification for ${pending.agentName}**`,
    '',
  ];

  if (pending.topic || pending.targetAgent || pending.fromAgent || pending.status) {
    lines.push('Contract state:');
    if (pending.fromAgent) {
      lines.push(`- From: ${pending.fromAgent}`);
    }
    if (pending.targetAgent) {
      lines.push(`- To: ${pending.targetAgent}`);
    }
    if (pending.topic) {
      lines.push(`- Topic: ${pending.topic}`);
    }
    if (pending.status) {
      lines.push(`- Status: ${pending.status}`);
    }
    if (typeof pending.exchangeCount === 'number') {
      lines.push(`- Exchanges so far: ${pending.exchangeCount}`);
    }
    lines.push('');
  }

  if (pending.humanPrompt) {
    lines.push(pending.humanPrompt, '');
  }

  lines.push(
    `Original task: ${pending.prompt}`,
    '',
    'Reply in plain language with the guidance you want Frontier to use. You can also still use `@frontier continue "..."` explicitly.',
  );

  return lines.join('\n');
}

export function renderUsageGuidance(): string {
  return (
    '**Frontier** - Digital Force for Software Delivery\n\n'
    + 'Usage:\n'
    + '- `@frontier initialize local runtime`\n'
    + '- `@frontier add remote adapter`\n'
    + '- `@frontier add llm adapter`\n'
    + '- `@frontier add plugin`\n'
    + '- `@frontier run engineer "implement the health endpoint for issue #42"`\n'
    + '- `@frontier continue "use the existing auth flow and keep refresh tokens"`\n'
    + '- `@frontier brainstorm auth rollout constraints`\n'
    + '- `@frontier workflow next step`\n'
    + '- `@frontier deepen plan`\n'
    + '- `@frontier kick off review`\n'
    + '- `@frontier rollout scorecard`\n'
    + '- `@frontier enablement checklist`\n'
    + '- `@frontier learnings planning`\n'
    + '- `@frontier learnings review auth workflow`\n'
    + '- `@frontier compound`\n'
    + '- `@frontier create learning capture`\n'
    + '- `@frontier capture guidance`\n'
    + '- `@frontier agent-native review`\n'
    + '- `@frontier review findings`\n'
    + '- `@frontier promote finding FINDING-164-001`\n'
    + '- `@frontier task bundles`\n'
    + '- `@frontier bounded parallel`\n'
    + '- `@frontier run architect "design the auth system"`\n'
    + '- `@frontier run reviewer "review the changes in issue #42"`\n\n'
    + 'During execution, live status updates for compaction, clarification, loop progress, tool activity, and self-review are streamed into chat.'
  );
}

/**
 * Match natural-language intents to initialize the Frontier local runtime in the
 * current workspace. Tolerates Frontier and legacy AgentX phrasings plus the
 * common typo "initalize".
 */
export function matchesInitializeIntent(userText: string): boolean {
  const normalized = userText
    .toLowerCase()
    .replace(/^(?:please|can you|could you)\s+/i, '')
    .replace(/^(?:frontier|agentx)[:,\s]+/i, '')
    .replace(/\bagent\s*x\b/gi, 'agentx')
    .replace(/[?!.]+$/g, '')
    .trim();

  if (!normalized) {
    return false;
  }

  const initVerb = '(?:initialize|initialise|initalize|init|setup|set\\s*up|configure|bootstrap)';
  const target = '(?:local\\s*runtime|workspace|project|repo|repository|frontier|agentx)';

  const patterns: RegExp[] = [
    new RegExp(`^${initVerb}$`),
    new RegExp(`^${initVerb}\\s+(?:the\\s+)?${target}(?:\\s+(?:in|for)\\s+(?:this|the)\\s+(?:workspace|repo|repository|project))?$`),
    new RegExp(`^(?:frontier|agentx)\\s+${initVerb}(?:\\s+${target})?$`),
    new RegExp(`^${target}\\s+${initVerb}$`),
    new RegExp(`^run\\s+(?:the\\s+)?(?:frontier|agentx)\\s+${initVerb}(?:\\s+command)?$`),
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

export async function tryHandleWorkspaceSetupRequest(
  userText: string,
  response: vscode.ChatResponseStream,
): Promise<vscode.ChatResult | undefined> {
  if (matchesInitializeIntent(userText)) {
    try {
      await vscode.commands.executeCommand('frontier.initializeLocalRuntime');
      response.markdown('Opened **Frontier: Initialize Local Runtime** for this workspace.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      response.markdown(`**Frontier error:** ${message}`);
    }
    return {};
  }

  if (/^(?:agentx:\s*)?(?:add plugin|install plugin)$/i.test(userText)) {
    try {
      await vscode.commands.executeCommand('frontier.addPlugin');
      response.markdown('Opened **Frontier: Add Plugin** for this workspace.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      response.markdown(`**Frontier error:** ${message}`);
    }
    return {};
  }

  return undefined;
}

export async function tryHandleWorkflowNextStepRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
  issues?: readonly LocalIssue[],
): Promise<vscode.ChatResult | undefined> {
  if (!/^(workflow next step|workflow guidance|next workflow step)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowGuidanceMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending, issues),
  ));
  return {};
}

export async function tryHandlePlanDeepeningRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
  issues?: readonly LocalIssue[],
): Promise<vscode.ChatResult | undefined> {
  if (!/^(deepen plan|plan deepening)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowEntryPointMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending, issues),
    'plan-deepening',
  ));
  return {};
}

export async function tryHandleReviewKickoffRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
  issues?: readonly LocalIssue[],
): Promise<vscode.ChatResult | undefined> {
  if (!/^(kick off review|review kickoff)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowEntryPointMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending, issues),
    'review-kickoff',
  ));
  return {};
}

export async function tryHandleWorkflowRolloutRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
  issues?: readonly LocalIssue[],
): Promise<vscode.ChatResult | undefined> {
  if (!/^(rollout scorecard|workflow rollout)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowRolloutScorecardMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending, issues),
  ));
  return {};
}

export async function tryHandleEnablementChecklistRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
  issues?: readonly LocalIssue[],
): Promise<vscode.ChatResult | undefined> {
  if (!/^(enablement checklist|operator checklist)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderOperatorEnablementChecklistMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending, issues),
  ));
  return {};
}

export function buildContinueGuidance(agentName: string): string {
  return `Clarification is waiting for your input for the ${agentName} agent. Continue with:\n\n- \`@frontier continue "your guidance here"\``;
}

function parsePendingClarificationDetails(humanPrompt?: string): {
  fromAgent?: string;
  targetAgent?: string;
  topic?: string;
  status?: string;
  exchangeCount?: number;
} {
  if (!humanPrompt) {
    return {};
  }

  const details: {
    fromAgent?: string;
    targetAgent?: string;
    topic?: string;
    status?: string;
    exchangeCount?: number;
  } = {};

  const fromMatch = humanPrompt.match(/^From:\s*(.+)$/im);
  if (fromMatch) {
    details.fromAgent = fromMatch[1].trim();
  }

  const toMatch = humanPrompt.match(/^To:\s*(.+)$/im);
  if (toMatch) {
    details.targetAgent = toMatch[1].trim();
  }

  const topicMatch = humanPrompt.match(/^Topic:\s*(.+)$/im);
  if (topicMatch) {
    details.topic = topicMatch[1].trim();
  }

  const statusMatch = humanPrompt.match(/^Status:\s*(.+)$/im);
  if (statusMatch) {
    details.status = statusMatch[1].trim();
  }

  const exchangeMatches = humanPrompt.match(/^\s*Iteration\s+\d+:/gim);
  if (exchangeMatches) {
    details.exchangeCount = exchangeMatches.length;
  }

  return details;
}

export async function tryHandleClarificationStatusRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  pending: PendingClarification | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(clarification status|pending clarification)$/i.test(userText)) {
    return undefined;
  }

  if (!pending) {
    response.markdown('There is no pending clarification right now.');
    return {};
  }

  response.markdown(buildPendingClarificationMessage(pending));
  return {};
}

export async function tryHandleContinueRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  pending: PendingClarification | undefined,
  signal?: AbortSignal,
): Promise<vscode.ChatResult | undefined> {
  const continueMatch = userText.match(/^continue(?:\s+(.+))?$/is);
  if (!continueMatch) {
    return undefined;
  }

  if (!pending) {
    response.markdown('There is no pending clarification to continue. Start a run first.');
    return {};
  }

  const guidance = continueMatch[1]?.trim();
  if (!guidance) {
    response.markdown(buildPendingClarificationMessage(pending));
    return {};
  }

  return resumePendingClarification(response, agentx, pending, guidance, signal);
}

export async function tryHandleLearningsRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
): Promise<vscode.ChatResult | undefined> {
  const learningsMatch = userText.match(/^learnings\s+(planning|plan|review)(?:\s+(.+))?$/is);
  if (!learningsMatch) {
    return undefined;
  }

  const intent = /review/i.test(learningsMatch[1]) ? 'review' : 'planning';
  const resolvedQuery = workspaceRoot
    ? (learningsMatch[2]?.trim() || getDefaultLearningsQuery(workspaceRoot, intent))
    : (learningsMatch[2]?.trim() || '');
  const results = workspaceRoot ? rankLearnings(workspaceRoot, intent, resolvedQuery) : [];
  response.markdown(renderRankedLearningsMarkdown(intent, results, resolvedQuery));
  return {};
}

export async function tryHandleBrainstormRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
): Promise<vscode.ChatResult | undefined> {
  const brainstormMatch = userText.match(/^(?:ce:)?brainstorm(?:\s+(.+))?$/is);
  if (!brainstormMatch) {
    return undefined;
  }

  if (!workspaceRoot) {
    response.markdown('No workspace is open, so Frontier cannot brainstorm against repo context.');
    return {};
  }

  const resolvedQuery = brainstormMatch[1]?.trim() || getDefaultLearningsQuery(workspaceRoot, 'planning');
  const results = rankLearnings(workspaceRoot, 'planning', resolvedQuery);
  const rendered = renderBrainstormGuidanceMarkdown(workspaceRoot, resolvedQuery, results);
  response.markdown(rendered);

  // Persist the brainstorm session to the local clarification ledger
  try {
    const summary = results.length > 0
      ? results.slice(0, 3).map(r => r.title || r.relativePath || '(untitled)').join('; ')
      : '(no matching learnings)';
    saveBrainstormRecord(workspaceRoot, 0, resolvedQuery, summary);
  } catch {
    // Best-effort persistence -- do not block the brainstorm response
  }

  return {};
}

export async function tryHandleCaptureGuidanceRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(capture guidance|knowledge capture|capture)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderCaptureGuidanceMarkdown(workspaceRoot));
  return {};
}

export async function tryHandleCompoundRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(?:ce:)?compound(?:\s+loop)?$/i.test(userText)) {
    return undefined;
  }

  response.markdown(workspaceRoot
    ? renderCompoundLoopMarkdown(workspaceRoot)
    : 'No workspace is open, so Frontier cannot evaluate the compound loop.');
  return {};
}

export async function tryHandleTaskBundleRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(?:show|list)?\s*task bundles?$/i.test(userText.trim())) {
    return undefined;
  }

  if (!agentx.workspaceRoot) {
    response.markdown('No workspace is open, so Frontier cannot inspect task bundles.');
    return {};
  }

  if (!hasWorkspaceCliRuntime(agentx)) {
    response.markdown(renderMissingRuntimeMessage());
    return {};
  }

  const bundles = await listTaskBundles(agentx, { all: true });
  response.markdown(renderPlainTextMarkdown(
    'Task Bundles',
    renderTaskBundlesText(bundles),
    [
      'Interactive creation, resolution, and promotion stay in command surfaces:',
      '- `Frontier: Create Task Bundle`',
      '- `Frontier: Resolve Task Bundle`',
      '- `Frontier: Promote Task Bundle`',
    ],
  ));
  return {};
}

export async function tryHandleBoundedParallelRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(?:show|list)?\s*(?:bounded\s+)?parallel(?:\s+runs?)?$/i.test(userText.trim())) {
    return undefined;
  }

  if (!agentx.workspaceRoot) {
    response.markdown('No workspace is open, so Frontier cannot inspect bounded parallel runs.');
    return {};
  }

  if (!hasWorkspaceCliRuntime(agentx)) {
    response.markdown(renderMissingRuntimeMessage());
    return {};
  }

  const runs = await listBoundedParallelRuns(agentx);
  response.markdown(renderPlainTextMarkdown(
    'Bounded Parallel Runs',
    renderBoundedParallelRunsText(runs),
    [
      'Interactive assessment, start, and reconciliation stay in command surfaces:',
      '- `Frontier: Assess Bounded Parallel Delivery`',
      '- `Frontier: Start Bounded Parallel Delivery`',
      '- `Frontier: Reconcile Bounded Parallel Run`',
    ],
  ));
  return {};
}

export async function tryHandleCreateLearningCaptureRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(capture learning|create learning capture|scaffold learning)$/i.test(userText)) {
    return undefined;
  }

  if (!workspaceRoot) {
    response.markdown('No workspace is open, so Frontier cannot create a learning capture file.');
    return {};
  }

  await vscode.commands.executeCommand('frontier.createLearningCapture');
  const target = getLearningCaptureTarget(workspaceRoot);
  response.markdown(
    `Opened a learning capture artifact for ${target?.issueNumber ? `issue #${target.issueNumber}` : 'the current context'}.`,
  );
  return {};
}

export async function tryHandleAgentNativeReviewRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(agent-native review|parity review|agent parity)$/i.test(userText)) {
    return undefined;
  }

  const report = evaluateAgentNativeReview(agentx);
  response.markdown(report
    ? renderAgentNativeReviewMarkdown(report)
    : 'No workspace is open, so Frontier cannot evaluate agent-native review parity.');
  return {};
}

export async function tryHandleReviewFindingsRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(review findings|findings review|durable findings)$/i.test(userText)) {
    return undefined;
  }

  const records = workspaceRoot ? loadReviewFindingRecords(workspaceRoot) : [];
  response.markdown(renderReviewFindingsMarkdown(records));
  return {};
}

export async function tryHandlePromoteFindingRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
): Promise<vscode.ChatResult | undefined> {
  const promoteFindingMatch = userText.match(/^promote finding\s+([A-Za-z0-9-]+)$/i);
  if (!promoteFindingMatch) {
    return undefined;
  }

  try {
    const result = await promoteReviewFinding(agentx, promoteFindingMatch[1]);
    response.markdown(`Promoted ${result.finding.id} as issue #${result.issueNumber}.`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    response.markdown(`**Frontier error:** ${message}`);
  }

  return {};
}

function normalizeCliLine(line: string): string {
  return stripAnsi(line).trim();
}

function shouldSurfaceCliLine(line: string): boolean {
  return LIVE_STATUS_PATTERN.test(line);
}

function shouldKeepDiscussionLineInChat(line: string): boolean {
  return CHAT_VISIBLE_DISCUSSION_PATTERN.test(line) && !HUMAN_REQUIRED_SESSION_PATTERN.test(line);
}

function getChatOutputChannel(): vscode.OutputChannel {
  if (!chatOutputChannel) {
    chatOutputChannel = vscode.window.createOutputChannel(CHAT_OUTPUT_CHANNEL_NAME);
  }
  return chatOutputChannel;
}

function formatOutputPreview(output: string): string {
  const normalized = stripAnsi(output).trim();
  if (!normalized) {
    return 'No output was produced.';
  }

  const summarySections = getOutputSummarySections(normalized);

  if (normalized.length <= CHAT_OUTPUT_INLINE_LIMIT) {
    return normalized;
  }

  const lines = normalized.split(/\r?\n/);
  const head = lines.slice(0, CHAT_OUTPUT_PREVIEW_LINES);
  const tail = lines.slice(-CHAT_OUTPUT_PREVIEW_LINES);
  const previewLines = [...head];

  if (lines.length > CHAT_OUTPUT_PREVIEW_LINES * 2) {
    previewLines.push(`... (${lines.length - (CHAT_OUTPUT_PREVIEW_LINES * 2)} lines omitted) ...`);
  }

  if (lines.length > CHAT_OUTPUT_PREVIEW_LINES) {
    previewLines.push(...tail);
  }

  return [
    `Large output detected (${lines.length} lines, ${normalized.length} chars). Full output was written to the **${CHAT_OUTPUT_CHANNEL_NAME}** output channel.`,
    '',
    ...summarySections.flatMap((section) => [
      `${section.label}:`,
      '```text',
      section.content,
      '```',
      '',
    ]),
    'Preview:',
    '```text',
    previewLines.join('\n'),
    '```',
  ].join('\n');
}

function formatChatVisibleOutput(output: string, visibleDiscussionLines: string[]): string {
  const formattedOutput = formatOutputPreview(output);
  const discussionMarkdown = formatDiscussionMarkdown(output, visibleDiscussionLines);
  if (!discussionMarkdown) {
    return formattedOutput;
  }

  return `${discussionMarkdown}\n\n${formattedOutput}`;
}

function formatDiscussionMarkdown(output: string, lines: string[]): string {
  const formattedLines = Array.from(new Set(lines
    .map(formatDiscussionLine)
    .filter((line): line is string => Boolean(line))));

  if (formattedLines.length === 0) {
    return '';
  }

  const normalizedOutput = stripAnsi(output);
  if (formattedLines.every((line) => normalizedOutput.includes(line))) {
    return '';
  }

  return [
    '**Clarification Discussion**',
    '',
    ...formattedLines.map((line) => `- ${line}`),
  ].join('\n');
}

function formatDiscussionLine(line: string): string | undefined {
  const askedMatch = line.match(/^\[CLARIFY \d+\/\d+\]\s+Asking\s+([^\s]+)\s+about:\s+(.+)$/i);
  if (askedMatch) {
    return `Asked ${askedMatch[1]} about ${askedMatch[2]}.`;
  }

  const detailMatch = line.match(/^\[CLARIFY DETAIL\]\s+(.+)$/i);
  if (detailMatch) {
    return `Guidance: ${detailMatch[1]}`;
  }

  const responseMatch = line.match(/^\[CLARIFY RESPONSE\]\s+(.+)$/i);
  if (responseMatch) {
    return `Response: ${responseMatch[1]}`;
  }

  const humanEscalationMatch = line.match(/^\[HUMAN ESCALATION\]\s+(.+)$/i);
  if (humanEscalationMatch) {
    return `Escalated for human input: ${humanEscalationMatch[1]}`;
  }

  const humanRequiredMatch = line.match(/^\[HUMAN REQUIRED\]\s+(.+)$/i);
  if (humanRequiredMatch) {
    return `Human input required: ${humanRequiredMatch[1]}`;
  }

  const humanResponseMatch = line.match(/^\[HUMAN RESPONSE\]\s+(.+)$/i);
  if (humanResponseMatch) {
    return `Human response: ${humanResponseMatch[1]}`;
  }

  return undefined;
}

function getOutputSummarySections(output: string): Array<{ label: string; content: string }> {
  const sections: Array<{ label: string; content: string }> = [];
  const executionSummary = getSummaryBlock(output, EXECUTION_SUMMARY_PATTERN);
  const selfReviewSummary = getSummaryBlock(output, SELF_REVIEW_SUMMARY_PATTERN);

  if (executionSummary) {
    sections.push({ label: 'Execution summary', content: executionSummary });
  }

  if (selfReviewSummary) {
    sections.push({ label: 'Self-review summary', content: selfReviewSummary });
  }

  return sections;
}

function getSummaryBlock(output: string, pattern: RegExp): string {
  const matches = output.match(pattern);
  if (!matches || matches.length === 0) {
    return '';
  }

  return matches.join('\n');
}

function writeOutputToChannel(title: string, output: string): void {
  const channel = getChatOutputChannel();
  channel.clear();
  channel.appendLine(title);
  channel.appendLine('');
  channel.appendLine(stripAnsi(output));
}

async function updatePendingClarification(
  agentx: FrontierContext,
  pending: { sessionId: string; agentName: string; prompt: string; humanPrompt?: string },
): Promise<void> {
  if (typeof agentx.setPendingClarification === 'function') {
    await agentx.setPendingClarification({
      ...pending,
      ...parsePendingClarificationDetails(pending.humanPrompt),
    });
  }
}

async function clearPendingClarification(agentx: FrontierContext): Promise<void> {
  if (typeof agentx.clearPendingClarification === 'function') {
    await agentx.clearPendingClarification();
  }
}