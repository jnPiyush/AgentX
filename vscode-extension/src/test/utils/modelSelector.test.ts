import { strict as assert } from 'assert';
import {
  __setMockModels,
  __clearMockModels,
} from '../mocks/vscode';
import { selectModelForAgent, listAvailableModels } from '../../utils/modelSelector';
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
});
