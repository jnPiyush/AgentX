// ---------------------------------------------------------------------------
// AgentX -- Learning Pipeline: Feedback Collector (Phase C)
// ---------------------------------------------------------------------------
//
// Collects feedback on lesson effectiveness through:
// 1. Automated outcome detection from session patterns 
// 2. Optional user feedback prompts at session end
// 3. Confidence adjustment based on feedback
// 4. Lesson promotion when thresholds are met
//
// Integration points:
// - Called by session end hooks to collect automated feedback
// - Provides VS Code UI prompts for human feedback 
// - Updates lesson confidence through LessonStore
// ---------------------------------------------------------------------------

import {
  Lesson,
  LessonOutcome,
  LessonConfidence,
  LearningConfig,
  DEFAULT_LEARNING_CONFIG,
  SessionFeedbackContext,
} from './learningTypes';
import { LessonStore } from './lessonStore';

export interface UserFeedbackPrompt {
  lessonId: string;
  lessonSummary: string;
  question: string;
  options: FeedbackOption[];
}

export interface FeedbackOption {
  label: string;
  value: 'positive' | 'negative' | 'neutral' | 'human-confirmed' | 'human-rejected';
  description: string;
}

/**
 * Collects and processes feedback on lesson effectiveness.
 * Combines automated pattern detection with optional human feedback.
 */
export class FeedbackCollector {
  private readonly config: LearningConfig;

  constructor(
    private readonly lessonStore: LessonStore,
    config?: Partial<LearningConfig>
  ) {
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
  }

  /**
   * Collect automated feedback based on session outcomes.
   * Called automatically at session end by the agentic loop.
   */
  async collectAutomatedFeedback(context: SessionFeedbackContext): Promise<void> {
    if (!this.config.enabled || context.appliedLessons.length === 0) {
      return;
    }

    for (const lessonId of context.appliedLessons) {
      const outcome = this.analyzeSessionOutcome(context, lessonId);
      if (outcome) {
        await this.lessonStore.recordOutcome(lessonId, outcome);
        
        // Check if lesson should be promoted
        await this.checkForPromotion(lessonId);
      }
    }
  }

  /**
   * Generate user feedback prompts for high-impact lessons.
   * Called when feedbackPromptEnabled is true and lessons were applied.
   */
  async generateFeedbackPrompts(context: SessionFeedbackContext): Promise<UserFeedbackPrompt[]> {
    if (!this.config.feedbackPromptEnabled || context.appliedLessons.length === 0) {
      return [];
    }

    const prompts: UserFeedbackPrompt[] = [];

    for (const lessonId of context.appliedLessons) {
      const lesson = await this.lessonStore.getById(lessonId);
      if (!lesson) continue;

      // Only prompt for lessons that could benefit from feedback
      if (this.shouldRequestFeedback(lesson, context)) {
        prompts.push(this.createFeedbackPrompt(lesson, context));
      }
    }

    return prompts.slice(0, 3); // Max 3 prompts per session
  }

  /**
   * Process user feedback responses.
   */
  async processUserFeedback(
    lessonId: string, 
    feedbackValue: 'positive' | 'negative' | 'neutral' | 'human-confirmed' | 'human-rejected',
    comment?: string
  ): Promise<void> {
    const outcome: LessonOutcome = {
      date: new Date().toISOString(),
      type: feedbackValue,
      context: comment || 'User feedback via prompt',
    };

    await this.lessonStore.recordOutcome(lessonId, outcome);
    
    // Check if lesson should be promoted after user feedback
    await this.checkForPromotion(lessonId);
  }

  /**
   * Analyze session outcome to determine lesson effectiveness.
   */
  private analyzeSessionOutcome(context: SessionFeedbackContext, lessonId: string): LessonOutcome | null {
    const now = new Date().toISOString();

    // Success indicators
    if (context.successfulOutcome && !context.errorOccurred) {
      return {
        date: now,
        type: 'positive',
        context: `Session completed successfully in ${Math.round(context.completionTime / 1000)}s`,
      };
    }

    // Error indicators (lesson may not have helped)
    if (context.errorOccurred) {
      // Check if the error pattern matches what the lesson was supposed to prevent
      if (this.isLessonRelevantToError(context.sessionSummary, lessonId)) {
        return {
          date: now,
          type: 'negative', 
          context: 'Similar error occurred despite lesson being present',
        };
      } else {
        // Error was unrelated to the lesson
        return {
          date: now,
          type: 'neutral',
          context: 'Session had errors unrelated to this lesson',
        };
      }
    }

    // Productivity indicators
    if (context.completionTime < 300000) { // Under 5 minutes = efficient
      return {
        date: now,
        type: 'positive',
        context: 'Task completed efficiently, lesson may have helped',
      };
    }

    // No clear signal
    return {
      date: now,
      type: 'neutral',
      context: 'Session completed with no clear success/failure indicators',
    };
  }

  /**
   * Determine if feedback should be requested for a lesson.
   */
  private shouldRequestFeedback(lesson: Lesson, context: SessionFeedbackContext): boolean {
    // Don't over-prompt for the same lesson
    if (lesson.outcomes.length >= 5) return false;
    
    // Request feedback for lessons with low confidence
    if (lesson.confidence === LessonConfidence.LOW) return true;
    
    // Request feedback for lessons close to promotion threshold
    const remainingConfirmations = this.config.promotionThreshold - lesson.confirmations;
    if (remainingConfirmations <= 1 && remainingConfirmations > 0) return true;
    
    // Request feedback if session had issues (lesson effectiveness unclear)
    if (context.errorOccurred) return true;
    
    return false;
  }

  /**
   * Create a user feedback prompt for a lesson.
   */
  private createFeedbackPrompt(lesson: Lesson, context: SessionFeedbackContext): UserFeedbackPrompt {
    const question = context.errorOccurred 
      ? `This lesson was shown to prevent issues, but errors occurred. Was it helpful?`
      : `This lesson was provided to guide your work. How relevant was it?`;

    return {
      lessonId: lesson.id,
      lessonSummary: `${lesson.pattern} → ${lesson.recommendation}`,
      question,
      options: [
        {
          label: '👍 Very Helpful',
          value: 'human-confirmed',
          description: 'This lesson directly helped me avoid mistakes or work more efficiently',
        },
        {
          label: '✅ Somewhat Helpful', 
          value: 'positive',
          description: 'This lesson provided useful context even if not directly applied',
        },
        {
          label: '😐 Not Relevant',
          value: 'neutral', 
          description: 'This lesson didn\'t apply to my current task',
        },
        {
          label: '👎 Misleading',
          value: 'human-rejected',
          description: 'This lesson was incorrect or led me in the wrong direction',
        },
      ],
    };
  }

  /**
   * Check if lesson should be promoted based on confirmation threshold.
   */
  private async checkForPromotion(lessonId: string): Promise<void> {
    const lesson = await this.lessonStore.getById(lessonId);
    if (!lesson) return;

    // Promote lessons that reach the confirmation threshold
    if (lesson.confirmations >= this.config.promotionThreshold && !lesson.promotedTo) {
      const promotionType = this.determinePromotionType(lesson);
      
      if (promotionType) {
        await this.lessonStore.promote(lessonId, promotionType);
        
        // If configured, commit high confidence lessons to git
        if (this.config.autoCommitHighConfidence && lesson.confidence === LessonConfidence.HIGH) {
          await this.lessonStore.commitHighConfidence();
        }
      }
    }
  }

  /**
   * Determine what type of hard rule a lesson should be promoted to.
   */
  private determinePromotionType(lesson: Lesson): string | null {
    switch (lesson.category) {
      case 'security-pattern':
        return 'security-rule';
      case 'tool-misuse':
        return 'workflow-check';
      case 'source-defect-pattern':
        return 'lint-rule';
      case 'hygiene-violation':
        return 'git-hook';
      case 'test-infra-gap':
        return 'test-template';
      default:
        return 'documentation'; // Generic fallback
    }
  }

  /**
   * Check if an error is related to what a lesson was supposed to prevent.
   */
  private isLessonRelevantToError(sessionSummary: string, lessonId: string): boolean {
    // This is a simplified implementation
    // In production, this could use more sophisticated pattern matching
    return sessionSummary.toLowerCase().includes('error') || 
           sessionSummary.toLowerCase().includes('fail');
  }

  /**
   * Get feedback statistics for reporting.
   */
  async getFeedbackStats(): Promise<{
    totalOutcomes: number;
    positiveOutcomes: number;
    negativeOutcomes: number;
    humanFeedback: number;
    averageConfidence: number;
  }> {
    const stats = await this.lessonStore.getStats();
    const lessons = await this.lessonStore.query({ includePromoted: true });
    
    let totalOutcomes = 0;
    let positiveOutcomes = 0;
    let negativeOutcomes = 0;
    let humanFeedback = 0;

    for (const lesson of lessons) {
      totalOutcomes += lesson.outcomes.length;
      
      for (const outcome of lesson.outcomes) {
        if (outcome.type === 'positive' || outcome.type === 'human-confirmed') {
          positiveOutcomes++;
        } else if (outcome.type === 'negative' || outcome.type === 'human-rejected') {
          negativeOutcomes++;
        }
        
        if (outcome.type === 'human-confirmed' || outcome.type === 'human-rejected') {
          humanFeedback++;
        }
      }
    }

    const totalLessons = stats.confidenceCounts.LOW + stats.confidenceCounts.MEDIUM + stats.confidenceCounts.HIGH;
    const weightedConfidence = (stats.confidenceCounts.LOW * 1 + stats.confidenceCounts.MEDIUM * 2 + stats.confidenceCounts.HIGH * 3);
    const averageConfidence = totalLessons > 0 ? weightedConfidence / totalLessons : 0;

    return {
      totalOutcomes,
      positiveOutcomes,
      negativeOutcomes,
      humanFeedback,
      averageConfidence,
    };
  }
}