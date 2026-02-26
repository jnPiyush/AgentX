// ---------------------------------------------------------------------------
// AgentX -- Typed Event Bus
// ---------------------------------------------------------------------------
//
// Centralized, strongly-typed event system for agent activity notifications.
// UI components (tree views, chat participant, status bar) subscribe to events
// instead of polling or being manually refreshed.
//
// Inspired by OpenBrowserClaw's EventBus pattern, adapted for VS Code.
// ---------------------------------------------------------------------------

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

  /** Agent sent a clarification request to an upstream agent (via Agent X). */
  'clarification-requested': ClarificationLifecycleEvent;

  /** Target agent answered a clarification request. */
  'clarification-answered': ClarificationLifecycleEvent;

  /** Clarification SLA expired -- pending past staleAfter timestamp. */
  'clarification-stale': ClarificationLifecycleEvent;

  /** Requesting agent marked clarification as resolved. */
  'clarification-resolved': ClarificationLifecycleEvent;

  /** Clarification auto-escalated (max rounds / stuck / deadlock). */
  'clarification-escalated': ClarificationLifecycleEvent;
}

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

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

/**
 * Payload for all clarification lifecycle events.
 * Carries enough context for tree views and history log.
 */
export interface ClarificationLifecycleEvent {
  readonly clarificationId: string;
  readonly issueNumber: number;
  readonly fromAgent: string;
  readonly toAgent: string;
  readonly topic: string;
  readonly blocking: boolean;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Event callback type
// ---------------------------------------------------------------------------

type EventCallback<T> = (data: T) => void;

// ---------------------------------------------------------------------------
// AgentEventBus
// ---------------------------------------------------------------------------

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
export class AgentEventBus {
  private readonly listeners = new Map<string, Set<EventCallback<unknown>>>();
  private readonly history: Array<{ event: string; data: unknown; timestamp: number }> = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory;
  }

  /**
   * Subscribe to an event type.
   * Returns an unsubscribe function for easy cleanup.
   */
  on<K extends keyof AgentEventMap>(
    event: K,
    callback: EventCallback<AgentEventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventCallback<unknown>);

    return () => {
      set.delete(callback as EventCallback<unknown>);
    };
  }

  /**
   * Subscribe to an event type for a single firing only.
   */
  once<K extends keyof AgentEventMap>(
    event: K,
    callback: EventCallback<AgentEventMap[K]>,
  ): () => void {
    const unsub = this.on(event, (data) => {
      unsub();
      callback(data);
    });
    return unsub;
  }

  /**
   * Emit an event to all registered listeners.
   */
  emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]): void {
    // Record in history
    this.history.push({ event, data, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const set = this.listeners.get(event);
    if (!set) { return; }

    for (const cb of set) {
      try {
        cb(data);
      } catch (err) {
        console.error(`AgentEventBus: listener error on '${event}':`, err);
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events if omitted.
   */
  clear(event?: keyof AgentEventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event.
   */
  listenerCount(event: keyof AgentEventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get recent event history (most recent last).
   */
  getHistory(limit?: number): ReadonlyArray<{ event: string; data: unknown; timestamp: number }> {
    if (limit !== undefined && limit < this.history.length) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear all history entries.
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Dispose the event bus -- clears all listeners and history.
   */
  dispose(): void {
    this.listeners.clear();
    this.history.length = 0;
  }
}
