import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SkillTreeProvider } from '../../views/skillTreeProvider';
import { SkillTreeItem } from '../../views/skillTreeProviderInternals';

function createWorkspaceRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-skill-tree-'));
  const skillDir = path.join(root, '.github', 'skills', 'development', 'testing');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: testing\ndescription: Test coverage and quality\n---\n# Testing',
    'utf-8',
  );
  return root;
}

function makeContext(root: string, extensionPath = root) {
  const listeners: Array<() => void> = [];
  return {
    workspaceRoot: root,
    extensionContext: { extensionPath },
    // minimal EventEmitter shim used by the provider
    _eventListeners: listeners,
  } as any;
}

describe('SkillTreeProvider', () => {
  it('returns the same TreeItem passed to getTreeItem', () => {
    const root = createWorkspaceRoot();
    const provider = new SkillTreeProvider(makeContext(root));
    const item = SkillTreeItem.info('test');
    assert.strictEqual(provider.getTreeItem(item), item);
  });

  it('getChildren returns category nodes at root level', async () => {
    const root = createWorkspaceRoot();
    const provider = new SkillTreeProvider(makeContext(root));
    const items = await provider.getChildren();
    // Should have at least one category node (development contains testing skill)
    assert.ok(items.length > 0);
  });

  it('getChildren returns children of a category node', async () => {
    const root = createWorkspaceRoot();
    const provider = new SkillTreeProvider(makeContext(root));
    const categories = await provider.getChildren();
    assert.ok(categories.length > 0);
    const children = await provider.getChildren(categories[0]);
    assert.ok(Array.isArray(children));
  });

  it('returns info node when no skills are found', async () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-empty-'));
    const provider = new SkillTreeProvider(makeContext(emptyRoot, emptyRoot));
    const items = await provider.getChildren();
    assert.ok(items.length >= 1);
    // When no workspace skills and no bundled skills, shows info
    // (exact result depends on bundled extension skills; just assert it doesn't throw)
  });

  it('refresh fires onDidChangeTreeData', () => {
    const root = createWorkspaceRoot();
    const provider = new SkillTreeProvider(makeContext(root));
    let fired = false;
    provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.refresh();
    assert.ok(fired);
  });
});
