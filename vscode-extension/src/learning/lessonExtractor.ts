// ---------------------------------------------------------------------------
// AgentX -- Learning Pipeline: Lesson Extractor (Simplified)
// ---------------------------------------------------------------------------
//
// Extracts lessons from compaction summaries using pattern matching.
// This implementation focuses on the most common patterns agents encounter.
//
// Integration point: Called by contextCompactor.ts during session compaction.
// ---------------------------------------------------------------------------

import {
  Lesson,
  LessonCategory,
  LessonConfidence,
} from './learningTypes';
import { LessonStore } from './lessonStore';
import * as crypto from 'crypto';

/**
 * Simplified lesson extractor focusing on the most impactful patterns.
 * Extracts lessons from session compaction summaries.
 */
export class LessonExtractor {
  constructor(private readonly lessonStore: LessonStore) {}

  /**
   * Extract lessons from a compaction summary.
   * Called by contextCompactor.ts when sessions are compacted.
   */
  async extractLessons(
    summary: string,
    agent: string,
    issueNumber: number,
    sessionId: string,
  ): Promise<void> {
    const lessons: Lesson[] = [];

    // Extract different types of lessons
    lessons.push(...this.extractErrorPatterns(summary, agent, issueNumber, sessionId));
    lessons.push(...this.extractToolMisuse(summary, agent, issueNumber, sessionId));
    lessons.push(...this.extractSecurityPatterns(summary, agent, issueNumber, sessionId));
    lessons.push(...this.extractProductivityBlockers(summary, agent, issueNumber, sessionId));

    // Store extracted lessons
    for (const lesson of lessons) {
      await this.lessonStore.add(lesson);
    }
  }

  private extractErrorPatterns(summary: string, agent: string, issueNumber: number, sessionId: string): Lesson[] {
    const lessons: Lesson[] = [];

    // TypeScript/compilation errors
    if (/typescript.*error|compilation.*fail|type.*error|cannot find name/i.test(summary)) {
      lessons.push(this.createLesson({
        category: LessonCategory.SOURCE_DEFECT_PATTERN,
        pattern: 'TypeScript compilation errors during implementation',
        learning: 'Missing type definitions or incorrect imports caused compilation failures',
        recommendation: 'Always run tsc --noEmit before committing. Check import paths and type definitions.',
        tags: ['typescript', 'compilation', 'types'],
        files: this.extractFilePatterns(summary, ['.ts', '.tsx']),
        agent,
        issueNumber,
        sessionId,
        summary,
      }));
    }

    // Import/dependency errors  
    if (/cannot.*resolve|module.*not.*found|import.*error|dependency.*missing/i.test(summary)) {
      lessons.push(this.createLesson({
        category: LessonCategory.SOURCE_DEFECT_PATTERN,
        pattern: 'Missing dependencies or incorrect import paths',
        learning: 'Import errors often indicate missing packages or incorrect file paths',
        recommendation: 'Verify package.json dependencies and check import paths. Use relative paths correctly.',
        tags: ['imports', 'dependencies', 'modules'],
        files: this.extractFilePatterns(summary, ['.ts', '.js', '.json']),
        agent,
        issueNumber,
        sessionId,
        summary,
      }));
    }

    return lessons;
  }

  private extractToolMisuse(summary: string, agent: string, issueNumber: number, sessionId: string): Lesson[] {
    const lessons: Lesson[] = [];

    // Test framework issues
    if (/test.*fail|mocha.*error|jest.*error|vitest.*error/i.test(summary)) {
      lessons.push(this.createLesson({
        category: LessonCategory.TOOL_MISUSE,
        pattern: 'Test framework configuration or setup issues',
        learning: 'Test failures often stem from incorrect test setup or missing mocks',
        recommendation: 'Verify test configuration files and ensure proper mock setup for external dependencies.',
        tags: ['testing', 'mocha', 'jest', 'vitest'],
        files: this.extractFilePatterns(summary, ['test', 'spec']),
        agent,
        issueNumber,
        sessionId,
        summary,
      }));
    }

    return lessons;
  }

  private extractSecurityPatterns(summary: string, agent: string, issueNumber: number, sessionId: string): Lesson[] {
    const lessons: Lesson[] = [];

    if (/hardcoded.*secret|api.*key.*exposed|password.*in.*code/i.test(summary)) {
      lessons.push(this.createLesson({
        category: LessonCategory.SECURITY_PATTERN,
        pattern: 'Hardcoded secrets or sensitive data in code',
        learning: 'Credentials and secrets found in source code pose security risks',
        recommendation: 'Use environment variables or Key Vault for all secrets. Never commit credentials.',
        tags: ['security', 'secrets', 'credentials'],
        files: this.extractFilePatterns(summary, ['.ts', '.js', '.env']),
        agent,
        issueNumber,
        sessionId,
        summary,
      }));
    }

    return lessons;
  }

  private extractProductivityBlockers(summary: string, agent: string, issueNumber: number, sessionId: string): Lesson[] {
    const lessons: Lesson[] = [];

    if (/took.*long|slow.*performance|timeout.*error|hung.*for.*minutes/i.test(summary)) {
      lessons.push(this.createLesson({
        category: LessonCategory.PRODUCTIVITY_BLOCKER,
        pattern: 'Long debugging sessions or performance issues',
        learning: 'Extended debugging sessions indicate underlying process or tooling issues',
        recommendation: 'Improve debugging setup, add better logging, or optimize slow operations.',
        tags: ['performance', 'debugging', 'productivity'],
        files: this.extractFilePatterns(summary, ['.ts', '.js']),
        agent,
        issueNumber,
        sessionId,
        summary,
      }));
    }

    return lessons;
  }

  private createLesson(params: {
    category: LessonCategory;
    pattern: string;
    learning: string;
    recommendation: string;
    tags: string[];
    files: string[];
    agent: string;
    issueNumber: number;
    sessionId: string;
    summary: string;
  }): Lesson {
    const id = this.generateLessonId(params.category, params.pattern);
    
    return {
      id,
      category: params.category,
      pattern: params.pattern,
      learning: params.learning,
      recommendation: params.recommendation,
      files: params.files,
      tags: params.tags,
      source: 'auto',
      confidence: LessonConfidence.LOW, // Start with LOW confidence
      occurrences: 1,
      confirmations: 0,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
      outcomes: [],
      extractedFrom: {
        agent: params.agent,
        issueNumber: params.issueNumber,
        sessionId: params.sessionId,
        summary: params.summary,
      },
    };
  }

  private extractFilePatterns(summary: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    // Extract file paths mentioned in the summary
    const fileRegex = /([a-zA-Z0-9_\-\/\\\.]+\.(ts|tsx|js|jsx|json|md))/g;
    let match;
    
    while ((match = fileRegex.exec(summary)) !== null) {
      const filePath = match[1];
      if (extensions.some(ext => filePath.includes(ext))) {
        files.push(filePath);
      }
    }

    return Array.from(new Set(files)); // Remove duplicates
  }

  private generateLessonId(category: LessonCategory, pattern: string): string {
    const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
    const input = `${category}:${normalizedPattern}`;
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
  }
}