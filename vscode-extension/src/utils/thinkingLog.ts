// ---------------------------------------------------------------------------
// AgentX -- Structured Thinking Log
// ---------------------------------------------------------------------------
//
// Records every agent action with timestamps and structured metadata.
// Feeds into the VS Code Output Channel and the event bus for real-time
// visibility into agent behavior.
//
// Inspired by OpenBrowserClaw's thinking-log system.
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import { AgentEventBus, ThinkingLogEvent, SkillLoadedEvent } from './eventBus';

/**
 * Log entry kinds -- matches ThinkingLogEvent['kind'].
 */
export type LogEntryKind = ThinkingLogEvent['kind'];

/**
 * A single structured log entry.
 */
export interface LogEntry {
  readonly id: number;
  readonly agent: string;
  readonly kind: LogEntryKind;
  readonly label: string;
  readonly detail?: string;
  readonly timestamp: number;
}

/**
 * Structured thinking log that writes to a VS Code Output Channel
 * and emits events on the AgentEventBus.
 *
 * Usage:
 * ```ts
 * const log = new ThinkingLog(eventBus);
 * log.info('Engineer', 'Starting implementation', 'Issue #42');
 * log.toolCall('Engineer', 'replace_string_in_file', 'src/app.ts L45-50');
 * log.toolResult('Engineer', 'replace_string_in_file', 'Success');
 * log.warning('Engineer', 'Test coverage below 80%', '72% coverage');
 * ```
 */
export class ThinkingLog {
  private readonly entries: LogEntry[] = [];
  private readonly channel: vscode.OutputChannel;
  private readonly eventBus: AgentEventBus | undefined;
  private readonly maxEntries: number;
  private nextId = 1;

  constructor(eventBus?: AgentEventBus, maxEntries = 1000) {
    this.channel = vscode.window.createOutputChannel('AgentX Thinking Log');
    this.eventBus = eventBus;
    this.maxEntries = maxEntries;
  }

  // -----------------------------------------------------------------------
  // Convenience methods
  // -----------------------------------------------------------------------

  info(agent: string, label: string, detail?: string): void {
    this.log(agent, 'info', label, detail);
  }

  toolCall(agent: string, tool: string, detail?: string): void {
    this.log(agent, 'tool-call', `Tool: ${tool}`, detail);
  }

  toolResult(agent: string, tool: string, detail?: string): void {
    this.log(agent, 'tool-result', `Result: ${tool}`, detail);
  }

  apiCall(agent: string, label: string, detail?: string): void {
    this.log(agent, 'api-call', label, detail);
  }

  text(agent: string, label: string, detail?: string): void {
    this.log(agent, 'text', label, detail);
  }

  warning(agent: string, label: string, detail?: string): void {
    this.log(agent, 'warning', label, detail);
  }

  error(agent: string, label: string, detail?: string): void {
    this.log(agent, 'error', label, detail);
  }

  /**
   * Record that a skill SKILL.md was loaded into context.
   * Emits both a thinking-log entry and a dedicated skill-loaded event
   * so downstream analytics can track retrieval rates.
   */
  skillLoad(agent: string, skillName: string, skillPath: string, tokens: number): void {
    this.log(agent, 'info', `Skill loaded: ${skillName}`, `${skillPath} (~${tokens} tokens)`);

    if (this.eventBus) {
      this.eventBus.emit('skill-loaded', {
        agent,
        skillName,
        skillPath,
        tokens,
        timestamp: Date.now(),
      } satisfies SkillLoadedEvent);
    }
  }

  // -----------------------------------------------------------------------
  // Core logging
  // -----------------------------------------------------------------------

  /**
   * Record a structured log entry.
   */
  log(agent: string, kind: LogEntryKind, label: string, detail?: string): void {
    const now = Date.now();
    const entry: LogEntry = {
      id: this.nextId++,
      agent,
      kind,
      label,
      detail,
      timestamp: now,
    };

    // Store in memory
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Write to VS Code Output Channel
    const time = new Date(now).toISOString().slice(11, 23); // HH:MM:SS.mmm
    const kindTag = `[${kind.toUpperCase()}]`.padEnd(14);
    const line = `${time} ${kindTag} [${agent}] ${label}${detail ? ' -- ' + detail : ''}`;
    this.channel.appendLine(line);

    // Emit on event bus
    if (this.eventBus) {
      this.eventBus.emit('thinking-log', {
        agent,
        kind,
        label,
        detail,
        timestamp: now,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  /**
   * Get all entries, optionally filtered.
   */
  getEntries(filter?: {
    agent?: string;
    kind?: LogEntryKind;
    since?: number;
    limit?: number;
  }): ReadonlyArray<LogEntry> {
    let result: LogEntry[] = this.entries;

    if (filter?.agent) {
      result = result.filter((e) => e.agent === filter.agent);
    }
    if (filter?.kind) {
      result = result.filter((e) => e.kind === filter.kind);
    }
    if (filter?.since) {
      const since = filter.since;
      result = result.filter((e) => e.timestamp >= since);
    }
    if (filter?.limit !== undefined) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * Get a summary of agent activity counts.
   */
  getSummary(): Record<string, Record<LogEntryKind, number>> {
    const summary: Record<string, Record<string, number>> = {};

    for (const entry of this.entries) {
      if (!summary[entry.agent]) {
        summary[entry.agent] = {};
      }
      const agentSummary = summary[entry.agent];
      agentSummary[entry.kind] = (agentSummary[entry.kind] ?? 0) + 1;
    }

    return summary as Record<string, Record<LogEntryKind, number>>;
  }

  /**
   * Clear all stored entries.
   */
  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Show the output channel in the VS Code UI.
   */
  show(): void {
    this.channel.show(true);
  }

  /**
   * Dispose the output channel and clear entries.
   */
  dispose(): void {
    this.entries.length = 0;
    this.channel.dispose();
  }
}
