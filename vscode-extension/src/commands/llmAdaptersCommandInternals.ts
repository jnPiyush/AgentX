import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { promptWorkspaceRoot, readJsonWithComments } from './initializeInternals';
import { runCriticalPreCheck } from './setupWizard';

export type LlmAdapterMode = 'copilot' | 'claude-code' | 'anthropic-api' | 'openai-api';

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
}

export interface LlmAdapterApplyResult {
  readonly changed: boolean;
  readonly providerLabel: string;
  readonly preCheckPassed: boolean;
}

interface LlmProviderPick extends vscode.QuickPickItem {
  readonly value: LlmAdapterMode;
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

const CLAUDE_MODEL_ITEMS = [
  { label: 'claude-sonnet-4.6', description: 'Default balanced Claude model' },
  { label: 'claude-opus-4.6', description: 'Higher capability Claude model' },
  { label: 'claude-sonnet-4.5', description: 'Previous Sonnet generation' },
  { label: 'claude-haiku-4.5', description: 'Lower-cost Claude model' },
];

const OPENAI_MODEL_ITEMS = [
  { label: 'gpt-5.4', description: 'Default highest-capability GPT model' },
  { label: 'gpt-5.1', description: 'Stable GPT-5 generation' },
  { label: 'gpt-5-mini', description: 'Lower-cost GPT-5 tier' },
  { label: 'gpt-4.1', description: 'High-compatibility GPT model' },
  { label: 'gpt-4o', description: 'Fast multimodal GPT model' },
  { label: 'gpt-5.2-codex', description: 'Codex-family model over API access' },
];

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
        defaultModel: settings.defaultModel ?? 'claude-sonnet-4.6',
      };
    case 'anthropic-api':
      return {
        enabled: true,
        defaultModel: settings.defaultModel ?? 'claude-sonnet-4.6',
        baseUrl: settings.baseUrl ?? '',
        anthropicVersion: settings.anthropicVersion ?? '2023-06-01',
      };
    case 'openai-api':
      return {
        enabled: true,
        defaultModel: settings.defaultModel ?? 'gpt-5.4',
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

async function promptProviderPick(preferredProviderId?: LlmAdapterMode): Promise<LlmAdapterMode | undefined> {
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
    defaultModel: model.label,
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
    defaultModel: model.label,
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
    defaultModel: model.label,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl?.trim(),
  };
}

async function promptProviderSettings(providerId: LlmAdapterMode): Promise<ProviderPromptResult | undefined> {
  switch (providerId) {
    case 'copilot':
      return {};
    case 'claude-code':
      return promptClaudeCodeSettings();
    case 'anthropic-api':
      return promptAnthropicSettings();
    case 'openai-api':
      return promptOpenAiSettings();
    default:
      return undefined;
  }
}

function getProviderLabel(providerId: LlmAdapterMode): string {
  switch (providerId) {
    case 'copilot':
      return 'GitHub Copilot';
    case 'claude-code':
      return 'Claude Subscription';
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
  }

  if (providerId === 'anthropic-api') {
    if (settings.apiKey) {
      await agentx.storeWorkspaceLlmSecret('anthropic-api', settings.apiKey);
    }
    await agentx.deleteWorkspaceLlmSecret('openai-api');
  }

  if (providerId === 'copilot' || providerId === 'claude-code') {
    await agentx.deleteWorkspaceLlmSecret('openai-api');
    await agentx.deleteWorkspaceLlmSecret('anthropic-api');
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
    providerLabel: getProviderLabel(providerId),
    preCheckPassed,
  };
}

export async function runAddLlmAdapterCommand(
  agentx: AgentXContext,
  preferredProviderId?: LlmAdapterMode,
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

  const providerId = await promptProviderPick(preferredProviderId);
  if (!providerId) {
    return;
  }

  const settings = await promptProviderSettings(providerId);
  if (!settings) {
    return;
  }

  const result = await applyLlmAdapterConfiguration(agentx, root, providerId, settings, { runPreCheck: true });

  if (!result.preCheckPassed && providerId === 'claude-code') {
    vscode.window.showWarningMessage(
      'AgentX: Claude subscription mode was saved, but Claude Code CLI still needs installation or login.',
    );
    return;
  }

  const suffix = result.changed ? 'saved for this workspace' : 'already configured for this workspace';
  vscode.window.showInformationMessage(
    `AgentX: ${getProviderLabel(providerId)} is now the active LLM adapter and has been ${suffix}.`,
  );
}