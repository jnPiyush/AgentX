// ---------------------------------------------------------------------------
// AgentX -- Lesson Store: JSONL-based Persistent Storage
// ---------------------------------------------------------------------------
//
// JSONL-based persistent storage for lessons that survives across VS Code
// sessions. Stores lessons with confidence tracking, outcome history, and
// TTL-based archival.
//
// Storage locations:
//   ~/.agentx/lessons/lessons.jsonl             (global, cross-project)
//   .agentx/lessons/lessons.jsonl               (project, gitignored)
//   .agentx/lessons/lessons-committed.jsonl     (project, git-tracked HIGH only)
//
// Each lesson is a single JSON line, enabling append-only writes and
// streaming reads without loading the entire file into memory.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import {
  Lesson,
  LessonCategory,
  LessonConfidence,
  LessonFilter,
  LessonOutcome,
  LessonStats,
  LearningConfig,
  LessonStoragePaths,
  DEFAULT_LEARNING_CONFIG,
  CONFIDENCE_ORDER,
} from './learningTypes';

// ---------------------------------------------------------------------------
// Lesson Store Interface
// ---------------------------------------------------------------------------

/**
 * Interface for lesson persistence and retrieval.
 * Supports both global (cross-project) and project-specific lesson storage.
 */
export interface ILessonStore {
  // --- Query ---
  query(filter: LessonFilter): Promise<readonly Lesson[]>;
  getById(id: string): Promise<Lesson | null>;
  getStats(): Promise<LessonStats>;

  // --- Write ---
  add(lesson: Lesson): Promise<void>;
  update(id: string, patch: Partial<Lesson>): Promise<boolean>;
  recordOutcome(id: string, outcome: LessonOutcome): Promise<boolean>;

  // --- Lifecycle ---
  promote(id: string, target: string): Promise<boolean>;
  archive(id: string): Promise<boolean>;
  commitHighConfidence(): Promise<readonly string[]>;

  // --- Human commands ---
  addManual(
    pattern: string,
    learning: string,
    recommendation: string,
    category: LessonCategory,
    tags?: readonly string[],
    files?: readonly string[]
  ): Promise<Lesson>;
  reject(id: string, reason: string): Promise<boolean>;
  
  // --- Maintenance ---
  pruneExpired(): Promise<number>;
  consolidateSimilar(): Promise<number>;
}

// ---------------------------------------------------------------------------
// JSONL-based Implementation
// ---------------------------------------------------------------------------

/**
 * JSONL-based lesson store supporting global and project-specific lessons.
 * 
 * Resolution order for queries:
 * 1. Project-specific lessons (.agentx/lessons/)
 * 2. Global lessons (~/.agentx/lessons/)
 * 
 * If same lesson ID exists in both, project version takes precedence.
 */
export class LessonStore implements ILessonStore {
  private readonly config: LearningConfig;
  private readonly paths: LessonStoragePaths;

  constructor(
    private readonly projectRoot: string,
    config?: Partial<LearningConfig>
  ) {
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
    this.paths = this.resolvePaths(projectRoot);
    // Directories are created lazily on first write to avoid creating
    // .agentx/ in workspaces that have not been initialized yet.
  }

  // ---------------------------------------------------------------------------
  // Query methods
  // ---------------------------------------------------------------------------

  async query(filter: LessonFilter = {}): Promise<readonly Lesson[]> {
    const projectLessons = await this.readLessonsFromFile(this.paths.projectLessons);
    const globalLessons = await this.readLessonsFromFile(this.paths.globalLessons);

    // Merge with project lessons taking precedence
    const lessonMap = new Map<string, Lesson>();
    
    // Add global lessons first
    globalLessons.forEach(lesson => lessonMap.set(lesson.id, lesson));
    
    // Override with project lessons (project takes precedence)
    projectLessons.forEach(lesson => lessonMap.set(lesson.id, lesson));

    const allLessons = Array.from(lessonMap.values());
    const filtered = this.filterLessons(allLessons, filter);
    return this.sortLessons(filtered, filter.limit);
  }

  async getById(id: string): Promise<Lesson | null> {
    // Check project store first
    const projectLessons = await this.readLessonsFromFile(this.paths.projectLessons);
    const projectLesson = projectLessons.find(l => l.id === id);
    if (projectLesson) {
      return projectLesson;
    }

    // Fall back to global store
    const globalLessons = await this.readLessonsFromFile(this.paths.globalLessons);
    return globalLessons.find(l => l.id === id) || null;
  }

  async getStats(): Promise<LessonStats> {
    const lessons = await this.query({ includePromoted: true });
    const archived = await this.getArchivedCount();

    const confidenceCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    const categoryCounts = {} as Record<LessonCategory, number>;
    let totalConfirmations = 0;
    let oldestDate = new Date().toISOString();
    let newestDate = new Date(0).toISOString();

    for (const lesson of lessons) {
      confidenceCounts[lesson.confidence]++;
      categoryCounts[lesson.category] = (categoryCounts[lesson.category] || 0) + 1;
      totalConfirmations += lesson.confirmations;

      if (lesson.createdAt < oldestDate) oldestDate = lesson.createdAt;
      if (lesson.createdAt > newestDate) newestDate = lesson.createdAt;
    }

    return {
      totalLessons: lessons.length,
      activeLessons: lessons.filter(l => !l.promotedTo).length,
      promotedLessons: lessons.filter(l => !!l.promotedTo).length,
      archivedLessons: archived,
      confidenceCounts,
      categoryCounts,
      averageConfirmations: lessons.length > 0 ? totalConfirmations / lessons.length : 0,
      oldestLesson: oldestDate,
      newestLesson: newestDate,
    };
  }

  // ---------------------------------------------------------------------------
  // Write methods
  // ---------------------------------------------------------------------------

  async add(lesson: Lesson): Promise<void> {
    // Check for existing lesson with same ID
    const existing = await this.getById(lesson.id);
    if (existing) {
      // Update existing lesson: increment occurrences, update lastSeen
      await this.update(lesson.id, {
        occurrences: existing.occurrences + 1,
        lastSeen: lesson.lastSeen,
      });
      return;
    }

    // Add new lesson to appropriate store
    const targetFile = this.shouldStoreGlobally(lesson) 
      ? this.paths.globalLessons 
      : this.paths.projectLessons;

    await this.appendLessonToFile(targetFile, lesson);
  }

  async update(id: string, patch: Partial<Lesson>): Promise<boolean> {
    // Find lesson in project store first, then global
    const projectLessons = await this.readLessonsFromFile(this.paths.projectLessons);
    const projectIndex = projectLessons.findIndex(l => l.id === id);
    
    if (projectIndex >= 0) {
      const updated = { ...projectLessons[projectIndex], ...patch };
      projectLessons[projectIndex] = updated;
      await this.writeLessonsToFile(this.paths.projectLessons, projectLessons);
      return true;
    }

    // Try global store
    const globalLessons = await this.readLessonsFromFile(this.paths.globalLessons);
    const globalIndex = globalLessons.findIndex(l => l.id === id);
    
    if (globalIndex >= 0) {
      const updated = { ...globalLessons[globalIndex], ...patch };
      globalLessons[globalIndex] = updated;
      await this.writeLessonsToFile(this.paths.globalLessons, globalLessons);
      return true;
    }

    return false;
  }

  async recordOutcome(id: string, outcome: LessonOutcome): Promise<boolean> {
    const lesson = await this.getById(id);
    if (!lesson) return false;

    // Add outcome and update confidence
    const newOutcomes = [...lesson.outcomes, outcome];
    let newConfidence = lesson.confidence;
    let newConfirmations = lesson.confirmations;

    // Update confidence based on outcome type
    if (outcome.type === 'positive' || outcome.type === 'human-confirmed') {
      newConfirmations++;
      if (newConfidence === 'LOW') newConfidence = 'MEDIUM';
      else if (newConfidence === 'MEDIUM') newConfidence = 'HIGH';
    } else if (outcome.type === 'negative' || outcome.type === 'human-rejected') {
      if (newConfidence === 'HIGH') newConfidence = 'MEDIUM';
      else if (newConfidence === 'MEDIUM') newConfidence = 'LOW';
    }

    return this.update(id, {
      outcomes: newOutcomes,
      confidence: newConfidence,
      confirmations: newConfirmations,
    });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle methods
  // ---------------------------------------------------------------------------

  async promote(id: string, target: string): Promise<boolean> {
    return this.update(id, {
      promotedTo: target,
      promotedAt: new Date().toISOString(),
    });
  }

  async archive(id: string): Promise<boolean> {
    const lesson = await this.getById(id);
    if (!lesson) return false;

    // Determine source file and archive file
    const isInProject = await this.isLessonInProjectStore(id);
    const sourceFile = isInProject ? this.paths.projectLessons : this.paths.globalLessons;
    const archiveFile = isInProject ? this.paths.projectArchive : this.paths.globalArchive;

    // Read, filter, and rewrite source file
    const lessons = await this.readLessonsFromFile(sourceFile);
    const filtered = lessons.filter(l => l.id !== id);
    await this.writeLessonsToFile(sourceFile, filtered);

    // Append to archive
    await this.appendLessonToFile(archiveFile, lesson);
    return true;
  }

  async commitHighConfidence(): Promise<readonly string[]> {
    const projectLessons = await this.readLessonsFromFile(this.paths.projectLessons);
    const highConfidenceLessons = projectLessons.filter(l => l.confidence === 'HIGH');

    if (highConfidenceLessons.length === 0) {
      return [];
    }

    await this.writeLessonsToFile(this.paths.projectCommitted, highConfidenceLessons);
    return highConfidenceLessons.map(l => l.id);
  }

  // ---------------------------------------------------------------------------
  // Human command methods
  // ---------------------------------------------------------------------------

  async addManual(
    pattern: string,
    learning: string,
    recommendation: string,
    category: LessonCategory,
    tags: readonly string[] = [],
    files: readonly string[] = []
  ): Promise<Lesson> {
    const lesson: Lesson = {
      id: this.generateLessonId(category, pattern),
      category,
      pattern,
      learning,
      recommendation,
      files,
      tags,
      source: 'manual',
      confidence: 'MEDIUM',  // Manual lessons start at MEDIUM
      occurrences: 1,
      confirmations: 0,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),      updatedAt: new Date().toISOString(),      outcomes: [],
    };

    await this.add(lesson);
    return lesson;
  }

  async reject(id: string, reason: string): Promise<boolean> {
    return this.recordOutcome(id, {
      date: new Date().toISOString(),
      type: 'human-rejected',
      context: reason,
    });
  }

  // ---------------------------------------------------------------------------
  // Maintenance methods
  // ---------------------------------------------------------------------------

  async pruneExpired(): Promise<number> {
    const now = new Date();
    const lessons = await this.query({ includePromoted: true });
    let archivedCount = 0;

    for (const lesson of lessons) {
      const lastSeenDate = new Date(lesson.lastSeen);
      const daysSinceLastSeen = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24);

      // Archive LOW confidence lessons after archiveDays
      if (lesson.confidence === 'LOW' && daysSinceLastSeen > this.config.archiveDays) {
        await this.archive(lesson.id);
        archivedCount++;
      }
      // Decay non-HIGH confidence lessons after decayDays
      else if (lesson.confidence !== 'HIGH' && daysSinceLastSeen > this.config.decayDays) {
        const newConfidence = lesson.confidence === 'MEDIUM' ? 'LOW' : lesson.confidence;
        await this.update(lesson.id, { confidence: newConfidence });
      }
    }

    return archivedCount;
  }

  async consolidateSimilar(): Promise<number> {
    // TODO: Implement lesson consolidation based on text similarity
    // This would merge lessons with similar patterns/learnings/recommendations
    // For now, return 0 (no consolidations)
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolvePaths(projectRoot: string): LessonStoragePaths {
    const globalLessonsDir = path.join(os.homedir(), '.agentx', 'lessons');
    const projectLessonsDir = path.join(projectRoot, '.agentx', 'lessons');

    return {
      globalLessons: path.join(globalLessonsDir, 'lessons.jsonl'),
      globalArchive: path.join(globalLessonsDir, 'archive', 'lessons-archived.jsonl'),
      projectLessons: path.join(projectLessonsDir, 'lessons.jsonl'),
      projectCommitted: path.join(projectLessonsDir, 'lessons-committed.jsonl'),
      projectArchive: path.join(projectLessonsDir, 'archive', 'lessons-archived.jsonl'),
    };
  }

  private ensureDirectories(): void {
    const dirs = [
      path.dirname(this.paths.globalLessons),
      path.dirname(this.paths.globalArchive),
      path.dirname(this.paths.projectLessons),
      path.dirname(this.paths.projectCommitted),
      path.dirname(this.paths.projectArchive),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async readLessonsFromFile(filePath: string): Promise<Lesson[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as Lesson);
    } catch (error) {
      console.warn(`Failed to read lessons from ${filePath}:`, error);
      return [];
    }
  }

  private async writeLessonsToFile(filePath: string, lessons: readonly Lesson[]): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = lessons.map(lesson => JSON.stringify(lesson)).join('\n');
    fs.writeFileSync(filePath, content + (content ? '\n' : ''), 'utf8');
  }

  private async appendLessonToFile(filePath: string, lesson: Lesson): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(lesson) + '\n';
    fs.appendFileSync(filePath, line, 'utf8');
  }

  private filterLessons(lessons: readonly Lesson[], filter: LessonFilter): Lesson[] {
    return lessons.filter(lesson => {
      // Category filter
      if (filter.categories && !filter.categories.includes(lesson.category)) {
        return false;
      }

      // File filter (match if any file overlaps)
      if (filter.files && filter.files.length > 0) {
        const hasFileMatch = filter.files.some(filterFile =>
          lesson.files.some(lessonFile => 
            lessonFile.includes(filterFile) || filterFile.includes(lessonFile)
          )
        );
        if (!hasFileMatch) return false;
      }

      // Tag filter (match if any tag overlaps)
      if (filter.tags && filter.tags.length > 0) {
        const hasTagMatch = filter.tags.some(filterTag =>
          lesson.tags.some(lessonTag => 
            lessonTag.toLowerCase().includes(filterTag.toLowerCase()) ||
            filterTag.toLowerCase().includes(lessonTag.toLowerCase())
          )
        );
        if (!hasTagMatch) return false;
      }

      // Confidence filter
      if (filter.minConfidence && CONFIDENCE_ORDER[lesson.confidence] < CONFIDENCE_ORDER[filter.minConfidence]) {
        return false;
      }

      // Source filter
      if (filter.source && lesson.source !== filter.source) {
        return false;
      }

      // Promoted filter
      if (!filter.includePromoted && lesson.promotedTo) {
        return false;
      }

      return true;
    });
  }

  private sortLessons(lessons: Lesson[], limit?: number): Lesson[] {
    // Sort by: confidence DESC, confirmations DESC, lastSeen DESC
    const sorted = lessons.sort((a, b) => {
      // Primary: confidence
      const confDiff = CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
      if (confDiff !== 0) return confDiff;

      // Secondary: confirmations
      const confirmDiff = b.confirmations - a.confirmations;
      if (confirmDiff !== 0) return confirmDiff;

      // Tertiary: lastSeen (most recent first)
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    return limit ? sorted.slice(0, limit) : sorted;
  }

  private shouldStoreGlobally(lesson: Lesson): boolean {
    // Store globally if it's a general pattern applicable across projects
    return lesson.category === 'mock-limitation' ||
           lesson.category === 'tool-misuse' ||
           lesson.category === 'security-pattern';
  }

  private async isLessonInProjectStore(id: string): Promise<boolean> {
    const projectLessons = await this.readLessonsFromFile(this.paths.projectLessons);
    return projectLessons.some(l => l.id === id);
  }

  private async getArchivedCount(): Promise<number> {
    const globalArchived = await this.readLessonsFromFile(this.paths.globalArchive);
    const projectArchived = await this.readLessonsFromFile(this.paths.projectArchive);
    return globalArchived.length + projectArchived.length;
  }

  private generateLessonId(category: LessonCategory, pattern: string): string {
    const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
    const input = `${category}:${normalizedPattern}`;
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
  }
}