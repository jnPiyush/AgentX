import { strict as assert } from 'assert';
import {
  AgenticLoop,
  DoneValidator,
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

  it('should re-enter loop when done-validation fails', async () => {
    let callCount = 0;

    // Adapter returns text on every call
    const adapter: LlmAdapter = {
      async chat(): Promise<LlmResponse> {
        callCount++;
        return { text: `Attempt ${callCount}`, toolCalls: [] };
      },
    };

    let validationCalls = 0;
    const validator: DoneValidator = {
      async validate() {
        validationCalls++;
        // Fail the first 2 times, pass on 3rd
        if (validationCalls < 3) {
          return { passed: false, feedback: `Fix issue #${validationCalls}` };
        }
        return { passed: true };
      },
    };

    const loop = new AgenticLoop(
      {
        agentName: 'engineer',
        systemPrompt: 'Test',
        maxIterations: 10,
        doneValidator: validator,
      },
      new ToolRegistry(),
    );

    const ac = new AbortController();
    const summary = await loop.run('do work', adapter, ac.signal);

    assert.equal(summary.exitReason, 'text_response');
    assert.equal(validationCalls, 3, 'validator should be called 3 times');
    assert.ok(summary.iterations >= 3, 'should iterate at least 3 times for validation retries');
    assert.ok(summary.finalText.includes('Attempt 3'));
  });

  it('should cap validation retries at MAX_VALIDATION_RETRIES', async () => {
    const adapter: LlmAdapter = {
      async chat(): Promise<LlmResponse> {
        return { text: 'Still not done', toolCalls: [] };
      },
    };

    let validationCalls = 0;
    const validator: DoneValidator = {
      async validate() {
        validationCalls++;
        return { passed: false, feedback: 'Still broken' };
      },
    };

    const loop = new AgenticLoop(
      {
        agentName: 'engineer',
        systemPrompt: 'Test',
        maxIterations: 20,
        doneValidator: validator,
      },
      new ToolRegistry(),
    );

    const ac = new AbortController();
    const summary = await loop.run('do work', adapter, ac.signal);

    // MAX_VALIDATION_RETRIES = 3, so validator called max 3 times, then loop accepts result
    assert.equal(summary.exitReason, 'text_response');
    assert.ok(validationCalls <= 4, 'should not exceed max validation retries');
  });

  it('should resume a session and continue the loop', async () => {
    let callCount = 0;
    const adapter: LlmAdapter = {
      async chat(): Promise<LlmResponse> {
        callCount++;
        if (callCount === 1) {
          return { text: 'First run done', toolCalls: [] };
        }
        return { text: 'Resumed and done', toolCalls: [] };
      },
    };

    const loop = new AgenticLoop(
      { agentName: 'engineer', systemPrompt: 'Test', maxIterations: 5 },
      new ToolRegistry(),
    );

    const ac = new AbortController();
    const first = await loop.run('start work', adapter, ac.signal);
    assert.equal(first.exitReason, 'text_response');

    const second = await loop.resume(first.sessionId, 'continue', adapter, ac.signal);
    assert.equal(second.exitReason, 'text_response');
    assert.ok(second.finalText.includes('Resumed'));
  });

  it('should call onValidation progress callback', async () => {
    const adapter: LlmAdapter = {
      async chat(): Promise<LlmResponse> {
        return { text: 'Done', toolCalls: [] };
      },
    };

    let validationCallbackCalled = false;
    const validator: DoneValidator = {
      async validate() {
        return { passed: true };
      },
    };

    const loop = new AgenticLoop(
      { agentName: 'engineer', systemPrompt: 'Test', maxIterations: 5, doneValidator: validator },
      new ToolRegistry(),
    );

    const ac = new AbortController();
    await loop.run('do work', adapter, ac.signal, {
      onValidation: (passed) => {
        validationCallbackCalled = true;
        assert.equal(passed, true);
      },
    });

    assert.ok(validationCallbackCalled, 'onValidation callback should be invoked');
  });

  it('should run internal hooks for tool and clarification lifecycle', async () => {
    let step = 0;
    const adapter: LlmAdapter = {
      async chat(_messages: readonly SessionMessage[]): Promise<LlmResponse> {
        step++;
        if (step === 1) {
          return {
            text: 'Need architecture input',
            toolCalls: [
              {
                id: 'tc-hook-1',
                name: 'request_clarification',
                arguments: {
                  targetAgent: 'architect',
                  topic: 'schema',
                  question: 'Should we use completedAt?',
                },
              },
            ],
          };
        }
        return { text: 'Done with clarification', toolCalls: [] };
      },
    };

    let beforeToolCalled = false;
    let afterToolCalled = false;
    let beforeClarificationCalled = false;
    let afterClarificationCalled = false;
    let patchedQuestionSeen = false;

    const loop = new AgenticLoop(
      {
        agentName: 'engineer',
        systemPrompt: 'Test hook loop',
        maxIterations: 6,
        canClarify: ['architect'],
        onClarificationNeeded: async (_topic, question) => {
          patchedQuestionSeen = question.includes('[hooked]');
          return {
            clarificationId: 'CLR-1',
            answer: 'Use completedAt.',
            status: 'answered',
            round: 1,
          };
        },
        hooks: {
          onBeforeToolUse: async () => {
            beforeToolCalled = true;
          },
          onAfterToolUse: async () => {
            afterToolCalled = true;
          },
          onBeforeClarification: async ({ question }) => {
            beforeClarificationCalled = true;
            return { question: `${question} [hooked]` };
          },
          onAfterClarification: async ({ answer }) => {
            afterClarificationCalled = answer.includes('completedAt');
          },
        },
      },
      new ToolRegistry(),
    );

    const ac = new AbortController();
    const summary = await loop.run('do work', adapter, ac.signal);

    assert.equal(summary.exitReason, 'text_response');
    assert.ok(beforeToolCalled, 'onBeforeToolUse should be called');
    assert.ok(afterToolCalled, 'onAfterToolUse should be called');
    assert.ok(beforeClarificationCalled, 'onBeforeClarification should be called');
    assert.ok(afterClarificationCalled, 'onAfterClarification should be called');
    assert.ok(patchedQuestionSeen, 'patched clarification question should reach callback');
  });
});
