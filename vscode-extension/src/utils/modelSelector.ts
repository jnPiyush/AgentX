// ---------------------------------------------------------------------------
// AgentX -- Model Selector Utility
// ---------------------------------------------------------------------------
//
// Resolves the preferred LLM model for an agent using the VS Code Language
// Model API (vscode.lm.selectChatModels). Each agent definition declares a
// primary `model` and optional `modelFallback` in its frontmatter. This
// utility maps those human-readable names to VS Code chat model selectors.
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import { AgentDefinition } from '../agentxContext';

/**
 * Result of a model selection attempt.
 */
export interface ModelSelectionResult {
  /** The resolved chat model, or undefined if none matched. */
  readonly chatModel: vscode.LanguageModelChat | undefined;
  /** Which model string was matched ('primary' | 'fallback' | 'none'). */
  readonly source: 'primary' | 'fallback' | 'none';
  /** The human-readable model name that was resolved (or attempted). */
  readonly modelName: string;
  /**
   * Maximum input tokens the model supports (context window size).
   * Read from `chatModel.maxInputTokens` when available;  falls back to
   * a conservative estimate based on model family.
   */
  readonly maxInputTokens: number;
}

// ---------------------------------------------------------------------------
// Context Window Defaults
// ---------------------------------------------------------------------------

/**
 * Default token budget when no model info is available.
 * Conservative estimate suitable for most Copilot models.
 */
const DEFAULT_TOKEN_BUDGET = 100_000;

/**
 * Known context window sizes by model family prefix.
 * Used as fallback when `chatModel.maxInputTokens` is not available.
 * Values represent the full context window; callers should apply a
 * utilization ratio (e.g., 75%) to leave room for output tokens.
 */
const CONTEXT_WINDOW_MAP: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly tokens: number;
}> = [
  // Claude models
  { pattern: /claude.*opus/i, tokens: 200_000 },
  { pattern: /claude.*sonnet/i, tokens: 200_000 },
  { pattern: /claude.*haiku/i, tokens: 200_000 },
  // GPT models
  { pattern: /gpt-?5/i, tokens: 200_000 },
  { pattern: /gpt-?4o/i, tokens: 128_000 },
  { pattern: /gpt-?4/i, tokens: 128_000 },
  { pattern: /o[34]-?mini/i, tokens: 128_000 },
  // Gemini models
  { pattern: /gemini.*3.*pro/i, tokens: 1_000_000 },
  { pattern: /gemini.*3.*flash/i, tokens: 1_000_000 },
  { pattern: /gemini.*2.*pro/i, tokens: 1_000_000 },
  { pattern: /gemini/i, tokens: 1_000_000 },
];

/**
 * Resolve the context window size for a model in order of preference:
 *   1. `chatModel.maxInputTokens` (VS Code LM API, most accurate)
 *   2. Family-based lookup from CONTEXT_WINDOW_MAP
 *   3. Conservative default (100K)
 *
 * @param chatModel - Resolved VS Code chat model (may expose maxInputTokens)
 * @param modelName - Human-readable model name for family-based fallback
 * @returns Maximum input tokens the model supports
 */
export function resolveContextWindow(
  chatModel: vscode.LanguageModelChat | undefined,
  modelName: string,
): number {
  // 1. Prefer the API-reported value
  const apiTokens = (chatModel as { maxInputTokens?: number } | undefined)?.maxInputTokens;
  if (typeof apiTokens === 'number' && apiTokens > 0) {
    return apiTokens;
  }

  // 2. Family-based lookup
  for (const entry of CONTEXT_WINDOW_MAP) {
    if (entry.pattern.test(modelName)) {
      return entry.tokens;
    }
  }

  // Also check the chatModel name/family strings
  if (chatModel) {
    const identifier = `${chatModel.name} ${chatModel.family}`;
    for (const entry of CONTEXT_WINDOW_MAP) {
      if (entry.pattern.test(identifier)) {
        return entry.tokens;
      }
    }
  }

  // 3. Conservative default
  return DEFAULT_TOKEN_BUDGET;
}

/**
 * Known model name mappings from agent .md frontmatter names to VS Code
 * Language Model API selector families/versions.
 *
 * The keys are normalized lowercase prefixes that appear in agent definitions.
 * Each value provides a `family` string used with `vscode.lm.selectChatModels`.
 */
const MODEL_FAMILY_MAP: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly family: string;
  readonly vendor: string;
}> = [
  // Claude models
  { pattern: /claude\s*opus\s*4/i, family: 'claude-opus-4', vendor: 'copilot' },
  { pattern: /claude\s*sonnet\s*4/i, family: 'claude-sonnet-4', vendor: 'copilot' },
  { pattern: /claude\s*haiku/i, family: 'claude-haiku', vendor: 'copilot' },
  { pattern: /claude\s*opus/i, family: 'claude-opus', vendor: 'copilot' },
  { pattern: /claude\s*sonnet/i, family: 'claude-sonnet', vendor: 'copilot' },

  // GPT models
  { pattern: /gpt[\s-]*5[\s.]*3\s*codex/i, family: 'gpt-5.3-codex', vendor: 'copilot' },
  { pattern: /gpt[\s-]*5/i, family: 'gpt-5', vendor: 'copilot' },
  { pattern: /gpt[\s-]*4o/i, family: 'gpt-4o', vendor: 'copilot' },
  { pattern: /gpt[\s-]*4/i, family: 'gpt-4', vendor: 'copilot' },
  { pattern: /o4[\s-]*mini/i, family: 'o4-mini', vendor: 'copilot' },
  { pattern: /o3[\s-]*mini/i, family: 'o3-mini', vendor: 'copilot' },

  // Gemini models
  { pattern: /gemini\s*3[\s.]*1\s*pro/i, family: 'gemini-3.1-pro', vendor: 'copilot' },
  { pattern: /gemini\s*3\s*pro/i, family: 'gemini-3-pro', vendor: 'copilot' },
  { pattern: /gemini\s*3\s*flash/i, family: 'gemini-3-flash', vendor: 'copilot' },
  { pattern: /gemini\s*2[\s.]*5\s*pro/i, family: 'gemini-2.5-pro', vendor: 'copilot' },
  { pattern: /gemini\s*2\s*flash/i, family: 'gemini-2-flash', vendor: 'copilot' },
  { pattern: /gemini\s*pro/i, family: 'gemini-pro', vendor: 'copilot' },
  { pattern: /gemini/i, family: 'gemini', vendor: 'copilot' },
];

/**
 * Parse a human-readable model name from agent frontmatter and try to select
 * a matching VS Code Language Model using `vscode.lm.selectChatModels`.
 *
 * @param modelName - e.g. "Gemini 3 Pro (copilot)" or "Claude Opus 4.6 (copilot)"
 * @returns Matching chat models array (may be empty)
 */
async function trySelectModel(
  modelName: string,
): Promise<vscode.LanguageModelChat | undefined> {
  if (!modelName) {
    return undefined;
  }

  // Check if vscode.lm API is available (requires VS Code 1.90+)
  if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
    return undefined;
  }

  // Try to match against known model families
  for (const entry of MODEL_FAMILY_MAP) {
    if (entry.pattern.test(modelName)) {
      try {
        const models = await vscode.lm.selectChatModels({
          family: entry.family,
          vendor: entry.vendor,
        });
        if (models.length > 0) {
          return models[0];
        }
        // Family matched pattern but no exact model -- do NOT fall back to
        // partial matching here, as that would match sibling models (e.g.
        // gemini-3-flash when gemini-3-pro was requested). Instead, let the
        // caller try the modelFallback.
      } catch {
        // Model selection failed -- continue to next pattern
      }
    }
  }

  // Last resort: try the raw model name as-is in the family field
  try {
    const raw = modelName.replace(/\(copilot\)/i, '').trim();
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    const fuzzy = models.find(
      (m) => m.name.toLowerCase().includes(raw.toLowerCase())
        || m.family.toLowerCase().includes(raw.toLowerCase()),
    );
    if (fuzzy) {
      return fuzzy;
    }
  } catch {
    // Ignore errors -- will return undefined
  }

  return undefined;
}

/**
 * Select the best available chat model for an agent, trying the primary model
 * first and falling back to `modelFallback` if the primary is unavailable.
 *
 * @param agentDef - Parsed agent definition with model/modelFallback
 * @returns ModelSelectionResult with the resolved model and source
 */
export async function selectModelForAgent(
  agentDef: AgentDefinition | undefined,
): Promise<ModelSelectionResult> {
  if (!agentDef || !agentDef.model) {
    return { chatModel: undefined, source: 'none', modelName: '', maxInputTokens: DEFAULT_TOKEN_BUDGET };
  }

  // Try primary model
  const primary = await trySelectModel(agentDef.model);
  if (primary) {
    return {
      chatModel: primary,
      source: 'primary',
      modelName: agentDef.model,
      maxInputTokens: resolveContextWindow(primary, agentDef.model),
    };
  }

  // Try fallback model
  if (agentDef.modelFallback) {
    const fallback = await trySelectModel(agentDef.modelFallback);
    if (fallback) {
      return {
        chatModel: fallback,
        source: 'fallback',
        modelName: agentDef.modelFallback,
        maxInputTokens: resolveContextWindow(fallback, agentDef.modelFallback),
      };
    }
  }

  return {
    chatModel: undefined,
    source: 'none',
    modelName: agentDef.model,
    maxInputTokens: resolveContextWindow(undefined, agentDef.model),
  };
}

/**
 * List all available chat models from the VS Code Language Model API.
 * Useful for diagnostics and debugging model selection issues.
 */
export async function listAvailableModels(): Promise<string[]> {
  if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
    return [];
  }
  try {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    return models.map((m) => `${m.name} (family=${m.family}, vendor=${m.vendor})`);
  } catch {
    return [];
  }
}
