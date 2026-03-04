// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Synapse Network Types
// ---------------------------------------------------------------------------
//
// Phase 3 type definitions for the Synapse Network (cross-issue linking).
//
// The Synapse Network computes lightweight similarity between observations
// across issues and creates bidirectional links for pattern propagation.
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.4 and 4.2.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Synapse link
// ---------------------------------------------------------------------------

/**
 * A bidirectional link between two observations from different issues.
 */
export interface SynapseLink {
  /** Unique link ID: syn-{obsId1}-{obsId2} */
  readonly id: string;
  /** Source observation ID. */
  readonly sourceObservation: string;
  /** Target observation ID. */
  readonly targetObservation: string;
  /** Source issue number. */
  readonly sourceIssue: number;
  /** Target issue number. */
  readonly targetIssue: number;
  /** Computed similarity score (0.0 - 1.0). */
  readonly similarity: number;
  /** How the link was created. */
  readonly linkType: 'auto' | 'manual';
  /** ISO-8601 creation time. */
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Synapse manifest
// ---------------------------------------------------------------------------

/**
 * Manifest storing all observation links.
 * Persisted at `.agentx/memory/synapse-manifest.json`.
 */
export interface SynapseManifest {
  readonly version: 1;
  updatedAt: string;
  links: SynapseLink[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * ISynapseNetwork -- cross-issue observation linking via similarity.
 */
export interface ISynapseNetwork {
  /** Compute links for a new observation against recent observations. */
  processNewObservation(observationId: string, issueNumber: number, content: string, labels: string[], category: string): Promise<SynapseLink[]>;
  /** Get all links for an observation. */
  getLinks(observationId: string): Promise<SynapseLink[]>;
  /** Get cross-issue context string for prompt injection. */
  getCrossIssueContext(issueNumber: number, limit?: number): Promise<string>;
  /** Get all links (for dashboard/visualization). */
  getAllLinks(): Promise<SynapseLink[]>;
  /** Remove stale links (target observation archived/missing). */
  prune(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SIMILARITY_THRESHOLD = 0.70;
export const MAX_LINKS_PER_OBSERVATION = 10;
export const MAX_CROSS_ISSUE_CONTEXT_TOKENS = 300;
export const SYNAPSE_MANIFEST_FILE = 'synapse-manifest.json';
export const SYNAPSE_MANIFEST_CACHE_TTL_MS = 60_000;
