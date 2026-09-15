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
});

test('rejects disabled agents, raw shell commands and gate overrides', () => {
    for (const command of ['run devops Deploy', 'raw git push', 'loop complete', 'run engineer --skip-review', 'run engineer bad\u0000text']) {
        assert.throws(() => parseCommand(command, ['engineer']));
    }
    assert.throws(() => parseCommand('x'.repeat(4001), []));
    assert.throws(() => parseCommand(null, []));
});