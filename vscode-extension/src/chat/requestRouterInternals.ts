import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
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
  listBoundedParallelRuns,
  renderBoundedParallelRunsText,
} from '../parallel/parallel-delivery';
import { stripAnsi } from '../utils/stripAnsi';

const CHAT_OUTPUT_CHANNEL_NAME = 'AgentX Chat';
const CHAT_OUTPUT_INLINE_LIMIT = 4000;
const CHAT_OUTPUT_PREVIEW_LINES = 8;
const LIVE_STATUS_PATTERN = /\[(?:COMPACTION|CLARIFY(?: RESPONSE| DETAIL| \d+\/\d+)?|SELF-REVIEW(?: SUMMARY)?|EXECUTION SUMMARY|MODEL FALLBACK|LOOP WARNING|CIRCUIT BREAKER|TOOL ERROR|BOUNDARY BLOCKED|FAIL|WARN|PASS|HUMAN ESCALATION|HUMAN REQUIRED|HUMAN RESPONSE|HUMAN REQUIRED SESSION)\]|^\s*Iteration \d+\/\d+|^\s*Tool:/i;
const CHAT_VISIBLE_DISCUSSION_PATTERN = /^\[(?:CLARIFY(?: RESPONSE| DETAIL| \d+\/\d+)?|HUMAN ESCALATION|HUMAN REQUIRED|HUMAN RESPONSE)\]/i;
const HUMAN_REQUIRED_SESSION_PATTERN = /\[HUMAN REQUIRED SESSION\]\s+(.+)$/i;
const EXECUTION_SUMMARY_PATTERN = /^\[EXECUTION SUMMARY\].*$/gim;
const SELF_REVIEW_SUMMARY_PATTERN = /^\[SELF-REVIEW SUMMARY\].*$/gim;

export type PendingClarification = NonNullable<
  Awaited<ReturnType<AgentXContext['getPendingClarification']>>
>;

let chatOutputChannel: vscode.OutputChannel | undefined;

function hasWorkspaceCliRuntime(agentx: AgentXContext): boolean {
  return typeof (agentx as AgentXContext & { hasCliRuntime?: () => boolean }).hasCliRuntime !== 'function'
    || (agentx as AgentXContext & { hasCliRuntime: () => boolean }).hasCliRuntime();
}

function renderMissingRuntimeMessage(): string {
  return [
    '**AgentX workspace initialization is not available in this workspace.**',
    '',
    'This workspace has an open folder, but it has not been initialized with the `.agentx` state and artifact folders needed for `run`, loop execution, or clarification resume.',
    '',
    'To enable formal AgentX execution in this repo, run **AgentX: Initialize Local Runtime** first.',
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
  agentx: AgentXContext,
  agentName: string,
  task: string,
): Promise<vscode.ChatResult> {
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
    );

    writeOutputToChannel(`AgentX Chat Run: ${agentName}`, output);

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
    const msg = err instanceof Error ? err.message : String(err);
    response.markdown(`**AgentX error:** ${msg}`);
  }

  return {};
}

export async function resumePendingClarification(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
  pending: PendingClarification,
  guidance: string,
): Promise<vscode.ChatResult> {
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
    );

    writeOutputToChannel(`AgentX Chat Resume: ${pending.agentName}`, output);

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
    const msg = err instanceof Error ? err.message : String(err);
    response.markdown(`**AgentX error:** ${msg}`);
  }

  return {};
}

export async function getPendingClarification(
  agentx: AgentXContext,
): Promise<PendingClarification | undefined> {
  return typeof agentx.getPendingClarification === 'function'
    ? await agentx.getPendingClarification()
    : undefined;
}

export function buildPendingClarificationMessage(
  pending: { agentName: string; prompt: string; humanPrompt?: string },
): string {
  const lines = [
    `**Pending clarification for ${pending.agentName}**`,
    '',
  ];

  if (pending.humanPrompt) {
    lines.push(pending.humanPrompt, '');
  }

  lines.push(
    `Original task: ${pending.prompt}`,
    '',
    'Reply in plain language with the guidance you want AgentX to use. You can also still use `@agentx continue "..."` explicitly.',
  );

  return lines.join('\n');
}

export function renderUsageGuidance(): string {
  return (
    '**AgentX** - Digital Force for Software Delivery\n\n'
    + 'Usage:\n'
    + '- `@agentx initialize local runtime`\n'
    + '- `@agentx add remote adapter`\n'
    + '- `@agentx add llm adapter`\n'
    + '- `@agentx add plugin`\n'
    + '- `@agentx run engineer "implement the health endpoint for issue #42"`\n'
    + '- `@agentx continue "use the existing auth flow and keep refresh tokens"`\n'
    + '- `@agentx brainstorm auth rollout constraints`\n'
    + '- `@agentx workflow next step`\n'
    + '- `@agentx deepen plan`\n'
    + '- `@agentx kick off review`\n'
    + '- `@agentx rollout scorecard`\n'
    + '- `@agentx enablement checklist`\n'
    + '- `@agentx learnings planning`\n'
    + '- `@agentx learnings review auth workflow`\n'
    + '- `@agentx compound`\n'
    + '- `@agentx create learning capture`\n'
    + '- `@agentx capture guidance`\n'
    + '- `@agentx agent-native review`\n'
    + '- `@agentx review findings`\n'
    + '- `@agentx promote finding FINDING-164-001`\n'
    + '- `@agentx task bundles`\n'
    + '- `@agentx bounded parallel`\n'
    + '- `@agentx run architect "design the auth system"`\n'
    + '- `@agentx run reviewer "review the changes in issue #42"`\n\n'
    + 'During execution, live status updates for compaction, clarification, loop progress, tool activity, and self-review are streamed into chat.'
  );
}

export async function tryHandleWorkspaceSetupRequest(
  userText: string,
  response: vscode.ChatResponseStream,
): Promise<vscode.ChatResult | undefined> {
  if (/^(?:agentx:\s*)?(?:initialize local runtime|setup local runtime|initialize(?: project| workspace)?|setup workspace)$/i.test(userText)) {
    try {
      await vscode.commands.executeCommand('agentx.initializeLocalRuntime');
      response.markdown('Opened **AgentX: Initialize Local Runtime** for this workspace.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      response.markdown(`**AgentX error:** ${message}`);
    }
    return {};
  }

  if (/^(?:agentx:\s*)?(?:add plugin|install plugin)$/i.test(userText)) {
    try {
      await vscode.commands.executeCommand('agentx.addPlugin');
      response.markdown('Opened **AgentX: Add Plugin** for this workspace.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      response.markdown(`**AgentX error:** ${message}`);
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
): Promise<vscode.ChatResult | undefined> {
  if (!/^(workflow next step|workflow guidance|next workflow step)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowGuidanceMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending),
  ));
  return {};
}

export async function tryHandlePlanDeepeningRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(deepen plan|plan deepening)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowEntryPointMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending),
    'plan-deepening',
  ));
  return {};
}

export async function tryHandleReviewKickoffRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(kick off review|review kickoff)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowEntryPointMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending),
    'review-kickoff',
  ));
  return {};
}

export async function tryHandleWorkflowRolloutRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(rollout scorecard|workflow rollout)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderWorkflowRolloutScorecardMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending),
  ));
  return {};
}

export async function tryHandleEnablementChecklistRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  workspaceRoot: string | undefined,
  pending: PendingClarification | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(enablement checklist|operator checklist)$/i.test(userText)) {
    return undefined;
  }

  response.markdown(renderOperatorEnablementChecklistMarkdown(
    evaluateWorkflowGuidance(workspaceRoot, !!pending),
  ));
  return {};
}

export function buildContinueGuidance(agentName: string): string {
  return `Clarification is waiting for your input for the ${agentName} agent. Continue with:\n\n- \`@agentx continue "your guidance here"\``;
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
  agentx: AgentXContext,
  pending: PendingClarification | undefined,
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

  return resumePendingClarification(response, agentx, pending, guidance);
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
    response.markdown('No workspace is open, so AgentX cannot brainstorm against repo context.');
    return {};
  }

  const resolvedQuery = brainstormMatch[1]?.trim() || getDefaultLearningsQuery(workspaceRoot, 'planning');
  const results = rankLearnings(workspaceRoot, 'planning', resolvedQuery);
  response.markdown(renderBrainstormGuidanceMarkdown(workspaceRoot, resolvedQuery, results));
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
    : 'No workspace is open, so AgentX cannot evaluate the compound loop.');
  return {};
}

export async function tryHandleTaskBundleRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(?:show|list)?\s*task bundles?$/i.test(userText.trim())) {
    return undefined;
  }

  if (!agentx.workspaceRoot) {
    response.markdown('No workspace is open, so AgentX cannot inspect task bundles.');
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
      '- `AgentX: Create Task Bundle`',
      '- `AgentX: Resolve Task Bundle`',
      '- `AgentX: Promote Task Bundle`',
    ],
  ));
  return {};
}

export async function tryHandleBoundedParallelRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(?:show|list)?\s*(?:bounded\s+)?parallel(?:\s+runs?)?$/i.test(userText.trim())) {
    return undefined;
  }

  if (!agentx.workspaceRoot) {
    response.markdown('No workspace is open, so AgentX cannot inspect bounded parallel runs.');
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
      '- `AgentX: Assess Bounded Parallel Delivery`',
      '- `AgentX: Start Bounded Parallel Delivery`',
      '- `AgentX: Reconcile Bounded Parallel Run`',
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
    response.markdown('No workspace is open, so AgentX cannot create a learning capture file.');
    return {};
  }

  await vscode.commands.executeCommand('agentx.createLearningCapture');
  const target = getLearningCaptureTarget(workspaceRoot);
  response.markdown(
    `Opened a learning capture artifact for ${target?.issueNumber ? `issue #${target.issueNumber}` : 'the current context'}.`,
  );
  return {};
}

export async function tryHandleAgentNativeReviewRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult | undefined> {
  if (!/^(agent-native review|parity review|agent parity)$/i.test(userText)) {
    return undefined;
  }

  const report = evaluateAgentNativeReview(agentx);
  response.markdown(report
    ? renderAgentNativeReviewMarkdown(report)
    : 'No workspace is open, so AgentX cannot evaluate agent-native review parity.');
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
  agentx: AgentXContext,
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
    response.markdown(`**AgentX error:** ${message}`);
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
  agentx: AgentXContext,
  pending: { sessionId: string; agentName: string; prompt: string; humanPrompt?: string },
): Promise<void> {
  if (typeof agentx.setPendingClarification === 'function') {
    await agentx.setPendingClarification(pending);
  }
}

async function clearPendingClarification(agentx: AgentXContext): Promise<void> {
  if (typeof agentx.clearPendingClarification === 'function') {
    await agentx.clearPendingClarification();
  }
}