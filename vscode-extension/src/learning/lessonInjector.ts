// ---------------------------------------------------------------------------
// AgentX -- Learning Pipeline: Lesson Injector (Simplified)
// ---------------------------------------------------------------------------
//
// Injects relevant lessons into agent context without information overload.
// Uses relevance scoring to prioritize most applicable lessons.
//
// Integration point: Called by agenticChatHandler.ts before agent execution.
// ---------------------------------------------------------------------------

import { 
  Lesson, 
  LessonQuery, 
  LearningContext, 
  LessonCategory,
  LessonConfidence 
} from './learningTypes';
import { LessonStore } from './lessonStore';

/**
 * Configuration for lesson injection behavior.
 */
interface InjectionConfig {
  maxLessons: number;        // Maximum lessons to inject
  minRelevanceScore: number; // Minimum relevance threshold
  includeConfidenceLevels: readonly LessonConfidence[]; // Which confidence levels to include
}

/**
 * Simplified lesson injector focusing on relevance and readability.
 * Provides context-aware lessons without overwhelming agents.
 */
export class LessonInjector {
  private readonly defaultConfig: InjectionConfig = {
    maxLessons: 3,
    minRelevanceScore: 0.6,
    includeConfidenceLevels: [LessonConfidence.HIGH, LessonConfidence.MEDIUM] as const,
  };

  constructor(private readonly lessonStore: LessonStore) {}

  /**
   * Get formatted lessons for injection into agent context.
   * Returns lessons most relevant to the current work context.
   */
  async getContextualLessons(context: LearningContext, config?: Partial<InjectionConfig>): Promise<string> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Get relevant lessons
    const lessons = await this.findRelevantLessons(context, finalConfig);
    
    // Format for agent consumption
    return this.formatLessonsForContext(lessons);
  }

  /**
   * Find lessons most relevant to the current context.
   */
  private async findRelevantLessons(context: LearningContext, config: InjectionConfig): Promise<Lesson[]> {
    const allSources: Lesson[][] = await Promise.all([
      this.getLessonsByAgent(context.agent),
      this.getLessonsByTechnology(context.files),
      this.getLessonsByCategory(context),
    ]);

    // Flatten and deduplicate
    const allLessons = [...new Set(allSources.flat())];
    
    // Score and filter lessons
    const scoredLessons = allLessons
      .map(lesson => ({
        lesson,
        score: this.calculateRelevanceScore(lesson, context),
      }))
      .filter(item => 
        item.score >= config.minRelevanceScore &&
        config.includeConfidenceLevels.includes(item.lesson.confidence)
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, config.maxLessons);

    return scoredLessons.map(item => item.lesson);
  }

  /**
   * Calculate how relevant a lesson is to the current context.
   * Returns a score from 0 to 1.
   */
  private calculateRelevanceScore(lesson: Lesson, context: LearningContext): number {
    let score = 0;

    // Agent relevance (40% weight)
    if (lesson.extractedFrom?.agent === context.agent) {
      score += 0.4;
    } else if (lesson.tags.includes(context.agent.toLowerCase())) {
      score += 0.2;
    }

    // File/technology relevance (30% weight)
    const fileMatches = context.files.filter(file => 
      lesson.files.some(lessonFile => 
        file.includes(lessonFile) || lessonFile.includes(file)
      )
    ).length;
    
    if (fileMatches > 0) {
      score += Math.min(0.3, fileMatches * 0.1);
    }

    // Tag relevance (20% weight)
    const contextTags = this.extractTagsFromContext(context);
    const tagMatches = lesson.tags.filter(tag => 
      contextTags.includes(tag)
    ).length;
    
    if (tagMatches > 0) {
      score += Math.min(0.2, tagMatches * 0.05);
    }

    // Confidence boost (10% weight)
    switch (lesson.confidence) {
      case LessonConfidence.HIGH:
        score += 0.1;
        break;
      case LessonConfidence.MEDIUM:
        score += 0.06;
        break;
      case LessonConfidence.LOW:
        score += 0.02;
        break;
    }

    return Math.min(1, score);
  }

  /**
   * Extract relevant tags from learning context.
   */
  private extractTagsFromContext(context: LearningContext): string[] {
    const tags: string[] = [];
    
    // Add agent name
    tags.push(context.agent.toLowerCase());
    
    // Extract file extension tags
    for (const file of context.files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        tags.push('typescript');
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        tags.push('javascript');
      } else if (file.endsWith('.py')) {
        tags.push('python');
      } else if (file.includes('test') || file.includes('spec')) {
        tags.push('testing');
      }
    }
    
    // Add issue-type tags if available
    if (context.issueLabels) {
      for (const label of context.issueLabels) {
        if (label.startsWith('type:')) {
          tags.push(label.replace('type:', ''));
        }
      }
    }

    return Array.from(new Set(tags)); // Remove duplicates
  }

  /**
   * Format lessons for agent context injection.
   */
  private formatLessonsForContext(lessons: Lesson[]): string {
    if (lessons.length === 0) {
      return '';
    }

    const sections = [];
    
    sections.push('## 🔍 Relevant Lessons');
    sections.push('');
    sections.push('Based on previous sessions, here are some relevant lessons for this context:');
    sections.push('');

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      sections.push(`### ${i + 1}. ${lesson.pattern}`);
      sections.push('');
      sections.push(`**Learning:** ${lesson.learning}`);
      sections.push('');
      sections.push(`**Recommendation:** ${lesson.recommendation}`);
      sections.push('');
      
      if (lesson.files.length > 0) {
        sections.push(`**Relevant files:** ${lesson.files.join(', ')}`);
        sections.push('');
      }
      
      sections.push(`*Confidence: ${lesson.confidence} | Seen: ${lesson.occurrences} times*`);
      sections.push('');
    }

    sections.push('---');
    sections.push('');

    return sections.join('\n');
  }

  /**
   * Get lessons by agent who extracted them.
   */
  private async getLessonsByAgent(agent: string): Promise<Lesson[]> {
    const query: LessonQuery = {
      tags: [agent.toLowerCase()],
      limit: 10,
      sortBy: 'confidence',
    };

    return [...await this.lessonStore.query(query)];
  }

  /**
   * Get lessons relevant to specific technologies (based on file patterns).
   */
  private async getLessonsByTechnology(filePatterns: string[]): Promise<Lesson[]> {
    const techTags: string[] = [];
    
    for (const pattern of filePatterns) {
      if (pattern.includes('.ts') || pattern.includes('.tsx')) {
        techTags.push('typescript');
      }
      if (pattern.includes('.js') || pattern.includes('.jsx')) {
        techTags.push('javascript');
      }
      if (pattern.includes('.py')) {
        techTags.push('python');
      }
      if (pattern.includes('test') || pattern.includes('spec')) {
        techTags.push('testing');
      }
      if (pattern.includes('api') || pattern.includes('endpoint')) {
        techTags.push('api');
      }
      if (pattern.includes('component') || pattern.includes('ui')) {
        techTags.push('ui');
      }
      if (pattern.includes('auth') || pattern.includes('login')) {
        techTags.push('authentication');
      }
      if (pattern.includes('db') || pattern.includes('database')) {
        techTags.push('database');
      }
    }

    if (techTags.length === 0) return [];

    const query: LessonQuery = {
      tags: Array.from(new Set(techTags)),
      limit: 15,
      sortBy: 'confidence',
    };

    return [...await this.lessonStore.query(query)];
  }

  /**
   * Get lessons by category based on context.
   */
  private async getLessonsByCategory(context: LearningContext): Promise<Lesson[]> {
    // Determine relevant categories based on context
    const relevantCategories: LessonCategory[] = [];
    
    if (context.files.some(f => f.includes('test') || f.includes('spec'))) {
      relevantCategories.push(LessonCategory.TOOL_MISUSE);
    }
    
    if (context.issueLabels?.includes('type:bug')) {
      relevantCategories.push(LessonCategory.SOURCE_DEFECT_PATTERN);
    }
    
    if (context.issueLabels?.includes('security') || 
        context.files.some(f => f.includes('auth') || f.includes('security'))) {
      relevantCategories.push(LessonCategory.SECURITY_PATTERN);
    }

    if (relevantCategories.length === 0) {
      // Default to defect patterns if no specific context
      relevantCategories.push(LessonCategory.SOURCE_DEFECT_PATTERN);
    }

    const query: LessonQuery = {
      categories: relevantCategories,
      limit: 10,
      sortBy: 'confirmations',
    };

    return [...await this.lessonStore.query(query)];
  }
}