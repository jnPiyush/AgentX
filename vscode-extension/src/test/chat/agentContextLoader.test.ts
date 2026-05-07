import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadAgentInstructions, clearInstructionCache } from '../../chat/agentContextLoader';

/**
 * Creates a minimal AgentXContext-like object whose workspaceRoot
 * points to a temporary directory we control.
 */
function createFakeAgentx(root: string, extensionPath?: string) {
  return {
    workspaceRoot: root,
    extensionContext: extensionPath ? { extensionPath } : undefined,
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

  it('should fall back to hidden runtime agent definitions', async () => {
    const filePath = path.join(tmpDir, '.agentx', 'runtime', 'agents', 'runtime.agent.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '---\nname: Runtime Agent\n---\n\nRuntime body');

    const agentx = createFakeAgentx(tmpDir);
    const result = await loadAgentInstructions(agentx, 'runtime.agent.md');

    assert.equal(result, 'Runtime body');
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

  it('rewrites canonical template references to bundled extension paths when zero-copy runtime is in effect', async () => {
    // Bundled extension layout (zero-copy): only the bundle holds the template
    const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ext-'));
    const bundledTemplateDir = path.join(extensionPath, '.github', 'agentx', 'templates');
    const bundledSkillDir = path.join(extensionPath, '.github', 'agentx', 'skills', 'development', 'testing');
    fs.mkdirSync(bundledTemplateDir, { recursive: true });
    fs.mkdirSync(bundledSkillDir, { recursive: true });
    const bundledTemplatePath = path.join(bundledTemplateDir, 'ARCH-REVIEW-TEMPLATE.md');
    const bundledSkillPath = path.join(bundledSkillDir, 'SKILL.md');
    fs.writeFileSync(bundledTemplatePath, '# Arch Review Template');
    fs.writeFileSync(bundledSkillPath, '# Testing Skill');

    const agentFile = path.join(tmpDir, '.github', 'agents', 'reviewer.agent.md');
    const content = [
      '---',
      'name: Reviewer',
      '---',
      '',
      'Read .github/templates/ARCH-REVIEW-TEMPLATE.md before drafting.',
      'Load .github/skills/development/testing/SKILL.md before validating.',
      'Also read `.github/templates/REVIEW-TEMPLATE.md` for code reviews.',
    ].join('\n');
    fs.writeFileSync(agentFile, content);

    try {
      const agentx = createFakeAgentx(tmpDir, extensionPath);
      const result = await loadAgentInstructions(agentx, 'reviewer.agent.md');

      assert.ok(result, 'should return content');
      const expectedBundledPath = bundledTemplatePath.replace(/\\/g, '/');
      assert.ok(
        result!.includes(expectedBundledPath),
        `body should reference resolved bundled template path, got: ${result}`,
      );
      assert.ok(
        result!.includes(bundledSkillPath.replace(/\\/g, '/')),
        'body should reference resolved bundled skill path',
      );
      assert.ok(
        !/(?:^|[^\/])\.github\/templates\/ARCH-REVIEW-TEMPLATE\.md/.test(result!),
        'unresolved canonical ARCH template reference must be rewritten',
      );
      assert.ok(
        !/(?:^|[^\/])\.github\/skills\/development\/testing\/SKILL\.md/.test(result!),
        'unresolved canonical skill reference must be rewritten',
      );
    } finally {
      fs.rmSync(extensionPath, { recursive: true, force: true });
    }
  });

  it('prefers workspace runtime mirror over bundled path when both exist', async () => {
    const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ext-'));
    fs.mkdirSync(path.join(extensionPath, '.github', 'agentx', 'templates'), { recursive: true });
    fs.writeFileSync(
      path.join(extensionPath, '.github', 'agentx', 'templates', 'ARCH-REVIEW-TEMPLATE.md'),
      'bundled',
    );

    const runtimeDir = path.join(tmpDir, '.agentx', 'runtime', 'templates');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(runtimeDir, 'ARCH-REVIEW-TEMPLATE.md'), 'runtime');

    const agentFile = path.join(tmpDir, '.github', 'agents', 'reviewer-runtime.agent.md');
    fs.writeFileSync(
      agentFile,
      '---\nname: R\n---\n\nUse .github/templates/ARCH-REVIEW-TEMPLATE.md\n',
    );

    try {
      const agentx = createFakeAgentx(tmpDir, extensionPath);
      const result = await loadAgentInstructions(agentx, 'reviewer-runtime.agent.md');

      assert.ok(result!.includes('.agentx/runtime/templates/ARCH-REVIEW-TEMPLATE.md'),
        'should rewrite to workspace runtime path');
      assert.ok(!result!.includes(extensionPath.replace(/\\/g, '/')),
        'should not use bundled path when runtime mirror exists');
    } finally {
      fs.rmSync(extensionPath, { recursive: true, force: true });
    }
  });

  it('leaves canonical references unchanged when a workspace override exists', async () => {
    const overrideDir = path.join(tmpDir, '.github', 'templates');
    fs.mkdirSync(overrideDir, { recursive: true });
    fs.writeFileSync(path.join(overrideDir, 'ARCH-REVIEW-TEMPLATE.md'), 'override');

    const agentFile = path.join(tmpDir, '.github', 'agents', 'reviewer-override.agent.md');
    fs.writeFileSync(
      agentFile,
      '---\nname: R\n---\n\nUse .github/templates/ARCH-REVIEW-TEMPLATE.md\n',
    );

    const agentx = createFakeAgentx(tmpDir);
    const result = await loadAgentInstructions(agentx, 'reviewer-override.agent.md');

    assert.ok(result!.includes('.github/templates/ARCH-REVIEW-TEMPLATE.md'),
      'should preserve canonical path when workspace override exists');
  });
});
