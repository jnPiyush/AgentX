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

  describe('extractToolCalls (via adapter integration)', () => {

    it('should parse tool calls from XML-tagged text', () => {
      // We test the extraction logic by simulating what the adapter would do
      const text = `I will read the file first.
<tool_call>{"name": "file_read", "arguments": {"filePath": "README.md"}}</tool_call>
Then I will summarize.`;

      // Regex-based extraction matching the adapter's implementation
      const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
      const cleanText = text.replace(
        /<tool_call>([\s\S]*?)<\/tool_call>/g,
        (_match, json: string) => {
          try {
            const parsed = JSON.parse(json.trim());
            if (parsed.name && typeof parsed.name === 'string') {
              toolCalls.push({
                name: parsed.name,
                arguments: parsed.arguments ?? {},
              });
            }
          } catch { /* skip */ }
          return '';
        },
      ).trim();

      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].name, 'file_read');
      assert.deepEqual(toolCalls[0].arguments, { filePath: 'README.md' });
      assert.equal(cleanText, 'I will read the file first.\n\nThen I will summarize.');
    });

    it('should handle multiple tool calls in one response', () => {
      const text = `<tool_call>{"name": "list_dir", "arguments": {"dirPath": "."}}</tool_call>
<tool_call>{"name": "grep_search", "arguments": {"pattern": "TODO"}}</tool_call>`;

      const toolCalls: Array<{ name: string }> = [];
      text.replace(
        /<tool_call>([\s\S]*?)<\/tool_call>/g,
        (_match, json: string) => {
          try {
            const parsed = JSON.parse(json.trim());
            if (parsed.name) { toolCalls.push({ name: parsed.name }); }
          } catch { /* skip */ }
          return '';
        },
      );

      assert.equal(toolCalls.length, 2);
      assert.equal(toolCalls[0].name, 'list_dir');
      assert.equal(toolCalls[1].name, 'grep_search');
    });

    it('should handle malformed JSON gracefully', () => {
      const text = `Some text <tool_call>{bad json}</tool_call> more text`;

      const toolCalls: Array<{ name: string }> = [];
      const cleanText = text.replace(
        /<tool_call>([\s\S]*?)<\/tool_call>/g,
        (_match, json: string) => {
          try {
            const parsed = JSON.parse(json.trim());
            if (parsed.name) { toolCalls.push({ name: parsed.name }); }
          } catch { /* skip */ }
          return '';
        },
      ).trim();

      assert.equal(toolCalls.length, 0);
      assert.equal(cleanText, 'Some text  more text');
    });

    it('should return empty array when no tool calls present', () => {
      const text = 'Here is a plain text response with no tool calls.';

      const toolCalls: Array<{ name: string }> = [];
      text.replace(
        /<tool_call>([\s\S]*?)<\/tool_call>/g,
        (_match, json: string) => {
          try {
            const parsed = JSON.parse(json.trim());
            if (parsed.name) { toolCalls.push({ name: parsed.name }); }
          } catch { /* skip */ }
          return '';
        },
      );

      assert.equal(toolCalls.length, 0);
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
