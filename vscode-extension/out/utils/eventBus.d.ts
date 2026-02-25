/**
 * All event types emitted by the AgentX event bus.
 *
 * Add new event types here -- consumers get full type safety on both
 * emit() and on() calls.
 */
export interface AgentEventMap {
    /** Agent started working on an issue. */
    'agent-started': AgentStartedEvent;
    /** Agent completed its work. */
    'agent-completed': AgentCompletedEvent;
    /** Agent encountered an error. */
    'agent-error': AgentErrorEvent;
    /** A tool was invoked by an agent. */
    'tool-invoked': ToolInvokedEvent;
    /** A handoff between agents was triggered. */
    'handoff-triggered': HandoffTriggeredEvent;
    /** Pre-handoff validation result. */
    'validation-result': ValidationResultEvent;
    /** Context compaction was performed. */
    'context-compacted': ContextCompactedEvent;
    /** Thinking log entry recorded. */
    'thinking-log': ThinkingLogEvent;
    /** Scheduled task fired. */
    'task-fired': TaskFiredEvent;
    /** Channel message received. */
    'channel-message': ChannelMessageEvent;
    /** Generic state change (ready queue, workflow, etc.). */
    'state-change': StateChangeEvent;
}
export interface AgentStartedEvent {
    readonly agent: string;
    readonly issueNumber?: number;
    readonly timestamp: number;
}
export interface AgentCompletedEvent {
    readonly agent: string;
    readonly issueNumber?: number;
    readonly durationMs: number;
    readonly timestamp: number;
}
export interface AgentErrorEvent {
    readonly agent: string;
    readonly error: string;
    readonly issueNumber?: number;
    readonly timestamp: number;
}
export interface ToolInvokedEvent {
    readonly agent: string;
    readonly tool: string;
    readonly status: 'running' | 'done' | 'error';
    readonly detail?: string;
    readonly timestamp: number;
}
export interface HandoffTriggeredEvent {
    readonly fromAgent: string;
    readonly toAgent: string;
    readonly issueNumber?: number;
    readonly timestamp: number;
}
export interface ValidationResultEvent {
    readonly agent: string;
    readonly issueNumber?: number;
    readonly passed: boolean;
    readonly errors: string[];
    readonly timestamp: number;
}
export interface ContextCompactedEvent {
    readonly agent: string;
    readonly originalTokens: number;
    readonly compactedTokens: number;
    readonly summary: string;
    readonly timestamp: number;
}
export interface ThinkingLogEvent {
    readonly agent: string;
    readonly kind: 'info' | 'tool-call' | 'tool-result' | 'api-call' | 'text' | 'warning' | 'error';
    readonly label: string;
    readonly detail?: string;
    readonly timestamp: number;
}
export interface TaskFiredEvent {
    readonly taskId: string;
    readonly schedule: string;
    readonly description: string;
    readonly timestamp: number;
}
export interface ChannelMessageEvent {
    readonly channelId: string;
    readonly direction: 'inbound' | 'outbound';
    readonly content: string;
    readonly timestamp: number;
}
export interface StateChangeEvent {
    readonly source: string;
    readonly oldState?: string;
    readonly newState: string;
    readonly timestamp: number;
}
type EventCallback<T> = (data: T) => void;
/**
 * Centralized event bus for AgentX.
 *
 * Usage:
 * ```ts
 * const bus = new AgentEventBus();
 *
 * // Subscribe
 * const unsub = bus.on('agent-started', (e) => {
 *   console.log(`${e.agent} started on #${e.issueNumber}`);
 * });
 *
 * // Emit
 * bus.emit('agent-started', { agent: 'Engineer', issueNumber: 42, timestamp: Date.now() });
 *
 * // Unsubscribe
 * unsub();
 * ```
 */
export declare class AgentEventBus {
    private readonly listeners;
    private readonly history;
    private readonly maxHistory;
    constructor(maxHistory?: number);
    /**
     * Subscribe to an event type.
     * Returns an unsubscribe function for easy cleanup.
     */
    on<K extends keyof AgentEventMap>(event: K, callback: EventCallback<AgentEventMap[K]>): () => void;
    /**
     * Subscribe to an event type for a single firing only.
     */
    once<K extends keyof AgentEventMap>(event: K, callback: EventCallback<AgentEventMap[K]>): () => void;
    /**
     * Emit an event to all registered listeners.
     */
    emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]): void;
    /**
     * Remove all listeners for a specific event, or all events if omitted.
     */
    clear(event?: keyof AgentEventMap): void;
    /**
     * Get the number of listeners for a specific event.
     */
    listenerCount(event: keyof AgentEventMap): number;
    /**
     * Get recent event history (most recent last).
     */
    getHistory(limit?: number): ReadonlyArray<{
        event: string;
        data: unknown;
        timestamp: number;
    }>;
    /**
     * Clear all history entries.
     */
    clearHistory(): void;
    /**
     * Dispose the event bus -- clears all listeners and history.
     */
    dispose(): void;
}
export {};
//# sourceMappingURL=eventBus.d.ts.map