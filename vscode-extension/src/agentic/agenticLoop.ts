// ---------------------------------------------------------------------------
// AgentX -- Inner Agentic Loop
// ---------------------------------------------------------------------------
//
// The core LLM <-> Tool execution cycle. This module orchestrates:
//
//   1. Send messages + tool schemas to the LLM
//   2. If LLM returns tool_calls -> execute each tool
//   3. Record calls for loop detection
//   4. Append tool results to conversation
//   5. Check loop detection / budget / abort
//   6. On text-only response -> run done-validation, re-enter if validation fails
//   7. Repeat until validated text response, or limits hit
//
// The loop is model-agnostic: it receives an LLM adapter interface so it
// can work with any provider (OpenAI, Anthropic, Azure OpenAI, local).
//
// Agent-to-agent communication happens through the request_clarification
// tool (not fragile regex matching on LLM text output).
// ---------------------------------------------------------------------------

import { ToolRegistry, ToolCallRequest, ToolResult, ToolContext, ClarificationHandler } from './toolEngine';
import { BoundaryViolationError } from './boundaryHook';
import { resolveMode } from './promptingModes';
import { time } from '../utils/timingUtils';
import { pruneMessages } from '../utils/contextCompactor';
import { HookRegistry } from './hookPriority';
import {
  ToolLoopDetector,
  LoopDetectionResult,
  LoopDetectionConfig,
} from './toolLoopDetection';
import {
  SessionManager,
  SessionMessage,
  SessionToolCall,
  SessionStorage,
  InMemorySessionStorage,
} from './sessionState';
import {
  LlmAdapterFactory,
  AgentLoader,
} from './subAgentSpawner';
import {
  SelfReviewConfig,
  SelfReviewResult,
  SelfReviewProgress,
  runSelfReview,
} from './selfReviewLoop';
import {
  ClarificationLoopConfig,
  ClarificationLoopResult,
  ClarificationProgress,
  ClarificationEvaluator,
  runClarificationLoop,
} from './clarificationLoop';
import { ProgressTracker } from './progressTracker';
import { ParallelToolExecutor } from './parallelToolExecutor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A tool call as returned by the LLM. */
export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

/** A single LLM response (may contain text, tool calls, or both). */
export interface LlmResponse {
  /** Text content (may be empty if only tool calls). */
  readonly text: string;
  /** Tool calls requested by the LLM (empty if text-only response). */
  readonly toolCalls: readonly LlmToolCall[];
  /** Token usage for this response. */
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
  /** Model-specific finish reason. */
  readonly finishReason?: string;
}

/**
 * Adapter interface for calling an LLM. The agentic loop is provider-agnostic;
 * implement this interface for OpenAI, Anthropic, Azure OpenAI, or any other.
 */
export interface LlmAdapter {
  /**
   * Send a conversation to the LLM and get a response.
   *
   * @param messages - Full conversation history
   * @param tools - Tool function schemas available to the LLM
   * @param signal - Abort signal for cancellation
   */
  chat(
    messages: readonly SessionMessage[],
    tools: ReadonlyArray<{ name: string; description: string; parameters: Record<string, unknown> }>,
    signal: AbortSignal,
  ): Promise<LlmResponse>;
}

/** Callback for streaming progress updates to the caller. */
export interface LoopProgressCallback {
  onIteration?(iteration: number, maxIterations: number): void;
  onToolCall?(toolName: string, params: Record<string, unknown>): void;
  onToolResult?(toolName: string, result: ToolResult): void;
  onLoopWarning?(result: LoopDetectionResult): void;
  onText?(text: string): void;
  onComplete?(summary: LoopSummary): void;
  onValidation?(passed: boolean, details: string): void;
}

/** Final summary of the agentic loop execution. */
export interface LoopSummary {
  readonly sessionId: string;
  readonly iterations: number;
  readonly toolCallsExecuted: number;
  readonly finalText: string;
  readonly exitReason: LoopExitReason;
  readonly loopDetection: LoopDetectionResult | null;
  readonly totalTokensEstimate: number;
  readonly durationMs: number;
}

export type LoopExitReason =
  | 'text_response'
  | 'max_iterations'
  | 'circuit_breaker'
  | 'aborted'
  | 'error'
  | 'empty_response';

/**
 * Done-validation callback (LEGACY -- prefer selfReviewConfig).
 * Called when the LLM produces a text-only response
 * (signaling "I'm done"). Returns whether the work is actually done.
 *
 * If validation fails, the loop injects the failure message into the
 * conversation and continues iterating so the LLM can self-correct.
 *
 * @deprecated Use selfReviewConfig for LLM-based self-review instead.
 */
export interface DoneValidator {
  /**
   * Validate whether the agent's work meets completion criteria.
   * @returns { passed: true } or { passed: false, feedback: "..." }
   */
  validate(): Promise<{ passed: boolean; feedback?: string }>;
}

/**
 * Hook context for tool execution interception.
 */
export interface ToolHookContext {
  readonly sessionId: string;
  readonly iteration: number;
  readonly agentName: string;
  readonly toolName: string;
  readonly params: Record<string, unknown>;
}

/**
 * Hook context after tool execution.
 */
export interface ToolResultHookContext extends ToolHookContext {
  readonly result: ToolResult;
}

/**
 * Hook context for compaction events.
 */
export interface CompactionHookContext {
  readonly sessionId: string;
  readonly agentName: string;
  readonly beforeTokens: number;
  readonly afterTokens: number;
  readonly didCompact: boolean;
  readonly keepRecent: number;
  readonly tokenBudget: number;
  readonly summary?: string;
}

/**
 * Hook context for clarification interception.
 */
export interface ClarificationHookContext {
  readonly agentName: string;
  readonly targetAgent: string;
  readonly topic: string;
  readonly question: string;
  readonly mode: 'loop' | 'callback';
}

/**
 * Hook context after clarification resolution.
 */
export interface ClarificationResultHookContext extends ClarificationHookContext {
  readonly answer: string;
}

/**
 * Action the onError hook can request.
 *
 * - retry:    Re-attempt the failed operation (up to maxRetries)
 * - fallback: Accept the provided fallback text and continue
 * - abort:    Stop the loop immediately with exitReason 'error'
 */
export type ErrorHookAction = 'retry' | 'fallback' | 'abort';

/**
 * Context passed to the onError hook.
 */
export interface ErrorHookContext {
  readonly sessionId: string;
  readonly agentName: string;
  readonly iteration: number;
  readonly error: unknown;
  readonly errorMessage: string;
  /** Which phase the error occurred in. */
  readonly phase: 'llm_call' | 'tool_execution' | 'compaction' | 'self_review';
  /** How many retries have been attempted for this error already. */
  readonly retryCount: number;
}

/**
 * Result returned from the onError hook.
 */
export interface ErrorHookResult {
  readonly action: ErrorHookAction;
  /** Fallback text to use when action='fallback'. */
  readonly fallbackResult?: string;
}

/**
 * Internal extension hooks for chat-mode control points.
 */
export interface AgenticLoopHooks {
  onBeforeToolUse?(
    context: ToolHookContext,
  ): Promise<Record<string, unknown> | void> | Record<string, unknown> | void;
  onAfterToolUse?(context: ToolResultHookContext): Promise<void> | void;
  onCompaction?(context: CompactionHookContext): Promise<void> | void;
  onBeforeClarification?(
    context: ClarificationHookContext,
  ): Promise<Partial<Pick<ClarificationHookContext, 'targetAgent' | 'topic' | 'question'>> | void>
    | Partial<Pick<ClarificationHookContext, 'targetAgent' | 'topic' | 'question'>>
    | void;
  onAfterClarification?(context: ClarificationResultHookContext): Promise<void> | void;
  /**
   * Called when an error occurs during the agentic loop.
   * Return an ErrorHookResult to control error recovery:
   *   - retry:    Re-attempt (up to 3 retries per error)
   *   - fallback: Accept fallbackResult text and continue
   *   - abort:    Stop the loop (default if hook not set)
   */
  onError?(context: ErrorHookContext): Promise<ErrorHookResult> | ErrorHookResult;
  onHookError?(hookName: string, error: unknown): void;
}

/** Configuration for the agentic loop. */
export interface AgenticLoopConfig {
  /** Maximum iterations before forced stop (default 30). */
  readonly maxIterations: number;
  /** Token budget for the session (default 100_000). */
  readonly tokenBudget: number;
  /** System prompt prepended to every conversation. */
  readonly systemPrompt: string;
  /** Agent name for session tracking. */
  readonly agentName: string;
  /** Optional issue number for traceability. */
  readonly issueNumber?: number;
  /** Loop detection config overrides. */
  readonly loopDetection?: Partial<LoopDetectionConfig>;
  /** Number of recent messages to keep during compaction. */
  readonly compactKeepRecent: number;
  /** Whether to auto-compact when budget threshold is reached. */
  readonly autoCompact: boolean;
  /**
   * Agents this loop instance is allowed to request clarifications from.
   * Empty / undefined means clarification is disabled for this loop.
   * The request_clarification tool checks this list at execution time.
   * Example: ['architect', 'product-manager']
   */
  readonly canClarify?: readonly string[];
  /**
   * Maximum clarification rounds per request before auto-escalation.
   * Defaults to 3 if canClarify is set; ignored otherwise.
   */
  readonly clarifyMaxRounds?: number;
  /**
   * Callback invoked when the request_clarification tool is called.
   * Routes the question to the target agent and returns the answer.
   * If not provided, the tool returns a graceful "not available" message.
   */
  readonly onClarificationNeeded?: (
    topic: string,
    question: string,
  ) => Promise<import('../utils/clarificationTypes').ClarificationResult>;
  /**
   * Done-validation hook (LEGACY). When set, the loop validates completion
   * criteria before accepting a text-only response as "done". If validation
   * fails, the feedback is injected into the conversation and the loop
   * continues. Maximum re-validation attempts = 3 to prevent infinite loops.
   *
   * @deprecated Use selfReviewConfig for LLM-based self-review instead.
   */
  readonly doneValidator?: DoneValidator;
  /**
   * Self-review loop configuration. When set, the loop spawns a same-role
   * sub-agent to review the main agent's work whenever a text-only response
   * is produced (signaling "done"). The reviewer provides structured findings
   * and the main agent addresses non-low-impact findings iteratively.
   *
   * This replaces DoneValidator with a richer, LLM-based review mechanism
   * that works for ALL agent roles (not just code-producing agents).
   *
   * Max iterations configurable (default: 15).
   */
  readonly selfReviewConfig?: SelfReviewConfig;
  /**
   * Self-review progress callbacks. Streamed to the UI during review.
   */
  readonly selfReviewProgress?: SelfReviewProgress;
  /**
   * LLM adapter factory for spawning sub-agents (self-review & clarification).
   * Must be provided if selfReviewConfig or clarificationLoopConfig is set.
   */
  readonly llmAdapterFactory?: LlmAdapterFactory;
  /**
   * Agent loader for loading sub-agent definitions and instructions.
   * Must be provided if selfReviewConfig or clarificationLoopConfig is set.
   */
  readonly agentLoader?: AgentLoader;
  /**
   * Clarification loop configuration. When set, the request_clarification
   * tool uses the clarification loop module for iterative agent-to-agent
   * communication with human fallback.
   *
   * Max iterations configurable (default: 6).
   */
  readonly clarificationLoopConfig?: ClarificationLoopConfig;
  /**
   * Clarification loop progress callbacks.
   */
  readonly clarificationProgress?: ClarificationProgress;
  /**
   * Custom evaluator for clarification answers. If not provided, a
   * default heuristic evaluator is used.
   */
  readonly clarificationEvaluator?: ClarificationEvaluator;
  /**
   * Workspace root path for CLI loop state bridge.
   * When set, the agentic loop reads/updates .agentx/state/loop-state.json
   * to stay synchronized with the CLI-based iterative loop.
   */
  readonly workspaceRoot?: string;
  /**
   * Optional internal hooks for pre/post tool calls, compaction, and
   * clarification interception. Hook failures are isolated and do not
   * terminate the main loop.
   */
  readonly hooks?: AgenticLoopHooks;
  /**
   * Tool category names from agent frontmatter. When set, the LLM only
   * sees schemas for tools in these categories (e.g., 'read', 'edit',
   * 'execute', 'search', 'agent'). The tool registry still has all
   * tools, but the LLM schemas are filtered at the prompt level.
   *
   * If empty or undefined, all tools are exposed (backward-compatible).
   */
  readonly allowedTools?: readonly string[];
  /**
   * Prompting mode for the agent (US-4.4). When set, a mode-specific
   * system prompt suffix is appended to the base system prompt.
   * Built-in modes for Engineer: 'write', 'refactor', 'test', 'docs'.
   * Default: undefined (no mode suffix applied, backward-compatible).
   */
  readonly mode?: string;
  /**
   * Hard cap on conversation messages (US-2.5). When the message count
   * exceeds this limit, the oldest non-system messages are pruned.
   * System messages are NEVER pruned (they are exempt from the cap).
   * Works alongside token-based compaction.
   * Default: 200.
   */
  readonly maxMessages?: number;
  /**
   * Priority-based hook registries (US-4.5). When set, the loop executes
   * registered hooks through HookRegistry in priority order BEFORE calling
   * the legacy hooks from `hooks`. This enables multiple handlers per event
   * with deterministic execution ordering.
   *
   * Each registry key corresponds to an AgenticLoopHooks event name.
   * Backward-compatible: legacy hooks still fire after registry hooks.
   */
  readonly hookRegistries?: {
    readonly onBeforeToolUse?: HookRegistry<ToolHookContext, Record<string, unknown> | void>;
    readonly onAfterToolUse?: HookRegistry<ToolResultHookContext, void>;
    readonly onCompaction?: HookRegistry<CompactionHookContext, void>;
    readonly onError?: HookRegistry<ErrorHookContext, ErrorHookResult>;
  };
}

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 20,
  tokenBudget: 100_000,
  systemPrompt: 'You are a helpful AI coding assistant.',
  agentName: 'engineer',
  compactKeepRecent: 10,
  autoCompact: true,
};

/** Maximum re-validation attempts before accepting the response. */
const MAX_VALIDATION_RETRIES = 3;

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class AgenticLoopError extends Error {
  constructor(
    message: string,
    public readonly exitReason: LoopExitReason,
  ) {
    super(message);
    this.name = 'AgenticLoopError';
  }
}

// ---------------------------------------------------------------------------
// Agentic Loop
// ---------------------------------------------------------------------------

/**
 * The inner agentic loop: runs the LLM <-> Tool cycle until the LLM produces
 * a validated text-only response, a safety limit is hit, or the operation is
 * aborted.
 *
 * ## Architecture
 *
 * ```
 *  User prompt
 *     |
 *     v
 *  [Session Manager] -- persist messages
 *     |
 *     v
 *  [LLM Adapter]  <---.
 *     |                |
 *     v                |
 *  tool_calls?  -----> [Tool Registry] -> execute
 *     |    yes              |  (includes request_clarification
 *     |                     |   and validate_done tools)
 *     |                     v
 *     |             [Loop Detector] -> record + detect
 *     |                     |
 *     |              feed results back
 *     |                     |
 *     '---------------------'
 *     |
 *     | no tool_calls (text only)
 *     v
 *  [Done Validator] -- pass? -> Return final text
 *       |                       (also updates CLI loop state)
 *       | fail
 *       v
 *  Inject feedback -> continue loop
 * ```
 */
export class AgenticLoop {
  private readonly config: AgenticLoopConfig;
  private readonly toolRegistry: ToolRegistry;
  private readonly loopDetector: ToolLoopDetector;
  private readonly sessionManager: SessionManager;

  constructor(
    config: Partial<AgenticLoopConfig>,
    toolRegistry: ToolRegistry,
    sessionStorage?: SessionStorage,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolRegistry = toolRegistry;
    this.loopDetector = new ToolLoopDetector(this.config.loopDetection);
    this.sessionManager = new SessionManager(
      sessionStorage ?? new InMemorySessionStorage(),
    );
  }

  private handleHookError(hookName: string, error: unknown): void {
    this.config.hooks?.onHookError?.(hookName, error);
  }

  /**
   * Run the agentic loop for a user prompt.
   *
   * @param userPrompt - The user's initial message
   * @param llm - LLM adapter to call
   * @param abortSignal - Abort signal (e.g., from VS Code CancellationToken)
   * @param progress - Optional callbacks for streaming progress
   * @returns Final loop summary
   */
  async run(
    userPrompt: string,
    llm: LlmAdapter,
    abortSignal: AbortSignal,
    progress?: LoopProgressCallback,
  ): Promise<LoopSummary> {
    this.loopDetector.reset();

    // Create session
    const session = this.sessionManager.create(
      this.config.agentName,
      this.config.issueNumber,
    );
    const sessionId = session.meta.sessionId;

    // Add system prompt (with optional mode suffix, US-4.4)
    const modeResolution = resolveMode({
      baseSystemPrompt: this.config.systemPrompt,
      mode: this.config.mode,
      role: this.config.agentName,
    });
    this.sessionManager.addMessage(sessionId, {
      role: 'system',
      content: modeResolution.systemPrompt,
      timestamp: new Date().toISOString(),
    });

    // Add user prompt
    this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    });

    return this.executeLoop(sessionId, llm, abortSignal, progress);
  }

  /**
   * Resume a previously saved session with a new user message.
   */
  async resume(
    sessionId: string,
    userMessage: string,
    llm: LlmAdapter,
    abortSignal: AbortSignal,
    progress?: LoopProgressCallback,
  ): Promise<LoopSummary> {
    this.loopDetector.reset();
    const loaded = this.sessionManager.load(sessionId);
    if (!loaded) {
      throw new AgenticLoopError(
        `Session not found: ${sessionId}`,
        'error',
      );
    }

    // Add the new user message
    this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    return this.executeLoop(sessionId, llm, abortSignal, progress);
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /** Get the tool registry for external registration. */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /** Get the session manager for external queries. */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /** Get the loop detector for inspection. */
  getLoopDetector(): ToolLoopDetector {
    return this.loopDetector;
  }

  // -----------------------------------------------------------------------
  // Core Loop (single implementation -- used by both run and resume)
  // -----------------------------------------------------------------------

  /**
   * Execute the core LLM <-> Tool cycle for a session that already has
   * system prompt and user message(s) in its history.
   *
   * This is the SINGLE implementation of the loop logic, eliminating the
   * previous duplication between run() and runFromSession().
   */
  private async executeLoop(
    sessionId: string,
    llm: LlmAdapter,
    abortSignal: AbortSignal,
    progress?: LoopProgressCallback,
  ): Promise<LoopSummary> {
    const startTime = Date.now();

    // Build tool context with clarification handler injected
    const workspaceRoot = this.config.workspaceRoot ?? this.resolveWorkspaceRoot();
    const clarificationHandler = this.buildClarificationHandler();
    const toolCtx: ToolContext & { clarificationHandler?: ClarificationHandler } = {
      workspaceRoot,
      abortSignal,
      log: (msg) => progress?.onText?.(msg),
      clarificationHandler,
    };

    const toolSchemas = this.config.allowedTools && this.config.allowedTools.length > 0
      ? this.toolRegistry.toFilteredFunctionSchemas(this.config.allowedTools)
      : this.toolRegistry.toFunctionSchemas();

    let iterations = 0;
    let totalToolCalls = 0;
    let finalText = '';
    let exitReason: LoopExitReason = 'text_response';
    let lastLoopResult: LoopDetectionResult | null = null;
    let validationRetries = 0;

    // Progress tracking and parallel execution
    const progressTracker = new ProgressTracker();
    const parallelExecutor = new ParallelToolExecutor();
    progressTracker.initialize(this.config.systemPrompt);

    // --- Main loop ---
    while (iterations < this.config.maxIterations) {
      iterations++;
      progress?.onIteration?.(iterations, this.config.maxIterations);

      // Check abort
      if (abortSignal.aborted) {
        exitReason = 'aborted';
        break;
      }

      // Auto-compact if needed
      if (this.config.autoCompact) {
        const beforeTokens = this.sessionManager.getMeta(sessionId)?.totalTokensEstimate ?? 0;
        this.sessionManager.compact(
          sessionId,
          this.config.tokenBudget,
          this.config.compactKeepRecent,
        );
        const afterTokens = this.sessionManager.getMeta(sessionId)?.totalTokensEstimate ?? 0;
        const didCompact = afterTokens < beforeTokens;
        if (this.config.hooks?.onCompaction || this.config.hookRegistries?.onCompaction) {
          let summary: string | undefined;
          if (didCompact) {
            const compacted = this.sessionManager
              .getMessages(sessionId)
              .find(
                (m) => m.role === 'system' && m.content.startsWith('[Session compacted:'),
              );
            summary = compacted?.content;
          }
          const compactionContext = {
            sessionId,
            agentName: this.config.agentName,
            beforeTokens,
            afterTokens,
            didCompact,
            keepRecent: this.config.compactKeepRecent,
            tokenBudget: this.config.tokenBudget,
            summary,
          };
          // Execute priority-registered compaction hooks (US-4.5)
          if (this.config.hookRegistries?.onCompaction) {
            try {
              await this.config.hookRegistries.onCompaction.executeAll(compactionContext);
            } catch (err: unknown) {
              this.handleHookError('hookRegistry:onCompaction', err);
            }
          }
          // Legacy compaction hook (backward-compatible)
          try {
            await this.config.hooks?.onCompaction?.(compactionContext);
          } catch (err: unknown) {
            this.handleHookError('onCompaction', err);
          }
        }
      }

      // Call LLM (with onError hook support for retry/fallback/abort)
      // Apply bounded message pruning (US-2.5) before sending to LLM
      const rawMessages = this.sessionManager.getMessages(sessionId);
      const pruneResult = pruneMessages(rawMessages, {
        maxMessages: this.config.maxMessages ?? 200,
        warnBeforePrune: true,
      });
      const messages = pruneResult.messages as ReadonlyArray<SessionMessage>;
      let response!: LlmResponse;
      let llmRetryCount = 0;
      const MAX_ERROR_RETRIES = 3;
      let llmSuccess = false;
      let llmAbort = false;

      while (!llmSuccess && llmRetryCount <= MAX_ERROR_RETRIES) {
        try {
          // Wrap LLM call with time() for performance measurement (US-3.2)
          const timed = await time(
            `llm-chat-iter-${iterations}`,
            () => llm.chat(messages, toolSchemas, abortSignal),
          );
          response = timed.result;
          llmSuccess = true;
        } catch (err: unknown) {
          if (abortSignal.aborted) {
            exitReason = 'aborted';
            llmAbort = true;
            break;
          }

          const msg = err instanceof Error ? err.message : String(err);
          const errorContext = {
            sessionId,
            agentName: this.config.agentName,
            iteration: iterations,
            error: err,
            errorMessage: msg,
            phase: 'llm_call' as const,
            retryCount: llmRetryCount,
          };

          // Execute priority-registered error hooks first (US-4.5)
          if (this.config.hookRegistries?.onError) {
            try {
              const registryResult = await this.config.hookRegistries.onError.executeUntilResult(errorContext);
              if (registryResult.result) {
                if (registryResult.result.action === 'retry' && llmRetryCount < MAX_ERROR_RETRIES) {
                  llmRetryCount++;
                  continue;
                } else if (registryResult.result.action === 'fallback' && registryResult.result.fallbackResult) {
                  response = {
                    text: registryResult.result.fallbackResult,
                    toolCalls: [],
                  } as LlmResponse;
                  llmSuccess = true;
                  break;
                }
                // action === 'abort' falls through to legacy hook / default abort
              }
            } catch (registryErr: unknown) {
              this.handleHookError('hookRegistry:onError', registryErr);
            }
          }

          // Legacy onError hook (backward-compatible)
          if (this.config.hooks?.onError) {
            try {
              const hookResult = await this.config.hooks.onError(errorContext);

              if (hookResult.action === 'retry' && llmRetryCount < MAX_ERROR_RETRIES) {
                llmRetryCount++;
                continue;
              } else if (hookResult.action === 'fallback' && hookResult.fallbackResult) {
                // Treat fallback text as the LLM response
                response = {
                  text: hookResult.fallbackResult,
                  toolCalls: [],
                } as LlmResponse;
                llmSuccess = true;
                break;
              }
              // action === 'abort' or retries exhausted
            } catch (hookErr: unknown) {
              this.handleHookError('onError', hookErr);
            }
          }

          // Default: abort on error
          finalText = `LLM error: ${msg}`;
          exitReason = 'error';
          llmAbort = true;
          break;
        }
      }

      if (llmAbort) { break; }
      if (!llmSuccess) {
        finalText = 'LLM error: max retries exhausted';
        exitReason = 'error';
        break;
      }

      // Handle empty response
      if (!response.text && response.toolCalls.length === 0) {
        exitReason = 'empty_response';
        break;
      }

      // If text-only response -> validate, then done
      if (response.toolCalls.length === 0) {
        finalText = response.text;
        progress?.onText?.(finalText);

        this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
        });

        // --- Self-Review Loop (replaces old DoneValidator) ---
        if (
          this.config.selfReviewConfig
          && this.config.llmAdapterFactory
          && this.config.agentLoader
          && validationRetries < MAX_VALIDATION_RETRIES
        ) {
          try {
            const reviewResult: SelfReviewResult = await runSelfReview(
              this.config.selfReviewConfig,
              finalText,
              this.config.llmAdapterFactory,
              this.config.agentLoader,
              abortSignal,
              this.config.selfReviewProgress,
            );

            progress?.onValidation?.(reviewResult.approved, reviewResult.summary);

            if (!reviewResult.approved && reviewResult.summary) {
              validationRetries++;
              // Inject review findings as feedback for the main agent to fix
              this.sessionManager.addMessage(sessionId, {
                role: 'user',
                content:
                  `[Self-Review FAILED - iteration ${validationRetries}/${MAX_VALIDATION_RETRIES}]\n\n`
                  + `${reviewResult.summary}\n\n`
                  + 'Please address the findings above and try again.',
                timestamp: new Date().toISOString(),
              });
              finalText = ''; // Reset -- loop continues with review feedback
              continue;
            }
            // Review approved -- fall through to exit
          } catch {
            // Review error -- accept the response to avoid infinite retry
          }
        }
        // --- Legacy DoneValidator gate (deprecated, for backward compat) ---
        else if (this.config.doneValidator && validationRetries < MAX_VALIDATION_RETRIES) {
          try {
            const validation = await this.config.doneValidator.validate();
            progress?.onValidation?.(validation.passed, validation.feedback ?? '');

            if (!validation.passed && validation.feedback) {
              validationRetries++;
              this.sessionManager.addMessage(sessionId, {
                role: 'user',
                content:
                  `[Done-Validation FAILED - attempt ${validationRetries}/${MAX_VALIDATION_RETRIES}]\n\n`
                  + `${validation.feedback}\n\n`
                  + 'Please fix the issues above and try again. '
                  + 'Use the validate_done tool to verify your fixes before responding.',
                timestamp: new Date().toISOString(),
              });
              finalText = ''; // Reset -- loop continues with validation feedback
              continue;
            }
            // Validation passed -- fall through to exit
          } catch {
            // Validation error -- accept the response to avoid infinite retry
          }
        }

        // Update CLI loop state if workspace root is available
        this.updateCliLoopState(workspaceRoot, iterations, finalText);

        exitReason = 'text_response';
        break;
      }

      // Record assistant message with tool calls
      const sessionToolCalls: SessionToolCall[] = response.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        params: tc.arguments,
      }));

      this.sessionManager.addMessage(sessionId, {
        role: 'assistant',
        content: response.text,
        toolCalls: sessionToolCalls,
        timestamp: new Date().toISOString(),
      });

      // --- 3-Phase tool execution ---

      // Phase 1: Pre-process boundary hooks sequentially; collect approved calls.
      const approvedRequests: ToolCallRequest[] = [];
      const approvedParams: Record<string, Record<string, unknown>> = {};

      for (const toolCall of response.toolCalls) {
        if (abortSignal.aborted) {
          exitReason = 'aborted';
          break;
        }

        let effectiveParams: Record<string, unknown> = toolCall.arguments;
        let boundaryBlocked = false;

        // Execute priority-registered hooks first (US-4.5)
        if (this.config.hookRegistries?.onBeforeToolUse) {
          try {
            const chainResult = await this.config.hookRegistries.onBeforeToolUse.executeAll({
              sessionId,
              iteration: iterations,
              agentName: this.config.agentName,
              toolName: toolCall.name,
              params: effectiveParams,
            });
            // Apply first non-void result as parameter patch
            for (const entry of chainResult.results) {
              if (entry.result && typeof entry.result === 'object') {
                effectiveParams = entry.result as Record<string, unknown>;
                break;
              }
            }
          } catch (err: unknown) {
            this.handleHookError('hookRegistry:onBeforeToolUse', err);
          }
        }

        // Legacy hook (backward-compatible)
        if (this.config.hooks?.onBeforeToolUse) {
          try {
            const patched = await this.config.hooks.onBeforeToolUse({
              sessionId,
              iteration: iterations,
              agentName: this.config.agentName,
              toolName: toolCall.name,
              params: toolCall.arguments,
            });
            if (patched && typeof patched === 'object') {
              effectiveParams = patched;
            }
          } catch (err: unknown) {
            // BoundaryViolationError: inject a blocked result instead of
            // executing the tool. The LLM will see the error message and
            // can adjust its approach.
            if (err instanceof BoundaryViolationError) {
              boundaryBlocked = true;
              const blockedResult: ToolResult = {
                content: [{ type: 'text', text: `[BOUNDARY BLOCKED] ${err.message}` }],
                isError: true,
              };
              totalToolCalls++;
              progress?.onToolResult?.(toolCall.name, blockedResult);
              const blockedText = blockedResult.content.map((c) => c.text).join('\n');
              this.loopDetector.record(toolCall.name, effectiveParams, blockedText);
              this.sessionManager.addMessage(sessionId, {
                role: 'tool',
                content: blockedText,
                toolCallId: toolCall.id,
                timestamp: new Date().toISOString(),
              });
              progressTracker.recordFailure(
                response.toolCalls.indexOf(toolCall),
                `[BOUNDARY BLOCKED] ${toolCall.name}`,
              );
            }
            this.handleHookError('onBeforeToolUse', err);
          }
        }

        if (boundaryBlocked) { continue; }

        approvedRequests.push({ id: toolCall.id, name: toolCall.name, params: effectiveParams });
        approvedParams[toolCall.id] = effectiveParams;
      }

      if (abortSignal.aborted) { exitReason = 'aborted'; }

      // Phase 2: Execute approved calls via parallel executor.
      const parallelResults = exitReason !== 'aborted' && approvedRequests.length > 0
        ? await parallelExecutor.analyzeAndExecute(approvedRequests, this.toolRegistry, toolCtx)
        : [];

      // Phase 3: Post-process results (results are in the same order as approvedRequests).
      for (let ri = 0; ri < parallelResults.length; ri++) {
        const result = parallelResults[ri];
        const request = approvedRequests[ri];
        const effectiveParams = approvedParams[request.id] ?? {};
        const stepIndex = response.toolCalls.findIndex((tc) => tc.id === request.id);

        totalToolCalls++;
        progress?.onToolCall?.(request.name, effectiveParams);
        progress?.onToolResult?.(request.name, result);

        // Record for loop detection
        const resultText = result.content.map((c) => c.text).join('\n');
        this.loopDetector.record(request.name, effectiveParams, resultText);

        // Progress tracking
        if (result.isError) {
          progressTracker.recordFailure(stepIndex, resultText);
        } else {
          progressTracker.recordSuccess(stepIndex, resultText);
        }

        if (this.config.hookRegistries?.onAfterToolUse) {
          try {
            await this.config.hookRegistries.onAfterToolUse.executeAll({
              sessionId,
              iteration: iterations,
              agentName: this.config.agentName,
              toolName: request.name,
              params: effectiveParams,
              result,
            });
          } catch (err: unknown) {
            this.handleHookError('hookRegistry:onAfterToolUse', err);
          }
        }

        if (this.config.hooks?.onAfterToolUse) {
          try {
            await this.config.hooks.onAfterToolUse({
              sessionId,
              iteration: iterations,
              agentName: this.config.agentName,
              toolName: request.name,
              params: effectiveParams,
              result,
            });
          } catch (err: unknown) {
            this.handleHookError('onAfterToolUse', err);
          }
        }

        // Append tool result to session
        this.sessionManager.addMessage(sessionId, {
          role: 'tool',
          content: resultText,
          toolCallId: request.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Inject replan message if stalled
      if (progressTracker.isStalled()) {
        const ctx = progressTracker.getRePlanContext();
        const replanMsg = `[REPLAN NEEDED] Agent has stalled after ${ctx.lastErrors.length} consecutive failures. `
          + `Objective: ${ctx.objective}. Please try a different approach.`;
        this.sessionManager.addMessage(sessionId, {
          role: 'user',
          content: replanMsg,
          timestamp: new Date().toISOString(),
        });
        progressTracker.acknowledgeReplan();
      }

      // Emit stale-warning if no progress for staleTimeoutMs
      if (progressTracker.isStale()) {
        const staleMsg = `[STALE WARNING] No progress recorded for 60 seconds. `
          + `Consider changing strategy or requesting help.`;
        this.sessionManager.addMessage(sessionId, {
          role: 'user',
          content: staleMsg,
          timestamp: new Date().toISOString(),
        });
        progress?.onLoopWarning?.({
          severity: 'warning',
          detector: null,
          message: staleMsg,
          count: 0,
        });
      }

      if (abortSignal.aborted) {
        exitReason = 'aborted';
        break;
      }

      // Run loop detection
      lastLoopResult = this.loopDetector.detect();
      if (lastLoopResult.severity !== 'none') {
        progress?.onLoopWarning?.(lastLoopResult);
      }
      if (lastLoopResult.severity === 'circuit_breaker') {
        exitReason = 'circuit_breaker';
        finalText = `Loop detection circuit breaker: ${lastLoopResult.message}`;
        break;
      }
    }

    // Check if max iterations hit
    if (iterations >= this.config.maxIterations && exitReason === 'text_response' && !finalText) {
      exitReason = 'max_iterations';
    }

    // Persist session
    this.sessionManager.save(sessionId);

    const summary: LoopSummary = {
      sessionId,
      iterations,
      toolCallsExecuted: totalToolCalls,
      finalText,
      exitReason,
      loopDetection: lastLoopResult,
      totalTokensEstimate: this.sessionManager.getMeta(sessionId)?.totalTokensEstimate ?? 0,
      durationMs: Date.now() - startTime,
    };

    progress?.onComplete?.(summary);

    return summary;
  }

  // -----------------------------------------------------------------------
  // Clarification handler (wired into the request_clarification tool)
  // -----------------------------------------------------------------------

  /**
   * Build a ClarificationHandler that the request_clarification tool will
   * call at execution time. This replaces the old regex-based detection.
   *
   * When clarificationLoopConfig is set, the handler uses the full
   * clarification loop for iterative back-and-forth with human fallback.
   * Otherwise, falls back to the single-shot onClarificationNeeded callback.
   */
  private buildClarificationHandler(): ClarificationHandler | undefined {
    if (!this.config.canClarify || this.config.canClarify.length === 0) {
      return undefined;
    }

    const canClarify = this.config.canClarify;

    // Prefer the new clarification loop if configured
    if (
      this.config.clarificationLoopConfig
      && this.config.llmAdapterFactory
      && this.config.agentLoader
    ) {
      const loopConfig = this.config.clarificationLoopConfig;
      const llmFactory = this.config.llmAdapterFactory;
      const agentLoader = this.config.agentLoader;
      const evaluator = this.config.clarificationEvaluator;
      const clarificationProgress = this.config.clarificationProgress;
      const agentName = this.config.agentName;

      return async (targetAgent: string, topic: string, question: string) => {
        let effectiveTarget = targetAgent;
        let effectiveTopic = topic;
        let effectiveQuestion = question;

        if (this.config.hooks?.onBeforeClarification) {
          try {
            const patched = await this.config.hooks.onBeforeClarification({
              agentName,
              targetAgent,
              topic,
              question,
              mode: 'loop',
            });
            if (patched?.targetAgent) { effectiveTarget = patched.targetAgent; }
            if (patched?.topic) { effectiveTopic = patched.topic; }
            if (patched?.question) { effectiveQuestion = patched.question; }
          } catch (err: unknown) {
            this.handleHookError('onBeforeClarification', err);
          }
        }

        // Scope check
        const normalized = effectiveTarget.toLowerCase();
        if (!canClarify.includes(normalized)) {
          throw new Error(
            `Cannot request clarification from '${effectiveTarget}'. `
            + `Allowed agents: [${canClarify.join(', ')}]`,
          );
        }

        const result: ClarificationLoopResult = await runClarificationLoop(
          loopConfig,
          agentName,
          normalized,
          effectiveTopic,
          effectiveQuestion,
          llmFactory,
          agentLoader,
          new AbortController().signal, // Sub-loops get their own abort
          evaluator,
          clarificationProgress,
        );

        if (this.config.hooks?.onAfterClarification) {
          try {
            await this.config.hooks.onAfterClarification({
              agentName,
              targetAgent: normalized,
              topic: effectiveTopic,
              question: effectiveQuestion,
              answer: result.answer,
              mode: 'loop',
            });
          } catch (err: unknown) {
            this.handleHookError('onAfterClarification', err);
          }
        }

        return { answer: result.answer };
      };
    }

    // Fall back to the legacy single-shot callback
    if (!this.config.onClarificationNeeded) {
      return undefined;
    }

    const callback = this.config.onClarificationNeeded;

    return async (targetAgent: string, topic: string, question: string) => {
      let effectiveTarget = targetAgent;
      let effectiveTopic = topic;
      let effectiveQuestion = question;

      if (this.config.hooks?.onBeforeClarification) {
        try {
          const patched = await this.config.hooks.onBeforeClarification({
            agentName: this.config.agentName,
            targetAgent,
            topic,
            question,
            mode: 'callback',
          });
          if (patched?.targetAgent) { effectiveTarget = patched.targetAgent; }
          if (patched?.topic) { effectiveTopic = patched.topic; }
          if (patched?.question) { effectiveQuestion = patched.question; }
        } catch (err: unknown) {
          this.handleHookError('onBeforeClarification', err);
        }
      }

      // Scope check
      const normalized = effectiveTarget.toLowerCase();
      if (!canClarify.includes(normalized)) {
        throw new Error(
          `Cannot request clarification from '${effectiveTarget}'. `
          + `Allowed agents: [${canClarify.join(', ')}]`,
        );
      }

      const result = await callback(effectiveTopic, effectiveQuestion);

      if (this.config.hooks?.onAfterClarification) {
        try {
          await this.config.hooks.onAfterClarification({
            agentName: this.config.agentName,
            targetAgent: normalized,
            topic: effectiveTopic,
            question: effectiveQuestion,
            answer: result.answer,
            mode: 'callback',
          });
        } catch (err: unknown) {
          this.handleHookError('onAfterClarification', err);
        }
      }

      return { answer: result.answer };
    };
  }

  // -----------------------------------------------------------------------
  // CLI Loop State Bridge
  // -----------------------------------------------------------------------

  /**
   * Update the CLI loop state file (.agentx/state/loop-state.json) so
   * the agentic loop and CLI-based iterative loop stay synchronized.
   *
   * Only writes if the file already exists (loop was started via CLI).
   */
  private updateCliLoopState(
    workspaceRoot: string,
    iterations: number,
    summary: string,
  ): void {
    try {
      const fs = require('fs');
      const pathMod = require('path');
      const stateFile = pathMod.join(workspaceRoot, '.agentx', 'state', 'loop-state.json');

      if (!fs.existsSync(stateFile)) {
        return; // No CLI loop active -- nothing to bridge
      }

      const raw = fs.readFileSync(stateFile, 'utf-8');
      const state = JSON.parse(raw);

      if (!state.active) {
        return; // Loop already complete/cancelled
      }

      // Record the agentic iteration in the CLI loop history
      state.iteration = (state.iteration ?? 0) + 1;
      state.lastIterationAt = new Date().toISOString();
      if (!state.history) { state.history = []; }
      state.history.push({
        iteration: state.iteration,
        timestamp: new Date().toISOString(),
        summary: `[agentic-loop] ${iterations} LLM iterations. ${summary.slice(0, 200)}`,
        status: 'agentic',
      });

      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // Non-fatal -- bridge is best-effort
    }
  }

  private resolveWorkspaceRoot(): string {
    // Use VS Code workspace if available, otherwise cwd
    try {
      const vscode = require('vscode');
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
      }
    } catch { /* not in VS Code context */ }
    return process.cwd();
  }
}
