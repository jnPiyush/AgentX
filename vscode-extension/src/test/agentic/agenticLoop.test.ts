import { strict as assert } from 'assert';
import {
  AgenticLoop,
  LlmAdapter,
  LlmResponse,
  SessionMessage,
  ToolRegistry,
} from '../../agentic';

class FakeToolThenTextAdapter implements LlmAdapter {
  async chat(messages: readonly SessionMessage[]): Promise<LlmResponse> {
    const hasToolResult = messages.some((m) => m.role === 'tool');
    if (!hasToolResult) {
      return {
        text: 'Checking workspace first',
        toolCalls: [
          { id: 'tc-1', name: 'list_dir', arguments: { dirPath: '.' } },
        ],
      };
    }

    return {
      text: 'Done after tool execution',
      toolCalls: [],
    };
  }
}

describe('AgenticLoop', () => {
  it('should execute tool cycle and return final text', async () => {
    const loop = new AgenticLoop(
      {
        agentName: 'engineer',
        systemPrompt: 'You are test loop.',
        maxIterations: 5,
      },
      new ToolRegistry(),
    );

    const ac = new AbortController();
    const summary = await loop.run('list files', new FakeToolThenTextAdapter(), ac.signal);

    assert.equal(summary.exitReason, 'text_response');
    assert.ok(summary.iterations >= 2, 'should take at least one tool round trip');
    assert.ok(summary.toolCallsExecuted >= 1, 'should execute at least one tool');
    assert.ok(summary.finalText.includes('Done'));
  });
});
