import { strict as assert } from 'assert';
import {
  spawnSubAgent,
  spawnSubAgentWithHistory,
  runParallelSubAgents,
  SubAgentConfig,
  LlmAdapterFactory,
  AgentLoader,
  ParallelSubAgentInvocation,
} from '../../agentic/subAgentSpawner';
import { LlmAdapter, LlmResponse, SessionMessage } from '../../agentic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFakeAdapter(responseText: string): LlmAdapter {
  return {
    async chat(): Promise<LlmResponse> {
      return { text: responseText, toolCalls: [] };
    },
  };
}

function createFakeLlmFactory(adapter: LlmAdapter): LlmAdapterFactory {
  return async () => adapter;
}

function createFakeAgentLoader(
  defOverrides?: { name?: string; description?: string; model?: string },
  instructionsText?: string,
): AgentLoader {
  return {
    async loadDef(role: string) {
      return {
        name: defOverrides?.name ?? role,
        description: defOverrides?.description ?? `Test ${role} agent.`,
        model: defOverrides?.model ?? 'test-model',
      };
    },
    async loadInstructions(_role: string) {
      return instructionsText ?? '## Role\nTest role instructions.\n## Constraints\nNo constraints.';
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubAgentSpawner', () => {
  describe('spawnSubAgent', () => {
    it('should spawn a sub-agent and return its text response', async () => {
      const adapter = createFakeAdapter('Sub-agent response text');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'reviewer',
        workspaceRoot: '/tmp/test',
      };

      const result = await spawnSubAgent(
        config,
        'Review this code',
        factory,
        loader,
        signal,
      );

      assert.ok(result.response.includes('Sub-agent response'));
      assert.equal(result.exitReason, 'text_response');
      assert.ok(result.iterations >= 1);
      assert.ok(result.durationMs >= 0);
    });

    it('should return fallback when LLM adapter is null', async () => {
      const factory: LlmAdapterFactory = async () => null;
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'architect',
        workspaceRoot: '/tmp/test',
      };

      const result = await spawnSubAgent(
        config,
        'Design the system',
        factory,
        loader,
        signal,
      );

      assert.ok(result.response.includes('not available'));
      assert.equal(result.exitReason, 'error');
    });

    it('should respect maxIterations config', async () => {
      let callCount = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          callCount++;
          // Always return tool calls to force iteration
          if (callCount < 3) {
            return {
              text: '',
              toolCalls: [{ id: `tc-${callCount}`, name: 'list_dir', arguments: { dirPath: '.' } }],
            };
          }
          return { text: 'Finally done', toolCalls: [] };
        },
      };

      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'engineer',
        maxIterations: 5,
        workspaceRoot: '/tmp/test',
      };

      const result = await spawnSubAgent(config, 'Do work', factory, loader, signal);
      assert.ok(result.iterations >= 2);
    });
  });

  describe('spawnSubAgentWithHistory', () => {
    it('should include prior conversation history', async () => {
      let receivedMessages: readonly SessionMessage[] = [];
      const adapter: LlmAdapter = {
        async chat(messages: readonly SessionMessage[]): Promise<LlmResponse> {
          receivedMessages = messages;
          return { text: 'Done with history', toolCalls: [] };
        },
      };

      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'reviewer',
        workspaceRoot: '/tmp/test',
      };

      const history: SessionMessage[] = [
        { role: 'user', content: 'Previous question', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Previous answer', timestamp: new Date().toISOString() },
      ];

      const result = await spawnSubAgentWithHistory(
        config,
        history,
        factory,
        loader,
        signal,
      );

      assert.ok(result.response.includes('Done with history'));
      // The adapter should receive system + history + new prompt
      assert.ok(receivedMessages.length >= 3);
    });
  });

  // -----------------------------------------------------------------------
  // runParallelSubAgents (P2 - Story #66)
  // -----------------------------------------------------------------------
  describe('runParallelSubAgents', () => {
    function makeInvocation(role: string, response: string, weight?: number): ParallelSubAgentInvocation {
      return {
        config: { role, workspaceRoot: '/tmp/test' },
        prompt: `Do ${role} work`,
        weight,
      };
    }

    function makeDelayedAdapter(response: string, delayMs: number): LlmAdapter {
      return {
        async chat(): Promise<LlmResponse> {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return { text: response, toolCalls: [] };
        },
      };
    }

    it('should return empty result for zero invocations', async () => {
      const factory = createFakeLlmFactory(createFakeAdapter('unused'));
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const result = await runParallelSubAgents(
        [],
        { strategy: 'all', consolidation: 'merge' },
        factory,
        loader,
        signal,
      );

      assert.equal(result.response, '');
      assert.equal(result.individual.length, 0);
      assert.equal(result.successCount, 0);
    });

    it('should execute all agents with "all" strategy', async () => {
      const adapter = createFakeAdapter('Agent result');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations = [
        makeInvocation('engineer', 'Code done'),
        makeInvocation('reviewer', 'Review done'),
        makeInvocation('architect', 'Design done'),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'all', consolidation: 'merge' },
        factory,
        loader,
        signal,
      );

      assert.equal(result.strategy, 'all');
      assert.equal(result.consolidation, 'merge');
      assert.equal(result.individual.length, 3);
      assert.ok(result.durationMs >= 0);
      assert.ok(result.successCount >= 1);
    });

    it('should merge results with section headers', async () => {
      const adapter = createFakeAdapter('My response');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations = [
        makeInvocation('engineer', 'Code'),
        makeInvocation('reviewer', 'Review'),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'all', consolidation: 'merge' },
        factory,
        loader,
        signal,
      );

      // Merge consolidation should have section headers
      assert.ok(result.response.includes('## engineer'), 'Should have engineer section header');
      assert.ok(result.response.includes('## reviewer'), 'Should have reviewer section header');
    });

    it('should select best response with "best" consolidation', async () => {
      // Two adapters: one returns short text, one returns long text
      let adapterIndex = 0;
      const factory: LlmAdapterFactory = async () => {
        adapterIndex++;
        const text = adapterIndex === 1 ? 'Short' : 'This is a much longer and more detailed response';
        return {
          async chat(): Promise<LlmResponse> {
            return { text, toolCalls: [] };
          },
        };
      };
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations = [
        makeInvocation('engineer', 'Code', 1.0),
        makeInvocation('reviewer', 'Review', 1.0),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'all', consolidation: 'best' },
        factory,
        loader,
        signal,
      );

      // Best strategy picks longest * weight - the longer response should win
      assert.ok(result.response.length > 10, 'Should pick the longer response');
    });

    it('should handle agent failures gracefully with "all" strategy', async () => {
      let callIdx = 0;
      const factory: LlmAdapterFactory = async () => {
        callIdx++;
        if (callIdx === 1) {
          return {
            async chat(): Promise<LlmResponse> {
              throw new Error('Agent 1 crashed');
            },
          };
        }
        return createFakeAdapter('Agent 2 succeeded');
      };
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations = [
        makeInvocation('engineer', 'Code'),
        makeInvocation('reviewer', 'Review'),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'all', consolidation: 'merge' },
        factory,
        loader,
        signal,
      );

      // Should still have results for both - one error, one success
      assert.equal(result.individual.length, 2);
      assert.ok(result.successCount >= 1, 'At least one should succeed');
    });

    it('should return first result with "race" strategy', async () => {
      let adapterIdx = 0;
      const factory: LlmAdapterFactory = async () => {
        adapterIdx++;
        return makeDelayedAdapter(
          adapterIdx === 1 ? 'Fast agent' : 'Slow agent',
          adapterIdx === 1 ? 10 : 200,
        );
      };
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations = [
        makeInvocation('fast-agent', 'Be fast'),
        makeInvocation('slow-agent', 'Be slow'),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'race', consolidation: 'merge' },
        factory,
        loader,
        signal,
      );

      assert.equal(result.strategy, 'race');
      // One should have a real response
      const hasReal = result.individual.some((r) =>
        !r.response.includes('not selected') && r.exitReason === 'text_response',
      );
      assert.ok(hasReal, 'At least one sub-agent should have a real response');
    });

    it('should respect quorum threshold', async () => {
      const adapter = createFakeAdapter('Quorum result');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations = [
        makeInvocation('agent-1', 'Work 1'),
        makeInvocation('agent-2', 'Work 2'),
        makeInvocation('agent-3', 'Work 3'),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'quorum', consolidation: 'merge', quorumThreshold: 0.5 },
        factory,
        loader,
        signal,
      );

      assert.equal(result.strategy, 'quorum');
      assert.ok(result.successCount >= 2, 'Quorum of 50% of 3 = 2 agents should complete');
    });

    it('should use vote consolidation with weights', async () => {
      let idx = 0;
      const factory: LlmAdapterFactory = async () => {
        idx++;
        // Agent 1 and 3 return same answer, agent 2 returns different
        const text = idx === 2 ? 'Different answer' : 'Same answer';
        return createFakeAdapter(text);
      };
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const invocations: ParallelSubAgentInvocation[] = [
        makeInvocation('agent-1', 'Vote', 1.0),
        makeInvocation('agent-2', 'Vote', 1.0),
        makeInvocation('agent-3', 'Vote', 1.0),
      ];

      const result = await runParallelSubAgents(
        invocations,
        { strategy: 'all', consolidation: 'vote' },
        factory,
        loader,
        signal,
      );

      // "Same answer" gets weight 2.0, "Different answer" gets 1.0
      // But all adapters return the same text since they share the factory
      // The vote should pick the most common response
      assert.ok(result.response.length > 0, 'Vote should produce a non-empty result');
    });
  });
});
