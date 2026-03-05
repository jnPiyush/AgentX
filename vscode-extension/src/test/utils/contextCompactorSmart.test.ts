import { strict as assert } from 'assert';
import {
  manageMessagesSmartly,
  compactConversationWithVSCodeLM,
  SmartMessageConfig,
} from '../../utils/contextCompactor';
import { AgentEventBus } from '../../utils/eventBus';
import {
  __setMockModels,
  __clearMockModels,
  MockLanguageModelChat,
} from '../mocks/vscode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate N user/assistant message pairs. */
function generateMessages(
  count: number,
  contentSize = 40,
): Array<{ role: string; content: string }> {
  const msgs: Array<{ role: string; content: string }> = [];
  for (let i = 1; i <= count; i++) {
    msgs.push({ role: 'user', content: `U${i} ${'x'.repeat(contentSize)}` });
    msgs.push({ role: 'assistant', content: `A${i} ${'y'.repeat(contentSize)}` });
  }
  return msgs;
}

/** Create a mock LM model that returns a canned summary. */
function createMockModel(summary: string): MockLanguageModelChat {
  return {
    name: 'mock-model',
    family: 'gpt-4o',
    vendor: 'copilot',
    maxInputTokens: 128_000,
    sendRequest: async () => ({
      text: (async function* () {
        yield summary;
      })(),
    }),
  };
}

// ---------------------------------------------------------------------------
// manageMessagesSmartly
// ---------------------------------------------------------------------------

describe('manageMessagesSmartly', () => {
  let bus: AgentEventBus;

  beforeEach(() => {
    bus = new AgentEventBus();
    // Default: no LM models available (forces rule-based fallback path)
    __clearMockModels();
  });

  afterEach(() => {
    bus.dispose();
    __clearMockModels();
  });

  // ------ No processing needed ------

  it('should return messages unchanged when under threshold and count', async () => {
    const messages = generateMessages(5); // 10 messages, small tokens
    const config: SmartMessageConfig = {
      tokenBudget: 100_000,
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    const result = await manageMessagesSmartly(messages, config, bus, 'test');

    assert.equal(result.didCompact, false);
    assert.equal(result.didPrune, false);
    assert.equal(result.messages.length, 10);
    assert.equal(result.tokensBeforeProcessing, result.tokensAfterProcessing);
  });

  // ------ Compaction at exact interval ------

  it('should trigger compaction at exact 59-message interval when over threshold', async () => {
    // 59 messages with enough tokens to exceed 70% of a small budget
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 59; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'a'.repeat(200) });
    }
    // 59 * 200 = 11800 chars -> ~2950 tokens. Budget 3000 -> 70% = 2100. 2950 > 2100.
    const config: SmartMessageConfig = {
      tokenBudget: 3000,
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    // Set up mock model for compaction
    __setMockModels([createMockModel('Compacted summary')]);

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, true);
    assert.equal(result.didPrune, false);
    assert.ok(result.tokensAfterProcessing <= result.tokensBeforeProcessing);
  });

  // ------ FIX VALIDATION: Compaction between intervals when over threshold ------

  it('should trigger compaction at non-interval count when over threshold (modulo fix)', async () => {
    // 65 messages (NOT a multiple of 59, but > 59) with high token usage
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 65; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'a'.repeat(200) });
    }
    // 65 * 200 = 13000 chars -> ~3250 tokens. Budget 3000 -> 70% = 2100. 3250 > 2100.
    // Before fix: 65 % 59 !== 0 -> would NOT compact despite being over threshold
    // After fix: needsCompaction && messages.length >= checkInterval -> DOES compact
    const config: SmartMessageConfig = {
      tokenBudget: 3000,
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    __setMockModels([createMockModel('Compacted summary for non-interval')]);

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, true, 'Should compact even at non-interval count when over threshold');
    assert.equal(result.didPrune, false);
  });

  // ------ No compaction when under threshold at interval ------

  it('should NOT compact at interval when under threshold', async () => {
    // 59 messages but very small tokens
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 59; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'hi' });
    }
    // 59 * 2 = 118 chars -> ~30 tokens. Budget 100000 -> 70% = 70000. 30 < 70000.
    const config: SmartMessageConfig = {
      tokenBudget: 100_000,
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, false);
    assert.equal(result.didPrune, false);
    assert.equal(result.messages.length, 59);
  });

  // ------ FIX VALIDATION: Pruning at DEFAULT_MAX_MESSAGES (100, not hardcoded) ------

  it('should prune when messages exceed DEFAULT_MAX_MESSAGES (100) but under threshold', async () => {
    // 101 messages, small tokens -> should trigger pruning branch
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 101; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'short' });
    }
    const config: SmartMessageConfig = {
      tokenBudget: 1_000_000, // Very high so threshold is never hit
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, false);
    assert.equal(result.didPrune, true, 'Should prune when over 100 messages');
    assert.ok(result.prunedCount! > 0, 'Should have pruned at least 1 message');
  });

  it('should NOT prune when messages are exactly at 100', async () => {
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 100; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'short' });
    }
    const config: SmartMessageConfig = {
      tokenBudget: 1_000_000,
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, false);
    assert.equal(result.didPrune, false, 'Should not prune at exactly 100');
  });

  // ------ FIX VALIDATION: Default threshold uses 0.7 (not old 0.4) ------

  it('should use default threshold of 0.7 when not specified', async () => {
    // Messages with tokens at 50% of budget -> should NOT compact
    // (old 0.4 threshold would have compacted at 50%)
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 59; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'a'.repeat(40) });
    }
    // 59 * 40 = 2360 chars -> ~590 tokens. Budget 1000 -> 70% = 700. 590 < 700.
    // But if threshold were 0.4: 40% = 400. 590 > 400 -> would compact.
    const config: SmartMessageConfig = {
      tokenBudget: 1000,
      // compactionThreshold not specified -> defaults to 0.7
    };

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, false, 'Should NOT compact at 59% with 0.7 threshold');
  });

  // ------ Compaction below interval but under checkInterval count ------

  it('should NOT compact when under checkInterval count even if over threshold', async () => {
    // 30 messages (below 59) with high tokens
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 30; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'a'.repeat(200) });
    }
    // 30 * 200 = 6000 chars -> ~1500 tokens. Budget 1000 -> 70% = 700. 1500 > 700.
    // BUT messages.length (30) < checkInterval (59) -> should NOT compact
    const config: SmartMessageConfig = {
      tokenBudget: 1000,
      checkInterval: 59,
      compactionThreshold: 0.7,
    };

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, false, 'Should not compact when under checkInterval count');
    assert.equal(result.didPrune, false);
  });

  // ------ Result metadata ------

  it('should return correct token estimates in result', async () => {
    const msgs = [
      { role: 'user', content: 'a'.repeat(400) }, // 100 tokens
      { role: 'assistant', content: 'b'.repeat(400) }, // 100 tokens
    ];
    const config: SmartMessageConfig = {
      tokenBudget: 100_000,
    };

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    // 800 chars + 1 newline = 801 chars -> ceil(801/4) = 201
    assert.ok(result.tokensBeforeProcessing > 0);
    assert.equal(result.tokensBeforeProcessing, result.tokensAfterProcessing);
  });

  // ------ Custom check interval ------

  it('should respect custom checkInterval', async () => {
    // 10 messages at interval of 10 with high tokens -> should compact
    const msgs: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 10; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'a'.repeat(200) });
    }
    // 10 * 200 = 2000 chars -> ~500 tokens. Budget 500 -> 70% = 350. 500 > 350.
    const config: SmartMessageConfig = {
      tokenBudget: 500,
      checkInterval: 10,
      compactionThreshold: 0.7,
    };

    __setMockModels([createMockModel('Custom interval compaction')]);

    const result = await manageMessagesSmartly(msgs, config, bus, 'test');

    assert.equal(result.didCompact, true, 'Should compact at custom interval');
  });
});

// ---------------------------------------------------------------------------
// compactConversationWithVSCodeLM
// ---------------------------------------------------------------------------

describe('compactConversationWithVSCodeLM', () => {

  afterEach(() => {
    __clearMockModels();
  });

  it('should use AI compaction when models are available', async () => {
    __setMockModels([createMockModel('AI-powered summary of the conversation')]);

    const messages = [
      { role: 'user', content: 'Help me build a REST API' },
      { role: 'assistant', content: 'I will create an Express server' },
      { role: 'user', content: 'Add authentication with JWT' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'Engineer');

    assert.ok(result.includes('AI-Powered Context Compaction'));
    assert.ok(result.includes('Engineer'));
    assert.ok(result.includes('AI-powered summary of the conversation'));
  });

  it('should fall back to rule-based compaction when no models available', async () => {
    __clearMockModels(); // No models

    const messages = [
      { role: 'user', content: 'I decided to use PostgreSQL for the database' },
      { role: 'assistant', content: 'created file src/db.ts with connection pool' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'Architect');

    assert.ok(result.includes('Rule-Based Context Compaction Summary'));
  });

  // ------ FIX VALIDATION: Broader model selector with fallback chain ------

  it('should try vendor-only selector first, then empty selector', async () => {
    // Model with non-copilot vendor should be found by empty selector fallback
    const customModel: MockLanguageModelChat = {
      name: 'custom-model',
      family: 'claude',
      vendor: 'anthropic',
      maxInputTokens: 200_000,
      sendRequest: async () => ({
        text: (async function* () {
          yield 'Custom model summary';
        })(),
      }),
    };
    __setMockModels([customModel]);

    const messages = [
      { role: 'user', content: 'Test message' },
      { role: 'assistant', content: 'Test reply' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    // The vendor-only selector ({ vendor: 'copilot' }) won't match 'anthropic',
    // but the empty selector ({}) will find it
    assert.ok(result.includes('AI-Powered Context Compaction'));
    assert.ok(result.includes('Custom model summary'));
  });

  it('should handle model sendRequest errors with fallback', async () => {
    const errorModel: MockLanguageModelChat = {
      name: 'error-model',
      family: 'gpt-4o',
      vendor: 'copilot',
      maxInputTokens: 128_000,
      sendRequest: async () => {
        throw new Error('Model unavailable');
      },
    };
    __setMockModels([errorModel]);

    const messages = [
      { role: 'user', content: 'decided to use React for frontend' },
      { role: 'assistant', content: 'created file src/App.tsx' },
    ];

    // Should fall back to rule-based compaction on error
    const result = await compactConversationWithVSCodeLM(messages, 'test');

    assert.ok(result.includes('Rule-Based Context Compaction Summary'));
  });

  it('should include metadata in AI compaction result', async () => {
    __setMockModels([createMockModel('Detailed summary')]);

    const messages = [
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Reply 1' },
      { role: 'user', content: 'Message 2' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'TestAgent');

    assert.ok(result.includes('**Agent**: TestAgent'));
    assert.ok(result.includes('**Messages**: 3'));
    assert.ok(result.includes('**Tokens**'));
    assert.ok(result.includes("VS Code's Language Model API"));
  });
});

// ---------------------------------------------------------------------------
// performRuleBasedCompaction (tested indirectly via compactConversationWithVSCodeLM fallback)
// ---------------------------------------------------------------------------

describe('performRuleBasedCompaction (via LM fallback)', () => {

  beforeEach(() => {
    __clearMockModels(); // Force rule-based path
  });

  it('should extract decision patterns', async () => {
    const messages = [
      { role: 'user', content: 'We need a database solution.' },
      { role: 'assistant', content: 'I decided to use PostgreSQL for reliability.' },
      { role: 'user', content: 'Good. What about the cache?' },
      { role: 'assistant', content: 'I chose Redis for the caching layer.' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    assert.ok(result.includes('Decisions'), 'Should have Decisions section');
    assert.ok(result.includes('decided to use PostgreSQL'));
  });

  it('should extract code change patterns', async () => {
    const messages = [
      { role: 'assistant', content: 'I created file src/auth.ts with JWT middleware' },
      { role: 'assistant', content: 'modified file src/server.ts to add routes' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    assert.ok(result.includes('Code Changes'), 'Should have Code Changes section');
    assert.ok(result.includes('created file src/auth.ts'));
  });

  it('should extract error patterns', async () => {
    const messages = [
      { role: 'assistant', content: 'Error: Cannot find module jsonwebtoken' },
      { role: 'user', content: 'It failed with a timeout on the API call' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    assert.ok(result.includes('Errors Encountered'), 'Should have Errors section');
  });

  it('should extract key facts', async () => {
    const messages = [
      { role: 'user', content: 'Important: The API must support rate limiting at 100 req/s' },
      { role: 'assistant', content: 'Note: We should use helmet for security headers' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    assert.ok(result.includes('Key Facts'), 'Should have Key Facts section');
  });

  it('should include message count and token estimate in summary', async () => {
    const messages = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Second message' },
      { role: 'user', content: 'Third message' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    assert.ok(result.includes('Compacted from 3 messages'));
  });

  it('should handle messages with no extractable patterns gracefully', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];

    const result = await compactConversationWithVSCodeLM(messages, 'test');

    // Should still produce a valid summary even without extractable patterns
    assert.ok(result.includes('Rule-Based Context Compaction Summary'));
    assert.ok(result.includes('Compacted from 2 messages'));
  });
});
