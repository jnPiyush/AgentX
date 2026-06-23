import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { promptWorkspaceRoot, readJsonWithComments } from './initializeInternals';
import { runCriticalPreCheck } from './setupWizard';

export type LlmAdapterMode = 'copilot' | 'claude-code' | 'anthropic-api' | 'openai-api';
export type LlmAdapterSetupMode = LlmAdapterMode | 'claude-code-local';
export type ClaudeCodeProfile = 'subscription' | 'local-gateway';

interface AgentXConfig {
  readonly created?: string;
  readonly updatedAt?: string;
  readonly llmProvider?: string;
  readonly llmProviders?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface ProviderPromptResult {
  readonly defaultModel?: string;
  readonly baseUrl?: string;
  readonly anthropicVersion?: string;
  readonly apiKey?: string;
  readonly profile?: ClaudeCodeProfile;
  readonly modelRouting?: 'mapped' | 'default-only';
  readonly customModelName?: string;
  readonly customModelDescription?: string;
  readonly disableExperimentalBetas?: boolean;
}

export interface LlmAdapterApplyResult {
  readonly changed: boolean;
  readonly providerLabel: string;
  readonly preCheckPassed: boolean;
}

interface LlmProviderPick extends vscode.QuickPickItem {
  readonly value: LlmAdapterSetupMode;
}

interface LlmModelPick extends vscode.QuickPickItem {
  readonly value: string;
}

const LLM_PROVIDER_ITEMS: readonly LlmProviderPick[] = [
  {
    label: 'GitHub Copilot',
    value: 'copilot',
    description: 'Default current behavior',
    detail: 'Uses the existing GitHub Copilot and GitHub Models flow.',
  },
  {
    label: 'Claude Subscription',
    value: 'claude-code',
    description: 'Claude Code CLI login',
    detail: 'Uses the local Claude Code subscription/runtime when authenticated.',
  },
  {
    label: 'Claude Code + LiteLLM + Ollama',
    value: 'claude-code-local',
    description: 'Local-model gateway profile',
    detail: 'Routes Claude Code through a LiteLLM proxy to an Ollama-hosted coding model.',
  },
  {
    label: 'Claude API',
    value: 'anthropic-api',
    description: 'Anthropic API key',
    detail: 'Uses Anthropic token-based API consumption for Claude models.',
  },
  {
    label: 'OpenAI API',
    value: 'openai-api',
    description: 'OpenAI API key',
    detail: 'Uses OpenAI token-based API consumption for GPT-family models.',
  },
];

const DEFAULT_LITELLM_BASE_URL = 'http://127.0.0.1:4000';

const CLAUDE_MODEL_ITEMS: readonly LlmModelPick[] = [
  { label: 'claude-opus-4.8', value: 'claude-opus-4.8', description: 'Default highest-capability Claude model' },
  { label: 'claude-opus-4.6', value: 'claude-opus-4.6', description: 'Previous Opus generation' },
  { label: 'claude-haiku-4.5', value: 'claude-haiku-4.5', description: 'Lower-cost Claude model' },
];

const CLAUDE_LOCAL_MODEL_ITEMS: readonly LlmModelPick[] = [
  {
    label: 'Qwen 2.5 Coder 14B',
    value: 'qwen2.5-coder:14b',
    description: 'Recommended local coding default',
    detail: 'Good default for Ollama-backed coding tasks when LiteLLM accepts the raw Ollama model name.',
  },
  {
    label: 'DeepSeek Coder',
    value: 'deepseek-coder:latest',
    description: 'Alternative local coding model',
    detail: 'Use if your Ollama install exposes DeepSeek Coder under this model name.',
  },
  {
    label: 'Codestral',
    value: 'codestral:latest',
    description: 'Alternative local coding model',
    detail: 'Use if your Ollama install exposes Codestral under this model name.',
  },
  {
    label: 'Custom LiteLLM model id',
    value: '__custom__',
    description: 'Enter the exact model id expected by LiteLLM',
    detail: 'Use this when your LiteLLM endpoint expects a prefixed id such as ollama_chat/<model>.',
  },
];

const OPENAI_MODEL_ITEMS: readonly LlmModelPick[] = [
  { label: 'gpt-5.5', value: 'gpt-5.5', description: 'Default highest-capability GPT model' },
  { label: 'gpt-5.1', value: 'gpt-5.1', description: 'Stable GPT-5 generation' },
  { label: 'gpt-5-mini', value: 'gpt-5-mini', description: 'Lower-cost GPT-5 tier' },
  { label: 'gpt-4.1', value: 'gpt-4.1', description: 'High-compatibility GPT model' },
  { label: 'gpt-4o', value: 'gpt-4o', description: 'Fast multimodal GPT model' },
  { label: 'gpt-5.2-codex', value: 'gpt-5.2-codex', description: 'Codex-family model over API access' },
];

function sanitizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function writeJsonIfChanged(filePath: string, content: unknown): boolean {
  const next = JSON.stringify(content, null, 2);
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : undefined;
  if (current?.trim() === next.trim()) {
    return false;
  }

  fs.writeFileSync(filePath, next);
  return true;
}

function sanitizeProviderRecord(providerId: LlmAdapterMode, settings: ProviderPromptResult): Record<string, unknown> {
  switch (providerId) {
    case 'claude-code':
      return {
        enabled: true,
        defaultModel: settings.defaultModel ?? 'claude-opus-4.8',
        profile: settings.profile ?? 'subscription',
        baseUrl: sanitizeOptionalString(settings.baseUrl),
        modelRouting: settings.modelRouting ?? 'mapped',
        customModelName: sanitizeOptionalString(settings.customModelName),
        customModelDescription: sanitizeOptionalString(settings.customModelDescription),
        disableExperimentalBetas: settings.disableExperimentalBetas === true,
      };
    case 'anthropic-api':
      return {
        enabled: true,
        defaultModel: settings.defaultModel ?? 'claude-opus-4.8',
        baseUrl: settings.baseUrl ?? '',
        anthropicVersion: settings.anthropicVersion ?? '2023-06-01',
      };
    case 'openai-api':
      return {
        enabled: true,
        defaultModel: settings.defaultModel ?? 'gpt-5.5',
        baseUrl: settings.baseUrl ?? '',
      };
    default:
      return { enabled: true };
  }
}

function upsertLlmAdapterConfig(
  root: string,
  providerId: LlmAdapterMode,
  settings: ProviderPromptResult,
): boolean {
  const configFile = path.join(root, '.agentx', 'config.json');
  const existingConfig = readJsonWithComments<AgentXConfig>(configFile) ?? {};
  const existingProviders = { ...(existingConfig.llmProviders ?? {}) };

  existingProviders[providerId] = sanitizeProviderRecord(providerId, settings);

  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    llmProvider: providerId,
    llmProviders: existingProviders,
    created: existingConfig.created ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return writeJsonIfChanged(configFile, nextConfig);
}

function getClaudeCodeProviderLabel(profile: ClaudeCodeProfile | undefined): string {
  return profile === 'local-gateway'
    ? 'Claude Code + LiteLLM + Ollama'
    : 'Claude Subscription';
}

function getProviderIdForSetupMode(setupMode: LlmAdapterSetupMode): LlmAdapterMode {
  return setupMode === 'claude-code-local' ? 'claude-code' : setupMode;
}

async function promptProviderPick(
  preferredProviderId?: LlmAdapterSetupMode,
): Promise<LlmAdapterSetupMode | undefined> {
  if (preferredProviderId) {
    return preferredProviderId;
  }

  const picked = await vscode.window.showQuickPick(LLM_PROVIDER_ITEMS, {
    placeHolder: 'Select the LLM adapter to activate for this workspace',
    title: 'AgentX - Add LLM Adapter',
  });

  return picked?.value;
}

async function promptClaudeCodeSettings(): Promise<ProviderPromptResult | undefined> {
  const model = await vscode.window.showQuickPick(CLAUDE_MODEL_ITEMS, {
    placeHolder: 'Default Claude model for subscription mode',
    title: 'AgentX - Claude Subscription',
  });

  if (!model) {
    return undefined;
  }

  return {
    defaultModel: model.value,
    profile: 'subscription',
    modelRouting: 'mapped',
  };
}

async function promptClaudeLocalGatewaySettings(): Promise<ProviderPromptResult | undefined> {
  const model = await vscode.window.showQuickPick(CLAUDE_LOCAL_MODEL_ITEMS, {
    placeHolder: 'Select the Ollama coding model exposed through LiteLLM',
    title: 'AgentX - Claude Code + LiteLLM + Ollama',
  });
  if (!model) {
    return undefined;
  }

  let modelId = model.value;
  if (modelId === '__custom__') {
    const customModelId = await vscode.window.showInputBox({
      prompt: 'LiteLLM model id',
      placeHolder: 'qwen2.5-coder:14b or ollama_chat/qwen2.5-coder:14b',
      validateInput: (value) => value.trim().length < 3 ? 'Enter the model id your LiteLLM gateway expects' : undefined,
    });
    if (!customModelId) {
      return undefined;
    }
    modelId = customModelId.trim();
  }

  const baseUrlInput = await vscode.window.showInputBox({
    prompt: 'LiteLLM Anthropic base URL',
    placeHolder: DEFAULT_LITELLM_BASE_URL,
    value: DEFAULT_LITELLM_BASE_URL,
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Enter the LiteLLM base URL';
      }

      try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? undefined
          : 'Use an http or https URL';
      } catch {
        return 'Enter a valid URL';
      }
    },
  });
  if (!baseUrlInput) {
    return undefined;
  }

  const authToken = await vscode.window.showInputBox({
    prompt: 'LiteLLM auth token (optional)',
    placeHolder: 'Leave blank if the local proxy does not require auth',
    password: true,
  });

  const customModelName = model.value === '__custom__'
    ? 'Custom local coding model'
    : model.label;

  return {
    defaultModel: modelId,
    baseUrl: baseUrlInput.trim(),
    apiKey: sanitizeOptionalString(authToken),
    profile: 'local-gateway',
    modelRouting: 'default-only',
    customModelName,
    customModelDescription: 'LiteLLM + Ollama local coding model',
    disableExperimentalBetas: true,
  };
}

async function promptAnthropicSettings(): Promise<ProviderPromptResult | undefined> {
  const model = await vscode.window.showQuickPick(CLAUDE_MODEL_ITEMS, {
    placeHolder: 'Default Claude model for API mode',
    title: 'AgentX - Claude API',
  });
  if (!model) {
    return undefined;
  }

  const apiKey = await vscode.window.showInputBox({
    prompt: 'Anthropic API key',
    placeHolder: 'sk-ant-...',
    password: true,
    validateInput: (value) => value.trim().length < 10 ? 'Enter a valid Anthropic API key' : undefined,
  });
  if (!apiKey) {
    return undefined;
  }

  const baseUrl = await vscode.window.showInputBox({
    prompt: 'Anthropic base URL (leave empty for default)',
    placeHolder: 'https://api.anthropic.com',
  });

  return {
    defaultModel: model.value,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl?.trim(),
    anthropicVersion: '2023-06-01',
  };
}

async function promptOpenAiSettings(): Promise<ProviderPromptResult | undefined> {
  const model = await vscode.window.showQuickPick(OPENAI_MODEL_ITEMS, {
    placeHolder: 'Default OpenAI model for API mode',
    title: 'AgentX - OpenAI API',
  });
  if (!model) {
    return undefined;
  }

  const apiKey = await vscode.window.showInputBox({
    prompt: 'OpenAI API key',
    placeHolder: 'sk-...',
    password: true,
    validateInput: (value) => value.trim().length < 10 ? 'Enter a valid OpenAI API key' : undefined,
  });
  if (!apiKey) {
    return undefined;
  }

  const baseUrl = await vscode.window.showInputBox({
    prompt: 'OpenAI base URL (leave empty for default)',
    placeHolder: 'https://api.openai.com/v1',
  });

  return {
    defaultModel: model.value,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl?.trim(),
  };
}

async function promptProviderSettings(setupMode: LlmAdapterSetupMode): Promise<ProviderPromptResult | undefined> {
  switch (setupMode) {
    case 'copilot':
      return {};
    case 'claude-code':
      return promptClaudeCodeSettings();
    case 'claude-code-local':
      return promptClaudeLocalGatewaySettings();
    case 'anthropic-api':
      return promptAnthropicSettings();
    case 'openai-api':
      return promptOpenAiSettings();
    default:
      return undefined;
  }
}

function getProviderLabel(providerId: LlmAdapterMode, profile?: ClaudeCodeProfile): string {
  switch (providerId) {
    case 'copilot':
      return 'GitHub Copilot';
    case 'claude-code':
      return getClaudeCodeProviderLabel(profile);
    case 'anthropic-api':
      return 'Claude API';
    case 'openai-api':
      return 'OpenAI API';
    default:
      return providerId;
  }
}

export async function applyLlmAdapterConfiguration(
  agentx: AgentXContext,
  root: string,
  providerId: LlmAdapterMode,
  settings: ProviderPromptResult,
  options?: { readonly runPreCheck?: boolean },
): Promise<LlmAdapterApplyResult> {
  const changed = upsertLlmAdapterConfig(root, providerId, settings);

  if (providerId === 'openai-api') {
    if (settings.apiKey) {
      await agentx.storeWorkspaceLlmSecret('openai-api', settings.apiKey);
    }
    await agentx.deleteWorkspaceLlmSecret('anthropic-api');
    await agentx.deleteWorkspaceLlmSecret('claude-code');
  }

  if (providerId === 'anthropic-api') {
    if (settings.apiKey) {
      await agentx.storeWorkspaceLlmSecret('anthropic-api', settings.apiKey);
    }
    await agentx.deleteWorkspaceLlmSecret('openai-api');
    await agentx.deleteWorkspaceLlmSecret('claude-code');
  }

  if (providerId === 'claude-code') {
    if (settings.apiKey) {
      await agentx.storeWorkspaceLlmSecret('claude-code', settings.apiKey);
    } else {
      await agentx.deleteWorkspaceLlmSecret('claude-code');
    }
    await agentx.deleteWorkspaceLlmSecret('openai-api');
    await agentx.deleteWorkspaceLlmSecret('anthropic-api');
  }

  if (providerId === 'copilot') {
    await agentx.deleteWorkspaceLlmSecret('openai-api');
    await agentx.deleteWorkspaceLlmSecret('anthropic-api');
    await agentx.deleteWorkspaceLlmSecret('claude-code');
  }

  agentx.invalidateCache();
  await vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
  await vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
  await vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

  let preCheckPassed = true;
  if (options?.runPreCheck ?? true) {
    const preCheck = await runCriticalPreCheck(agentx, true);
    preCheckPassed = preCheck.passed;
  }

  return {
    changed,
    providerLabel: getProviderLabel(providerId, settings.profile),
    preCheckPassed,
  };
}

export async function runAddLlmAdapterCommand(
  agentx: AgentXContext,
  preferredProviderId?: LlmAdapterSetupMode,
): Promise<void> {
  const root = await promptWorkspaceRoot('AgentX - Add LLM Adapter');
  if (!root) {
    return;
  }

  const configFile = path.join(root, '.agentx', 'config.json');
  if (!fs.existsSync(configFile)) {
    vscode.window.showWarningMessage(
      'AgentX LLM adapters require workspace initialization. Run "AgentX: Initialize Local Runtime" first.',
    );
    return;
  }

  const setupMode = await promptProviderPick(preferredProviderId);
  if (!setupMode) {
    return;
  }

  const providerId = getProviderIdForSetupMode(setupMode);
  const settings = await promptProviderSettings(setupMode);
  if (!settings) {
    return;
  }

  const result = await applyLlmAdapterConfiguration(agentx, root, providerId, settings, { runPreCheck: true });

  if (!result.preCheckPassed && providerId === 'claude-code') {
    vscode.window.showWarningMessage(
      settings.profile === 'local-gateway'
        ? 'AgentX: Claude Code local gateway mode was saved, but Claude Code CLI still needs installation or login.'
        : 'AgentX: Claude subscription mode was saved, but Claude Code CLI still needs installation or login.',
    );
    return;
  }

  const suffix = result.changed ? 'saved for this workspace' : 'already configured for this workspace';
  vscode.window.showInformationMessage(
    `AgentX: ${getProviderLabel(providerId, settings.profile)} is now the active LLM adapter and has been ${suffix}.`,
  );
}