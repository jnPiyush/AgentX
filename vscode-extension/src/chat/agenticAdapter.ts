import {
  LlmAdapter,
  LlmResponse,
  SessionMessage,
} from '../agentic';

function getLastUserMessage(messages: readonly SessionMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === 'user') {
      return messages[index].content;
    }
  }
  return '';
}

function getLastToolMessage(messages: readonly SessionMessage[]): SessionMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === 'tool') {
      return messages[index];
    }
  }
  return undefined;
}

function extractQuoted(text: string): string | undefined {
  const quoted = text.match(/"([^"]+)"|'([^']+)'|`([^`]+)`/);
  return quoted?.[1] ?? quoted?.[2] ?? quoted?.[3];
}

function extractPathPrompt(prompt: string): string | undefined {
  const quoted = extractQuoted(prompt);
  if (quoted) {
    return quoted;
  }

  const pathMatch = prompt.match(/\b(?:file|path)\s+([\w./\\-]+)/i);
  if (pathMatch) {
    return pathMatch[1];
  }

  if (/\b(readme|readme\.md)\b/i.test(prompt)) {
    return 'README.md';
  }
  if (/\bagents\.md\b/i.test(prompt)) {
    return 'AGENTS.md';
  }

  return undefined;
}

function buildToolIntent(prompt: string): LlmResponse | undefined {
  const lower = prompt.toLowerCase();

  if (/\b(list|show|files|folders|directory|tree)\b/i.test(lower)) {
    return {
      text: 'I will inspect the workspace directory first.',
      toolCalls: [{ id: 'tc-list-dir', name: 'list_dir', arguments: { dirPath: '.' } }],
    };
  }

  if (/\b(read|open|show)\b/i.test(lower) && /\b(file|readme|agents\.md)\b/i.test(lower)) {
    const filePath = extractPathPrompt(prompt) ?? 'README.md';
    return {
      text: `I will read ${filePath} to answer accurately.`,
      toolCalls: [{ id: 'tc-read-file', name: 'file_read', arguments: { filePath } }],
    };
  }

  if (/\b(search|find|grep|look\s+for)\b/i.test(lower)) {
    const pattern = extractQuoted(prompt) ?? 'agent';
    return {
      text: `I will search for "${pattern}" in the workspace.`,
      toolCalls: [{ id: 'tc-grep-search', name: 'grep_search', arguments: { pattern, maxResults: 20 } }],
    };
  }

  if (/\b(run|execute|command)\b/i.test(lower)) {
    const command = extractQuoted(prompt) ?? 'git status';
    return {
      text: `I will run command: ${command}`,
      toolCalls: [{ id: 'tc-terminal', name: 'terminal_exec', arguments: { command, timeoutMs: 20000 } }],
    };
  }

  return undefined;
}

export function createLocalAgenticAdapter(agentName: string, routeDescription: string): LlmAdapter {
  return {
    async chat(messages: readonly SessionMessage[]): Promise<LlmResponse> {
      const lastTool = getLastToolMessage(messages);

      if (lastTool) {
        const toolOutput = lastTool.content.trim();
        return {
          text:
            `Agent selected: ${agentName}. ${routeDescription}\n\n`
            + 'Tool execution completed.\n\n'
            + '```\n'
            + `${toolOutput || '(no output)'}`
            + '\n```',
          toolCalls: [],
        };
      }

      const prompt = getLastUserMessage(messages);
      const toolIntent = buildToolIntent(prompt);
      if (toolIntent) {
        return toolIntent;
      }

      return {
        text:
          `Agent selected: ${agentName}. ${routeDescription}\n\n`
          + 'No direct workspace action was needed. I can run tools if you ask explicitly '
          + '(for example: list files, read a file, search text, or run a command).',
        toolCalls: [],
      };
    },
  };
}
