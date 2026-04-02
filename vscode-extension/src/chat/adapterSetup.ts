import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import type { PendingSetupState } from '../agentxContextTypes';
import {
  type AdapterMode,
  applyRemoteAdapterConfiguration,
  detectAdoOrigin,
  detectGitHubOriginRepo,
} from '../commands/adaptersCommandInternals';
import {
  type LlmAdapterMode,
  applyLlmAdapterConfiguration,
} from '../commands/llmAdaptersCommandInternals';

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4.6';
const DEFAULT_OPENAI_MODEL = 'gpt-5.4';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4.6';

export type PendingSetup = NonNullable<Awaited<ReturnType<AgentXContext['getPendingSetup']>>>;

function getWorkspaceRoot(agentx: AgentXContext): string | undefined {
  return agentx.workspaceRoot ?? agentx.firstWorkspaceFolder;
}

function hasWorkspaceRuntimeConfig(root: string | undefined): boolean {
  return !!root && fs.existsSync(path.join(root, '.agentx', 'config.json'));
}

function renderMissingInitializationMessage(subject: string): string {
  return [
    `**AgentX ${subject} setup needs workspace initialization first.**`,
    '',
    'Run **AgentX: Initialize Local Runtime** and then retry this setup request in chat.',
  ].join('\n');
}

async function updatePendingSetup(agentx: AgentXContext, pending: PendingSetupState): Promise<void> {
  if (typeof agentx.setPendingSetup === 'function') {
    await agentx.setPendingSetup(pending);
  }
}

async function clearPendingSetup(agentx: AgentXContext): Promise<void> {
  if (typeof agentx.clearPendingSetup === 'function') {
    await agentx.clearPendingSetup();
  }
}

export async function getPendingSetup(agentx: AgentXContext): Promise<PendingSetup | undefined> {
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
        'Reply with one of: `copilot`, `claude subscription`, `claude api`, or `openai api`.',
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
      ].join('\n').replace(/\u001b\[0m/g, '`');
    case 'enter-ado-project':
      return [
        '**Azure DevOps adapter setup**',
        '',
        pending.detectedValue
          ? `I detected [0m${pending.detectedValue}[0m from the origin remote. Reply [0muse detected[0m or send a different [0morganization/project[0m.`
          : 'Reply with the Azure DevOps target as `organization/project`.',
      ].join('\n').replace(/\u001b\[0m/g, '`');
    default:
      return '**Adapter setup is waiting for more input.**';
  }
}

function parseLlmProviderReply(userText: string): LlmAdapterMode | undefined {
  const normalized = userText.trim().toLowerCase();
  if (normalized.includes('openai')) { return 'openai-api'; }
  if (normalized.includes('copilot')) { return 'copilot'; }
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
  agentx: AgentXContext,
  root: string,
  providerId: LlmAdapterMode,
): Promise<vscode.ChatResult> {
  await clearPendingSetup(agentx);

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
        'If Claude Code is not installed or logged in yet, run `claude auth login` and retry your next AgentX task.',
      ].join('\n'));
      return {};
    }
    case 'openai-api': {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'OpenAI API key',
        placeHolder: 'sk-...',
        password: true,
        validateInput: (value) => value.trim().length < 10 ? 'Enter a valid OpenAI API key' : undefined,
      });
      if (!apiKey) {
        response.markdown('OpenAI adapter setup cancelled.');
        return {};
      }

      await applyLlmAdapterConfiguration(
        agentx,
        root,
        'openai-api',
        { defaultModel: DEFAULT_OPENAI_MODEL, apiKey: apiKey.trim() },
        { runPreCheck: false },
      );
      response.markdown([
        `Configured **OpenAI API** with default model \`${DEFAULT_OPENAI_MODEL}\`.`,
        '',
        'The API key was collected through a secure VS Code prompt and stored in workspace secret storage, not in chat.',
      ].join('\n'));
      return {};
    }
    case 'anthropic-api': {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Anthropic API key',
        placeHolder: 'sk-ant-...',
        password: true,
        validateInput: (value) => value.trim().length < 10 ? 'Enter a valid Anthropic API key' : undefined,
      });
      if (!apiKey) {
        response.markdown('Claude API adapter setup cancelled.');
        return {};
      }

      await applyLlmAdapterConfiguration(
        agentx,
        root,
        'anthropic-api',
        {
          defaultModel: DEFAULT_ANTHROPIC_MODEL,
          apiKey: apiKey.trim(),
          anthropicVersion: '2023-06-01',
        },
        { runPreCheck: false },
      );
      response.markdown([
        `Configured **Claude API** with default model \`${DEFAULT_ANTHROPIC_MODEL}\`.`,
        '',
        'The API key was collected through a secure VS Code prompt and stored in workspace secret storage, not in chat.',
      ].join('\n'));
      return {};
    }
  }
}

async function beginLlmSetup(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
  providerId?: LlmAdapterMode,
  prompt = '',
): Promise<vscode.ChatResult> {
  const root = getWorkspaceRoot(agentx);
  if (!hasWorkspaceRuntimeConfig(root)) {
    response.markdown(renderMissingInitializationMessage('LLM adapter'));
    return {};
  }

  if (!providerId) {
    const pending: PendingSetupState = {
      kind: 'llm-adapter',
      step: 'choose-llm-provider',
      prompt,
    };
    await updatePendingSetup(agentx, pending);
    response.markdown(renderPendingSetupMessage(pending));
    return {};
  }

  return completeLlmProviderSetup(response, agentx, root!, providerId);
}

async function beginRemoteSetup(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
  adapterMode?: AdapterMode,
  prompt = '',
): Promise<vscode.ChatResult> {
  const root = getWorkspaceRoot(agentx);
  if (!hasWorkspaceRuntimeConfig(root)) {
    response.markdown(renderMissingInitializationMessage('repo adapter'));
    return {};
  }

  if (!adapterMode) {
    const pending: PendingSetupState = {
      kind: 'remote-adapter',
      step: 'choose-remote-adapter',
      prompt,
    };
    await updatePendingSetup(agentx, pending);
    response.markdown(renderPendingSetupMessage(pending));
    return {};
  }

  if (adapterMode === 'local') {
    await clearPendingSetup(agentx);
    await applyRemoteAdapterConfiguration(agentx, root!, 'local', undefined, { runPreCheck: false });
    response.markdown('Configured **local** mode for this workspace. Remote backlog adapters are now disabled.');
    return {};
  }

  if (adapterMode === 'github') {
    const detectedRepo = await detectGitHubOriginRepo(root!);
    const pending: PendingSetupState = {
      kind: 'remote-adapter',
      step: 'enter-github-repo',
      prompt,
      adapterMode: 'github',
      detectedValue: detectedRepo,
    };
    await updatePendingSetup(agentx, pending);
    response.markdown(renderPendingSetupMessage(pending));
    return {};
  }

  const detectedAdo = await detectAdoOrigin(root!);
  const pending: PendingSetupState = {
    kind: 'remote-adapter',
    step: 'enter-ado-project',
    prompt,
    adapterMode: 'ado',
    detectedValue: detectedAdo ? `${detectedAdo.organization}/${detectedAdo.project}` : undefined,
  };
  await updatePendingSetup(agentx, pending);
  response.markdown(renderPendingSetupMessage(pending));
  return {};
}

export async function tryHandleAdapterSetupRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult | undefined> {
  if (/^(?:agentx:\s*)?(?:add llm adapter|switch llm|switch model provider|connect claude|connect claude api|connect openai|setup claude|setup claude api|setup openai|use claude|use claude api|use openai|use copilot)$/i.test(userText)) {
    const normalized = userText.toLowerCase();
    const preferredProvider = normalized.includes('openai')
      ? 'openai-api'
      : normalized.includes('claude') && normalized.includes('api')
        ? 'anthropic-api'
        : normalized.includes('claude')
          ? 'claude-code'
          : normalized.includes('copilot')
            ? 'copilot'
            : undefined;
    return beginLlmSetup(response, agentx, preferredProvider, userText);
  }

  if (/^(?:agentx:\s*)?(?:add remote adapter|switch adapter|switch remote adapter|connect github|connect ado|connect local|setup github|setup ado|setup local|use github|use ado|use local|use local adapter)$/i.test(userText)) {
    const normalized = userText.toLowerCase();
    const preferredAdapter = normalized.includes('github')
      ? 'github'
      : normalized.includes('ado')
        ? 'ado'
        : normalized.includes('local')
          ? 'local'
          : undefined;
    return beginRemoteSetup(response, agentx, preferredAdapter, userText);
  }

  return undefined;
}

export async function tryHandlePendingSetupRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
  pending: PendingSetup | undefined,
): Promise<vscode.ChatResult | undefined> {
  if (!pending) {
    return undefined;
  }

  const normalized = userText.trim();
  if (/^cancel(?: setup)?$/i.test(normalized)) {
    await clearPendingSetup(agentx);
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

  const root = getWorkspaceRoot(agentx);
  if (!hasWorkspaceRuntimeConfig(root)) {
    await clearPendingSetup(agentx);
    response.markdown(renderMissingInitializationMessage('adapter'));
    return {};
  }

  if (pending.step === 'enter-github-repo') {
    const settings = parseGitHubReply(normalized, pending.detectedValue);
    if (!settings) {
      response.markdown(`${renderPendingSetupMessage(pending)}\n\nI expected a GitHub repo like \`owner/repo\`.`);
      return {};
    }

    await clearPendingSetup(agentx);
    await applyRemoteAdapterConfiguration(agentx, root!, 'github', settings, { runPreCheck: false });
    response.markdown(`Configured **GitHub** mode for this workspace using repo \`${settings.repoSlug}\`.`);
    return {};
  }

  if (pending.step === 'enter-ado-project') {
    const settings = parseAdoReply(normalized, pending.detectedValue);
    if (!settings) {
      response.markdown(`${renderPendingSetupMessage(pending)}\n\nI expected Azure DevOps in the form \`organization/project\`.`);
      return {};
    }

    await clearPendingSetup(agentx);
    await applyRemoteAdapterConfiguration(agentx, root!, 'ado', settings, { runPreCheck: false });
    response.markdown(`Configured **Azure DevOps** mode for this workspace using \`${settings.organization}/${settings.project}\`.`);
    return {};
  }

  return undefined;
}