// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: ObservationExtractor
// ---------------------------------------------------------------------------
//
// Parses the compaction summary produced by ContextCompactor.compactConversation()
// into structured Observation objects ready for persistence.
//
// Input format (produced by compactConversation):
//   ## Context Compaction Summary
//   Compacted from N messages (~T tokens).
//
//   ### Decisions
//   - decided to use JSON storage for Phase 1
//   - ...
//
//   ### Code Changes
//   - created file src/memory/types.ts
//   - ...
//
//   ### Errors Encountered
//   - error: Could not parse lock file
//   - ...
//
//   ### Key Facts
//   - Important: memory budget is 20K tokens
//   - ...
//
// Each bullet point under a section becomes one Observation.
// The summary field is a truncated version of the content (<=60 chars).
//
// Phase 1: section-to-category mapping + simple truncation.
// Phase 3: LLM-based summarization, deduplication, quality scoring.
// ---------------------------------------------------------------------------

import { estimateTokens } from '../utils/contextCompactor';
import {
  MAX_OBSERVATIONS_PER_CAPTURE,
  Observation,
  ObservationCategory,
} from './types';

// ---------------------------------------------------------------------------
// Section header -> category mapping
// ---------------------------------------------------------------------------

const SECTION_CATEGORY_MAP: ReadonlyArray<{ pattern: RegExp; category: ObservationCategory }> = [
  { pattern: /^#{1,3}\s*decisions?/i, category: 'decision' },
  { pattern: /^#{1,3}\s*(code\s*changes?|file\s*changes?|modified\s*files?)/i, category: 'code-change' },
  { pattern: /^#{1,3}\s*errors?\s*(encountered|found)?/i, category: 'error' },
  { pattern: /^#{1,3}\s*key\s*facts?/i, category: 'key-fact' },
];

// Minimum content length to be worth persisting (filters out noise).
const MIN_CONTENT_LENGTH = 10;

// Maximum characters for auto-generated summary.
const SUMMARY_MAX_CHARS = 240;

// ---------------------------------------------------------------------------
// ObservationExtractor
// ---------------------------------------------------------------------------

/**
 * Parses a compaction summary string into individual Observation objects.
 *
 * Usage:
 * ```ts
 * const extractor = new ObservationExtractor();
 * const observations = extractor.extractObservations(
 *   compactedSummary,
 *   'engineer',
 *   42,
 *   'session-abc123'
 * );
 * ```
 */
export class ObservationExtractor {
  /**
   * Extract structured observations from a compaction summary.
   *
   * @param summary - The full compaction summary text from compactConversation().
   * @param agent - Agent name that produced the summary.
   * @param issueNumber - Issue number for the active session.
   * @param sessionId - Session identifier for provenance tracking.
   * @returns Array of Observation objects (max MAX_OBSERVATIONS_PER_CAPTURE).
   */
  extractObservations(
    summary: string,
    agent: string,
    issueNumber: number,
    sessionId: string,
  ): Observation[] {
    if (!summary || summary.trim().length === 0) { return []; }

    const lines = summary.split('\n');
    const observations: Observation[] = [];
    let currentCategory: ObservationCategory = 'compaction-summary';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { continue; }

      // Detect section headers and update current category.
      const matched = SECTION_CATEGORY_MAP.find((s) => s.pattern.test(line));
      if (matched) {
        currentCategory = matched.category;
        continue;
      }

      // Skip non-bullet lines that are not content (e.g., headers, dividers).
      if (!line.startsWith('-') && !line.startsWith('*')) { continue; }

      // Strip bullet prefix.
      const content = line.replace(/^[-*]\s*/, '').trim();

      if (content.length < MIN_CONTENT_LENGTH) { continue; }

      observations.push(
        this.buildObservation(content, currentCategory, agent, issueNumber, sessionId),
      );

      if (observations.length >= MAX_OBSERVATIONS_PER_CAPTURE) { break; }
    }

    // If no bullet items were extracted but the summary is non-trivial,
    // store the whole summary as a compaction-summary observation.
    if (observations.length === 0 && summary.length >= MIN_CONTENT_LENGTH) {
      observations.push(
        this.buildObservation(summary, 'compaction-summary', agent, issueNumber, sessionId),
      );
    }

    return observations;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildObservation(
    content: string,
    category: ObservationCategory,
    agent: string,
    issueNumber: number,
    sessionId: string,
  ): Observation {
    const now = new Date().toISOString();
    return {
      id: this.generateId(agent, issueNumber),
      agent,
      issueNumber,
      category,
      content,
      summary: truncate(content, SUMMARY_MAX_CHARS),
      tokens: estimateTokens(content),
      timestamp: now,
      sessionId,
    };
  }

  /**
   * Generate a unique observation ID.
   * Format: obs-{agent}-{issue}-{timestamp}-{rand6}
   * Example: obs-engineer-29-1709035200000-a1b2c3
   */
  private generateId(agent: string, issueNumber: number): string {
    const safeAgent = agent.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    return `obs-${safeAgent}-${issueNumber}-${ts}-${rand}`;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a string to maxChars, appending '...' if truncated.
 */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) { return text; }
  return text.slice(0, maxChars - 3) + '...';
}
