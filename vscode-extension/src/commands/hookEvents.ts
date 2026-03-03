import * as vscode from 'vscode';
import { AgentEventBus } from '../utils/eventBus';

type HistoryEvent = {
  event: string;
  data: unknown;
  timestamp: number;
};

function formatData(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return String(data ?? '');
  }

  const record = data as Record<string, unknown>;
  const primary = [
    record.agent,
    record.tool,
    record.status,
    record.fromAgent,
    record.toAgent,
    record.issueNumber,
  ]
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v))
    .join(' | ');

  const detail = record.detail ? ` :: ${String(record.detail).slice(0, 200)}` : '';
  return `${primary}${detail}`.trim();
}

export function registerHookEventsCommand(
  context: vscode.ExtensionContext,
  eventBus: AgentEventBus,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showHookEvents', async () => {
      const quickPick = await vscode.window.showQuickPick(
        ['25', '50', '100', '200'],
        {
          title: 'Hook events to display',
          placeHolder: 'Select history size',
        },
      );

      if (!quickPick) {
        return;
      }

      const limit = Number(quickPick);
      const history = eventBus.getHistory(limit) as readonly HistoryEvent[];
      const hookEvents = history.filter((h) =>
        h.event === 'tool-invoked'
        || h.event === 'handoff-triggered'
        || h.event === 'context-compacted'
        || h.event === 'agent-error',
      );

      const channel = vscode.window.createOutputChannel('AgentX Hook Events');
      channel.clear();
      channel.appendLine(`AgentX Hook Events (last ${limit})`);
      channel.appendLine('');

      if (hookEvents.length === 0) {
        channel.appendLine('No hook-related events captured yet.');
        channel.appendLine('Run an agentic chat turn and try again.');
        channel.show(true);
        return;
      }

      for (const item of hookEvents) {
        const ts = new Date(item.timestamp).toISOString();
        const payload = formatData(item.data);
        channel.appendLine(`[${ts}] ${item.event}${payload ? ` -> ${payload}` : ''}`);
      }

      channel.appendLine('');
      channel.appendLine(`Total hook events shown: ${hookEvents.length}`);
      channel.show(true);
    }),
  );
}
