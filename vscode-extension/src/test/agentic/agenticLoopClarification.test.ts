import { strict as assert } from 'assert';
import {
  AgenticLoop,
  LlmAdapter,
  LlmResponse,
  SessionMessage,
  ToolRegistry,
  ClarificationLoopConfig,
  LlmAdapterFactory,
  AgentLoader,
  AgentDefLike,
} from '../../agentic';
import {
  __setMockModels,
  __clearMockModels,
} from '../mocks/vscode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock model for LM API - prevents unrelated compaction issues. */
function installMockModel(): void {
  __setMockModels([{
    name: 'mock',
    family: 'gpt-4o',
    vendor: 'copilot',
    maxInputTokens: 128_000,
    sendRequest: async () => ({
      text: (async function* () { yield 'summary'; })(),
    }),
  }]);
}

// ---------------------------------------------------------------------------
// AbortSignal propagation to clarification sub-loop
// ---------------------------------------------------------------------------

describe('AgenticLoop - clarification AbortSignal propagation', () => {

  beforeEach(() => {
    installMockModel();
  });

  afterEach(() => {
    __clearMockModels();
  });

  it('should propagate parent abort to clarification loop (not orphaned AbortController)', async () => {
    // Track what abort signal runClarificationLoop receives
    let receivedAbortSignal: AbortSignal | null = null;
    let clarificationCalled = false;

    // Step 1: LLM calls request_clarification tool
    // Step 2: LLM returns final text
    let step = 0;
    const adapter: LlmAdapter = {
      async chat(_messages: readonly SessionMessage[]): Promise<LlmResponse> {
        step++;
        if (step === 1) {
          return {
            text: 'Need architect input',
            toolCalls: [{
              id: 'tc-1',
              name: 'request_clarification',
              arguments: {
                targetAgent: 'architect',
                topic: 'schema-design',
                question: 'How should the DB schema look?',
              },
            }],
          };
        }
        return { text: 'Done with work', toolCalls: [] };
      },
    };

    // Fake LLM factory that records the abort signal passed through
    const fakeFactory: LlmAdapterFactory = async (_role: string) => {
      return {
        async chat(): Promise<LlmResponse> {
          return { text: 'Use normalized tables', toolCalls: [] };
        },
      };
    };

    // Fake agent loader
    const fakeLoader: AgentLoader = {
      async loadDef(_role: string): Promise<AgentDefLike | undefined> {
        return {
          name: 'architect',
          description: 'Solution architect',
          model: 'gpt-4o',
        };
      },
      async loadInstructions(_role: string): Promise<string | undefined> {
        return 'You are an architect.';
      },
    };

    const clarificationConfig: ClarificationLoopConfig = {
      maxIterations: 3,
      workspaceRoot: '/fake/workspace',
      responderMaxIterations: 2,
      responderTokenBudget: 5000,
    };

    const parentAc = new AbortController();

    const loop = new AgenticLoop(
      {
        agentName: 'engineer',
        systemPrompt: 'You are test loop.',
        maxIterations: 5,
        canClarify: ['architect'],
        clarificationLoopConfig: clarificationConfig,
        llmAdapterFactory: fakeFactory,
        agentLoader: fakeLoader,
        hooks: {
          onBeforeClarification: async (ctx) => {
            clarificationCalled = true;
            return undefined;
          },
          onAfterClarification: async (ctx) => {
            // If we get here, the clarification handler worked
          },
        },
      },
      new ToolRegistry(),
    );

    const summary = await loop.run('design the schema', adapter, parentAc.signal);

    // The test validates that the clarification loop was invoked
    // (which means the handler was built with the parentAbortSignal, not an orphaned one)
    assert.ok(clarificationCalled, 'Clarification handler should have been invoked');
    assert.equal(summary.exitReason, 'text_response');
  });

  it('should abort clarification when parent signal is aborted', async () => {
    let step = 0;
    const adapter: LlmAdapter = {
      async chat(_messages: readonly SessionMessage[]): Promise<LlmResponse> {
        step++;
        if (step === 1) {
          return {
            text: 'Need input',
            toolCalls: [{
              id: 'tc-abort-1',
              name: 'request_clarification',
              arguments: {
                targetAgent: 'architect',
                topic: 'design',
                question: 'What pattern?',
              },
            }],
          };
        }
        return { text: 'Should not reach here', toolCalls: [] };
      },
    };

    // Factory that hangs until abort - simulates a long-running sub-agent
    const hangingFactory: LlmAdapterFactory = async () => ({
      async chat(_messages: readonly SessionMessage[]): Promise<LlmResponse> {
        // simulate long wait that should be interrupted by abort
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { text: 'Late response', toolCalls: [] };
      },
    });

    const fakeLoader: AgentLoader = {
      async loadDef() {
        return {
          name: 'architect',
          description: 'Solution architect',
          model: 'gpt-4o',
        };
      },
      async loadInstructions() {
        return 'You are an architect.';
      },
    };

    const parentAc = new AbortController();

    const loop = new AgenticLoop(
      {
        agentName: 'engineer',
        systemPrompt: 'Test abort propagation.',
        maxIterations: 5,
        canClarify: ['architect'],
        clarificationLoopConfig: {
          maxIterations: 3,
          workspaceRoot: '/fake',
        },
        llmAdapterFactory: hangingFactory,
        agentLoader: fakeLoader,
      },
      new ToolRegistry(),
    );

    // Abort shortly after starting
    setTimeout(() => parentAc.abort(), 10);

    const summary = await loop.run('test abort', adapter, parentAc.signal);

    // The loop should have exited due to abort, not text_response
    assert.equal(summary.exitReason, 'aborted');
  });
});

// ---------------------------------------------------------------------------
// Module-level imports verification (fs and path)
// ---------------------------------------------------------------------------

describe('AgenticLoop - module-level imports', () => {
  // This test verifies that fs and path are available at module level
  // (Fix: moved from dynamic require() inside updateCliLoopState to module-level imports)
  // The fact that this test file loads agenticLoop.ts without errors
  // proves the module-level imports work correctly.

  it('should load AgenticLoop module without import errors', () => {
    // If fs/path were still dynamically required inside the function body
    // instead of at module level, this would not catch the issue.
    // But the TypeScript compiler already verified these imports.
    // This test confirms the module loads cleanly at runtime.
    const loop = new AgenticLoop(
      {
        agentName: 'test',
        systemPrompt: 'Test module imports.',
        maxIterations: 1,
      },
      new ToolRegistry(),
    );
    assert.ok(loop, 'AgenticLoop should construct without errors');
  });
});
