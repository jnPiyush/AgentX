import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/commands.js';

test('accepts only scoped progress and instruction commands', () => {
    assert.deepEqual(parseCommand('/frontier status', []), { kind: 'status' });
    assert.deepEqual(parseCommand('run engineer Fix the failing test', ['engineer']), {
        kind: 'run', agent: 'engineer', instruction: 'Fix the failing test',
    });
    assert.equal(parseCommand('instruct 0123456789abcdef Keep the public API', []).kind, 'instruct');
    assert.equal(parseCommand('confirm 0123456789abcdef01234567', []).kind, 'confirm');
    assert.equal(parseCommand('help', []).kind, 'help');
    assert.deepEqual(parseCommand('inspect 0123456789ABCDEF', []), { kind: 'inspect', jobId: '0123456789abcdef' });
    assert.throws(() => parseCommand('inspect native-session', []));
});

test('rejects disabled agents, raw shell commands and gate overrides', () => {
    for (const command of ['run devops Deploy', 'raw git push', 'loop complete', 'run engineer --skip-review', 'run engineer bad\u0000text']) {
        assert.throws(() => parseCommand(command, ['engineer']));
    }
    assert.throws(() => parseCommand('x'.repeat(4001), []));
    assert.throws(() => parseCommand(null, []));
});

test('parses bounded job responses without treating them as new instructions', () => {
    const id = '0123456789abcdef';
    for (const decision of ['answer', 'revise']) {
        assert.deepEqual(parseCommand(`/frontier respond ${id.toUpperCase()} ${decision.toUpperCase()} Keep scope\nNo deployment`, []), {
            kind: 'respond', jobId: id, decision, text: 'Keep scope\nNo deployment',
        });
    }
    for (const decision of ['approve', 'cancel']) {
        assert.deepEqual(parseCommand(`respond ${id} ${decision}`, []), { kind: 'respond', jobId: id, decision, text: '' });
    }
    const prefix = `respond ${id} answer `;
    assert.equal(parseCommand(prefix + '--dry-run', []).text, '--dry-run');
    assert.equal(parseCommand(prefix + 'x'.repeat(4000 - prefix.length), []).text.length, 4000 - prefix.length);
    assert.throws(() => parseCommand(prefix + 'x'.repeat(4001 - prefix.length), []), /4000/);
});

test('rejects missing response text, edited approvals, native IDs and control characters', () => {
    for (const command of [
        'respond 0123456789abcdef answer', 'respond 0123456789abcdef revise',
        'respond 0123456789abcdef approve with changes', 'respond 0123456789abcdef cancel later',
        'respond 0123456789abcdef execute', 'respond native-session approve',
        'respond 0123456789abcdef0 approve', 'respond 0123456789abcdef answer bad\u0000text',
    ]) {
        assert.throws(() => parseCommand(command, []));
    }
});