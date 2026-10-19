import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';
import type { PendingSetupState } from '../frontierContextTypes';
import {
  type AdapterMode,
  applyRemoteAdapterConfiguration,
  detectAdoOrigin,
  detectGitHubOriginRepo,
} from '../commands/adaptersCommandInternals';
import {
  type LlmAdapterSetupMode,
  applyLlmAdapterConfiguration,
} from '../commands/llmAdaptersCommandInternals';

const DEFAULT_CLAUDE_MODEL = 'claude-opus-4.8';
const DEFAULT_CLAUDE_LOCAL_MODEL = 'qwen2.5-coder:14b';
const DEFAULT_CLAUDE_LOCAL_BASE_URL = 'http://127.0.0.1:4000';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4.8';

export type PendingSetup = NonNullable<Awaited<ReturnType<FrontierContext['getPendingSetup']>>>;

async function updatePendingSetup(agentx: FrontierContext, pending: PendingSetupState): Promise<void> {
  if (typeof agentx.setPendingSetup === 'function') {
    await agentx.setPendingSetup(pending);
  }
}

async function completeApiKeyProviderSetup(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  root: string,
  providerId: 'openai-api' | 'anthropic-api',
  options: {
    readonly prompt: string;
    readonly placeHolder: string;
    readonly invalidMessage: string;
    readonly cancelledMessage: string;
    readonly displayLabel: string;
    readonly defaultModel: string;
    readonly extraSettings?: Record<string, string>;
  },
): Promise<vscode.ChatResult> {
  const apiKey = await vscode.window.showInputBox({
    prompt: options.prompt,
    placeHolder: options.placeHolder,
    password: true,
    validateInput: (value) => value.trim().length < 10 ? options.invalidMessage : undefined,
  });
  if (!apiKey) {
    response.markdown(options.cancelledMessage);
    return {};
  }

  await applyLlmAdapterConfiguration(
    agentx,
    root,
    providerId,
    {
      defaultModel: options.defaultModel,
      apiKey: apiKey.trim(),
      ...(options.extraSettings ?? {}),
    },
    { runPreCheck: false },
  );
  response.markdown([
    `Configured **${options.displayLabel}** with default model \`${options.defaultModel}\`.`,
    '',
    'The API key was collected through a secure VS Code prompt and stored in workspace secret storage, not in chat.',
  ].join('\n'));
  return {};
}

async function promptPendingSetup(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  pending: PendingSetupState,
): Promise<vscode.ChatResult> {
  await updatePendingSetup(agentx, pending);
  response.markdown(renderPendingSetupMessage(pending));
  return {};
}

async function clearPendingSetup(agentx: FrontierContext, root: string | undefined): Promise<void> {
  if (typeof agentx.clearPendingSetup === 'function') {
    await agentx.clearPendingSetup(root);
  }
}

export async function getPendingSetup(agentx: FrontierContext): Promise<PendingSetup | undefined> {
  return typeof agentx.getPendingSetup === 'function'
    ? await agentx.getPendingSetup()
    : undefined;
}

function renderPendingSetupMessage(pending: PendingSetup): string {
  switch (pending.step) {
    case 'choose-llm-provider':
      return [
        '**Choose an LLM adapter**',
        '',
        'Reply with one of: `copilot`, `claude subscription`, `claude local`, `claude api`, or `openai api`.',
        'Reply `cancel` to stop this setup flow.',
      ].join('\n');
    case 'choose-remote-adapter':
      return [
        '**Choose a repo adapter**',
        '',
        'Reply with one of: `github`, `ado`, or `local`.',
        'Reply `cancel` to stop this setup flow.',
      ].join('\n');
    case 'enter-github-repo':
      return [
        '**GitHub adapter setup**',
        '',
        pending.detectedValue
          ? `I detected [0m${pending.detectedValue}[0m from the origin remote. Reply [0muse detected[0m or send a different [0mowner/repo[0m.`
          : 'Reply with the GitHub repository as `owner/repo`.',
        'You can optionally append a project number, for example `owner/repo project=12`.',
      // eslint-disable-next-line no-control-regex -- Intentionally replaces ANSI reset sequences.
      ].join('\n').replace(/\u001b\[0m/g, '`');
    case 'enter-ado-project':
      return [
        '**Azure DevOps adapter setup**',
        '',
        pending.detectedValue
          ? `I detected [0m${pending.detectedValue}[0m from the origin remote. Reply [0muse detected[0m or send a different [0morganization/project[0m.`
          : 'Reply with the Azure DevOps target as `organization/project`.',
      // eslint-disable-next-line no-control-regex -- Intentionally replaces ANSI reset sequences.
      ].join('\n').replace(/\u001b\[0m/g, '`');
    default:
      return '**Adapter setup is waiting for more input.**';
  }
}

function parseLlmProviderReply(userText: string): LlmAdapterSetupMode | undefined {
  const normalized = userText.trim().toLowerCase();
  if (normalized.includes('openai')) { return 'openai-api'; }
  if (normalized.includes('copilot')) { return 'copilot'; }
  if (normalized.includes('local') || normalized.includes('litellm') || normalized.includes('ollama')) { return 'claude-code-local'; }
  if (normalized.includes('claude') && normalized.includes('api')) { return 'anthropic-api'; }
  if (normalized.includes('anthropic')) { return 'anthropic-api'; }
  if (normalized.includes('claude')) { return 'claude-code'; }
  return undefined;
}

function parseRemoteAdapterReply(userText: string): AdapterMode | undefined {
  const normalized = userText.trim().toLowerCase();
  if (normalized.includes('github')) { return 'github'; }
  if (normalized.includes('ado') || normalized.includes('azure devops')) { return 'ado'; }
  if (normalized.includes('local')) { return 'local'; }
  return undefined;
}

function parseGitHubReply(userText: string, detectedValue?: string): { repoSlug: string; projectNum?: number | null } | undefined {
  const normalized = userText.trim();
  if (/^use detected$/i.test(normalized) && detectedValue) {
    return { repoSlug: detectedValue, projectNum: null };
  }

  const match = normalized.match(/^(?<repo>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\s+(?:project\s*=\s*|#)?(?<project>\d+))?$/i);
  if (!match?.groups?.repo) {
    return undefined;
  }

  return {
    repoSlug: match.groups.repo,
    projectNum: match.groups.project ? parseInt(match.groups.project, 10) : null,
  };
}

function parseAdoReply(userText: string, detectedValue?: string): { organization: string; project: string } | undefined {
  const normalized = userText.trim();
  if (/^use detected$/i.test(normalized) && detectedValue) {
    const parts = detectedValue.split('/');
    if (parts.length === 2) {
      return { organization: parts[0], project: parts[1] };
    }
  }

  const match = normalized.match(/^(?<organization>[^/\s]+)\/(?<project>[^/\s]+)$/);
  if (!match?.groups?.organization || !match.groups.project) {
    return undefined;
  }

  return {
    organization: match.groups.organization,
    project: match.groups.project,
  };
}

async function completeLlmProviderSetup(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  root: string,
  providerId: LlmAdapterSetupMode,
): Promise<vscode.ChatResult> {
  await clearPendingSetup(agentx, root);

  switch (providerId) {
    case 'copilot': {
      await applyLlmAdapterConfiguration(agentx, root, 'copilot', {}, { runPreCheck: false });
      response.markdown('Configured **GitHub Copilot** as the active LLM adapter for this workspace.');
      return {};
    }
    case 'claude-code': {
      await applyLlmAdapterConfiguration(
        agentx,
        root,
        'claude-code',
        { defaultModel: DEFAULT_CLAUDE_MODEL },
        { runPreCheck: false },
      );
      response.markdown([
        `Configured **Claude Subscription** with default model \`${DEFAULT_CLAUDE_MODEL}\`.`,
        '',
        'If Claude Code is not installed or logged in yet, run `claude auth login` and retry your next Frontier task.',
      ].join('\n'));
      return {};
    }
    case 'claude-code-local': {
      const authToken = await vscode.window.showInputBox({
        prompt: 'LiteLLM auth token (optional)',
        placeHolder: 'Leave blank if your local LiteLLM proxy does not require auth',
        password: true,
      });

      await applyLlmAdapterConfiguration(
        agentx,
        root,
        'claude-code',
        {
          defaultModel: DEFAULT_CLAUDE_LOCAL_MODEL,
          baseUrl: DEFAULT_CLAUDE_LOCAL_BASE_URL,
          apiKey: authToken?.trim() ? authToken.trim() : undefined,
          profile: 'local-gateway',
          modelRouting: 'default-only',
          customModelName: 'Qwen 2.5 Coder 14B',
          customModelDescription: 'LiteLLM + Ollama local coding model',
          disableExperimentalBetas: true,
        },
        { runPreCheck: false },
      );
      response.markdown([
        `Configured **Claude Code + LiteLLM + Ollama** with default model \`${DEFAULT_CLAUDE_LOCAL_MODEL}\`.`,
        '',
        `Claude Code will now target LiteLLM at \`${DEFAULT_CLAUDE_LOCAL_BASE_URL}\` and route Frontier model selection to the configured local coding model.`,
        'Keep LiteLLM, Ollama, and the selected model running before starting Frontier tasks.',
      ].join('\n'));
      return {};
    }
    case 'openai-api':
      return completeApiKeyProviderSetup(response, agentx, root, 'openai-api', {
        prompt: 'OpenAI API key',
        placeHolder: 'sk-...',
        invalidMessage: 'Enter a valid OpenAI API key',
        cancelledMessage: 'OpenAI adapter setup cancelled.',
        displayLabel: 'OpenAI API',
        defaultModel: DEFAULT_OPENAI_MODEL,
      });
    case 'anthropic-api':
      return completeApiKeyProviderSetup(response, agentx, root, 'anthropic-api', {
        prompt: 'Anthropic API key',
        placeHolder: 'sk-ant-...',
        invalidMessage: 'Enter a valid Anthropic API key',
        cancelledMessage: 'Claude API adapter setup cancelled.',
        displayLabel: 'Claude API',
        defaultModel: DEFAULT_ANTHROPIC_MODEL,
        extraSettings: { anthropicVersion: '2023-06-01' },
      });
  }
}

async function beginLlmSetup(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  providerId?: LlmAdapterSetupMode,
  prompt = '',
): Promise<vscode.ChatResult> {
  const root = await agentx.ensureWorkspaceReady();

  if (!providerId) {
    return promptPendingSetup(response, agentx, {
      workspaceRoot: root,
      kind: 'llm-adapter',
      step: 'choose-llm-provider',
      prompt,
    });
  }

  return completeLlmProviderSetup(response, agentx, root, providerId);
}

async function beginRemoteSetup(
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  adapterMode?: AdapterMode,
  prompt = '',
): Promise<vscode.ChatResult> {
  const root = await agentx.ensureWorkspaceReady();

  if (!adapterMode) {
    return promptPendingSetup(response, agentx, {
      workspaceRoot: root,
      kind: 'remote-adapter',
      step: 'choose-remote-adapter',
      prompt,
    });
  }

  if (adapterMode === 'local') {
    await clearPendingSetup(agentx, root);
    await applyRemoteAdapterConfiguration(agentx, root, 'local', undefined, { runPreCheck: false });
    response.markdown('Configured **local** mode for this workspace. Remote backlog adapters are now disabled.');
    return {};
  }

  if (adapterMode === 'github') {
    const detectedRepo = await detectGitHubOriginRepo(root);
    return promptPendingSetup(response, agentx, {
      workspaceRoot: root,
      kind: 'remote-adapter',
      step: 'enter-github-repo',
      prompt,
      adapterMode: 'github',
      detectedValue: detectedRepo,
    });
  }

  const detectedAdo = await detectAdoOrigin(root);
  return promptPendingSetup(response, agentx, {
    workspaceRoot: root,
    kind: 'remote-adapter',
    step: 'enter-ado-project',
    prompt,
    adapterMode: 'ado',
    detectedValue: detectedAdo ? `${detectedAdo.organization}/${detectedAdo.project}` : undefined,
  });
}

export async function tryHandleAdapterSetupRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
): Promise<vscode.ChatResult | undefined> {
  if (/^(?:frontier:\s*)?(?:add llm adapter|switch llm|switch model provider|connect claude|connect claude local|connect claude api|connect openai|setup claude|setup claude local|setup claude api|setup openai|use claude|use claude local|use claude api|use openai|use copilot)$/i.test(userText)) {
    return beginLlmSetup(response, agentx, parseLlmProviderReply(userText), userText);
  }

  if (/^(?:frontier:\s*)?(?:add remote adapter|switch adapter|switch remote adapter|connect github|connect ado|connect local|setup github|setup ado|setup local|use github|use ado|use local|use local adapter)$/i.test(userText)) {
    return beginRemoteSetup(response, agentx, parseRemoteAdapterReply(userText), userText);
  }

  return undefined;
}

export async function tryHandlePendingSetupRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: FrontierContext,
  pending: PendingSetup | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!pending) {
    return undefined;
  }
  const root = await agentx.ensureWorkspaceReady(pending.workspaceRoot);
  agentx = agentx.forWorkspace(root);

  const normalized = userText.trim();
  if (/^cancel(?: setup)?$/i.test(normalized)) {
    await clearPendingSetup(agentx, root);
    response.markdown('Cancelled the pending adapter setup flow.');
    return {};
  }

  if (/^continue$/i.test(normalized)) {
    response.markdown(renderPendingSetupMessage(pending));
    return {};
  }

  if (pending.kind === 'llm-adapter' && pending.step === 'choose-llm-provider') {
    const providerId = parseLlmProviderReply(normalized);
    if (!providerId) {
      response.markdown(`${renderPendingSetupMessage(pending)}\n\nI could not map that reply to a supported LLM adapter.`);
      return {};
    }

    return beginLlmSetup(response, agentx, providerId, pending.prompt);
  }

  if (pending.kind === 'remote-adapter' && pending.step === 'choose-remote-adapter') {
    const adapterMode = parseRemoteAdapterReply(normalized);
    if (!adapterMode) {
      response.markdown(`${renderPendingSetupMessage(pending)}\n\nI could not map that reply to a supported repo adapter.`);
      return {};
    }

    return beginRemoteSetup(response, agentx, adapterMode, pending.prompt);
  }

  if (pending.step === 'enter-github-repo') {
    const settings = parseGitHubReply(normalized, pending.detectedValue);
    if (!settings) {
      response.markdown(`${renderPendingSetupMessage(pending)}\n\nI expected a GitHub repo like \`owner/repo\`.`);
      return {};
    }

    await clearPendingSetup(agentx, root);
    await applyRemoteAdapterConfiguration(agentx, root, 'github', settings, { runPreCheck: false });
    response.markdown(`Configured **GitHub** mode for this workspace using repo \`${settings.repoSlug}\`.`);
    return {};
  }

  if (pending.step === 'enter-ado-project') {
    const settings = parseAdoReply(normalized, pending.detectedValue);
    if (!settings) {
      response.markdown(`${renderPendingSetupMessage(pending)}\n\nI expected Azure DevOps in the form \`organization/project\`.`);
      return {};
    }

    await clearPendingSetup(agentx, root);
    await applyRemoteAdapterConfiguration(agentx, root, 'ado', settings, { runPreCheck: false });
    response.markdown(`Configured **Azure DevOps** mode for this workspace using \`${settings.organization}/${settings.project}\`.`);
    return {};
  }

  return undefined;
}