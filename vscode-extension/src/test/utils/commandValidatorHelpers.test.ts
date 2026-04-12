// ---------------------------------------------------------------------------
// Tests -- Command Validator Helpers
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import {
  normaliseCommand,
  splitCompoundCommand,
  classifyReversibility,
} from '../../utils/commandValidatorHelpers';

describe('CommandValidatorHelpers', () => {
  // -----------------------------------------------------------------------
  // normaliseCommand
  // -----------------------------------------------------------------------
  describe('normaliseCommand', () => {
    it('should trim whitespace', () => {
      assert.equal(normaliseCommand('  git status  '), 'git status');
    });

    it('should collapse multiple spaces', () => {
      assert.equal(normaliseCommand('git   status'), 'git status');
    });

    it('should lowercase', () => {
      assert.equal(normaliseCommand('Git Status'), 'git status');
    });

    it('should handle tabs and newlines', () => {
      assert.equal(normaliseCommand('git\tstatus\n'), 'git status');
    });
  });

  // -----------------------------------------------------------------------
  // splitCompoundCommand
  // -----------------------------------------------------------------------
  describe('splitCompoundCommand', () => {
    it('should split on semicolons', () => {
      const parts = splitCompoundCommand('ls; pwd');
      assert.deepEqual(parts, ['ls', 'pwd']);
    });

    it('should split on &&', () => {
      const parts = splitCompoundCommand('npm install && npm test');
      assert.deepEqual(parts, ['npm install', 'npm test']);
    });

    it('should split on ||', () => {
      const parts = splitCompoundCommand('test -f foo || echo missing');
      assert.deepEqual(parts, ['test -f foo', 'echo missing']);
    });

    it('should split on pipe |', () => {
      const parts = splitCompoundCommand('cat file | grep pattern');
      assert.deepEqual(parts, ['cat file', 'grep pattern']);
    });

    it('should handle single command', () => {
      const parts = splitCompoundCommand('git status');
      assert.deepEqual(parts, ['git status']);
    });

    it('should filter empty parts', () => {
      const parts = splitCompoundCommand('ls;; pwd');
      assert.deepEqual(parts, ['ls', 'pwd']);
    });
  });

  // -----------------------------------------------------------------------
  // classifyReversibility
  // -----------------------------------------------------------------------
  describe('classifyReversibility', () => {
    it('should classify git checkout as easy', () => {
      const result = classifyReversibility('git checkout main');
      assert.equal(result.reversibility, 'easy');
      assert.ok(result.undoHint);
    });

    it('should classify git commit as easy', () => {
      const result = classifyReversibility('git commit -m "test"');
      assert.equal(result.reversibility, 'easy');
    });

    it('should classify rm -rf as irreversible', () => {
      const result = classifyReversibility('rm -rf build/');
      assert.equal(result.reversibility, 'irreversible');
    });

    it('should classify git push as irreversible', () => {
      const result = classifyReversibility('git push origin main');
      assert.equal(result.reversibility, 'irreversible');
    });

    it('should classify DROP as irreversible', () => {
      const result = classifyReversibility('DROP TABLE users');
      assert.equal(result.reversibility, 'irreversible');
    });

    it('should classify npm install as effort', () => {
      const result = classifyReversibility('npm install express');
      assert.equal(result.reversibility, 'effort');
    });

    it('should default unknown commands to effort', () => {
      const result = classifyReversibility('some-unknown-tool --flag');
      assert.equal(result.reversibility, 'effort');
    });
  });
});