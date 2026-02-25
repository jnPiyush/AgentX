// ---------------------------------------------------------------------------
// AgentX -- Context Compaction
// ---------------------------------------------------------------------------
//
// Detects when agent context is approaching token limits and provides
// utilities to summarize/compact conversation history and loaded context.
//
// Inspired by OpenBrowserClaw's compactContext() orchestrator method.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { AgentEventBus, ContextCompactedEvent } from './eventBus';

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Rough token-per-character ratio for English text (GPT/Claude). */
const CHARS_PER_TOKEN = 4;

/** Default context window size in tokens. */
const DEFAULT_CONTEXT_LIMIT = 200_000;

/**
 * Estimate token count for a string.
 * Uses the ~4 chars/token heuristic. Not exact, but sufficient for budgeting.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ---------------------------------------------------------------------------
// Context budget tracking
// ---------------------------------------------------------------------------

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
export class ContextCompactor {
  private readonly items: ContextItem[] = [];
  private readonly eventBus: AgentEventBus | undefined;
  private readonly contextLimit: number;

  /** Threshold (0-1) at which compaction is recommended. */
  private readonly compactionThreshold: number;

  constructor(
    eventBus?: AgentEventBus,
    contextLimit = DEFAULT_CONTEXT_LIMIT,
    compactionThreshold = 0.75,
  ) {
    this.eventBus = eventBus;
    this.contextLimit = contextLimit;
    this.compactionThreshold = compactionThreshold;
  }

  // -----------------------------------------------------------------------
  // Tracking
  // -----------------------------------------------------------------------

  /**
   * Track a loaded context item (skill, instruction, agent def, etc.).
   */
  trackItem(
    category: ContextItem['category'],
    source: string,
    content: string,
  ): void {
    this.items.push({
      source,
      category,
      tokens: estimateTokens(content),
      loadedAt: Date.now(),
    });
  }

  /**
   * Remove a tracked item by source name.
   */
  untrackItem(source: string): void {
    const idx = this.items.findIndex((item) => item.source === source);
    if (idx >= 0) {
      this.items.splice(idx, 1);
    }
  }

  /**
   * Clear all tracked items (e.g., on session reset).
   */
  reset(): void {
    this.items.length = 0;
  }

  // -----------------------------------------------------------------------
  // Budget checking
  // -----------------------------------------------------------------------

  /**
   * Check the current context budget status.
   */
  checkBudget(): BudgetStatus {
    const totalTokens = this.items.reduce((sum, item) => sum + item.tokens, 0);
    const utilizationPercent = Math.round((totalTokens / this.contextLimit) * 100);
    const needsCompaction = totalTokens / this.contextLimit >= this.compactionThreshold;

    let recommendation = '';
    if (utilizationPercent >= 90) {
      recommendation = 'CRITICAL: Context is nearly full. Compact immediately or remove skills.';
    } else if (needsCompaction) {
      recommendation = 'WARNING: Context is getting large. Consider compacting conversation history.';
    } else if (utilizationPercent >= 50) {
      recommendation = 'OK: Context usage is moderate. Monitor if adding more skills.';
    } else {
      recommendation = 'GOOD: Plenty of context budget remaining.';
    }

    return {
      totalTokens,
      limit: this.contextLimit,
      utilizationPercent,
      items: [...this.items],
      needsCompaction,
      recommendation,
    };
  }

  /**
   * Get token usage broken down by category.
   */
  getUsageByCategory(): Record<ContextItem['category'], number> {
    const usage: Record<string, number> = {
      instruction: 0,
      skill: 0,
      'agent-def': 0,
      template: 0,
      memory: 0,
      conversation: 0,
    };

    for (const item of this.items) {
      usage[item.category] = (usage[item.category] ?? 0) + item.tokens;
    }

    return usage as Record<ContextItem['category'], number>;
  }

  // -----------------------------------------------------------------------
  // Compaction
  // -----------------------------------------------------------------------

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
  compactConversation(
    messages: ReadonlyArray<{ role: string; content: string }>,
    agentName = 'unknown',
  ): string {
    const originalText = messages.map((m) => m.content).join('\n');
    const originalTokens = estimateTokens(originalText);

    // Extract key information from messages
    const keyFacts: string[] = [];
    const decisions: string[] = [];
    const codeChanges: string[] = [];
    const errors: string[] = [];

    for (const msg of messages) {
      const content = msg.content;

      // Extract decisions (lines starting with decision-like patterns)
      const decisionMatches = content.match(/(?:decided|decision|chose|selected|agreed|approved)[:.]?\s+.+/gi);
      if (decisionMatches) {
        decisions.push(...decisionMatches.map((m) => m.trim()));
      }

      // Extract file changes
      const fileMatches = content.match(/(?:created|modified|updated|deleted|wrote)\s+(?:file\s+)?[`']?[\w./\\-]+\.\w+[`']?/gi);
      if (fileMatches) {
        codeChanges.push(...fileMatches.map((m) => m.trim()));
      }

      // Extract errors
      const errorMatches = content.match(/(?:error|failed|exception|bug)[:.]?\s+.+/gi);
      if (errorMatches) {
        errors.push(...errorMatches.map((m) => m.trim()));
      }

      // Extract key facts (short important lines)
      const lines = content.split('\n').filter((l) => l.trim().length > 10 && l.trim().length < 200);
      for (const line of lines.slice(0, 5)) {
        if (/(?:important|note|require|must|should|critical)/i.test(line)) {
          keyFacts.push(line.trim());
        }
      }
    }

    // Build summary
    const sections: string[] = [
      '## Context Compaction Summary',
      '',
      `Compacted from ${messages.length} messages (~${originalTokens} tokens).`,
      '',
    ];

    if (decisions.length > 0) {
      sections.push('### Decisions', ...unique(decisions).slice(0, 10).map((d) => `- ${d}`), '');
    }
    if (codeChanges.length > 0) {
      sections.push('### Code Changes', ...unique(codeChanges).slice(0, 15).map((c) => `- ${c}`), '');
    }
    if (errors.length > 0) {
      sections.push('### Errors Encountered', ...unique(errors).slice(0, 10).map((e) => `- ${e}`), '');
    }
    if (keyFacts.length > 0) {
      sections.push('### Key Facts', ...unique(keyFacts).slice(0, 10).map((f) => `- ${f}`), '');
    }

    const summary = sections.join('\n');
    const compactedTokens = estimateTokens(summary);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('context-compacted', {
        agent: agentName,
        originalTokens,
        compactedTokens,
        summary,
        timestamp: Date.now(),
      });
    }

    return summary;
  }

  /**
   * Load and compact a session progress log from disk.
   *
   * @param progressDir - Path to the docs/progress/ directory.
   * @param issueNumber - Issue number to find the progress file for.
   * @returns Compacted summary or undefined if no file found.
   */
  compactProgressLog(progressDir: string, issueNumber: number): string | undefined {
    const prefix = `PROGRESS-${issueNumber}`;
    if (!fs.existsSync(progressDir)) { return undefined; }

    const files = fs.readdirSync(progressDir).filter((f) => f.startsWith(prefix));
    if (files.length === 0) { return undefined; }

    // Read the most recent progress file
    const latest = files.sort().pop()!;
    const content = fs.readFileSync(path.join(progressDir, latest), 'utf-8');

    // Extract completed items and current state
    const completedItems = content.match(/- \[x\].+/gi) ?? [];
    const pendingItems = content.match(/- \[ \].+/gi) ?? [];

    const summary = [
      `## Progress Summary (Issue #${issueNumber})`,
      '',
      `Source: ${latest}`,
      '',
      `### Completed (${completedItems.length})`,
      ...completedItems.slice(0, 20),
      '',
      `### Pending (${pendingItems.length})`,
      ...pendingItems.slice(0, 10),
    ].join('\n');

    return summary;
  }

  /**
   * Format a budget status report as a human-readable string.
   */
  formatBudgetReport(): string {
    const status = this.checkBudget();
    const usage = this.getUsageByCategory();

    const lines = [
      '## AgentX Context Budget',
      '',
      `Total: ~${status.totalTokens.toLocaleString()} / ${status.limit.toLocaleString()} tokens (${status.utilizationPercent}%)`,
      '',
      `Status: ${status.recommendation}`,
      '',
      '### Usage by Category',
      '',
      `| Category     | Tokens    |`,
      `|------------- |-----------|`,
    ];

    for (const [cat, tokens] of Object.entries(usage)) {
      if (tokens > 0) {
        lines.push(`| ${cat.padEnd(12)} | ${tokens.toLocaleString().padStart(9)} |`);
      }
    }

    if (status.items.length > 0) {
      lines.push('', '### Loaded Items', '');
      const sorted = [...status.items].sort((a: ContextItem, b: ContextItem) => b.tokens - a.tokens);
      for (const item of sorted.slice(0, 15)) {
        lines.push(`- ${item.source} (${item.category}): ~${item.tokens.toLocaleString()} tokens`);
      }
    }

    return lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}
