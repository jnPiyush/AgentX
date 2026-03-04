// ---------------------------------------------------------------------------
// AgentX -- Memory Pipeline: Synapse Network
// ---------------------------------------------------------------------------
//
// Cross-issue observation linking via Jaccard similarity. Computes a
// weighted similarity score between observations and creates bidirectional
// links for pattern propagation and cross-issue context injection.
//
// Similarity formula:
//   similarity(a, b) = 0.4 * jaccard(labels) +
//                      0.4 * jaccard(keywords) +
//                      0.2 * (category === category ? 1 : 0)
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 3.4 and 4.2.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { readJsonSafe, writeJsonLocked } from '../utils/fileLock';
import {
  type ISynapseNetwork,
  type SynapseLink,
  type SynapseManifest,
  SIMILARITY_THRESHOLD,
  MAX_LINKS_PER_OBSERVATION,
  MAX_CROSS_ISSUE_CONTEXT_TOKENS,
  SYNAPSE_MANIFEST_FILE,
  SYNAPSE_MANIFEST_CACHE_TTL_MS,
} from './synapseTypes';
import { type ObservationIndex, type ManifestFile } from './types';

// ---------------------------------------------------------------------------
// Internal: observation metadata for similarity comparison
// ---------------------------------------------------------------------------

interface ObservationMeta {
  readonly id: string;
  readonly issueNumber: number;
  readonly category: string;
  readonly keywords: Set<string>;
  readonly labels: Set<string>;
  readonly content: string;
}

// ---------------------------------------------------------------------------
// SynapseNetwork
// ---------------------------------------------------------------------------

/**
 * Cross-issue observation linking using Jaccard similarity.
 *
 * Links are stored in `synapse-manifest.json` and cached in memory.
 * The manifest is pruned on each write to keep only valid links.
 */
export class SynapseNetwork implements ISynapseNetwork {
  private readonly memoryDir: string;
  private manifestCache: SynapseManifest | undefined;
  private manifestCacheTime = 0;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
  }

  // -----------------------------------------------------------------------
  // ISynapseNetwork
  // -----------------------------------------------------------------------

  async processNewObservation(
    observationId: string,
    issueNumber: number,
    content: string,
    labels: string[],
    category: string,
  ): Promise<SynapseLink[]> {
    const newMeta: ObservationMeta = {
      id: observationId,
      issueNumber,
      category,
      keywords: this.extractKeywords(content),
      labels: new Set(labels.map((l) => l.toLowerCase())),
      content,
    };

    // Load recent cross-issue observations
    const candidates = await this.loadCandidates(issueNumber);
    const newLinks: SynapseLink[] = [];

    for (const candidate of candidates) {
      const similarity = this.computeSimilarity(newMeta, candidate);
      if (similarity >= SIMILARITY_THRESHOLD) {
        const link: SynapseLink = {
          id: `syn-${observationId}-${candidate.id}`,
          sourceObservation: observationId,
          targetObservation: candidate.id,
          sourceIssue: issueNumber,
          targetIssue: candidate.issueNumber,
          similarity,
          linkType: 'auto',
          createdAt: new Date().toISOString(),
        };
        newLinks.push(link);
      }
    }

    // Sort by similarity descending and cap per-observation limit
    newLinks.sort((a, b) => b.similarity - a.similarity);
    const linksToStore = newLinks.slice(0, MAX_LINKS_PER_OBSERVATION);

    if (linksToStore.length > 0) {
      await this.appendLinks(linksToStore);
    }

    return linksToStore;
  }

  async getLinks(observationId: string): Promise<SynapseLink[]> {
    const manifest = await this.loadManifest();
    return manifest.links.filter(
      (l) => l.sourceObservation === observationId || l.targetObservation === observationId,
    );
  }

  async getCrossIssueContext(issueNumber: number, limit?: number): Promise<string> {
    const maxTokens = limit ?? MAX_CROSS_ISSUE_CONTEXT_TOKENS;
    const manifest = await this.loadManifest();

    // Find all links involving this issue
    const relevantLinks = manifest.links.filter(
      (l) => l.sourceIssue === issueNumber || l.targetIssue === issueNumber,
    );

    if (relevantLinks.length === 0) {
      return '';
    }

    // Sort by similarity descending
    const sorted = [...relevantLinks].sort((a, b) => b.similarity - a.similarity);

    // Build context string up to token limit (4 chars/token heuristic)
    const maxChars = maxTokens * 4;
    const lines: string[] = ['[Cross-Issue Context]'];
    let totalChars = lines[0]!.length;

    for (const link of sorted) {
      const otherIssue = link.sourceIssue === issueNumber ? link.targetIssue : link.sourceIssue;
      const otherObs = link.sourceIssue === issueNumber ? link.targetObservation : link.sourceObservation;
      const line = `- Issue #${otherIssue} (obs: ${otherObs}, similarity: ${link.similarity.toFixed(2)})`;

      if (totalChars + line.length > maxChars) { break; }
      lines.push(line);
      totalChars += line.length;
    }

    return lines.length > 1 ? lines.join('\n') : '';
  }

  async getAllLinks(): Promise<SynapseLink[]> {
    const manifest = await this.loadManifest();
    return [...manifest.links];
  }

  async prune(): Promise<number> {
    const manifest = await this.loadManifest();
    const observationManifestPath = path.join(this.memoryDir, 'manifest.json');
    const obsManifest = readJsonSafe<ManifestFile>(observationManifestPath);

    if (!obsManifest) {
      return 0;
    }

    const validIds = new Set(obsManifest.entries.map((e) => e.id));
    const before = manifest.links.length;

    manifest.links = manifest.links.filter(
      (l) => validIds.has(l.sourceObservation) && validIds.has(l.targetObservation),
    );

    const pruned = before - manifest.links.length;
    if (pruned > 0) {
      manifest.updatedAt = new Date().toISOString();
      await this.saveManifest(manifest);
    }

    return pruned;
  }

  // -----------------------------------------------------------------------
  // Similarity computation
  // -----------------------------------------------------------------------

  /**
   * Weighted Jaccard similarity:
   *   0.4 * jaccard(labels) + 0.4 * jaccard(keywords) + 0.2 * (category match)
   */
  private computeSimilarity(a: ObservationMeta, b: ObservationMeta): number {
    const labelSim = this.jaccard(a.labels, b.labels);
    const keywordSim = this.jaccard(a.keywords, b.keywords);
    const categorySim = a.category === b.category ? 1.0 : 0.0;

    return 0.4 * labelSim + 0.4 * keywordSim + 0.2 * categorySim;
  }

  /**
   * Jaccard index: |A intersect B| / |A union B|.
   * Returns 0 if both sets are empty.
   */
  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) { return 0; }

    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) { intersection++; }
    }

    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  // -----------------------------------------------------------------------
  // Keyword extraction
  // -----------------------------------------------------------------------

  /**
   * Extracts significant keywords from observation content.
   * Strips stop-words and returns lowercase tokens of length >= 4.
   */
  private extractKeywords(content: string): Set<string> {
    const STOP_WORDS = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
      'was', 'were', 'are', 'has', 'had', 'not', 'but', 'all', 'can',
      'will', 'when', 'what', 'which', 'their', 'them', 'then', 'than',
      'should', 'could', 'would', 'about', 'into', 'more', 'some', 'such',
      'only', 'other', 'also', 'just', 'because', 'after', 'before',
    ]);

    const tokens = content
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

    return new Set(tokens);
  }

  // -----------------------------------------------------------------------
  // Manifest I/O (cached)
  // -----------------------------------------------------------------------

  private async loadManifest(): Promise<SynapseManifest> {
    const now = Date.now();
    if (this.manifestCache && (now - this.manifestCacheTime) < SYNAPSE_MANIFEST_CACHE_TTL_MS) {
      return this.manifestCache;
    }

    const manifestPath = path.join(this.memoryDir, SYNAPSE_MANIFEST_FILE);
    const loaded = readJsonSafe<SynapseManifest>(manifestPath);

    if (loaded && loaded.version === 1) {
      this.manifestCache = loaded;
      this.manifestCacheTime = now;
      return loaded;
    }

    const fresh: SynapseManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      links: [],
    };
    this.manifestCache = fresh;
    this.manifestCacheTime = now;
    return fresh;
  }

  private async saveManifest(manifest: SynapseManifest): Promise<void> {
    const manifestPath = path.join(this.memoryDir, SYNAPSE_MANIFEST_FILE);
    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await writeJsonLocked(manifestPath, manifest);
    this.manifestCache = manifest;
    this.manifestCacheTime = Date.now();
  }

  private async appendLinks(links: SynapseLink[]): Promise<void> {
    const manifest = await this.loadManifest();
    manifest.links.push(...links);
    manifest.updatedAt = new Date().toISOString();
    await this.saveManifest(manifest);
  }

  // -----------------------------------------------------------------------
  // Candidate loading
  // -----------------------------------------------------------------------

  /**
   * Loads observation metadata from other issues for cross-comparison.
   * Excludes observations from the same issue (self-linking is useless).
   */
  private async loadCandidates(excludeIssue: number): Promise<ObservationMeta[]> {
    const observationManifestPath = path.join(this.memoryDir, 'manifest.json');
    const obsManifest = readJsonSafe<ManifestFile>(observationManifestPath);

    if (!obsManifest) { return []; }

    // Take last 500 entries from other issues for performance
    const candidates: ObservationMeta[] = [];
    const entries = obsManifest.entries
      .filter((e: ObservationIndex) => e.issueNumber !== excludeIssue)
      .slice(-500);

    for (const entry of entries) {
      candidates.push({
        id: entry.id,
        issueNumber: entry.issueNumber,
        category: entry.category,
        keywords: this.extractKeywords(entry.summary),
        labels: new Set<string>(), // Labels are extracted from tags if available
        content: entry.summary,
      });
    }

    return candidates;
  }
}
