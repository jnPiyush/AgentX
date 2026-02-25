"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEventBus = void 0;
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
class AgentEventBus {
    listeners = new Map();
    history = [];
    maxHistory;
    constructor(maxHistory = 200) {
        this.maxHistory = maxHistory;
    }
    /**
     * Subscribe to an event type.
     * Returns an unsubscribe function for easy cleanup.
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const set = this.listeners.get(event);
        set.add(callback);
        return () => {
            set.delete(callback);
        };
    }
    /**
     * Subscribe to an event type for a single firing only.
     */
    once(event, callback) {
        const unsub = this.on(event, (data) => {
            unsub();
            callback(data);
        });
        return unsub;
    }
    /**
     * Emit an event to all registered listeners.
     */
    emit(event, data) {
        // Record in history
        this.history.push({ event, data, timestamp: Date.now() });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        const set = this.listeners.get(event);
        if (!set) {
            return;
        }
        for (const cb of set) {
            try {
                cb(data);
            }
            catch (err) {
                console.error(`AgentEventBus: listener error on '${event}':`, err);
            }
        }
    }
    /**
     * Remove all listeners for a specific event, or all events if omitted.
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
    /**
     * Get the number of listeners for a specific event.
     */
    listenerCount(event) {
        return this.listeners.get(event)?.size ?? 0;
    }
    /**
     * Get recent event history (most recent last).
     */
    getHistory(limit) {
        if (limit !== undefined && limit < this.history.length) {
            return this.history.slice(-limit);
        }
        return [...this.history];
    }
    /**
     * Clear all history entries.
     */
    clearHistory() {
        this.history.length = 0;
    }
    /**
     * Dispose the event bus -- clears all listeners and history.
     */
    dispose() {
        this.listeners.clear();
        this.history.length = 0;
    }
}
exports.AgentEventBus = AgentEventBus;
//# sourceMappingURL=eventBus.js.map