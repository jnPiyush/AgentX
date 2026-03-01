// ---------------------------------------------------------------------------
// AgentX -- VS Code Language Model Adapter
// ---------------------------------------------------------------------------
//
// Bridges the AgenticLoop's LlmAdapter interface to the VS Code Language
// Model API (vscode.lm.selectChatModels). This is the "ignition key" that
// connects the model-agnostic agentic loop to real Copilot Chat models.
//
// Supports:
//   - Per-agent model selection via modelSelector
//   - Streaming token collection
//   - Tool call extraction from model responses
//   - Cancellation via AbortSignal
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import {
  LlmAdapter,
  LlmResponse,
  LlmToolCall,
  SessionMessage,
} from '../agentic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VsCodeLmAdapterConfig {
  /** Resolved chat model from modelSelector. */
  readonly chatModel: vscode.LanguageModelChat;
  /** System prompt injected as the first message. */
  readonly systemPrompt?: string;
  /** Tool schemas for function calling (JSON Schema format). */
  readonly toolSchemas?: ReadonlyArray<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert SessionMessage[] to vscode.LanguageModelChatMessage[].
 *
 * The VS Code LM API uses a different message format than the AgenticLoop's
 * SessionMessage. This function bridges the two.
 */
function toVsCodeMessages(
  messages: readonly SessionMessage[],
): vscode.LanguageModelChatMessage[] {
  const result: vscode.LanguageModelChatMessage[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case 'system':
        // VS Code LM API does not have a system role; prepend as user context
        result.push(vscode.LanguageModelChatMessage.User(
          `[System Instructions]\n${msg.content}`
        ));
        break;
      case 'user':
        result.push(vscode.LanguageModelChatMessage.User(msg.content));
        break;
      case 'assistant':
        result.push(vscode.LanguageModelChatMessage.Assistant(msg.content));
        break;
      case 'tool':
        // Tool results are sent as user messages with tool context
        result.push(vscode.LanguageModelChatMessage.User(
          `[Tool Result: ${msg.toolCallId ?? 'unknown'}]\n${msg.content}`
        ));
        break;
    }
  }

  return result;
}

/**
 * Extract tool calls from the LLM text response.
 *
 * Models that support function calling via VS Code LM API may embed tool
 * calls in structured format. For models that return plain text with
 * embedded JSON tool calls, we parse them out.
 *
 * Expected format in the text:
 * ```
 * <tool_call>{"name": "file_read", "arguments": {"filePath": "README.md"}}</tool_call>
 * ```
 */
function extractToolCalls(text: string): { cleanText: string; toolCalls: LlmToolCall[] } {
  const toolCalls: LlmToolCall[] = [];
  let callIndex = 0;

  const cleanText = text.replace(
    /<tool_call>([\s\S]*?)<\/tool_call>/g,
    (_match, json: string) => {
      try {
        const parsed = JSON.parse(json.trim());
        if (parsed.name && typeof parsed.name === 'string') {
          toolCalls.push({
            id: `tc-${Date.now()}-${callIndex++}`,
            name: parsed.name,
            arguments: parsed.arguments ?? {},
          });
        }
      } catch {
        // Malformed JSON -- skip
      }
      return '';
    },
  ).trim();

  return { cleanText, toolCalls };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Create an LlmAdapter that uses the VS Code Language Model API.
 *
 * This adapter:
 *   1. Converts SessionMessages to VS Code LM messages
 *   2. Appends tool schemas as a system-level instruction
 *   3. Streams the response and collects tokens
 *   4. Parses tool calls from the response text
 *   5. Returns a standard LlmResponse for the agentic loop
 */
export function createVsCodeLmAdapter(config: VsCodeLmAdapterConfig): LlmAdapter {
  const { chatModel, toolSchemas } = config;

  return {
    async chat(
      messages: readonly SessionMessage[],
      _tools: ReadonlyArray<{ name: string; description: string; parameters: Record<string, unknown> }>,
      signal: AbortSignal,
    ): Promise<LlmResponse> {
      // Build VS Code messages
      const vsMessages = toVsCodeMessages(messages);

      // Inject tool schemas as a system instruction so the model knows
      // which tools are available and the expected call format
      const schemas = toolSchemas ?? _tools;
      if (schemas.length > 0) {
        const toolInstructions = buildToolInstructionPrompt(schemas);
        // Prepend as first message so model sees it early
        vsMessages.unshift(
          vscode.LanguageModelChatMessage.User(toolInstructions),
        );
      }

      // Create cancellation token from AbortSignal
      const tokenSource = new vscode.CancellationTokenSource();
      signal.addEventListener('abort', () => tokenSource.cancel(), { once: true });

      // Send request to VS Code LM
      const chatResponse = await chatModel.sendRequest(
        vsMessages,
        {},
        tokenSource.token,
      );

      // Stream and collect response text
      let fullText = '';
      for await (const fragment of chatResponse.text) {
        if (signal.aborted) { break; }
        fullText += fragment;
      }

      // Parse tool calls from the response
      const { cleanText, toolCalls } = extractToolCalls(fullText);

      return {
        text: cleanText,
        toolCalls,
        finishReason: signal.aborted ? 'abort' : 'stop',
      };
    },
  };
}

/**
 * Build an instruction prompt that teaches the model how to call tools.
 *
 * This follows the convention used by Claude and GPT models where tool
 * definitions are provided as structured instructions.
 */
function buildToolInstructionPrompt(
  tools: ReadonlyArray<{ name: string; description: string; parameters: Record<string, unknown> }>,
): string {
  const toolDefs = tools.map((t) => {
    const params = t.parameters?.properties
      ? Object.entries(t.parameters.properties as Record<string, { type: string; description: string }>)
        .map(([k, v]) => `  - ${k} (${v.type}): ${v.description}`)
        .join('\n')
      : '  (no parameters)';
    const required = (t.parameters?.required as string[])?.join(', ') ?? '';
    return `### ${t.name}\n${t.description}\nParameters:\n${params}\nRequired: ${required || 'none'}`;
  }).join('\n\n');

  return (
    '[Tool Definitions]\n'
    + 'You have the following tools available. To call a tool, wrap the call in XML tags:\n'
    + '<tool_call>{"name": "tool_name", "arguments": {"param": "value"}}</tool_call>\n\n'
    + 'You may call multiple tools in a single response. After tool results are returned, '
    + 'continue your reasoning. When you have enough information, respond with plain text only.\n\n'
    + toolDefs
  );
}
