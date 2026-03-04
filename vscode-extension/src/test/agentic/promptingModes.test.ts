// ---------------------------------------------------------------------------
// Tests -- Prompting Modes (US-4.4)
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import {
  registerMode,
  unregisterMode,
  listModes,
  getMode,
  resolveMode,
  resetModeRegistry,
  PromptMode,
} from '../../agentic/promptingModes';

describe('PromptingModes (US-4.4)', () => {
  beforeEach(() => {
    resetModeRegistry();
  });

  // -----------------------------------------------------------------------
  // Built-in modes
  // -----------------------------------------------------------------------

  describe('built-in Engineer modes', () => {
    it('should have 4 built-in modes for engineer role', () => {
      const modes = listModes('engineer');
      assert.equal(modes.length, 4);
      const names = modes.map((m) => m.name).sort();
      assert.deepEqual(names, ['docs', 'refactor', 'test', 'write']);
    });

    it('should return empty array for unknown role', () => {
      const modes = listModes('unknown-role');
      assert.equal(modes.length, 0);
    });

    it('should get specific mode by name', () => {
      const mode = getMode('engineer', 'write');
      assert.ok(mode);
      assert.equal(mode.name, 'write');
      assert.ok(mode.description.length > 0);
      assert.ok(mode.systemPromptSuffix.includes('Write'));
    });

    it('should return undefined for non-existent mode', () => {
      const mode = getMode('engineer', 'nonexistent');
      assert.equal(mode, undefined);
    });

    it('test mode should have tool category filter', () => {
      const mode = getMode('engineer', 'test');
      assert.ok(mode);
      assert.ok(mode.allowedToolCategories);
      assert.ok(mode.allowedToolCategories.includes('read'));
      assert.ok(mode.allowedToolCategories.includes('execute'));
    });

    it('docs mode should have tool category filter', () => {
      const mode = getMode('engineer', 'docs');
      assert.ok(mode);
      assert.ok(mode.allowedToolCategories);
      assert.ok(mode.allowedToolCategories.includes('read'));
      assert.ok(mode.allowedToolCategories.includes('edit'));
    });

    it('write mode should not have tool category filter', () => {
      const mode = getMode('engineer', 'write');
      assert.ok(mode);
      assert.equal(mode.allowedToolCategories, undefined);
    });
  });

  // -----------------------------------------------------------------------
  // Mode resolution
  // -----------------------------------------------------------------------

  describe('resolveMode', () => {
    const BASE_PROMPT = 'You are a helpful engineer.';

    it('should return base prompt when no mode specified', () => {
      const result = resolveMode({ baseSystemPrompt: BASE_PROMPT });
      assert.equal(result.systemPrompt, BASE_PROMPT);
      assert.equal(result.resolvedMode, 'default');
      assert.equal(result.modeApplied, false);
    });

    it('should return base prompt when mode is "default"', () => {
      const result = resolveMode({ baseSystemPrompt: BASE_PROMPT, mode: 'default' });
      assert.equal(result.systemPrompt, BASE_PROMPT);
      assert.equal(result.resolvedMode, 'default');
      assert.equal(result.modeApplied, false);
    });

    it('should return base prompt when mode is empty string', () => {
      const result = resolveMode({ baseSystemPrompt: BASE_PROMPT, mode: '' });
      assert.equal(result.resolvedMode, 'default');
      assert.equal(result.modeApplied, false);
    });

    it('should append mode suffix for valid mode', () => {
      const result = resolveMode({
        baseSystemPrompt: BASE_PROMPT,
        mode: 'refactor',
        role: 'engineer',
      });
      assert.ok(result.systemPrompt.startsWith(BASE_PROMPT));
      assert.ok(result.systemPrompt.includes('Refactor'));
      assert.equal(result.resolvedMode, 'refactor');
      assert.equal(result.modeApplied, true);
    });

    it('should include tool categories from mode', () => {
      const result = resolveMode({
        baseSystemPrompt: BASE_PROMPT,
        mode: 'test',
        role: 'engineer',
      });
      assert.ok(result.allowedToolCategories);
      assert.ok(result.allowedToolCategories!.length > 0);
      assert.equal(result.modeApplied, true);
    });

    it('should default role to engineer when not specified', () => {
      const result = resolveMode({
        baseSystemPrompt: BASE_PROMPT,
        mode: 'write',
      });
      assert.equal(result.modeApplied, true);
      assert.ok(result.systemPrompt.includes('Write'));
    });

    it('should throw for unknown mode', () => {
      assert.throws(
        () => resolveMode({
          baseSystemPrompt: BASE_PROMPT,
          mode: 'nonexistent',
          role: 'engineer',
        }),
        /Unknown prompting mode 'nonexistent'/,
      );
    });

    it('should throw for unknown mode on role with no modes', () => {
      assert.throws(
        () => resolveMode({
          baseSystemPrompt: BASE_PROMPT,
          mode: 'write',
          role: 'no-such-role',
        }),
        /Unknown prompting mode 'write' for role 'no-such-role'/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Custom mode registration
  // -----------------------------------------------------------------------

  describe('registerMode / unregisterMode', () => {
    it('should register a custom mode for a new role', () => {
      const customMode: PromptMode = {
        name: 'analyze',
        description: 'Analysis mode',
        systemPromptSuffix: '\n## Mode: Analyze\nFocus on analysis.',
      };
      registerMode('architect', customMode);
      const modes = listModes('architect');
      assert.equal(modes.length, 1);
      assert.equal(modes[0].name, 'analyze');
    });

    it('should add mode to existing role', () => {
      const customMode: PromptMode = {
        name: 'security',
        description: 'Security audit mode',
        systemPromptSuffix: '\n## Mode: Security\nFocus on security.',
      };
      registerMode('engineer', customMode);
      const modes = listModes('engineer');
      assert.equal(modes.length, 5); // 4 built-in + 1 custom
    });

    it('should overwrite existing mode with same name', () => {
      const updated: PromptMode = {
        name: 'write',
        description: 'Updated write mode',
        systemPromptSuffix: '\n## Mode: Write V2\nUpdated.',
      };
      registerMode('engineer', updated);
      const mode = getMode('engineer', 'write');
      assert.ok(mode);
      assert.equal(mode.description, 'Updated write mode');
    });

    it('should unregister a mode and return true', () => {
      const removed = unregisterMode('engineer', 'docs');
      assert.equal(removed, true);
      assert.equal(listModes('engineer').length, 3);
    });

    it('should return false when unregistering non-existent mode', () => {
      assert.equal(unregisterMode('engineer', 'nope'), false);
      assert.equal(unregisterMode('nope', 'docs'), false);
    });

    it('should throw on empty role', () => {
      assert.throws(
        () => registerMode('', { name: 'x', description: 'x', systemPromptSuffix: 'x' }),
        /non-empty role/,
      );
    });

    it('should throw on empty mode name', () => {
      assert.throws(
        () => registerMode('engineer', { name: '', description: 'x', systemPromptSuffix: 'x' }),
        /non-empty role and mode\.name/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // resetModeRegistry
  // -----------------------------------------------------------------------

  describe('resetModeRegistry', () => {
    it('should restore built-in modes after custom modifications', () => {
      registerMode('engineer', {
        name: 'custom',
        description: 'Custom',
        systemPromptSuffix: '\nCustom.',
      });
      unregisterMode('engineer', 'write');
      assert.equal(listModes('engineer').length, 4); // 3 built-in + 1 custom

      resetModeRegistry();

      const modes = listModes('engineer');
      assert.equal(modes.length, 4);
      assert.ok(modes.find((m) => m.name === 'write'));
      assert.ok(!modes.find((m) => m.name === 'custom'));
    });
  });
});
