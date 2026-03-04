import { strict as assert } from 'assert';
import { stripAnsi } from '../../utils/stripAnsi';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripAnsi', () => {
  it('should return plain text unchanged', () => {
    const text = 'Hello, world!';
    assert.strictEqual(stripAnsi(text), 'Hello, world!');
  });

  it('should strip SGR color codes', () => {
    const text = '\u001b[31mError\u001b[0m: something went wrong';
    assert.strictEqual(stripAnsi(text), 'Error: something went wrong');
  });

  it('should strip bold and underline codes', () => {
    const text = '\u001b[1mBold\u001b[22m and \u001b[4mUnderline\u001b[24m';
    assert.strictEqual(stripAnsi(text), 'Bold and Underline');
  });

  it('should strip 256-color codes', () => {
    const text = '\u001b[38;5;196mRed text\u001b[0m';
    assert.strictEqual(stripAnsi(text), 'Red text');
  });

  it('should strip 24-bit (truecolor) codes', () => {
    const text = '\u001b[38;2;255;0;0mTrue red\u001b[0m';
    assert.strictEqual(stripAnsi(text), 'True red');
  });

  it('should strip cursor movement codes', () => {
    const text = '\u001b[2A\u001b[3BMove around\u001b[1C';
    assert.strictEqual(stripAnsi(text), 'Move around');
  });

  it('should strip erase commands', () => {
    const text = '\u001b[2JCleared\u001b[K';
    assert.strictEqual(stripAnsi(text), 'Cleared');
  });

  it('should strip OSC sequences (title setting)', () => {
    const text = '\u001b]0;Window Title\u0007visible text';
    assert.strictEqual(stripAnsi(text), 'visible text');
  });

  it('should handle empty string', () => {
    assert.strictEqual(stripAnsi(''), '');
  });

  it('should handle string with only escape codes', () => {
    const text = '\u001b[31m\u001b[0m';
    assert.strictEqual(stripAnsi(text), '');
  });

  it('should handle multiple consecutive escape codes', () => {
    const text = '\u001b[1m\u001b[31m\u001b[4mStyled\u001b[0m';
    assert.strictEqual(stripAnsi(text), 'Styled');
  });

  it('should preserve newlines and tabs', () => {
    const text = '\u001b[31mLine 1\u001b[0m\n\tLine 2';
    assert.strictEqual(stripAnsi(text), 'Line 1\n\tLine 2');
  });

  it('should handle mixed content', () => {
    const text = 'start \u001b[32m1 PASS\u001b[0m | \u001b[31m0 FAIL\u001b[0m end';
    assert.strictEqual(stripAnsi(text), 'start 1 PASS | 0 FAIL end');
  });
});
