import { strict as assert } from 'assert';
import {
  __setMockModels,
  __clearMockModels,
} from '../mocks/vscode';
import { selectModelForAgent, listAvailableModels, resolveContextWindow } from '../../utils/modelSelector';
import { AgentDefinition } from '../../agentxContext';

function makeDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'Test Agent',
    description: 'A test agent',
    maturity: 'stable',
    mode: 'agent',
    model: '',
    fileName: 'test.agent.md',
    ...overrides,
  };
}

describe('modelSelector', () => {
  afterEach(() => {
    __clearMockModels();
  });

  // --- selectModelForAgent ----------------------------------------------

  describe('selectModelForAgent', () => {
    it('should return none when agentDef is undefined', async () => {
      const result = await selectModelForAgent(undefined);
      assert.equal(result.source, 'none');
      assert.equal(result.chatModel, undefined);
    });

    it('should return none when model is empty string', async () => {
      const result = await selectModelForAgent(makeDef({ model: '' }));
      assert.equal(result.source, 'none');
    });

    it('should select primary model matching Gemini 3 Pro', async () => {
      __setMockModels([
        { name: 'Gemini 3 Pro', family: 'gemini-3-pro', vendor: 'copilot' },
        { name: 'Gemini 3 Flash', family: 'gemini-3-flash', vendor: 'copilot' },
      ]);

      const result = await selectModelForAgent(
        makeDef({ model: 'Gemini 3 Pro (copilot)' }),
      );

      assert.equal(result.source, 'primary');
      assert.ok(result.chatModel);
      assert.equal(result.chatModel!.family, 'gemini-3-pro');
    });

    it('should select primary model matching Claude Opus 4', async () => {
      __setMockModels([
        { name: 'Claude Opus 4.6', family: 'claude-opus-4', vendor: 'copilot' },
        { name: 'Claude Sonnet 4.6', family: 'claude-sonnet-4', vendor: 'copilot' },
      ]);

      const result = await selectModelForAgent(
        makeDef({ model: 'Claude Opus 4.6 (copilot)' }),
      );

      assert.equal(result.source, 'primary');
      assert.ok(result.chatModel);
      assert.equal(result.chatModel!.family, 'claude-opus-4');
    });

    it('should fall back to modelFallback when primary unavailable', async () => {
      __setMockModels([
        { name: 'Gemini 3 Flash', family: 'gemini-3-flash', vendor: 'copilot' },
      ]);

      const result = await selectModelForAgent(
        makeDef({
          model: 'Gemini 3 Pro (copilot)',
          modelFallback: 'Gemini 3 Flash (copilot)',
        }),
      );

      assert.equal(result.source, 'fallback');
      assert.ok(result.chatModel);
      assert.equal(result.chatModel!.family, 'gemini-3-flash');
    });

    it('should return none when neither primary nor fallback available', async () => {
      __setMockModels([]);

      const result = await selectModelForAgent(
        makeDef({
          model: 'Gemini 3 Pro (copilot)',
          modelFallback: 'Gemini 3 Flash (copilot)',
        }),
      );

      assert.equal(result.source, 'none');
      assert.equal(result.chatModel, undefined);
      assert.equal(result.modelName, 'Gemini 3 Pro (copilot)');
    });

    it('should select GPT 5.3 Codex model', async () => {
      __setMockModels([
        { name: 'GPT 5.3 Codex', family: 'gpt-5.3-codex', vendor: 'copilot' },
      ]);

      const result = await selectModelForAgent(
        makeDef({ model: 'GPT 5.3 Codex (copilot)' }),
      );

      assert.equal(result.source, 'primary');
      assert.ok(result.chatModel);
      assert.equal(result.chatModel!.family, 'gpt-5.3-codex');
    });

    it('should select Claude Sonnet 4 model', async () => {
      __setMockModels([
        { name: 'Claude Sonnet 4.6', family: 'claude-sonnet-4', vendor: 'copilot' },
      ]);

      const result = await selectModelForAgent(
        makeDef({ model: 'Claude Sonnet 4.6 (copilot)' }),
      );

      assert.equal(result.source, 'primary');
      assert.ok(result.chatModel);
      assert.equal(result.chatModel!.family, 'claude-sonnet-4');
    });
  });

  // --- listAvailableModels -----------------------------------------------

  describe('listAvailableModels', () => {
    it('should list all mock models', async () => {
      __setMockModels([
        { name: 'Model A', family: 'family-a', vendor: 'copilot' },
        { name: 'Model B', family: 'family-b', vendor: 'copilot' },
      ]);

      const list = await listAvailableModels();
      assert.equal(list.length, 2);
      assert.ok(list[0].includes('Model A'));
      assert.ok(list[1].includes('Model B'));
    });

    it('should return empty when no models available', async () => {
      __clearMockModels();
      const list = await listAvailableModels();
      assert.deepEqual(list, []);
    });
  });

  // --- resolveContextWindow -----------------------------------------------

  describe('resolveContextWindow', () => {
    it('should prefer maxInputTokens from the model API', () => {
      const fakeModel = { name: 'Claude Opus 4', family: 'claude-opus-4', maxInputTokens: 250_000 };
      const result = resolveContextWindow(fakeModel as any, 'Claude Opus 4');
      assert.equal(result, 250_000);
    });

    it('should fall back to family-based lookup for Claude', () => {
      const fakeModel = { name: 'Claude Sonnet 4', family: 'claude-sonnet-4' };
      const result = resolveContextWindow(fakeModel as any, 'Claude Sonnet 4');
      assert.equal(result, 200_000);
    });

    it('should fall back to family-based lookup for GPT-4o', () => {
      const fakeModel = { name: 'GPT 4o', family: 'gpt-4o' };
      const result = resolveContextWindow(fakeModel as any, 'GPT 4o');
      assert.equal(result, 128_000);
    });

    it('should fall back to family-based lookup for Gemini', () => {
      const fakeModel = { name: 'Gemini 3 Pro', family: 'gemini-3-pro' };
      const result = resolveContextWindow(fakeModel as any, 'Gemini 3 Pro');
      assert.equal(result, 1_000_000);
    });

    it('should return conservative default for unknown model', () => {
      const fakeModel = { name: 'Unknown Model', family: 'mystery' };
      const result = resolveContextWindow(fakeModel as any, 'Unknown Model');
      assert.equal(result, 70_000);
    });

    it('should return conservative default when chatModel is undefined', () => {
      const result = resolveContextWindow(undefined, 'Unknown');
      assert.equal(result, 70_000);
    });

    it('should ignore maxInputTokens when it is zero', () => {
      const fakeModel = { name: 'Claude Opus 4', family: 'claude-opus-4', maxInputTokens: 0 };
      const result = resolveContextWindow(fakeModel as any, 'Claude Opus 4');
      assert.equal(result, 200_000); // Falls back to family-based
    });
  });

  // --- maxInputTokens in selectModelForAgent --------------------------------

  describe('selectModelForAgent maxInputTokens', () => {
    it('should include maxInputTokens in result when model is selected', async () => {
      __setMockModels([
        { name: 'Claude Opus 4.6', family: 'claude-opus-4', vendor: 'copilot', maxInputTokens: 200_000 },
      ]);

      const result = await selectModelForAgent(makeDef({ model: 'Claude Opus 4.6 (copilot)' }));
      assert.equal(result.source, 'primary');
      assert.equal(result.maxInputTokens, 200_000);
    });

    it('should include maxInputTokens from family lookup when API missing', async () => {
      __setMockModels([
        { name: 'Claude Sonnet 4.6', family: 'claude-sonnet-4', vendor: 'copilot' },
      ]);

      const result = await selectModelForAgent(makeDef({ model: 'Claude Sonnet 4.6 (copilot)' }));
      assert.equal(result.source, 'primary');
      // Should be 200K from CONTEXT_WINDOW_MAP
      assert.equal(result.maxInputTokens, 200_000);
    });

    it('should include default maxInputTokens when no model available', async () => {
      __setMockModels([]);
      const result = await selectModelForAgent(makeDef({ model: 'Unknown Model' }));
      assert.equal(result.source, 'none');
      assert.equal(result.maxInputTokens, 70_000);
    });
  });
});
