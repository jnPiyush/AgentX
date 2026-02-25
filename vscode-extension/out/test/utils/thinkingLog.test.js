"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const thinkingLog_1 = require("../../utils/thinkingLog");
const eventBus_1 = require("../../utils/eventBus");
describe('ThinkingLog', () => {
    let log;
    let bus;
    beforeEach(() => {
        bus = new eventBus_1.AgentEventBus();
        log = new thinkingLog_1.ThinkingLog(bus, 50);
    });
    afterEach(() => {
        log.dispose();
        bus.dispose();
    });
    it('should record info entries', () => {
        log.info('Engineer', 'Starting work', 'Issue #42');
        const entries = log.getEntries();
        assert_1.strict.equal(entries.length, 1);
        assert_1.strict.equal(entries[0].agent, 'Engineer');
        assert_1.strict.equal(entries[0].kind, 'info');
        assert_1.strict.equal(entries[0].label, 'Starting work');
        assert_1.strict.equal(entries[0].detail, 'Issue #42');
    });
    it('should record tool-call entries', () => {
        log.toolCall('Engineer', 'replace_string_in_file', 'src/app.ts');
        const entries = log.getEntries();
        assert_1.strict.equal(entries.length, 1);
        assert_1.strict.equal(entries[0].kind, 'tool-call');
        assert_1.strict.ok(entries[0].label.includes('replace_string_in_file'));
    });
    it('should record tool-result entries', () => {
        log.toolResult('Engineer', 'read_file', 'Success');
        const entries = log.getEntries();
        assert_1.strict.equal(entries[0].kind, 'tool-result');
    });
    it('should record warning and error entries', () => {
        log.warning('Reviewer', 'Low coverage', '72%');
        log.error('Engineer', 'Build failed', 'tsc exit code 2');
        const entries = log.getEntries();
        assert_1.strict.equal(entries.length, 2);
        assert_1.strict.equal(entries[0].kind, 'warning');
        assert_1.strict.equal(entries[1].kind, 'error');
    });
    it('should auto-increment IDs', () => {
        log.info('A', 'one');
        log.info('B', 'two');
        log.info('C', 'three');
        const entries = log.getEntries();
        assert_1.strict.equal(entries[0].id, 1);
        assert_1.strict.equal(entries[1].id, 2);
        assert_1.strict.equal(entries[2].id, 3);
    });
    it('should emit thinking-log events on the event bus', () => {
        const events = [];
        bus.on('thinking-log', (e) => events.push(e));
        log.info('PM', 'Creating PRD');
        assert_1.strict.equal(events.length, 1);
    });
    it('should respect maxEntries limit', () => {
        for (let i = 0; i < 60; i++) {
            log.info('Agent', `Entry ${i}`);
        }
        // maxEntries is 50, so oldest 10 should be trimmed
        const entries = log.getEntries();
        assert_1.strict.equal(entries.length, 50);
    });
    it('should filter entries by agent', () => {
        log.info('Engineer', 'eng work');
        log.info('PM', 'pm work');
        log.info('Engineer', 'more eng work');
        const filtered = log.getEntries({ agent: 'Engineer' });
        assert_1.strict.equal(filtered.length, 2);
    });
    it('should filter entries by kind', () => {
        log.info('A', 'info');
        log.error('A', 'error');
        log.warning('A', 'warning');
        const filtered = log.getEntries({ kind: 'error' });
        assert_1.strict.equal(filtered.length, 1);
        assert_1.strict.equal(filtered[0].kind, 'error');
    });
    it('should filter entries with limit', () => {
        for (let i = 0; i < 10; i++) {
            log.info('A', `entry ${i}`);
        }
        const filtered = log.getEntries({ limit: 3 });
        assert_1.strict.equal(filtered.length, 3);
    });
    it('should produce a summary by agent and kind', () => {
        log.info('Engineer', 'start');
        log.toolCall('Engineer', 'read');
        log.toolCall('Engineer', 'write');
        log.info('PM', 'prd done');
        const summary = log.getSummary();
        assert_1.strict.equal(summary['Engineer']['info'], 1);
        assert_1.strict.equal(summary['Engineer']['tool-call'], 2);
        assert_1.strict.equal(summary['PM']['info'], 1);
    });
    it('should clear entries', () => {
        log.info('A', 'x');
        log.info('B', 'y');
        log.clear();
        assert_1.strict.equal(log.getEntries().length, 0);
    });
    it('should work without an event bus', () => {
        const standalone = new thinkingLog_1.ThinkingLog(undefined, 10);
        standalone.info('Test', 'no bus');
        assert_1.strict.equal(standalone.getEntries().length, 1);
        standalone.dispose();
    });
});
//# sourceMappingURL=thinkingLog.test.js.map