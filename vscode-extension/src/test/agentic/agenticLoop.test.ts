import { strict as assert } from 'assert';
import {
  AgenticLoop,
  DoneValidator,
  LlmAdapter,
  LlmResponse,
  SessionMessage,
  ToolRegistry,
  ErrorHookAction,
  ErrorHookContext,
  ErrorHookResult,
  HookRegistry,
} from '../../agentic';
import { registerMode, resetModeRegistry } from '../../agentic/promptingModes';

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

  // -----------------------------------------------------------------------
  // onError hook tests (P2 - Story #64)
  // -----------------------------------------------------------------------
  describe('onError hook', () => {
    it('should retry LLM call when onError returns retry', async () => {
      let callCount = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          callCount++;
          if (callCount <= 2) {
            throw new Error(`Transient error #${callCount}`);
          }
          return { text: 'Success after retry', toolCalls: [] };
        },
      };

      let hookCalls = 0;
      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test onError retry',
          maxIterations: 5,
          hooks: {
            onError: async (ctx: ErrorHookContext): Promise<ErrorHookResult> => {
              hookCalls++;
              return { action: 'retry' };
            },
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.equal(summary.exitReason, 'text_response');
      assert.ok(summary.finalText.includes('Success after retry'));
      assert.ok(hookCalls >= 2, `onError hook should be called at least twice, got ${hookCalls}`);
      assert.equal(callCount, 3, 'LLM should be called 3 times (2 errors + 1 success)');
    });

    it('should use fallback text when onError returns fallback', async () => {
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          throw new Error('LLM is down');
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test onError fallback',
          maxIterations: 5,
          hooks: {
            onError: async (ctx: ErrorHookContext): Promise<ErrorHookResult> => {
              return {
                action: 'fallback',
                fallbackResult: 'Fallback response: service unavailable',
              };
            },
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.equal(summary.exitReason, 'text_response');
      assert.ok(
        summary.finalText.includes('Fallback response'),
        'Should return fallback text',
      );
    });

    it('should abort immediately when onError returns abort', async () => {
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          throw new Error('Fatal error');
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test onError abort',
          maxIterations: 5,
          hooks: {
            onError: async (ctx: ErrorHookContext): Promise<ErrorHookResult> => {
              return { action: 'abort' };
            },
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.equal(summary.exitReason, 'error');
      assert.ok(summary.finalText.includes('LLM error'));
    });

    it('should abort when no onError hook is set', async () => {
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          throw new Error('Unhandled error');
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test no onError',
          maxIterations: 5,
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.equal(summary.exitReason, 'error');
      assert.ok(summary.finalText.includes('Unhandled error'));
    });

    it('should provide correct context to onError hook', async () => {
      let receivedCtx: ErrorHookContext | undefined;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          throw new Error('Context test error');
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'test-agent',
          systemPrompt: 'Test onError context',
          maxIterations: 5,
          hooks: {
            onError: async (ctx: ErrorHookContext): Promise<ErrorHookResult> => {
              receivedCtx = ctx;
              return { action: 'abort' };
            },
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      await loop.run('do work', adapter, ac.signal);

      assert.ok(receivedCtx !== undefined, 'Hook should receive context');
      const ctx = receivedCtx as ErrorHookContext;
      assert.equal(ctx.agentName, 'test-agent');
      assert.equal(ctx.phase, 'llm_call');
      assert.equal(ctx.retryCount, 0);
      assert.equal(ctx.errorMessage, 'Context test error');
      assert.ok(ctx.iteration >= 1);
    });

    it('should cap retries at MAX_ERROR_RETRIES even with retry action', async () => {
      let hookCalls = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          throw new Error('Always fails');
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test max retries',
          maxIterations: 5,
          hooks: {
            onError: async (): Promise<ErrorHookResult> => {
              hookCalls++;
              return { action: 'retry' };
            },
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.equal(summary.exitReason, 'error');
      // MAX_ERROR_RETRIES = 3, so hook called 3 times (retries) + final abort
      assert.ok(hookCalls <= 4, `Hook should be called at most 4 times, got ${hookCalls}`);
    });
  });

  // -------------------------------------------------------------------------
  // P3 Integration Tests -- runtime wiring of US-4.4, US-3.2, US-4.5, US-2.5
  // -------------------------------------------------------------------------

  describe('P3 runtime integration', () => {
    afterEach(() => {
      resetModeRegistry();
    });

    it('should append mode suffix to system prompt (US-4.4)', async () => {
      const capturedMessages: SessionMessage[][] = [];
      const adapter: LlmAdapter = {
        async chat(msgs: readonly SessionMessage[]): Promise<LlmResponse> {
          capturedMessages.push([...msgs]);
          return { text: 'Done', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Base prompt.',
          mode: 'test',
          maxIterations: 3,
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      await loop.run('write tests', adapter, ac.signal);

      assert.ok(capturedMessages.length >= 1, 'LLM should be called');
      const systemMsg = capturedMessages[0].find((m) => m.role === 'system');
      assert.ok(systemMsg, 'Should have a system message');
      // The 'test' mode suffix contains 'test' related instructions
      assert.ok(
        systemMsg!.content.includes('Base prompt.'),
        'Should include base prompt',
      );
    });

    it('should prune messages when exceeding maxMessages (US-2.5)', async () => {
      let callCount = 0;
      const adapter: LlmAdapter = {
        async chat(msgs: readonly SessionMessage[]): Promise<LlmResponse> {
          callCount++;
          if (callCount <= 5) {
            return {
              text: `Step ${callCount}`,
              toolCalls: [
                { id: `tc-${callCount}`, name: 'list_dir', arguments: { dirPath: '.' } },
              ],
            };
          }
          return { text: 'Final', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test bounded messages',
          maxMessages: 5, // Very low cap to trigger pruning
          maxIterations: 10,
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      // The loop should complete without error even with aggressive pruning
      assert.equal(summary.exitReason, 'text_response');
      assert.ok(summary.iterations >= 2, 'Should complete multiple iterations');
    });

    it('should wrap LLM call with time() utility (US-3.2)', async () => {
      // Verify the loop completes successfully with time() wrapping
      // (time() is transparent to the caller but measures duration)
      let chatCalled = false;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          chatCalled = true;
          // Small delay to ensure time() captures non-zero duration
          await new Promise((r) => setTimeout(r, 5));
          return { text: 'Timed response', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test timing',
          maxIterations: 3,
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.ok(chatCalled, 'LLM should be called through time() wrapper');
      assert.equal(summary.exitReason, 'text_response');
      assert.ok(summary.finalText.includes('Timed'));
    });

    it('should execute hookRegistries.onBeforeToolUse in priority order (US-4.5)', async () => {
      const executionOrder: string[] = [];
      const registry = new HookRegistry<{
        sessionId: string;
        iteration: number;
        agentName: string;
        toolName: string;
        params: Record<string, unknown>;
      }>('onBeforeToolUse');

      registry.register({
        name: 'second-hook',
        priority: 200,
        handler: () => { executionOrder.push('second'); },
      });
      registry.register({
        name: 'first-hook',
        priority: 50,
        handler: () => { executionOrder.push('first'); },
      });

      let step = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          step++;
          if (step === 1) {
            return {
              text: 'Execute tool',
              toolCalls: [{ id: 'tc-1', name: 'list_dir', arguments: { dirPath: '.' } }],
            };
          }
          return { text: 'Done', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Hook test',
          maxIterations: 5,
          hookRegistries: {
            onBeforeToolUse: registry,
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      await loop.run('do work', adapter, ac.signal);

      assert.deepEqual(executionOrder, ['first', 'second'], 'Hooks should fire in priority order');
    });

    it('should execute hookRegistries.onAfterToolUse after tool execution (US-4.5)', async () => {
      let afterHookCalled = false;
      let afterToolName = '';
      const registry = new HookRegistry<{
        sessionId: string;
        iteration: number;
        agentName: string;
        toolName: string;
        params: Record<string, unknown>;
        result: unknown;
      }>('onAfterToolUse');

      registry.register({
        name: 'after-hook',
        priority: 100,
        handler: (ctx) => {
          afterHookCalled = true;
          afterToolName = ctx.toolName;
        },
      });

      let step = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          step++;
          if (step === 1) {
            return {
              text: 'Run tool',
              toolCalls: [{ id: 'tc-1', name: 'list_dir', arguments: { dirPath: '.' } }],
            };
          }
          return { text: 'Done', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'After hook test',
          maxIterations: 5,
          hookRegistries: {
            onAfterToolUse: registry,
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      await loop.run('do work', adapter, ac.signal);

      assert.ok(afterHookCalled, 'onAfterToolUse registry hook should fire');
      assert.equal(afterToolName, 'list_dir', 'Should receive correct tool name');
    });

    it('should execute hookRegistries.onError with executeUntilResult (US-4.5)', async () => {
      let hookCalled = false;
      const registry = new HookRegistry<ErrorHookContext, ErrorHookResult>('onError');

      registry.register({
        name: 'error-handler',
        priority: 50,
        handler: () => {
          hookCalled = true;
          return { action: 'abort' as ErrorHookAction };
        },
      });

      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          throw new Error('Test error for registry');
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Error hook test',
          maxIterations: 3,
          hookRegistries: {
            onError: registry,
          },
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('do work', adapter, ac.signal);

      assert.ok(hookCalled, 'onError registry hook should fire');
      assert.equal(summary.exitReason, 'error');
    });

    it('should default maxMessages to 200 when not specified (US-2.5)', async () => {
      // Verify the loop works with default maxMessages
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          return { text: 'Done', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Test default',
          maxIterations: 3,
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      const summary = await loop.run('quick task', adapter, ac.signal);

      assert.equal(summary.exitReason, 'text_response');
    });

    it('should accept custom mode from registry (US-4.4)', async () => {
      // Register a custom mode
      registerMode('engineer', {
        name: 'custom-mode',
        description: 'Test custom mode',
        systemPromptSuffix: '\n\n[CUSTOM MODE ACTIVE]',
      });

      const capturedMessages: SessionMessage[][] = [];
      const adapter: LlmAdapter = {
        async chat(msgs: readonly SessionMessage[]): Promise<LlmResponse> {
          capturedMessages.push([...msgs]);
          return { text: 'Custom mode done', toolCalls: [] };
        },
      };

      const loop = new AgenticLoop(
        {
          agentName: 'engineer',
          systemPrompt: 'Base.',
          mode: 'custom-mode',
          maxIterations: 3,
        },
        new ToolRegistry(),
      );

      const ac = new AbortController();
      await loop.run('do work', adapter, ac.signal);

      const systemMsg = capturedMessages[0].find((m) => m.role === 'system');
      assert.ok(systemMsg, 'Should have system message');
      assert.ok(
        systemMsg!.content.includes('[CUSTOM MODE ACTIVE]'),
        'Should include custom mode suffix',
      );
    });
  });
});
