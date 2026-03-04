// ---------------------------------------------------------------------------
// AgentX -- Intelligence Pipeline: Pattern Analyzer
// ---------------------------------------------------------------------------
//
// Scans outcome and observation stores for recurring patterns.
// Detects repeated failures, common pitfalls, and recurring success
// patterns that agents should learn from.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 4.1.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe } from '../../utils/fileLock';
import {
  type IDetector,
  type DetectorResult,
  type PatternAlert,
  DEFAULT_PATTERN_MIN_COUNT,
} from '../backgroundTypes';
import { type OutcomeRecord, type OutcomeManifest, OUTCOME_MANIFEST_FILE, OUTCOMES_DIR } from '../../memory/outcomeTypes';

// ---------------------------------------------------------------------------
// PatternAnalyzer
// ---------------------------------------------------------------------------

/**
 * Analyzes outcome records for recurring patterns. Groups by lesson
 * keywords and detects repeated failures that agents should avoid.
 */
export class PatternAnalyzer implements IDetector {
  readonly name = 'pattern';

  private readonly memoryDir: string;
  private readonly minPatternCount: number;

  constructor(memoryDir: string, minPatternCount?: number) {
    this.memoryDir = memoryDir;
    this.minPatternCount = minPatternCount ?? DEFAULT_PATTERN_MIN_COUNT;
  }

  async detect(): Promise<DetectorResult[]> {
    const results: DetectorResult[] = [];
    const outcomesDir = path.join(this.memoryDir, OUTCOMES_DIR);

    if (!fs.existsSync(outcomesDir)) {
      return results;
    }

    // Load outcome manifest
    const manifestPath = path.join(outcomesDir, OUTCOME_MANIFEST_FILE);
    const manifest = readJsonSafe<OutcomeManifest>(manifestPath);
    if (!manifest || manifest.entries.length === 0) {
      return results;
    }

    // Load recent outcome records (last 200 for performance)
    const recentEntries = manifest.entries.slice(-200);
    const outcomes: OutcomeRecord[] = [];

    for (const entry of recentEntries) {
      const recordPath = path.join(outcomesDir, `${entry.id}.json`);
      const record = readJsonSafe<OutcomeRecord>(recordPath);
      if (record) {
        outcomes.push(record);
      }
    }

    if (outcomes.length === 0) {
      return results;
    }

    // Analyze failure patterns
    const failurePatterns = this.analyzeFailures(outcomes);
    for (const pattern of failurePatterns) {
      results.push({
        detector: 'pattern',
        severity: pattern.occurrences >= this.minPatternCount * 2 ? 'critical' : 'warning',
        message: pattern.description,
        actionLabel: 'View Outcomes',
        actionCommand: 'agentx.sessionHistory',
      });
    }

    // Analyze success patterns for promotion candidates
    const successPatterns = this.analyzeSuccessPatterns(outcomes);
    for (const pattern of successPatterns) {
      results.push({
        detector: 'pattern',
        severity: 'info',
        message: pattern.description,
        actionLabel: 'Promote to Global',
        actionCommand: 'agentx.promoteToGlobal',
      });
    }

    return results;
  }

  /**
   * Groups failures by lesson keywords and returns patterns that
   * exceed the minimum count threshold.
   */
  private analyzeFailures(outcomes: readonly OutcomeRecord[]): PatternAlert[] {
    const failures = outcomes.filter((o) => o.result === 'fail' || o.result === 'partial');
    if (failures.length === 0) { return []; }

    // Group by keywords extracted from lessons
    const keywordGroups = new Map<string, OutcomeRecord[]>();

    for (const failure of failures) {
      const keywords = this.extractKeywords(failure.lesson);
      for (const keyword of keywords) {
        const group = keywordGroups.get(keyword) ?? [];
        group.push(failure);
        keywordGroups.set(keyword, group);
      }
    }

    const alerts: PatternAlert[] = [];

    for (const [keyword, group] of keywordGroups) {
      if (group.length >= this.minPatternCount) {
        const issues = [...new Set(group.map((g) => g.issueNumber).filter(Boolean))];
        alerts.push({
          patternId: `failure-${keyword}`,
          description: `Recurring failure pattern "${keyword}": ${group.length} occurrences across ${issues.length} issue(s)`,
          occurrences: group.length,
          issueNumbers: issues.filter((n): n is number => n !== undefined),
          firstSeen: group[0]?.timestamp ?? new Date().toISOString(),
          lastSeen: group[group.length - 1]?.timestamp ?? new Date().toISOString(),
        });
      }
    }

    return alerts;
  }

  /**
   * Identifies success patterns that appear frequently enough
   * to be candidates for global knowledge promotion.
   */
  private analyzeSuccessPatterns(outcomes: readonly OutcomeRecord[]): PatternAlert[] {
    const successes = outcomes.filter((o) => o.result === 'pass');
    if (successes.length === 0) { return []; }

    // Group by step or action keywords
    const actionGroups = new Map<string, OutcomeRecord[]>();

    for (const success of successes) {
      const keywords = this.extractKeywords(success.lesson);
      for (const keyword of keywords) {
        const group = actionGroups.get(keyword) ?? [];
        group.push(success);
        actionGroups.set(keyword, group);
      }
    }

    const alerts: PatternAlert[] = [];

    for (const [keyword, group] of actionGroups) {
      if (group.length >= this.minPatternCount) {
        const issues = [...new Set(group.map((g) => g.issueNumber).filter(Boolean))];
        alerts.push({
          patternId: `success-${keyword}`,
          description: `Recurring success pattern "${keyword}": ${group.length} occurrences -- candidate for global knowledge`,
          occurrences: group.length,
          issueNumbers: issues.filter((n): n is number => n !== undefined),
          firstSeen: group[0]?.timestamp ?? new Date().toISOString(),
          lastSeen: group[group.length - 1]?.timestamp ?? new Date().toISOString(),
        });
      }
    }

    return alerts;
  }

  /**
   * Extracts significant keywords from a lesson string.
   * Strips stop-words and returns lowercase tokens of length >= 4.
   */
  private extractKeywords(lesson: string): string[] {
    const STOP_WORDS = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
      'was', 'were', 'are', 'has', 'had', 'not', 'but', 'all', 'can',
      'her', 'his', 'one', 'our', 'out', 'you', 'will', 'when', 'what',
      'which', 'their', 'them', 'then', 'than', 'each', 'make', 'like',
      'should', 'could', 'would', 'about', 'into', 'more', 'some', 'such',
      'only', 'other', 'also', 'just', 'because', 'after', 'before',
    ]);

    return lesson
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
      .slice(0, 5); // Take top 5 keywords per lesson
  }
}
