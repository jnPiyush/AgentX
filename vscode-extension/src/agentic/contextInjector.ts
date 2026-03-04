// ---------------------------------------------------------------------------
// AgentX -- Agentic Pipeline: Cross-Session Context Injector
// ---------------------------------------------------------------------------
//
// Builds context blocks from previous sessions, outcome lessons,
// synapse links, and global knowledge for injection into the system
// prompt at the start of a new agentic loop session.
//
// This module does NOT modify agenticLoop.ts -- it provides a standalone
// function that callers (extension.ts, agenticChatHandler) invoke to
// enrich the system prompt before loop.run().
//
// See SPEC-Phase3-Proactive-Intelligence.md Section 4.5.
// ---------------------------------------------------------------------------

import { type OutcomeTracker } from '../memory/outcomeTracker';
import { type SessionRecorder } from '../memory/sessionRecorder';
import { type SynapseNetwork } from '../memory/synapseNetwork';
import { type GlobalKnowledgeStore } from '../memory/globalKnowledgeStore';

// ---------------------------------------------------------------------------
// Cross-Session context builder
// ---------------------------------------------------------------------------

/**
 * Dependencies for building cross-session context. All are optional --
 * the builder gracefully degrades if a subsystem is unavailable.
 */
export interface ContextInjectorDeps {
  outcomeTracker?: OutcomeTracker;
  sessionRecorder?: SessionRecorder;
  synapseNetwork?: SynapseNetwork;
  globalKnowledge?: GlobalKnowledgeStore;
}

/**
 * Configuration for how much context to inject.
 */
export interface ContextInjectorConfig {
  /** Max tokens for outcome lessons section. Default: 200 */
  readonly maxOutcomeTokens: number;
  /** Max tokens for session context section. Default: 150 */
  readonly maxSessionTokens: number;
  /** Max tokens for synapse cross-issue context. Default: 150 */
  readonly maxSynapseTokens: number;
  /** Max tokens for global knowledge section. Default: 200 */
  readonly maxKnowledgeTokens: number;
}

const DEFAULT_CONFIG: ContextInjectorConfig = {
  maxOutcomeTokens: 200,
  maxSessionTokens: 150,
  maxSynapseTokens: 150,
  maxKnowledgeTokens: 200,
};

/**
 * Build a cross-session context block for system prompt injection.
 *
 * Returns an empty string if no relevant context is found.
 * Never throws -- all errors are silently caught.
 *
 * @param issueNumber - Current issue number (null for non-issue work)
 * @param agentName - Current agent name
 * @param deps - Subsystem dependencies
 * @param config - Token budget configuration
 * @returns Context string to append to the system prompt
 */
export async function buildCrossSessionContext(
  issueNumber: number | undefined,
  agentName: string,
  deps: ContextInjectorDeps,
  config?: Partial<ContextInjectorConfig>,
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const sections: string[] = [];

  // 1. Outcome lessons from past work by this agent
  if (deps.outcomeTracker && agentName) {
    try {
      const lessons = await deps.outcomeTracker.formatLessonsForPrompt(
        agentName,
      );
      if (lessons) {
        // Truncate to token budget
        const maxChars = cfg.maxOutcomeTokens * 4;
        sections.push(lessons.slice(0, maxChars));
      }
    } catch {
      // Non-critical -- skip
    }
  }

  // 2. Most recent session summary for this issue
  if (deps.sessionRecorder && issueNumber) {
    try {
      const recent = await deps.sessionRecorder.getMostRecent(issueNumber);
      if (recent) {
        const maxChars = cfg.maxSessionTokens * 4;
        const desc = recent.summary?.slice(0, maxChars) ?? '';
        if (desc) {
          sections.push(`[Previous Session]\n${desc}`);
        }
      }
    } catch {
      // Non-critical -- skip
    }
  }

  // 3. Cross-issue synapse context
  if (deps.synapseNetwork && issueNumber) {
    try {
      const synapseCtx = await deps.synapseNetwork.getCrossIssueContext(
        issueNumber,
        cfg.maxSynapseTokens,
      );
      if (synapseCtx) {
        sections.push(synapseCtx);
      }
    } catch {
      // Non-critical -- skip
    }
  }

  // 4. Global knowledge (user-level patterns and pitfalls)
  if (deps.globalKnowledge) {
    try {
      const query = agentName + (issueNumber ? ` issue ${issueNumber}` : '');
      const knowledgeCtx = await deps.globalKnowledge.formatForPrompt(query);
      if (knowledgeCtx) {
        sections.push(knowledgeCtx);
      }
    } catch {
      // Non-critical -- skip
    }
  }

  if (sections.length === 0) {
    return '';
  }

  return '\n\n--- Cross-Session Context ---\n' + sections.join('\n\n');
}
