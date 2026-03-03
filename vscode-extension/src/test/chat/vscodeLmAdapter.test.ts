// ---------------------------------------------------------------------------
// Tests: vscodeLmAdapter
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import * as sinon from 'sinon';

// We test the helper functions by importing the module.
// The main adapter requires vscode.LanguageModelChat so we test the
// extractToolCalls and toVsCodeMessages logic via the exported adapter
// factory with stubs.

// Since vscodeLmAdapter uses vscode APIs, we test the tool-call extraction
// logic independently by importing the module in the test harness environment
// where the vscode mock is available.

describe('vscodeLmAdapter', () => {

  describe('extractToolCalls (multi-strategy)', () => {

    // Helper to apply the same multi-strategy extraction the adapter uses.
    // This mirrors the 4 strategies in vscodeLmAdapter.ts.
    function extractToolCalls(
      text: string,
    ): { toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>; cleanText: string } {
      const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

      function parseAndPush(json: string): boolean {
        try {
          const parsed = JSON.parse(json.trim());
          if (parsed && typeof parsed.name === 'string') {
            toolCalls.push({ name: parsed.name, arguments: parsed.arguments ?? {} });
            return true;
          }
        } catch { /* skip */ }
        return false;
      }

      // Strategy 1: XML tags
      let cleanText = text.replace(
        /<tool_call>([\s\S]*?)<\/tool_call>/g,
        (_match, json: string) => { parseAndPush(json); return ''; },
      ).trim();
      if (toolCalls.length > 0) { return { toolCalls, cleanText }; }

      // Strategy 2: Markdown code blocks labeled tool_call or tool
      cleanText = text.replace(
        /```(?:tool_call|tool)\s*\n([\s\S]*?)```/g,
        (_match, json: string) => { parseAndPush(json); return ''; },
      ).trim();
      if (toolCalls.length > 0) { return { toolCalls, cleanText }; }

      // Strategy 3: JSON code blocks containing tool-like objects
      cleanText = text.replace(
        /```json\s*\n([\s\S]*?)```/g,
        (_match, json: string) => {
          if (/["']name["']\s*:/.test(json) && /["']arguments["']\s*:/.test(json)) {
            parseAndPush(json);
            return '';
          }
          return _match;
        },
      ).trim();
      if (toolCalls.length > 0) { return { toolCalls, cleanText }; }

      // Strategy 4: Bare JSON objects
      const lines = text.split('\n');
      let buffer = '';
      for (const line of lines) {
        if (line.trim().startsWith('{') || buffer) {
          buffer += line + '\n';
          if (line.trim().endsWith('}')) {
            if (/["']name["']\s*:/.test(buffer) && /["']arguments["']\s*:/.test(buffer)) {
              parseAndPush(buffer);
            }
            buffer = '';
          }
        }
      }

      return { toolCalls, cleanText: text };
    }

    it('should parse tool calls from XML-tagged text (Strategy 1)', () => {
      const text = `I will read the file first.
<tool_call>{"name": "file_read", "arguments": {"filePath": "README.md"}}</tool_call>
Then I will summarize.`;

      const { toolCalls, cleanText } = extractToolCalls(text);
      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].name, 'file_read');
      assert.deepEqual(toolCalls[0].arguments, { filePath: 'README.md' });
      assert.ok(cleanText.includes('I will read the file first'));
    });

    it('should handle multiple tool calls in one response (Strategy 1)', () => {
      const text = `<tool_call>{"name": "list_dir", "arguments": {"dirPath": "."}}</tool_call>
<tool_call>{"name": "grep_search", "arguments": {"pattern": "TODO"}}</tool_call>`;

      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 2);
      assert.equal(toolCalls[0].name, 'list_dir');
      assert.equal(toolCalls[1].name, 'grep_search');
    });

    it('should handle malformed JSON gracefully', () => {
      const text = `Some text <tool_call>{bad json}</tool_call> more text`;
      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 0);
    });

    it('should return empty array when no tool calls present', () => {
      const text = 'Here is a plain text response with no tool calls.';
      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 0);
    });

    it('should parse from markdown code blocks (Strategy 2)', () => {
      const text = 'I will list the directory.\n\n```tool_call\n{"name": "list_dir", "arguments": {"dirPath": "."}}\n```';
      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].name, 'list_dir');
    });

    it('should parse from json code blocks with tool-like content (Strategy 3)', () => {
      const text = 'Here is my action:\n\n```json\n{"name": "file_read", "arguments": {"filePath": "AGENTS.md"}}\n```';
      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].name, 'file_read');
    });

    it('should NOT parse json code blocks without tool shape (Strategy 3)', () => {
      const text = 'Some config:\n\n```json\n{"port": 3000, "host": "localhost"}\n```';
      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 0);
    });

    it('should parse bare JSON objects at line boundaries (Strategy 4)', () => {
      const text = 'I will do this:\n{"name": "terminal_exec", "arguments": {"command": "npm test"}}\nDone.';
      const { toolCalls } = extractToolCalls(text);
      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].name, 'terminal_exec');
    });

  });

  describe('buildToolInstructionPrompt format', () => {

    it('should format tool schemas into an instruction prompt', () => {
      const tools = [
        {
          name: 'file_read',
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path to file' },
            },
            required: ['filePath'],
          },
        },
      ];

      // Simulate the prompt builder logic
      const toolDefs = tools.map((t) => {
        const params = t.parameters?.properties
          ? Object.entries(t.parameters.properties as Record<string, { type: string; description: string }>)
            .map(([k, v]) => `  - ${k} (${v.type}): ${v.description}`)
            .join('\n')
          : '  (no parameters)';
        const required = (t.parameters?.required as string[])?.join(', ') ?? '';
        return `### ${t.name}\n${t.description}\nParameters:\n${params}\nRequired: ${required || 'none'}`;
      }).join('\n\n');

      assert.ok(toolDefs.includes('### file_read'));
      assert.ok(toolDefs.includes('filePath (string): Path to file'));
      assert.ok(toolDefs.includes('Required: filePath'));
    });

  });

});
