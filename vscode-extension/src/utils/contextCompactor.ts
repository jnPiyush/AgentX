// ---------------------------------------------------------------------------
// AgentX -- Context Compaction
// ---------------------------------------------------------------------------
//
// Detects when agent context is approaching token limits and provides
// utilities to summarize/compact conversation history and loaded context.
//
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// Bounded Message Pruning (US-2.5)
// ---------------------------------------------------------------------------

/** Check context compaction every N messages (59-message increment rule). */
const COMPACTION_CHECK_INTERVAL = 59;

/** Default compaction threshold (70% of token budget). */
const DEFAULT_COMPACTION_THRESHOLD = 0.7;

/** Default maximum conversation message count for modern models. */
const DEFAULT_MAX_MESSAGES = 100;

/**
 * Configuration for bounded message pruning.
 */
export interface BoundedMessageConfig {
  /** Maximum number of messages to retain. Default: 200. */
  readonly maxMessages: number;
  /**
   * Whether to emit a warning event before pruning.
   * Default: true.
   */
  readonly warnBeforePrune: boolean;
}

/**
 * Result of a bounded message pruning operation.
 */
export interface PruneResult {
  /** Messages after pruning. */
  readonly messages: ReadonlyArray<{ role: string; content: string }>;
  /** Number of messages removed. */
  readonly prunedCount: number;
  /** Whether pruning was applied. */
  readonly didPrune: boolean;
  /** Total messages before pruning. */
  readonly originalCount: number;
}

/**
 * Enforce a hard cap on conversation messages by removing the oldest
 * non-system messages when the cap is reached.
 *
 * Rules:
 *   1. System messages (role='system') are NEVER pruned -- they are exempt
 *      from the hard cap by design. This means the returned array MAY
 *      exceed `maxMessages` when system messages alone exceed the limit.
 *      Callers that need a strict total count should filter system messages
 *      separately or adjust `maxMessages` upward to accommodate them.
 *   2. Oldest non-system messages are pruned first (preserves recent context)
 *   3. Works alongside token-based compaction (independent mechanism)
 *   4. Warning emitted via eventBus before pruning (if configured)
 *
 * @param messages - Full conversation history.
 * @param config - Bounded message configuration.
 * @param eventBus - Optional event bus for warning emission.
 * @param agentName - Agent name for event metadata.
 * @returns PruneResult with the pruned message array and metadata.
 */
export function pruneMessages(
  messages: ReadonlyArray<{ role: string; content: string }>,
  config?: Partial<BoundedMessageConfig>,
  eventBus?: AgentEventBus,
  agentName = 'unknown',
): PruneResult {
  const maxMessages = config?.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const warnBeforePrune = config?.warnBeforePrune ?? true;

  if (maxMessages <= 0) {
    // Safety: if misconfigured, return original
    return {
      messages,
      prunedCount: 0,
      didPrune: false,
      originalCount: messages.length,
    };
  }

  if (messages.length <= maxMessages) {
    return {
      messages,
      prunedCount: 0,
      didPrune: false,
      originalCount: messages.length,
    };
  }

  // Separate system messages from non-system messages
  const systemMessages: { role: string; content: string; originalIndex: number }[] = [];
  const nonSystemMessages: { role: string; content: string; originalIndex: number }[] = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'system') {
      systemMessages.push({ ...messages[i], originalIndex: i });
    } else {
      nonSystemMessages.push({ ...messages[i], originalIndex: i });
    }
  }

  // Calculate how many non-system messages to keep
  const nonSystemBudget = maxMessages - systemMessages.length;

  if (nonSystemBudget <= 0) {
    // Edge case: more system messages than max -- keep all system, prune all non-system
    const prunedCount = nonSystemMessages.length;
    if (warnBeforePrune && eventBus && prunedCount > 0) {
      eventBus.emit('bounded-message-warning', {
        agent: agentName,
        totalMessages: messages.length,
        maxMessages,
        prunedCount,
        timestamp: Date.now(),
      });
    }
    return {
      messages: systemMessages.map(({ role, content }) => ({ role, content })),
      prunedCount,
      didPrune: prunedCount > 0,
      originalCount: messages.length,
    };
  }

  const prunedCount = nonSystemMessages.length - nonSystemBudget;

  if (prunedCount <= 0) {
    return {
      messages,
      prunedCount: 0,
      didPrune: false,
      originalCount: messages.length,
    };
  }

  // Emit warning before pruning
  if (warnBeforePrune && eventBus) {
    eventBus.emit('bounded-message-warning', {
      agent: agentName,
      totalMessages: messages.length,
      maxMessages,
      prunedCount,
      timestamp: Date.now(),
    });
  }

  // Keep only the most recent non-system messages
  const keptNonSystem = nonSystemMessages.slice(prunedCount);

  // Merge system and kept non-system messages, preserving original order
  const merged = [...systemMessages, ...keptNonSystem]
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(({ role, content }) => ({ role, content }));

  return {
    messages: merged,
    prunedCount,
    didPrune: true,
    originalCount: messages.length,
  };
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Rough token-per-character ratio for English text (GPT/Claude). */
const CHARS_PER_TOKEN = 4;

/**
 * Default context window size in tokens for cases where model info is unavailable.
 * Conservative estimate that works for typical models with 70% utilization applied.
 */
const DEFAULT_CONTEXT_LIMIT = 70_000;

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
    compactionThreshold = DEFAULT_COMPACTION_THRESHOLD,
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
// Smart Message Management (59-Message Interval Rule)
// ---------------------------------------------------------------------------

/**
 * Configuration for smart message management with compaction.
 */
export interface SmartMessageConfig {
  /** Token budget for context window (70% of model max). */
  readonly tokenBudget: number;
  /** Message check interval (default: 59). */
  readonly checkInterval?: number;
  /** Compaction threshold (default: 0.7 = 70%). */
  readonly compactionThreshold?: number;
  /** Number of recent messages to preserve during compaction. */
  readonly keepRecent?: number;
}

/**
 * Result of smart message management operation.
 */
export interface SmartMessageResult {
  /** Messages after processing. */
  readonly messages: ReadonlyArray<{ role: string; content: string }>;
  /** Whether compaction was triggered. */
  readonly didCompact: boolean;
  /** Whether simple pruning was applied. */
  readonly didPrune: boolean;
  /** Total estimated tokens before processing. */
  readonly tokensBeforeProcessing: number;
  /** Total estimated tokens after processing. */
  readonly tokensAfterProcessing: number;
  /** Number of messages removed (if pruned). */
  readonly prunedCount?: number;
  /** Compaction summary (if compacted). */
  readonly compactionSummary?: string;
}

/**
 * Smart message management that checks every 59 messages and triggers
 * compaction when token usage reaches 70% of the context window.
 *
 * Algorithm:
 * 1. Check if message count is at 59-message intervals
 * 2. If yes, estimate token usage of all messages
 * 3. If token usage >= 70% of budget, trigger AI-powered compaction
 * 4. Otherwise, apply simple bounded pruning if needed
 *
 * @param messages - Full conversation history.
 * @param config - Smart message management configuration.
 * @param eventBus - Optional event bus for event emission.
 * @param agentName - Agent name for event metadata.
 * @returns Promise with SmartMessageResult containing processed messages and metadata.
 */
export async function manageMessagesSmartly(
  messages: ReadonlyArray<{ role: string; content: string }>,
  config: SmartMessageConfig,
  eventBus?: AgentEventBus,
  agentName = 'unknown',
): Promise<SmartMessageResult> {
  const checkInterval = config.checkInterval ?? COMPACTION_CHECK_INTERVAL;
  const compactionThreshold = config.compactionThreshold ?? DEFAULT_COMPACTION_THRESHOLD;
  const keepRecent = config.keepRecent ?? 10;
  
  // Calculate total tokens for current conversation
  const totalContent = messages.map(m => m.content).join('\n');
  const currentTokens = estimateTokens(totalContent);
  
  // Check if we're at a 59-message interval OR past threshold regardless of interval
  const isAtCheckInterval = messages.length % checkInterval === 0;
  
  // Check if we need compaction (70% threshold)
  const needsCompaction = currentTokens >= config.tokenBudget * compactionThreshold;
  
  if (needsCompaction && (isAtCheckInterval || messages.length >= checkInterval)) {
    // Trigger AI-powered compaction using VS Code Language Model
    const compactionResult = await performCompaction(messages, keepRecent, agentName, eventBus);
    return {
      messages: compactionResult.messages,
      didCompact: true,
      didPrune: false,
      tokensBeforeProcessing: currentTokens,
      tokensAfterProcessing: estimateTokens(compactionResult.messages.map(m => m.content).join('\n')),
      compactionSummary: compactionResult.summary,
    };
  } else if (messages.length > DEFAULT_MAX_MESSAGES) {
    // Fallback: simple bounded pruning if too many messages
    const pruneResult = pruneMessages(messages, {
      maxMessages: DEFAULT_MAX_MESSAGES,
      warnBeforePrune: true,
    }, eventBus, agentName);
    
    return {
      messages: pruneResult.messages,
      didCompact: false,
      didPrune: pruneResult.didPrune,
      tokensBeforeProcessing: currentTokens,
      tokensAfterProcessing: estimateTokens(pruneResult.messages.map(m => m.content).join('\n')),
      prunedCount: pruneResult.prunedCount,
    };
  } else {
    // No processing needed
    return {
      messages,
      didCompact: false,
      didPrune: false,
      tokensBeforeProcessing: currentTokens,
      tokensAfterProcessing: currentTokens,
    };
  }
}

/**
 * Perform message compaction using VS Code's Language Model API for intelligent summarization.
 * 
 * @param messages - Messages to compact.
 * @param keepRecent - Number of recent messages to preserve.
 * @param agentName - Agent name for event metadata.
 * @param eventBus - Optional event bus for events.
 * @returns Compaction result with messages and summary.
 */
async function performCompaction(
  messages: ReadonlyArray<{ role: string; content: string }>,
  keepRecent: number,
  agentName: string,
  eventBus?: AgentEventBus,
): Promise<{ messages: ReadonlyArray<{ role: string; content: string }>; summary: string }> {
  if (messages.length <= keepRecent + 1) {
    return { messages, summary: 'No compaction needed - too few messages' };
  }

  // Partition: system prompt | middle (compactable) | recent
  const systemPrompt = messages[0]?.role === 'system' ? messages[0] : null;
  const startIdx = systemPrompt ? 1 : 0;
  const recentStart = Math.max(startIdx, messages.length - keepRecent);
  const middle = messages.slice(startIdx, recentStart);
  const recent = messages.slice(recentStart);

  if (middle.length === 0) {
    return { messages, summary: 'No compaction needed - no middle messages' };
  }

  // Use VS Code LM API for intelligent compaction
  const intelligentSummary = await compactConversationWithVSCodeLM(middle, agentName);

  const compactionMsg = {
    role: 'system' as const,
    content: `[COMPACTED CONTEXT] ${intelligentSummary}`,
  };

  // Build final message list
  const newMessages = [];
  if (systemPrompt) {
    newMessages.push(systemPrompt);
  }
  newMessages.push(compactionMsg);
  newMessages.push(...recent);

  // Emit compaction event
  if (eventBus) {
    eventBus.emit('context-compacted', {
      agent: agentName,
      originalTokens: estimateTokens(messages.map(m => m.content).join('\n')),
      compactedTokens: estimateTokens(newMessages.map(m => m.content).join('\n')),
      summary: intelligentSummary,
      timestamp: Date.now(),
    });
  }

  return {
    messages: newMessages,
    summary: intelligentSummary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ---------------------------------------------------------------------------
// VS Code LM-Powered Intelligent Compaction
// ---------------------------------------------------------------------------

/**
 * Uses VS Code's Language Model API to intelligently compact conversation history.
 * This provides much better summarization than rule-based pattern extraction.
 *
 * @param messages - Messages to compact using AI.
 * @param agentName - Agent name for context.
 * @returns Promise with intelligent summary or falls back to rule-based if LM unavailable.
 */
export async function compactConversationWithVSCodeLM(
  messages: ReadonlyArray<{ role: string; content: string }>,
  agentName: string,
): Promise<string> {
  try {
    // Try to get a VS Code Language Model
    // Try broader selector first, then fall back to GPT family
    let availableModels = await vscode.lm.selectChatModels({
      vendor: 'copilot',
    });

    if (availableModels.length === 0) {
      availableModels = await vscode.lm.selectChatModels({});
    }

    if (availableModels.length === 0) {
      // Fallback to rule-based compaction if no model available
      return performRuleBasedCompaction(messages);
    }

    const model = availableModels[0];
    
    // Build the compaction prompt
    const conversationText = messages.map((msg, i) => 
      `${i + 1}. ${msg.role.toUpperCase()}: ${msg.content}`
    ).join('\n\n');

    const compactionPrompt = `You are analyzing a coding conversation to create a concise summary that preserves essential context. 

CONVERSATION TO SUMMARIZE:
${conversationText}

Please create a structured summary that includes:
1. **Context & Goal**: What was being worked on
2. **Key Decisions**: Important choices made during the conversation  
3. **Code Changes**: Files created, modified, or key implementations
4. **Current State**: Status of work and any pending tasks
5. **Important Details**: Technical details that must be preserved for context

Keep the summary comprehensive but concise. Focus on actionable information that would help continue the work. Omit redundant explanations and keep technical details precise.

Format as structured markdown with clear sections.`;

    const compactionRequest = [
      vscode.LanguageModelChatMessage.User(compactionPrompt)
    ];

    // Send request to VS Code LM
    const tokenSource = new vscode.CancellationTokenSource();
    const chatResponse = await model.sendRequest(
      compactionRequest,
      {},
      tokenSource.token,
    );

    // Collect the response
    let summary = '';
    for await (const fragment of chatResponse.text) {
      summary += fragment;
    }

    // Add metadata header
    const messageCount = messages.length;
    const originalTokens = estimateTokens(conversationText);
    const compactedTokens = estimateTokens(summary);
    
    const finalSummary = `## AI-Powered Context Compaction

**Agent**: ${agentName} | **Messages**: ${messageCount} → 1 | **Tokens**: ~${originalTokens} → ~${compactedTokens}

${summary}

---
*This summary was generated using VS Code's Language Model API*`;

    return finalSummary;

  } catch (error) {
    console.warn('VS Code LM compaction failed, falling back to rule-based:', error);
    return performRuleBasedCompaction(messages);
  }
}

/**
 * Traditional rule-based compaction as fallback when VS Code LM is unavailable.
 */
function performRuleBasedCompaction(
  messages: ReadonlyArray<{ role: string; content: string }>,
): string {
  const originalText = messages.map((m) => m.content).join('\n');
  const originalTokens = estimateTokens(originalText);

  // Extract key information patterns
  const keyFacts: string[] = [];
  const decisions: string[] = [];
  const codeChanges: string[] = [];
  const errors: string[] = [];

  for (const msg of messages) {
    const content = msg.content;

    // Extract key patterns using regex
    const decisionMatches = content.match(/(?:decided|decision|chose|selected|agreed|approved)[:.]?\s+.+/gi);
    if (decisionMatches) {
      decisions.push(...decisionMatches.map((m) => m.trim()));
    }

    const fileMatches = content.match(/(?:created|modified|updated|deleted|wrote)\s+(?:file\s+)?[`']?[\w./\\-]+\.\w+[`']?/gi);
    if (fileMatches) {
      codeChanges.push(...fileMatches.map((m) => m.trim()));
    }

    const errorMatches = content.match(/(?:error|failed|exception|bug)[:.]?\s+.+/gi);
    if (errorMatches) {
      errors.push(...errorMatches.map((m) => m.trim()));
    }

    const lines = content.split('\n').filter((l) => l.trim().length > 10 && l.trim().length < 200);
    for (const line of lines.slice(0, 5)) {
      if (/(?:important|note|require|must|should|critical)/i.test(line)) {
        keyFacts.push(line.trim());
      }
    }
  }

  // Build structured summary
  const sections: string[] = [
    '## Rule-Based Context Compaction Summary',
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

  return sections.join('\n');
}
