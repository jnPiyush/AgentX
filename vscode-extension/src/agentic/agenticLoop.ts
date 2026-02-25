// ---------------------------------------------------------------------------
// AgentX -- Inner Agentic Loop
// ---------------------------------------------------------------------------
//
// The core LLM <-> Tool execution cycle, inspired by OpenClaw's
// pi-embedded-runner. This module orchestrates:
//
//   1. Send messages + tool schemas to the LLM
//   2. If LLM returns tool_calls -> execute each tool
//   3. Record calls for loop detection
//   4. Append tool results to conversation
//   5. Check loop detection / budget / abort
//   6. Repeat until LLM returns a text-only response or limits hit
//
// The loop is model-agnostic: it receives an LLM adapter interface so it
// can work with any provider (OpenAI, Anthropic, Azure OpenAI, local).
// ---------------------------------------------------------------------------

import { ToolRegistry, ToolCallRequest, ToolResult, ToolContext } from './toolEngine';
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
}

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 30,
  tokenBudget: 100_000,
  systemPrompt: 'You are a helpful AI coding assistant.',
  agentName: 'engineer',
  compactKeepRecent: 10,
  autoCompact: true,
};

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
 * a text-only response, a safety limit is hit, or the operation is aborted.
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
 *     |    yes              |
 *     |                     v
 *     |             [Loop Detector] -> record + detect
 *     |                     |
 *     |              feed results back
 *     |                     |
 *     '---------------------'
 *     |
 *     | no tool_calls (text only)
 *     v
 *  Return final text
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
    const startTime = Date.now();
    this.loopDetector.reset();

    // Create session
    const session = this.sessionManager.create(
      this.config.agentName,
      this.config.issueNumber,
    );
    const sessionId = session.meta.sessionId;

    // Add system prompt
    this.sessionManager.addMessage(sessionId, {
      role: 'system',
      content: this.config.systemPrompt,
      timestamp: new Date().toISOString(),
    });

    // Add user prompt
    this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    });

    // Get tool schemas
    const toolSchemas = this.toolRegistry.toFunctionSchemas();

    // Build tool context
    const workspaceRoot = this.resolveWorkspaceRoot();
    const toolCtx: ToolContext = {
      workspaceRoot,
      abortSignal,
      log: (msg) => progress?.onText?.(msg),
    };

    let iterations = 0;
    let totalToolCalls = 0;
    let finalText = '';
    let exitReason: LoopExitReason = 'text_response';
    let lastLoopResult: LoopDetectionResult | null = null;

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
        this.sessionManager.compact(
          sessionId,
          this.config.tokenBudget,
          this.config.compactKeepRecent,
        );
      }

      // Call LLM
      const messages = this.sessionManager.getMessages(sessionId);
      let response: LlmResponse;
      try {
        response = await llm.chat(messages, toolSchemas, abortSignal);
      } catch (err: unknown) {
        if (abortSignal.aborted) {
          exitReason = 'aborted';
          break;
        }
        const msg = err instanceof Error ? err.message : String(err);
        finalText = `LLM error: ${msg}`;
        exitReason = 'error';
        break;
      }

      // Handle empty response
      if (!response.text && response.toolCalls.length === 0) {
        exitReason = 'empty_response';
        break;
      }

      // If text-only response -> done
      if (response.toolCalls.length === 0) {
        finalText = response.text;
        progress?.onText?.(finalText);

        this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
        });

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

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        if (abortSignal.aborted) {
          exitReason = 'aborted';
          break;
        }

        progress?.onToolCall?.(toolCall.name, toolCall.arguments);

        const request: ToolCallRequest = {
          id: toolCall.id,
          name: toolCall.name,
          params: toolCall.arguments,
        };

        const result = await this.toolRegistry.execute(request, toolCtx);
        totalToolCalls++;
        progress?.onToolResult?.(toolCall.name, result);

        // Record for loop detection
        const resultText = result.content.map((c) => c.text).join('\n');
        this.loopDetector.record(toolCall.name, toolCall.arguments, resultText);

        // Append tool result to session
        this.sessionManager.addMessage(sessionId, {
          role: 'tool',
          content: resultText,
          toolCallId: toolCall.id,
          timestamp: new Date().toISOString(),
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

    // Add the new user message and run
    this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Re-run the loop with existing session context
    return this.runFromSession(sessionId, llm, abortSignal, progress);
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
  // Private
  // -----------------------------------------------------------------------

  /**
   * Run the loop for an existing active session (used by resume).
   */
  private async runFromSession(
    sessionId: string,
    llm: LlmAdapter,
    abortSignal: AbortSignal,
    progress?: LoopProgressCallback,
  ): Promise<LoopSummary> {
    const startTime = Date.now();
    const toolSchemas = this.toolRegistry.toFunctionSchemas();
    const workspaceRoot = this.resolveWorkspaceRoot();
    const toolCtx: ToolContext = {
      workspaceRoot,
      abortSignal,
      log: (msg) => progress?.onText?.(msg),
    };

    let iterations = 0;
    let totalToolCalls = 0;
    let finalText = '';
    let exitReason: LoopExitReason = 'text_response';
    let lastLoopResult: LoopDetectionResult | null = null;

    while (iterations < this.config.maxIterations) {
      iterations++;
      progress?.onIteration?.(iterations, this.config.maxIterations);

      if (abortSignal.aborted) {
        exitReason = 'aborted';
        break;
      }

      if (this.config.autoCompact) {
        this.sessionManager.compact(
          sessionId,
          this.config.tokenBudget,
          this.config.compactKeepRecent,
        );
      }

      const messages = this.sessionManager.getMessages(sessionId);
      let response: LlmResponse;
      try {
        response = await llm.chat(messages, toolSchemas, abortSignal);
      } catch (err: unknown) {
        if (abortSignal.aborted) { exitReason = 'aborted'; break; }
        finalText = `LLM error: ${err instanceof Error ? err.message : String(err)}`;
        exitReason = 'error';
        break;
      }

      if (!response.text && response.toolCalls.length === 0) {
        exitReason = 'empty_response';
        break;
      }

      if (response.toolCalls.length === 0) {
        finalText = response.text;
        progress?.onText?.(finalText);
        this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
        });
        exitReason = 'text_response';
        break;
      }

      const sessionToolCalls: SessionToolCall[] = response.toolCalls.map((tc) => ({
        id: tc.id, name: tc.name, params: tc.arguments,
      }));
      this.sessionManager.addMessage(sessionId, {
        role: 'assistant',
        content: response.text,
        toolCalls: sessionToolCalls,
        timestamp: new Date().toISOString(),
      });

      for (const toolCall of response.toolCalls) {
        if (abortSignal.aborted) { exitReason = 'aborted'; break; }
        progress?.onToolCall?.(toolCall.name, toolCall.arguments);
        const result = await this.toolRegistry.execute(
          { id: toolCall.id, name: toolCall.name, params: toolCall.arguments },
          toolCtx,
        );
        totalToolCalls++;
        progress?.onToolResult?.(toolCall.name, result);

        const resultText = result.content.map((c) => c.text).join('\n');
        this.loopDetector.record(toolCall.name, toolCall.arguments, resultText);
        this.sessionManager.addMessage(sessionId, {
          role: 'tool',
          content: resultText,
          toolCallId: toolCall.id,
          timestamp: new Date().toISOString(),
        });
      }

      if (abortSignal.aborted) { exitReason = 'aborted'; break; }

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

    if (iterations >= this.config.maxIterations && exitReason === 'text_response' && !finalText) {
      exitReason = 'max_iterations';
    }

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
