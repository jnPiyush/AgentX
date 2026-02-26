// ---------------------------------------------------------------------------
// AgentX -- Clarification Renderer
// ---------------------------------------------------------------------------
//
// Formats clarification conversations for display in:
//   - Copilot Chat (Markdown via response.markdown())
//   - CLI terminal (ANSI-colored text)
//
// No buttons, panels, or separate views -- the conversation stream is the
// only interface. Follows the "conversation-as-interface" design decision.
// ---------------------------------------------------------------------------

import { ClarificationRecord, ThreadEntry, MonitorReport } from './clarificationTypes';

// ---------------------------------------------------------------------------
// ANSI color codes (mirrors CLI constants in agentx-cli.ps1)
// ---------------------------------------------------------------------------

const ANSI = {
  reset:  '\x1B[0m',
  red:    '\x1B[31m',
  green:  '\x1B[32m',
  yellow: '\x1B[33m',
  blue:   '\x1B[34m',
  magenta:'\x1B[35m',
  cyan:   '\x1B[36m',
  gray:   '\x1B[90m',
  bold:   '\x1B[1m',
} as const;

// ---------------------------------------------------------------------------
// Chat (Markdown) rendering
// ---------------------------------------------------------------------------

/**
 * Renders a clarification round to Markdown for Copilot Chat.
 *
 * Example output:
 * ```
 * ---
 * **[Engineer -> Architect]** Clarification: *authentication flow*
 * > Round 1 | CLR-42-001 | blocking
 *
 * Should the JWT validation happen in middleware or in each controller?
 *
 * **[Architect] Answer:**
 * JWT validation must happen in middleware...
 * ```
 */
export function renderRoundMarkdown(
  rec: ClarificationRecord,
  questionBody: string,
  answerBody: string,
  round: number,
): string {
  const lines: string[] = [
    '---',
    `**[${rec.from} -> ${rec.to}]** Clarification: *${rec.topic}*`,
    `> Round ${round} | ${rec.id} | ${rec.blocking ? 'blocking' : 'non-blocking'}`,
    '',
    questionBody,
    '',
    `**[${rec.to}] Answer:**`,
    '',
    answerBody,
    '',
  ];
  return lines.join('\n');
}

/**
 * Renders a clarification escalation to Markdown.
 */
export function renderEscalationMarkdown(rec: ClarificationRecord): string {
  const lines: string[] = [
    '---',
    `> **[ESCALATED]** Clarification *${rec.topic}* (${rec.id}) could not be resolved.`,
    '',
    `**Involved agents**: ${rec.from} <-> ${rec.to}`,
    `**Rounds exhausted**: ${rec.round}/${rec.maxRounds}`,
    '',
    '**Conversation summary:**',
    '',
  ];

  for (const entry of rec.thread) {
    const label = entry.type === 'question'
      ? `**[${entry.from}] Q (round ${entry.round}):**`
      : entry.type === 'answer'
        ? `**[${entry.from}] A (round ${entry.round}):**`
        : `**[${entry.from}] Escalation:**`;
    lines.push(label, '', entry.body, '');
  }

  lines.push(
    '**Action required**: Resolve this escalation manually.',
    '```',
    `agentx clarify resolve ${rec.id}`,
    '```',
    '',
  );

  return lines.join('\n');
}

/**
 * Renders full clarification thread as Markdown (for /clarify #N command).
 */
export function renderThreadMarkdown(records: ClarificationRecord[]): string {
  if (records.length === 0) {
    return '_No active clarifications._\n';
  }

  const lines: string[] = ['**Active Clarifications**\n'];

  for (const rec of records) {
    lines.push(
      `---`,
      `**${rec.id}** | ${rec.from} -> ${rec.to} | *${rec.topic}*`,
      `Status: \`${rec.status}\` | Round: ${rec.round}/${rec.maxRounds} | ${rec.blocking ? 'blocking' : 'non-blocking'}`,
      '',
    );

    for (const entry of rec.thread) {
      const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
      lines.push(`**[${entry.from}] ${typeLabel} (round ${entry.round}):**`);
      lines.push('');
      lines.push(entry.body);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Renders monitor report as Markdown.
 */
export function renderMonitorReportMarkdown(report: MonitorReport): string {
  const hasIssues = report.stale.length + report.stuck.length + report.deadlocked.length > 0;
  if (!hasIssues) { return '_No clarification issues detected._\n'; }

  const lines: string[] = ['**Clarification Monitor Report**\n'];

  if (report.stale.length > 0) {
    lines.push(`### Stale (${report.stale.length})`);
    for (const r of report.stale) {
      lines.push(`- ${r.id}: ${r.topic} | ${r.from} -> ${r.to} | SLA expired`);
    }
    lines.push('');
  }

  if (report.stuck.length > 0) {
    lines.push(`### Stuck (${report.stuck.length})`);
    for (const r of report.stuck) {
      lines.push(`- ${r.id}: ${r.topic} | ${r.from} <-> ${r.to} | Circular answers detected`);
    }
    lines.push('');
  }

  if (report.deadlocked.length > 0) {
    lines.push(`### Deadlocked (${report.deadlocked.length})`);
    for (const [a, b] of report.deadlocked) {
      lines.push(`- ${a.id} (${a.from}) <-> ${b.id} (${b.from}) | Mutual blocking`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI (ANSI) rendering
// ---------------------------------------------------------------------------

/**
 * Renders a clarification thread to ANSI terminal output.
 */
export function renderThreadCli(records: ClarificationRecord[]): string {
  if (records.length === 0) {
    return `${ANSI.gray}  No active clarifications.${ANSI.reset}\n`;
  }

  const lines: string[] = [
    `\n${ANSI.cyan}  Active Clarifications${ANSI.reset}`,
    `${ANSI.gray}  -----------------------------------------------${ANSI.reset}`,
  ];

  for (const rec of records) {
    const statusColor = rec.status === 'escalated' ? ANSI.red
      : rec.status === 'pending' ? ANSI.yellow
        : ANSI.green;

    lines.push(
      `\n  ${ANSI.bold}${rec.id}${ANSI.reset} ` +
      `${ANSI.gray}|${ANSI.reset} ` +
      `${ANSI.cyan}${rec.from}${ANSI.reset} -> ${ANSI.yellow}${rec.to}${ANSI.reset}`,
    );
    lines.push(
      `  ${ANSI.gray}Topic: ${rec.topic}` +
      `  Status: ${statusColor}${rec.status}${ANSI.reset}` +
      `${ANSI.gray}  Round: ${rec.round}/${rec.maxRounds}` +
      `  ${rec.blocking ? 'BLOCKING' : 'non-blocking'}${ANSI.reset}`,
    );

    for (const entry of rec.thread) {
      lines.push(renderThreadEntryCli(entry));
    }
  }

  lines.push('');
  return lines.join('\n');
}

function renderThreadEntryCli(entry: ThreadEntry): string {
  const typeColor = entry.type === 'question' ? ANSI.cyan
    : entry.type === 'answer' ? ANSI.green
      : entry.type === 'escalation' ? ANSI.red
        : ANSI.magenta;

  const typeLabel = entry.type.toUpperCase();
  const ts = entry.timestamp.length >= 16 ? entry.timestamp.substring(11, 16) : entry.timestamp;

  return (
    `\n  ${typeColor}[Round ${entry.round}] ${entry.from} -- ${typeLabel}${ANSI.reset} ` +
    `${ANSI.gray}(${ts})${ANSI.reset}\n  ${entry.body}`
  );
}

/**
 * Renders a single clarification round to terminal (used during live routing).
 */
export function renderRoundCli(
  rec: ClarificationRecord,
  questionBody: string,
  answerBody: string,
  round: number,
): string {
  const lines = [
    `\n${ANSI.gray}  ---${ANSI.reset}`,
    `  ${ANSI.cyan}[${rec.from} -> ${rec.to}]${ANSI.reset} Clarification: ${ANSI.yellow}${rec.topic}${ANSI.reset}`,
    `${ANSI.gray}  Round ${round}/${rec.maxRounds} | ${rec.id}${ANSI.reset}`,
    '',
    `  ${ANSI.cyan}Q:${ANSI.reset} ${questionBody}`,
    '',
    `  ${ANSI.green}A (${rec.to}):${ANSI.reset} ${answerBody}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Renders escalation notice to terminal.
 */
export function renderEscalationCli(rec: ClarificationRecord): string {
  const lines = [
    `\n${ANSI.red}  [ESCALATED] ${rec.id}${ANSI.reset}`,
    `  ${ANSI.gray}Topic: ${rec.topic} | Agents: ${rec.from} <-> ${rec.to}${ANSI.reset}`,
    `  ${ANSI.yellow}Max rounds (${rec.maxRounds}) reached. Human resolution required.${ANSI.reset}`,
    `\n  ${ANSI.gray}To resolve: agentx clarify resolve ${rec.id}${ANSI.reset}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Renders a summary table of all active clarifications (for `agentx clarify`).
 */
export function renderSummaryTableCli(records: ClarificationRecord[]): string {
  if (records.length === 0) {
    return `${ANSI.gray}  No active clarifications.${ANSI.reset}\n`;
  }

  const lines = [
    `\n${ANSI.cyan}  Active Clarifications${ANSI.reset}`,
    `${ANSI.gray}  -----------------------------------------------${ANSI.reset}`,
    `${ANSI.gray}  ID            From        To          Topic              Status    Round${ANSI.reset}`,
    `${ANSI.gray}  ------------- ----------- ----------- ------------------ --------- -----${ANSI.reset}`,
  ];

  for (const rec of records) {
    const id    = rec.id.padEnd(13);
    const from  = rec.from.substring(0, 10).padEnd(11);
    const to    = rec.to.substring(0, 10).padEnd(11);
    const topic = rec.topic.substring(0, 18).padEnd(18);
    const status = rec.status.padEnd(9);
    const round = `${rec.round}/${rec.maxRounds}`;

    const statusColor = rec.status === 'escalated' ? ANSI.red
      : rec.status === 'pending' ? ANSI.yellow
        : ANSI.green;

    lines.push(
      `  ${ANSI.gray}${id}${ANSI.reset} ` +
      `${from} ${to} ${topic} ` +
      `${statusColor}${status}${ANSI.reset} ` +
      `${ANSI.gray}${round}${ANSI.reset}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
