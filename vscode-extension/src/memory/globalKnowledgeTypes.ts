// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Global Knowledge Types
// ---------------------------------------------------------------------------
//
// Phase 3 type definitions for the Global Knowledge Base.
//
// Promotes high-value observations and outcomes from workspace-scoped memory
// to a user-level global knowledge base at ~/.agentx/knowledge/, enabling
// cross-project learning.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.5 and 4.3.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Knowledge category
// ---------------------------------------------------------------------------

/**
 * Semantic category for a global knowledge entry.
 */
export type KnowledgeCategory = 'pattern' | 'pitfall' | 'convention' | 'insight';

// ---------------------------------------------------------------------------
// Knowledge entry
// ---------------------------------------------------------------------------

/**
 * A single knowledge entry in the global store.
 * ID format: GK-{shortHash}
 */
export interface KnowledgeEntry {
  /** Unique ID: GK-{shortHash} */
  readonly id: string;
  /** Knowledge category. */
  readonly category: KnowledgeCategory;
  /** Short title (< 100 chars). */
  readonly title: string;
  /** Full knowledge text (< 500 chars). */
  readonly content: string;
  /** Workspace folder name where the knowledge originated. */
  readonly sourceProject: string;
  /** Original issue number (null if not issue-specific). */
  readonly sourceIssue: number | null;
  /** Original observation ID (null if from outcome). */
  readonly sourceObservationId: string | null;
  /** ISO-8601 promotion time. */
  readonly promotedAt: string;
  /** How the entry was promoted. */
  readonly promotionType: 'auto' | 'manual';
  /** Number of times recalled in prompt injection. */
  readonly usageCount: number;
  /** ISO-8601 last used time (null if never used). */
  readonly lastUsedAt: string | null;
  /** Labels inherited from source observation/outcome. */
  readonly labels: string[];
}

// ---------------------------------------------------------------------------
// Knowledge index
// ---------------------------------------------------------------------------

/**
 * Lightweight index entry for the global manifest.
 */
export interface KnowledgeIndex {
  readonly id: string;
  readonly category: KnowledgeCategory;
  readonly title: string;
  readonly sourceProject: string;
  readonly labels: string[];
  readonly usageCount: number;
  readonly promotedAt: string;
}

// ---------------------------------------------------------------------------
// Global knowledge manifest
// ---------------------------------------------------------------------------

/**
 * Manifest for the global knowledge store.
 * Persisted at ~/.agentx/knowledge/global-manifest.json.
 */
export interface GlobalKnowledgeManifest {
  readonly version: 1;
  updatedAt: string;
  entries: KnowledgeIndex[];
}

// ---------------------------------------------------------------------------
// Knowledge store statistics
// ---------------------------------------------------------------------------

export interface KnowledgeStats {
  readonly total: number;
  readonly byCategory: Record<KnowledgeCategory, number>;
  readonly sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * IGlobalKnowledgeStore -- user-level global knowledge base.
 */
export interface IGlobalKnowledgeStore {
  /** Promote an observation or outcome to global knowledge. Returns null if deduplicated. */
  promote(entry: Omit<KnowledgeEntry, 'id' | 'promotedAt' | 'usageCount' | 'lastUsedAt'>): Promise<KnowledgeEntry | null>;
  /** Search global knowledge by keyword and/or labels. */
  search(query: string, labels?: string[], limit?: number): Promise<KnowledgeIndex[]>;
  /** Get full knowledge entry by ID. */
  getById(id: string): Promise<KnowledgeEntry | null>;
  /** Increment usage count (called when entry used in prompt injection). */
  recordUsage(id: string): Promise<void>;
  /** List all entries, optionally filtered by category. */
  list(category?: KnowledgeCategory, limit?: number): Promise<KnowledgeIndex[]>;
  /** Remove a knowledge entry. */
  remove(id: string): Promise<boolean>;
  /** Prune entries unused for > PRUNE_UNUSED_AFTER_DAYS. Returns count removed. */
  prune(): Promise<number>;
  /** Get store statistics. */
  getStats(): Promise<KnowledgeStats>;
  /** Format for prompt injection (< 500 tokens). */
  formatForPrompt(query: string, labels?: string[]): Promise<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GLOBAL_KNOWLEDGE_DIR_NAME = '.agentx/knowledge';
export const GLOBAL_MANIFEST_FILE = 'global-manifest.json';
export const GLOBAL_STATS_FILE = '.stats.json';
export const PROMOTION_RECALL_THRESHOLD = 3;
export const DEDUP_SIMILARITY_THRESHOLD = 0.80;
export const MAX_GLOBAL_STORE_BYTES = 10_485_760; // 10 MB
export const PRUNE_UNUSED_AFTER_DAYS = 90;
export const MAX_KNOWLEDGE_TITLE_CHARS = 100;
export const MAX_KNOWLEDGE_CONTENT_CHARS = 500;
