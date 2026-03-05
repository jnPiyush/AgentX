// ---------------------------------------------------------------------------
// AgentX -- Learning Pipeline: Integration Layer
// ---------------------------------------------------------------------------
//
// Orchestrates all learning components and integrates with AgentX core.
// Provides event-driven lesson extraction and context injection.
//
// Integration points:
// - contextCompactor.ts: Automatic lesson extraction from compactions
// - agenticChatHandler.ts: Context injection for agent sessions
// - VS Code UI: Feedback collection interfaces
// ---------------------------------------------------------------------------

import { AgentEventBus } from '../utils/eventBus';
import { 
  LearningConfig, 
  LearningContext,
  SessionFeedbackContext,
  LessonContext,
  DEFAULT_LEARNING_CONFIG 
} from './learningTypes';
import { LessonStore } from './lessonStore';
import { LessonExtractor } from './lessonExtractor';
import { LessonInjector } from './lessonInjector';
import { FeedbackCollector } from './feedbackCollector';

// Types for missing exports from other files
export interface ContextInjectionRequest {
  sessionId: string;
  agent: string;
  issueNumber?: number;
  files: string[];
  issueLabels?: string[];
  executionContext?: string;
}

// Utility types
interface LearningSystemIntegration {
  extractor: LessonExtractor;
  injector: LessonInjector;
  collector: FeedbackCollector;
  store: LessonStore;  
}

/**
 * Central integration layer for the continuous learning system.
 * Connects all learning components with AgentX core architecture.
 */
export class LearningIntegration {
  private readonly store: LessonStore;
  private readonly extractor: LessonExtractor;
  private readonly injector: LessonInjector;
  private readonly collector: FeedbackCollector;
  private readonly config: LearningConfig;
  private readonly activeSessions = new Map<string, ContextInjectionRequest>();

  constructor(
    projectRoot: string,
    eventBus?: AgentEventBus,
    config?: Partial<LearningConfig>
  ) {
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
    this.store = new LessonStore(projectRoot, config);
    this.extractor = new LessonExtractor(this.store);
    this.injector = new LessonInjector(this.store);
    this.collector = new FeedbackCollector(this.store, config);

    // Hook into context compaction events if eventBus provided
    if (eventBus) {
      this.setupEventHandlers(eventBus);
    }
  }

  /**
   * Hook lesson extraction into context compaction workflow.
   * This automatically extracts lessons when sessions are compacted.
   */
  private setupEventHandlers(eventBus: AgentEventBus): void {
    // Extract lessons when context is compacted (traditional trigger)
    eventBus.on('context-compacted', async (event) => {
      if (!this.config.enabled) return;

      try {
        // Extract lessons from the compaction summary
        await this.extractor.extractLessons(
          event.summary,
          event.agent,
          0, // Issue number not available from context-compacted event
          `session-${Date.now()}`
        );        
      } catch (error) {
        console.warn('Learning integration: Failed to extract lessons from compaction:', error);
      }
    });

    // NEW: Session-based learning - extract lessons from completed sessions
    // This triggers more frequently than compaction for practical learning
    eventBus.on('agentic-loop-completed', async (event) => {
      if (!this.config.enabled) return;

      try {
        // Only process sessions with substantial content
        if (event.messageCount && event.messageCount >= 8) {
          // Create a summary from the session messages for lesson extraction
          const summary = this.createSessionSummary(event);
          
          await this.extractor.extractLessons(
            summary,
            event.agent,
            event.issueNumber || 0,
            event.sessionId
          );
        }
      } catch (error) {
        console.warn('Learning integration: Failed to extract lessons from session:', error);
      }
    });

    // Collect feedback when sessions end  
    eventBus.on('session-ended', async (event) => {
      if (!this.config.enabled) return;

      const sessionContext = this.activeSessions.get(event.sessionId);
      if (sessionContext) {
        try {
          const feedbackContext: SessionFeedbackContext = {
            sessionId: event.sessionId,
            agent: event.agent,
            issueNumber: event.issueNumber,
            appliedLessons: event.appliedLessons || [],
            sessionSummary: event.summary || '',
            errorOccurred: event.errorOccurred || false,
            successfulOutcome: event.successfulOutcome || false,
            completionTime: event.completionTime || 0,
          };

          // Collect automated feedback
          await this.collector.collectAutomatedFeedback(feedbackContext);

          // Generate user prompt if configured
          if (this.config.feedbackPromptEnabled) {
            const prompts = await this.collector.generateFeedbackPrompts(feedbackContext);
            if (prompts.length > 0) {
              // Emit event for UI to show feedback prompts
              eventBus.emit('learning-feedback-requested', {
                sessionId: event.sessionId,
                prompts: prompts.map(p => p.question), // Convert to string array
                timestamp: Date.now(),
              });
            }
          }
        } catch (error) {
          console.warn('Learning integration: Failed to collect session feedback:', error);
        } finally {
          // Clean up session tracking
          this.activeSessions.delete(event.sessionId);
        }
      }
    });
  }

  /**
   * Inject lessons into agent context at session start.
   * Call this when preparing context for a new agent session.
   */
  async injectLessonsForSession(request: ContextInjectionRequest): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    try {
      // Track active session for feedback collection
      this.activeSessions.set(request.sessionId, request);

      // Convert request to LearningContext
      const context = {
        agent: request.agent,
        files: request.files,
        issueLabels: request.issueLabels,
        issueNumber: request.issueNumber,
        executionContext: request.executionContext,
      };

      // Get formatted lessons for injection
      const lessonText = await this.injector.getContextualLessons(context);
      
      return lessonText;
    } catch (error) {
      console.warn('Learning integration: Failed to inject lessons:', error);
      return '';
    }
  }

  /**
   * Process user feedback on lessons.
   * Call this when user responds to feedback prompts.
   */
  async processUserFeedback(
    lessonId: string,
    feedbackValue: 'positive' | 'negative' | 'neutral' | 'human-confirmed' | 'human-rejected',
    comment?: string
  ): Promise<void> {
    try {
      await this.collector.processUserFeedback(lessonId, feedbackValue, comment);
    } catch (error) {
      console.warn('Learning integration: Failed to process user feedback:', error);
      throw error;
    }
  }

  /**
   * Get learning system components for direct access.
   */
  getSystem(): LearningSystemIntegration {
    return {
      extractor: this.extractor,
      injector: this.injector,
      collector: this.collector,
      store: this.store,
    };
  }

  /**
   * Get comprehensive learning system stats.
   */
  async getStats(): Promise<{
    lessonStats: any;
    feedbackStats: any;
    configStatus: {
      enabled: boolean;
      promotionThreshold: number;
      maxInjectPerSession: number;
      feedbackPromptEnabled: boolean;
    };
  }> {
    const [lessonStats, feedbackStats] = await Promise.all([
      this.store.getStats(),
      this.collector.getFeedbackStats(),
    ]);

    return {
      lessonStats,
      feedbackStats,
      configStatus: {
        enabled: this.config.enabled,
        promotionThreshold: this.config.promotionThreshold,
        maxInjectPerSession: this.config.maxInjectPerSession,
        feedbackPromptEnabled: this.config.feedbackPromptEnabled,
      },
    };
  }

  /**
   * Manually trigger lesson extraction from a session summary.
   * Useful for batch processing or testing.
   */
  async extractLessonsFromSummary(
    summary: string,
    agent: string,
    issueNumber: number,
    sessionId: string
  ): Promise<void> {
    try {
      await this.extractor.extractLessons(summary, agent, issueNumber, sessionId);
    } catch (error) {
      console.warn('Learning integration: Failed to extract lessons manually:', error);
      throw error;
    }
  }

  /**
   * Create a session summary for lesson extraction from agentic loop completion.
   * This provides a lightweight summary when full compaction hasn't occurred.
   */
  private createSessionSummary(event: any): string {
    const sections: string[] = [
      '## Session Summary (Lesson Extraction)',
      '',
      `Agent: ${event.agent || 'unknown'}`,
      `Messages: ${event.messageCount || 0}`,
      `Duration: ${event.duration || 'unknown'}`,
      '',
    ];

    // Add basic context if available
    if (event.issueNumber) {
      sections.push(`Issue: #${event.issueNumber}`, '');
    }

    if (event.outcome) {
      sections.push('### Outcome', `- ${event.outcome}`, '');
    }

    if (event.errors && event.errors.length > 0) {
      sections.push('### Errors Encountered');
      for (const error of event.errors.slice(0, 5)) {
        sections.push(`- ${error}`);
      }
      sections.push('');
    }

    if (event.completedTasks && event.completedTasks.length > 0) {
      sections.push('### Completed Tasks');
      for (const task of event.completedTasks.slice(0, 8)) {
        sections.push(`- ${task}`);
      }
      sections.push('');  
    }

    if (event.toolsUsed && event.toolsUsed.length > 0) {
      sections.push('### Tools Used');
      for (const tool of Array.from(new Set(event.toolsUsed)).slice(0, 10)) {
        sections.push(`- ${tool}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Cleanup method for proper disposal.
   */
  dispose(): void {
    this.activeSessions.clear();
    // Additional cleanup if needed in the future
  }
}

// ---------------------------------------------------------------------------
// Integration Event Types
// ---------------------------------------------------------------------------

/**
 * Events emitted by the learning integration system.
 * These extend the existing AgentEventBus event types.
 */
export type LearningIntegrationEvents = {
  'learning-feedback-requested': {
    sessionId: string;
    prompts: string[];
  };
  'lesson-extracted': {
    lessonId: string;
    category: string;
    agent: string;
    sessionId: string;
  };
  'lesson-promoted': {
    lessonId: string;
    promotedTo: string;
    confirmations: number;
  };
  'learning-stats-updated': {
    totalLessons: number;
    activeLessons: number;
    averageConfidence: number;
  };
};