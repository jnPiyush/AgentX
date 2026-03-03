// ---------------------------------------------------------------------------
// Tests: agenticAdapter -- local fallback adapter
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import { createLocalAgenticAdapter } from '../../chat/agenticAdapter';
import { SessionMessage } from '../../agentic';

const EMPTY_TOOLS: ReadonlyArray<{ name: string; description: string; parameters: Record<string, unknown> }> = [];
const NOOP_SIGNAL = new AbortController().signal;

function msgs(...pairs: Array<[string, string]>): SessionMessage[] {
  return pairs.map(([role, content]) => ({
    role: role as SessionMessage['role'],
    content,
    timestamp: new Date().toISOString(),
  }));
}

describe('agenticAdapter (local fallback)', () => {

  it('should include degraded-mode banner in every response', async () => {
    const adapter = createLocalAgenticAdapter('engineer', 'Route to engineer');
    const result = await adapter.chat(
      msgs(['user', 'Hello']), EMPTY_TOOLS, NOOP_SIGNAL,
    );
    assert.ok(result.text.includes('No language model was available'));
    assert.ok(result.text.includes('degraded mode'));
  });

  it('should detect list/files intent and emit list_dir tool call', async () => {
    const adapter = createLocalAgenticAdapter('engineer', 'Route');
    const result = await adapter.chat(
      msgs(['user', 'List the files in the current directory']), EMPTY_TOOLS, NOOP_SIGNAL,
    );
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].name, 'list_dir');
  });

  it('should detect file-read intent and emit file_read tool call', async () => {
    const adapter = createLocalAgenticAdapter('engineer', 'Route');
    const result = await adapter.chat(
      msgs(['user', 'Read the file "config.json"']), EMPTY_TOOLS, NOOP_SIGNAL,
    );
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].name, 'file_read');
    assert.equal(result.toolCalls[0].arguments.filePath, 'config.json');
  });

  it('should detect grep/search intent and emit grep_search tool call', async () => {
    const adapter = createLocalAgenticAdapter('engineer', 'Route');
    const result = await adapter.chat(
      msgs(['user', 'Search for "TODO" in the workspace']), EMPTY_TOOLS, NOOP_SIGNAL,
    );
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].name, 'grep_search');
    assert.equal(result.toolCalls[0].arguments.pattern, 'TODO');
  });

  it('should detect run/execute intent and emit terminal_exec tool call', async () => {
    const adapter = createLocalAgenticAdapter('engineer', 'Route');
    const result = await adapter.chat(
      msgs(['user', 'Run "npm test"']), EMPTY_TOOLS, NOOP_SIGNAL,
    );
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].name, 'terminal_exec');
    assert.equal(result.toolCalls[0].arguments.command, 'npm test');
  });

  it('should show tool output when last message is a tool result', async () => {
    const adapter = createLocalAgenticAdapter('engineer', 'Route to engineer');
    const messages: SessionMessage[] = [
      { role: 'user', content: 'List files', timestamp: new Date().toISOString() },
      { role: 'tool', content: 'file1.ts\nfile2.ts', timestamp: new Date().toISOString() },
    ];
    const result = await adapter.chat(messages, EMPTY_TOOLS, NOOP_SIGNAL);
    assert.ok(result.text.includes('file1.ts'));
    assert.ok(result.text.includes('Tool execution completed'));
    assert.ok(result.text.includes('degraded mode'));
  });

  it('should return no tool calls for non-matching prompts', async () => {
    const adapter = createLocalAgenticAdapter('architect', 'Design');
    const result = await adapter.chat(
      msgs(['user', 'What is the meaning of life?']), EMPTY_TOOLS, NOOP_SIGNAL,
    );
    assert.equal(result.toolCalls.length, 0);
    assert.ok(result.text.includes('No direct workspace action'));
  });

});
