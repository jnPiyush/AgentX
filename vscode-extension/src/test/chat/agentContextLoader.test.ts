import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadAgentInstructions, clearInstructionCache } from '../../chat/agentContextLoader';

/**
 * Creates a minimal AgentXContext-like object whose workspaceRoot
 * points to a temporary directory we control.
 */
function createFakeAgentx(root: string) {
  return {
    workspaceRoot: root,
    // Other properties are not used by agentContextLoader
  } as any;
}

describe('agentContextLoader', () => {
  let tmpDir: string;

  beforeEach(() => {
    clearInstructionCache();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-test-'));
    fs.mkdirSync(path.join(tmpDir, '.github', 'agents'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return undefined when agent file does not exist', async () => {
    const agentx = createFakeAgentx(tmpDir);
    const result = await loadAgentInstructions(agentx, 'nonexistent.agent.md');
    assert.equal(result, undefined);
  });

  it('should return undefined when workspace root is not set', async () => {
    const agentx = createFakeAgentx(undefined as any);
    // workspaceRoot is undefined
    (agentx as any).workspaceRoot = undefined;
    const result = await loadAgentInstructions(agentx, 'engineer.agent.md');
    assert.equal(result, undefined);
  });

  it('should return undefined when file has no frontmatter delimiters', async () => {
    const filePath = path.join(tmpDir, '.github', 'agents', 'bad.agent.md');
    fs.writeFileSync(filePath, 'No frontmatter here\nJust plain text\n');
    const agentx = createFakeAgentx(tmpDir);
    const result = await loadAgentInstructions(agentx, 'bad.agent.md');
    assert.equal(result, undefined);
  });

  it('should return undefined when file has only opening delimiter', async () => {
    const filePath = path.join(tmpDir, '.github', 'agents', 'partial.agent.md');
    fs.writeFileSync(filePath, '---\nname: Test\nThis never closes\n');
    const agentx = createFakeAgentx(tmpDir);
    const result = await loadAgentInstructions(agentx, 'partial.agent.md');
    assert.equal(result, undefined);
  });

  it('should extract body after frontmatter', async () => {
    const filePath = path.join(tmpDir, '.github', 'agents', 'test.agent.md');
    const content = [
      '---',
      'name: Test Agent',
      'description: A test agent',
      '---',
      '',
      '## Role',
      '',
      'This is the role section.',
      '',
      '## Constraints',
      '',
      '- Do not break things',
    ].join('\n');
    fs.writeFileSync(filePath, content);

    const agentx = createFakeAgentx(tmpDir);
    const result = await loadAgentInstructions(agentx, 'test.agent.md');

    assert.ok(result, 'should return content');
    assert.ok(result!.includes('## Role'), 'should contain Role section');
    assert.ok(result!.includes('This is the role section'), 'should contain role text');
    assert.ok(result!.includes('## Constraints'), 'should contain Constraints section');
  });

  it('should cache results on subsequent calls', async () => {
    const filePath = path.join(tmpDir, '.github', 'agents', 'cached.agent.md');
    fs.writeFileSync(filePath, '---\nname: Cached\n---\n\nBody content here');

    const agentx = createFakeAgentx(tmpDir);
    const first = await loadAgentInstructions(agentx, 'cached.agent.md');
    // Modify file on disk -- should still return cached
    fs.writeFileSync(filePath, '---\nname: Cached\n---\n\nDIFFERENT content');
    const second = await loadAgentInstructions(agentx, 'cached.agent.md');

    assert.equal(first, second, 'should return same cached result');
    assert.ok(first!.includes('Body content here'), 'should be original content');
  });

  it('should return fresh content after clearInstructionCache', async () => {
    const filePath = path.join(tmpDir, '.github', 'agents', 'refresh.agent.md');
    fs.writeFileSync(filePath, '---\nname: R\n---\n\nOriginal');

    const agentx = createFakeAgentx(tmpDir);
    const first = await loadAgentInstructions(agentx, 'refresh.agent.md');
    assert.ok(first!.includes('Original'));

    // Clear cache, update file
    clearInstructionCache();
    fs.writeFileSync(filePath, '---\nname: R\n---\n\nUpdated');
    const second = await loadAgentInstructions(agentx, 'refresh.agent.md');
    assert.ok(second!.includes('Updated'), 'should return updated content after cache clear');
  });
});
