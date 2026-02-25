import { AgentEventBus } from './eventBus';
/**
 * Estimate token count for a string.
 * Uses the ~4 chars/token heuristic. Not exact, but sufficient for budgeting.
 */
export declare function estimateTokens(text: string): number;
/**
 * Tracks loaded context items and their estimated token usage.
 */
export interface ContextItem {
    readonly source: string;
    readonly category: 'instruction' | 'skill' | 'agent-def' | 'template' | 'memory' | 'conversation';
    readonly tokens: number;
    readonly loadedAt: number;
}
/**
 * Result of a context budget check.
 */
export interface BudgetStatus {
    readonly totalTokens: number;
    readonly limit: number;
    readonly utilizationPercent: number;
    readonly items: ReadonlyArray<ContextItem>;
    readonly needsCompaction: boolean;
    readonly recommendation: string;
}
/**
 * Context compaction manager.
 *
 * Tracks loaded context items, estimates token budget, and provides
 * compaction utilities to stay within limits.
 *
 * Usage:
 * ```ts
 * const compactor = new ContextCompactor(eventBus);
 * compactor.trackItem('skill', 'testing', fileContent);
 * compactor.trackItem('instruction', 'typescript', fileContent);
 *
 * const status = compactor.checkBudget();
 * if (status.needsCompaction) {
 *   const summary = compactor.compactConversation(messages);
 * }
 * ```
 */
export declare class ContextCompactor {
    private readonly items;
    private readonly eventBus;
    private readonly contextLimit;
    /** Threshold (0-1) at which compaction is recommended. */
    private readonly compactionThreshold;
    constructor(eventBus?: AgentEventBus, contextLimit?: number, compactionThreshold?: number);
    /**
     * Track a loaded context item (skill, instruction, agent def, etc.).
     */
    trackItem(category: ContextItem['category'], source: string, content: string): void;
    /**
     * Remove a tracked item by source name.
     */
    untrackItem(source: string): void;
    /**
     * Clear all tracked items (e.g., on session reset).
     */
    reset(): void;
    /**
     * Check the current context budget status.
     */
    checkBudget(): BudgetStatus;
    /**
     * Get token usage broken down by category.
     */
    getUsageByCategory(): Record<ContextItem['category'], number>;
    /**
     * Compact a conversation by extracting key facts and decisions.
     *
     * This produces a structured summary that can replace the full
     * conversation history to free up token budget.
     *
     * @param messages - Array of {role, content} conversation messages.
     * @param agentName - Name of the active agent (for event emission).
     * @returns A compacted summary string.
     */
    compactConversation(messages: ReadonlyArray<{
        role: string;
        content: string;
    }>, agentName?: string): string;
    /**
     * Load and compact a session progress log from disk.
     *
     * @param progressDir - Path to the docs/progress/ directory.
     * @param issueNumber - Issue number to find the progress file for.
     * @returns Compacted summary or undefined if no file found.
     */
    compactProgressLog(progressDir: string, issueNumber: number): string | undefined;
    /**
     * Format a budget status report as a human-readable string.
     */
    formatBudgetReport(): string;
}
//# sourceMappingURL=contextCompactor.d.ts.map