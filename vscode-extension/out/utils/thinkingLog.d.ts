import { AgentEventBus, ThinkingLogEvent } from './eventBus';
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
export declare class ThinkingLog {
    private readonly entries;
    private readonly channel;
    private readonly eventBus;
    private readonly maxEntries;
    private nextId;
    constructor(eventBus?: AgentEventBus, maxEntries?: number);
    info(agent: string, label: string, detail?: string): void;
    toolCall(agent: string, tool: string, detail?: string): void;
    toolResult(agent: string, tool: string, detail?: string): void;
    apiCall(agent: string, label: string, detail?: string): void;
    text(agent: string, label: string, detail?: string): void;
    warning(agent: string, label: string, detail?: string): void;
    error(agent: string, label: string, detail?: string): void;
    /**
     * Record a structured log entry.
     */
    log(agent: string, kind: LogEntryKind, label: string, detail?: string): void;
    /**
     * Get all entries, optionally filtered.
     */
    getEntries(filter?: {
        agent?: string;
        kind?: LogEntryKind;
        since?: number;
        limit?: number;
    }): ReadonlyArray<LogEntry>;
    /**
     * Get a summary of agent activity counts.
     */
    getSummary(): Record<string, Record<LogEntryKind, number>>;
    /**
     * Clear all stored entries.
     */
    clear(): void;
    /**
     * Show the output channel in the VS Code UI.
     */
    show(): void;
    /**
     * Dispose the output channel and clear entries.
     */
    dispose(): void;
}
//# sourceMappingURL=thinkingLog.d.ts.map