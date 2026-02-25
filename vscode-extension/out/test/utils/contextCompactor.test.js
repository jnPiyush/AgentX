"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const contextCompactor_1 = require("../../utils/contextCompactor");
const eventBus_1 = require("../../utils/eventBus");
describe('contextCompactor - estimateTokens', () => {
    it('should estimate roughly 1 token per 4 characters', () => {
        const text = 'a'.repeat(400);
        assert_1.strict.equal((0, contextCompactor_1.estimateTokens)(text), 100);
    });
    it('should return 0 for empty string', () => {
        assert_1.strict.equal((0, contextCompactor_1.estimateTokens)(''), 0);
    });
    it('should round up', () => {
        assert_1.strict.equal((0, contextCompactor_1.estimateTokens)('abc'), 1); // 3/4 = 0.75, ceil = 1
    });
});
describe('ContextCompactor', () => {
    let compactor;
    let bus;
    beforeEach(() => {
        bus = new eventBus_1.AgentEventBus();
        compactor = new contextCompactor_1.ContextCompactor(bus, 10_000, 0.75);
    });
    afterEach(() => {
        bus.dispose();
    });
    it('should track items and report budget', () => {
        compactor.trackItem('skill', 'testing', 'a'.repeat(4000)); // ~1000 tokens
        compactor.trackItem('instruction', 'typescript', 'b'.repeat(2000)); // ~500 tokens
        const status = compactor.checkBudget();
        assert_1.strict.equal(status.items.length, 2);
        assert_1.strict.equal(status.totalTokens, 1500);
        assert_1.strict.equal(status.limit, 10_000);
        assert_1.strict.equal(status.utilizationPercent, 15);
        assert_1.strict.equal(status.needsCompaction, false);
    });
    it('should detect when compaction is needed', () => {
        compactor.trackItem('conversation', 'chat', 'x'.repeat(32_000)); // ~8000 tokens = 80%
        const status = compactor.checkBudget();
        assert_1.strict.equal(status.needsCompaction, true);
        assert_1.strict.ok(status.recommendation.includes('WARNING'));
    });
    it('should detect critical utilization at 90%+', () => {
        compactor.trackItem('conversation', 'chat', 'x'.repeat(36_800)); // ~9200 tokens = 92%
        const status = compactor.checkBudget();
        assert_1.strict.ok(status.recommendation.includes('CRITICAL'));
    });
    it('should untrack items', () => {
        compactor.trackItem('skill', 'testing', 'a'.repeat(400));
        assert_1.strict.equal(compactor.checkBudget().items.length, 1);
        compactor.untrackItem('testing');
        assert_1.strict.equal(compactor.checkBudget().items.length, 0);
    });
    it('should reset all tracked items', () => {
        compactor.trackItem('skill', 'a', 'x');
        compactor.trackItem('skill', 'b', 'x');
        compactor.reset();
        assert_1.strict.equal(compactor.checkBudget().items.length, 0);
    });
    it('should return usage by category', () => {
        compactor.trackItem('skill', 's1', 'a'.repeat(400)); // 100 tokens
        compactor.trackItem('instruction', 'i1', 'b'.repeat(800)); // 200 tokens
        const usage = compactor.getUsageByCategory();
        assert_1.strict.equal(usage.skill, 100);
        assert_1.strict.equal(usage.instruction, 200);
        assert_1.strict.equal(usage.conversation, 0);
    });
    it('should compact conversation and emit event', () => {
        const events = [];
        bus.on('context-compacted', (e) => events.push(e));
        const messages = [
            { role: 'user', content: 'Please implement the login feature' },
            { role: 'assistant', content: 'I decided to use JWT tokens for auth.' },
            { role: 'user', content: 'created file src/auth.ts with the handler' },
            { role: 'assistant', content: 'Error: missing dependency jsonwebtoken' },
        ];
        const summary = compactor.compactConversation(messages, 'Engineer');
        assert_1.strict.ok(summary.includes('Context Compaction Summary'));
        assert_1.strict.ok(summary.includes('Compacted from 4 messages'));
        assert_1.strict.equal(events.length, 1);
    });
    it('should format a human-readable budget report', () => {
        compactor.trackItem('skill', 'testing', 'a'.repeat(4000));
        const report = compactor.formatBudgetReport();
        assert_1.strict.ok(report.includes('AgentX Context Budget'));
        assert_1.strict.ok(report.includes('Usage by Category'));
        assert_1.strict.ok(report.includes('testing'));
    });
});
//# sourceMappingURL=contextCompactor.test.js.map