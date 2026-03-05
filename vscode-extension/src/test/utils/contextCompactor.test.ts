import { strict as assert } from 'assert';
import {
  estimateTokens,
  ContextCompactor,
  pruneMessages,
  BoundedMessageConfig,
  PruneResult,
} from '../../utils/contextCompactor';
import { AgentEventBus } from '../../utils/eventBus';

describe('contextCompactor - estimateTokens', () => {

  it('should estimate roughly 1 token per 4 characters', () => {
    const text = 'a'.repeat(400);
    assert.equal(estimateTokens(text), 100);
  });

  it('should return 0 for empty string', () => {
    assert.equal(estimateTokens(''), 0);
  });

  it('should round up', () => {
    assert.equal(estimateTokens('abc'), 1); // 3/4 = 0.75, ceil = 1
  });
});

describe('ContextCompactor', () => {

  let compactor: ContextCompactor;
  let bus: AgentEventBus;

  beforeEach(() => {
    bus = new AgentEventBus();
    compactor = new ContextCompactor(bus, 10_000, 0.75);
  });

  afterEach(() => {
    bus.dispose();
  });

  it('should track items and report budget', () => {
    compactor.trackItem('skill', 'testing', 'a'.repeat(4000)); // ~1000 tokens
    compactor.trackItem('instruction', 'typescript', 'b'.repeat(2000)); // ~500 tokens

    const status = compactor.checkBudget();
    assert.equal(status.items.length, 2);
    assert.equal(status.totalTokens, 1500);
    assert.equal(status.limit, 10_000);
    assert.equal(status.utilizationPercent, 15);
    assert.equal(status.needsCompaction, false);
  });

  it('should detect when compaction is needed', () => {
    compactor.trackItem('conversation', 'chat', 'x'.repeat(32_000)); // ~8000 tokens = 80%

    const status = compactor.checkBudget();
    assert.equal(status.needsCompaction, true);
    assert.ok(status.recommendation.includes('WARNING'));
  });

  it('should detect critical utilization at 90%+', () => {
    compactor.trackItem('conversation', 'chat', 'x'.repeat(36_800)); // ~9200 tokens = 92%

    const status = compactor.checkBudget();
    assert.ok(status.recommendation.includes('CRITICAL'));
  });

  it('should untrack items', () => {
    compactor.trackItem('skill', 'testing', 'a'.repeat(400));
    assert.equal(compactor.checkBudget().items.length, 1);

    compactor.untrackItem('testing');
    assert.equal(compactor.checkBudget().items.length, 0);
  });

  it('should reset all tracked items', () => {
    compactor.trackItem('skill', 'a', 'x');
    compactor.trackItem('skill', 'b', 'x');
    compactor.reset();

    assert.equal(compactor.checkBudget().items.length, 0);
  });

  it('should return usage by category', () => {
    compactor.trackItem('skill', 's1', 'a'.repeat(400)); // 100 tokens
    compactor.trackItem('instruction', 'i1', 'b'.repeat(800)); // 200 tokens

    const usage = compactor.getUsageByCategory();
    assert.equal(usage.skill, 100);
    assert.equal(usage.instruction, 200);
    assert.equal(usage.conversation, 0);
  });

  it('should compact conversation and emit event', () => {
    const events: unknown[] = [];
    bus.on('context-compacted', (e) => events.push(e));

    const messages = [
      { role: 'user', content: 'Please implement the login feature' },
      { role: 'assistant', content: 'I decided to use JWT tokens for auth.' },
      { role: 'user', content: 'created file src/auth.ts with the handler' },
      { role: 'assistant', content: 'Error: missing dependency jsonwebtoken' },
    ];

    const summary = compactor.compactConversation(messages, 'Engineer');

    assert.ok(summary.includes('Context Compaction Summary'));
    assert.ok(summary.includes('Compacted from 4 messages'));
    assert.equal(events.length, 1);
  });

  it('should format a human-readable budget report', () => {
    compactor.trackItem('skill', 'testing', 'a'.repeat(4000));
    const report = compactor.formatBudgetReport();

    assert.ok(report.includes('AgentX Context Budget'));
    assert.ok(report.includes('Usage by Category'));
    assert.ok(report.includes('testing'));
  });
});

// ---------------------------------------------------------------------------
// Bounded Message Pruning (US-2.5)
// ---------------------------------------------------------------------------

describe('pruneMessages (US-2.5)', () => {
  const sysMsg = { role: 'system', content: 'You are an assistant.' };
  const userMsg = (n: number) => ({ role: 'user', content: `Message ${n}` });
  const assistantMsg = (n: number) => ({ role: 'assistant', content: `Reply ${n}` });

  it('should not prune when under max', () => {
    const messages = [sysMsg, userMsg(1), assistantMsg(1)];
    const result = pruneMessages(messages, { maxMessages: 10, warnBeforePrune: false });
    assert.equal(result.didPrune, false);
    assert.equal(result.prunedCount, 0);
    assert.equal(result.messages.length, 3);
  });

  it('should not prune when exactly at max', () => {
    const messages = [sysMsg, userMsg(1), assistantMsg(1)];
    const result = pruneMessages(messages, { maxMessages: 3, warnBeforePrune: false });
    assert.equal(result.didPrune, false);
  });

  it('should prune oldest non-system messages when over max', () => {
    const messages = [
      sysMsg,
      userMsg(1), assistantMsg(1),
      userMsg(2), assistantMsg(2),
      userMsg(3), assistantMsg(3),
    ];
    // Max 4: 1 system + 3 non-system
    const result = pruneMessages(messages, { maxMessages: 4, warnBeforePrune: false });
    assert.equal(result.didPrune, true);
    assert.equal(result.prunedCount, 3); // 6 non-system - 3 budget = 3 pruned
    assert.equal(result.messages.length, 4);
    // System message always kept
    assert.equal(result.messages[0].role, 'system');
    // Most recent messages kept
    assert.ok(result.messages.some((m) => m.content === 'Reply 3'));
  });

  it('should preserve system messages and never prune them', () => {
    const messages = [
      { role: 'system', content: 'Sys 1' },
      userMsg(1),
      { role: 'system', content: 'Sys 2' },
      userMsg(2),
      assistantMsg(2),
    ];
    // Max 3: keeps both system (2) + 1 non-system
    const result = pruneMessages(messages, { maxMessages: 3, warnBeforePrune: false });
    assert.equal(result.didPrune, true);
    const systemMessages = result.messages.filter((m) => m.role === 'system');
    assert.equal(systemMessages.length, 2);
    assert.equal(result.messages.length, 3);
  });

  it('should preserve original message order after pruning', () => {
    const messages = [
      sysMsg,
      userMsg(1),
      assistantMsg(1),
      userMsg(2),
      assistantMsg(2),
    ];
    // Max 3: 1 system + 2 non-system (keep most recent)
    const result = pruneMessages(messages, { maxMessages: 3, warnBeforePrune: false });
    assert.equal(result.messages[0].role, 'system');
    assert.equal(result.messages[1].content, 'Message 2');
    assert.equal(result.messages[2].content, 'Reply 2');
  });

  it('should use default maxMessages (100) when no config', () => {
    // Build 101 messages
    const messages: Array<{ role: string; content: string }> = [sysMsg];
    for (let i = 1; i <= 100; i++) {
      messages.push(userMsg(i));
    }
    // 101 total, default 100 max -> prune 1
    const result = pruneMessages(messages);
    assert.equal(result.didPrune, true);
    assert.equal(result.prunedCount, 1);
    assert.equal(result.messages.length, 100);
  });

  it('should emit warning event before pruning', () => {
    const bus = new AgentEventBus();
    const warnings: unknown[] = [];
    bus.on('bounded-message-warning', (e) => warnings.push(e));

    const messages = [sysMsg, userMsg(1), userMsg(2), userMsg(3)];
    pruneMessages(messages, { maxMessages: 2, warnBeforePrune: true }, bus, 'test-agent');

    assert.equal(warnings.length, 1);
    const w = warnings[0] as { agent: string; prunedCount: number };
    assert.equal(w.agent, 'test-agent');
    assert.equal(w.prunedCount, 2);

    bus.dispose();
  });

  it('should not emit warning when warnBeforePrune is false', () => {
    const bus = new AgentEventBus();
    const warnings: unknown[] = [];
    bus.on('bounded-message-warning', (e) => warnings.push(e));

    const messages = [sysMsg, userMsg(1), userMsg(2), userMsg(3)];
    pruneMessages(messages, { maxMessages: 2, warnBeforePrune: false }, bus);

    assert.equal(warnings.length, 0);
    bus.dispose();
  });

  it('should handle edge case: maxMessages <= 0', () => {
    const messages = [sysMsg, userMsg(1)];
    const result = pruneMessages(messages, { maxMessages: 0, warnBeforePrune: false });
    assert.equal(result.didPrune, false);
    assert.equal(result.messages.length, 2);
  });

  it('should handle edge case: more system messages than maxMessages', () => {
    const messages = [
      { role: 'system', content: 'Sys 1' },
      { role: 'system', content: 'Sys 2' },
      { role: 'system', content: 'Sys 3' },
      userMsg(1),
    ];
    // Max 2, but 3 system messages -> keep all system, prune all non-system
    const result = pruneMessages(messages, { maxMessages: 2, warnBeforePrune: false });
    assert.equal(result.didPrune, true);
    assert.equal(result.messages.length, 3); // all system kept
    assert.ok(result.messages.every((m) => m.role === 'system'));
  });

  it('should handle empty message array', () => {
    const result = pruneMessages([], { maxMessages: 10, warnBeforePrune: false });
    assert.equal(result.didPrune, false);
    assert.equal(result.messages.length, 0);
  });

  it('should work alongside token-based compaction (independent)', () => {
    // pruneMessages is purely count-based, not token-based
    const messages = [
      sysMsg,
      { role: 'user', content: 'x'.repeat(100000) }, // huge message
      { role: 'assistant', content: 'short' },
    ];
    const result = pruneMessages(messages, { maxMessages: 3, warnBeforePrune: false });
    assert.equal(result.didPrune, false);
    assert.equal(result.messages.length, 3);
  });
});
