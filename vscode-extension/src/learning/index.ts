// ---------------------------------------------------------------------------
// AgentX -- Continuous Learning Loop: Module Exports
// ---------------------------------------------------------------------------
//
// Public API for the lesson storage and learning loop system.
// 
// Phase A: Core types and storage (✓ Complete)
// Phase B: Extractor and injector (✓ Complete)
// Phase C: Feedback collection (✓ Complete) 
// Phase D: Integration hooks (✓ Complete)
// ---------------------------------------------------------------------------

// Core types and interfaces
export * from './learningTypes';

// Storage and data access
export * from './lessonStore';

// Processing components
export * from './lessonExtractor';
export * from './lessonInjector';

// Feedback and collection
export { 
  FeedbackCollector,
  UserFeedbackPrompt,
  FeedbackOption
} from './feedbackCollector';

// Integration utilities
export * from './learningIntegration';