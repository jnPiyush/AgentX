// ---------------------------------------------------------------------------
// AgentX -- Continuous Learning Loop: Core Types
// ---------------------------------------------------------------------------
//
// Type definitions for the lesson extraction, storage, and injection system.
// Lessons are patterns learned from session observations that guide future
// agent behavior to avoid repeating mistakes.
//
// Storage pattern: JSONL (one lesson per line) for append-only persistence.
// Location: ~/.agentx/lessons/ (global) + .agentx/lessons/ (project-specific)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Semantic categories for lessons
// ---------------------------------------------------------------------------

/**
 * Semantic category for a lesson extracted from session observations.
 * Drives filtering, matching, and promotion to hard rules.
 */
export const LessonCategory = {
  TEST_INFRA_GAP: 'test-infra-gap',
  MOCK_LIMITATION: 'mock-limitation', 
  TOOL_MISUSE: 'tool-misuse',
  SOURCE_DEFECT_PATTERN: 'source-defect-pattern',
  HYGIENE_VIOLATION: 'hygiene-violation',
  PRODUCTIVITY_BLOCKER: 'productivity-blocker',
  SECURITY_PATTERN: 'security-pattern', 
  ARCHITECTURE_INSIGHT: 'architecture-insight',
  CUSTOM: 'custom',
} as const;

export type LessonCategory = typeof LessonCategory[keyof typeof LessonCategory];

// ---------------------------------------------------------------------------
// Confidence and outcome tracking
// ---------------------------------------------------------------------------

/**
 * Confidence level of a lesson based on confirmation history.
 * - LOW: Recently extracted, needs validation
 * - MEDIUM: Some positive feedback, probably useful 
 * - HIGH: Multiple confirmations, proven valuable
 */
export const LessonConfidence = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM', 
  HIGH: 'HIGH',
} as const;

export type LessonConfidence = typeof LessonConfidence[keyof typeof LessonConfidence];

/**
 * Outcome of applying a lesson in a session.
 * Used to adjust confidence and track lesson effectiveness.
 */
export interface LessonOutcome {
  /** ISO timestamp when outcome was recorded. */
  readonly date: string;
  /** Type of outcome observed. */
  readonly type: 'positive' | 'negative' | 'neutral' | 'human-confirmed' | 'human-rejected';
  /** Brief context about what happened. */
  readonly context: string;
}

// ---------------------------------------------------------------------------
// Core lesson data structure
// ---------------------------------------------------------------------------

/**
 * A single lesson learned from agent session observations.
 * 
 * Lessons are extracted automatically from session patterns (failures,
 * fixes, time sinks) or added manually by humans. They guide future
 * agent behavior through context injection and eventual promotion to
 * hard rules (scripts, checks, configuration).
 */
export interface Lesson {
  // --- Identity ---
  /** Deterministic hash of category + normalized pattern. */
  readonly id: string;
  /** Classification bucket for filtering and matching. */
  readonly category: LessonCategory;

  // --- Content (human-reviewable) ---
  /** What triggers this lesson (the conditions that fire it). */
  readonly pattern: string;
  /** Summarized learning - what we discovered (the why/root cause). */
  readonly learning: string;
  /** Actionable guidance - what to do instead (the recommendation). */
  readonly recommendation: string;

  // --- Context ---
  /** Relevant file paths (workspace-relative, for matching). */
  readonly files: readonly string[];
  /** Free-form tags for matching (e.g., "mocha", "sinon", "vscode-mock"). */
  readonly tags: readonly string[];
  /** Source of the lesson. */
  readonly source: 'auto' | 'manual';

  // --- Lifecycle ---
  /** Current confidence level based on confirmation history. */
  confidence: LessonConfidence;
  /** How many times the triggering pattern was observed. */
  occurrences: number;
  /** Count of positive outcomes (used for promotion threshold). */
  confirmations: number;
  /** ISO timestamp of most recent pattern observation. */
  lastSeen: string;
  /** ISO timestamp when lesson was first created. */
  readonly createdAt: string;
  /** ISO timestamp when lesson was last updated. */
  readonly updatedAt: string;
  /** History of outcomes when this lesson was applied. */
  readonly outcomes: readonly LessonOutcome[];
  /** Metadata about how this lesson was extracted. */
  readonly extractedFrom?: {
    readonly agent: string;
    readonly issueNumber: number;
    readonly sessionId: string;
    readonly summary: string;
  };

  // --- Promotion ---
  /** Target type if lesson was promoted to a hard rule. */
  promotedTo?: string;
  /** ISO timestamp when promoted (if applicable). */
  promotedAt?: string;
}

// ---------------------------------------------------------------------------
// Query and filtering
// ---------------------------------------------------------------------------

/**
 * Options for querying the lesson store.
 * Multiple criteria are combined with AND logic.
 */
export interface LessonFilter {
  /** Filter by lesson categories. */
  readonly categories?: readonly LessonCategory[];
  /** Match if any file path overlaps with lesson.files[]. */
  readonly files?: readonly string[];
  /** Match if any tag overlaps with lesson.tags[]. */
  readonly tags?: readonly string[];
  /** Filter by minimum confidence level. */
  readonly minConfidence?: LessonConfidence;
  /** Filter by source (auto-extracted vs manually added). */
  readonly source?: 'auto' | 'manual';
  /** Maximum number of results to return. */
  readonly limit?: number;
  /** Include promoted lessons (default: false, since they're replaced by hard rules). */
  readonly includePromoted?: boolean;
}

/**
 * Statistics about the lesson store contents.
 * Used for CLI reporting and lifecycle management.
 */
export interface LessonStats {
  readonly totalLessons: number;
  readonly activeLessons: number;
  readonly promotedLessons: number;
  readonly archivedLessons: number;
  readonly confidenceCounts: {
    readonly LOW: number;
    readonly MEDIUM: number;
    readonly HIGH: number;
  };
  readonly categoryCounts: Record<LessonCategory, number>;
  readonly averageConfirmations: number;
  readonly oldestLesson: string;       // ISO date
  readonly newestLesson: string;       // ISO date
}

/**
 * Query interface extending LessonFilter with additional search capabilities.
 */
export interface LessonQuery extends LessonFilter {
  /** Text search across pattern, learning, and recommendation fields. */
  readonly searchText?: string;
  /** Sort order for results. */
  readonly sortBy?: 'relevance' | 'confidence' | 'recent' | 'confirmations';
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the continuous learning loop.
 * Stored in .agentx/config.json under "lessons" key.
 */
export interface LearningConfig {
  /** Whether the learning loop is enabled. */
  readonly enabled: boolean;
  /** Number of confirmations required to promote a lesson to a hard rule. */
  readonly promotionThreshold: number;
  /** Maximum lessons injected per session. */
  readonly maxInjectPerSession: number;
  /** Whether to show "was this helpful?" prompt at session end. */
  readonly feedbackPromptEnabled: boolean;
  /** Days before confidence decays (at non-HIGH confidence). */
  readonly decayDays: number;
  /** Days at LOW confidence before archival. */
  readonly archiveDays: number;
  /** Whether to auto-commit HIGH confidence lessons to git. */
  readonly autoCommitHighConfidence: boolean;
}

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

/**
 * File paths for lesson storage.
 * Global lessons (cross-project) stored in ~/.agentx/lessons/
 * Project lessons stored in .agentx/lessons/
 */
export interface LessonStoragePaths {
  /** Global lesson store (JSONL). */
  readonly globalLessons: string;
  /** Global archive (JSONL). */
  readonly globalArchive: string;
  /** Project lesson store (JSONL, gitignored). */
  readonly projectLessons: string;
  /** Project committed lessons (JSONL, git-tracked). */
  readonly projectCommitted: string;
  /** Project archive (JSONL). */
  readonly projectArchive: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default configuration values for the learning loop. */
export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  enabled: true,
  promotionThreshold: 3,
  maxInjectPerSession: 5,
  feedbackPromptEnabled: true,
  decayDays: 90,
  archiveDays: 180,
  autoCommitHighConfidence: true,
} as const;

/** Confidence level ordering for comparisons. */
export const CONFIDENCE_ORDER: Record<LessonConfidence, number> = {
  [LessonConfidence.LOW]: 1,
  [LessonConfidence.MEDIUM]: 2,
  [LessonConfidence.HIGH]: 3,
} as const;

// ---------------------------------------------------------------------------
// Context and Integration Types
// ---------------------------------------------------------------------------

/**
 * Context for lesson injection decisions.
 * Used by LessonInjector to determine relevant lessons.
 */
export interface LearningContext {
  /** Agent requesting lessons. */
  readonly agent: string;
  /** Files being worked on. */
  readonly files: string[];
  /** Issue labels for categorization. */
  readonly issueLabels?: string[];
  /** Issue number for traceability. */
  readonly issueNumber?: number;
  /** Execution context (e.g., 'bug-fix', 'feature', 'refactor'). */
  readonly executionContext?: string;
}

/**
 * Feedback context for session outcome evaluation.
 * Used by FeedbackCollector to assess lesson effectiveness.
 */
export interface SessionFeedbackContext {
  /** Session identifier. */
  readonly sessionId: string;
  /** Agent that ran the session. */
  readonly agent: string;
  /** Issue number if applicable. */
  readonly issueNumber?: number;
  /** Lessons that were applied during the session. */
  readonly appliedLessons: string[];
  /** Summary of what happened in the session. */
  readonly sessionSummary: string;
  /** Whether an error occurred during the session. */
  readonly errorOccurred: boolean;
  /** Whether the session had a successful outcome. */
  readonly successfulOutcome: boolean;
  /** Time taken to complete the session (ms). */
  readonly completionTime: number;
}

/**
 * Result of lesson injection for a session.
 * Contains lessons and metadata for context.
 */
export interface LessonContext {
  /** Lessons relevant to the current context. */
  readonly relevantLessons: Lesson[];
  /** Total lessons considered. */
  readonly totalConsidered: number;
  /** Average relevance score of injected lessons. */  
  readonly averageRelevance: number;
  /** Context that was used for matching. */
  readonly context: LearningContext;
}