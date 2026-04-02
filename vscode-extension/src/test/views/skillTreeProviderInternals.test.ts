import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  collectSkillEntries,
  groupSkillsByCategory,
  SkillTreeItem,
} from '../../views/skillTreeProviderInternals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkillDir(base: string, category: string, skillName: string, description = 'A test skill'): string {
  const dir = path.join(base, category, skillName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: '${description}'\n---\n\n# ${skillName}\n`,
    'utf-8',
  );
  return dir;
}

// ---------------------------------------------------------------------------
// collectSkillEntries
// ---------------------------------------------------------------------------

describe('collectSkillEntries', () => {
  let tmpRoot: string;
  let skillsBase: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-skills-test-'));
    skillsBase = path.join(tmpRoot, '.github', 'skills');
    fs.mkdirSync(skillsBase, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns empty array when no skills directory exists', () => {
    const result = collectSkillEntries('/nonexistent-workspace', '/nonexistent-ext');
    assert.deepEqual(result, []);
  });

  it('discovers skills from workspace skills directory', () => {
    makeSkillDir(skillsBase, 'development', 'testing', 'Unit and integration testing');
    makeSkillDir(skillsBase, 'architecture', 'security', 'Security patterns');

    const result = collectSkillEntries(tmpRoot, '/nonexistent-ext');

    assert.equal(result.length, 2);
    const names = result.map((e) => e.name);
    assert.ok(names.includes('Testing'), 'should include Testing skill');
    assert.ok(names.includes('Security'), 'should include Security skill');
  });

  it('sets correct category on each entry', () => {
    makeSkillDir(skillsBase, 'development', 'testing');
    makeSkillDir(skillsBase, 'languages', 'python');

    const result = collectSkillEntries(tmpRoot, '/nonexistent-ext');

    const categories = result.map((e) => e.category);
    assert.ok(categories.includes('development'));
    assert.ok(categories.includes('languages'));
  });

  it('deduplicates same skill from workspace and extension paths', () => {
    makeSkillDir(skillsBase, 'development', 'testing');
    // Duplicate in a second base would be deduplicated via 'seen' set
    makeSkillDir(skillsBase, 'development', 'testing');

    const result = collectSkillEntries(tmpRoot, '/nonexistent-ext');
    const testingEntries = result.filter((e) => e.category === 'development' && e.name === 'Testing');
    assert.equal(testingEntries.length, 1, 'should not duplicate the same skill');
  });

  it('skips skill files that do not exist', () => {
    // Create a category dir without SKILL.md inside
    const emptySkillDir = path.join(skillsBase, 'development', 'empty-skill');
    fs.mkdirSync(emptySkillDir, { recursive: true });

    const result = collectSkillEntries(tmpRoot, '/nonexistent-ext');
    assert.equal(result.length, 0);
  });

  it('parses description from SKILL.md frontmatter', () => {
    makeSkillDir(skillsBase, 'data', 'databricks', 'Build Databricks pipelines');

    const result = collectSkillEntries(tmpRoot, '/nonexistent-ext');
    assert.equal(result.length, 1);
    assert.ok(result[0].description.includes('Databricks'), 'should parse description from frontmatter');
  });

  it('returns entries sorted by category then name', () => {
    makeSkillDir(skillsBase, 'testing', 'e2e-testing');
    makeSkillDir(skillsBase, 'architecture', 'security');
    makeSkillDir(skillsBase, 'architecture', 'api-design');

    const result = collectSkillEntries(tmpRoot, '/nonexistent-ext');

    assert.equal(result[0].category, 'architecture', 'architecture should come before testing');
    assert.equal(result[0].name, 'Api Design', 'api-design before security alphabetically');
    assert.equal(result[1].name, 'Security');
    assert.equal(result[2].category, 'testing');
  });
});

// ---------------------------------------------------------------------------
// groupSkillsByCategory
// ---------------------------------------------------------------------------

describe('groupSkillsByCategory', () => {
  it('returns empty array for empty input', () => {
    const result = groupSkillsByCategory([]);
    assert.deepEqual(result, []);
  });

  it('creates one category item per unique category', () => {
    const entries = [
      { name: 'Testing', category: 'development', description: 'Tests', filePath: '/p1', relativePath: 'r1' },
      { name: 'Security', category: 'architecture', description: 'Sec', filePath: '/p2', relativePath: 'r2' },
      { name: 'Error Handling', category: 'development', description: 'Errors', filePath: '/p3', relativePath: 'r3' },
    ];

    const result = groupSkillsByCategory(entries);

    assert.equal(result.length, 2, 'should create one item per category');
    const labels = result.map((i) => i.label);
    assert.ok(labels.includes('Architecture'));
    assert.ok(labels.includes('Development'));
  });

  it('category items are collapsed by default', () => {
    const entries = [
      { name: 'Testing', category: 'development', description: '', filePath: '/p', relativePath: 'r' },
    ];

    const result = groupSkillsByCategory(entries);
    assert.equal(
      result[0].collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
  });

  it('category item description shows child count', () => {
    const entries = [
      { name: 'Testing', category: 'development', description: '', filePath: '/p1', relativePath: 'r1' },
      { name: 'Error Handling', category: 'development', description: '', filePath: '/p2', relativePath: 'r2' },
    ];

    const result = groupSkillsByCategory(entries);
    assert.equal(result[0].description, '2', 'category description should show count');
  });

  it('skill children have open-file command', () => {
    const entries = [
      { name: 'Testing', category: 'development', description: '', filePath: '/skill/SKILL.md', relativePath: 'r' },
    ];

    const result = groupSkillsByCategory(entries);
    const child = result[0].children?.[0];
    assert.ok(child, 'should have child items');
    assert.equal(child.command?.command, 'vscode.open');
    assert.ok(
      (child.command?.arguments?.[0] as vscode.Uri).fsPath.includes('SKILL.md'),
    );
  });

  it('uses unknown category label for unregistered categories', () => {
    const entries = [
      { name: 'Fancy Skill', category: 'fancy-new-category', description: '', filePath: '/p', relativePath: 'r' },
    ];

    const result = groupSkillsByCategory(entries);
    assert.equal(result[0].label, 'Fancy New Category', 'should title-case unknown categories');
  });
});

// ---------------------------------------------------------------------------
// SkillTreeItem static factories
// ---------------------------------------------------------------------------

describe('SkillTreeItem', () => {
  it('info() creates a non-collapsible info item', () => {
    const item = SkillTreeItem.info('No skills found', 'hint text');
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.equal(item.label, 'No skills found');
    assert.equal(item.description, 'hint text');
    assert.equal(item.contextValue, 'skillInfo');
  });

  it('skill() creates a leaf item with vscode.open command', () => {
    const entry = {
      name: 'Python',
      category: 'languages',
      description: 'Python best practices',
      filePath: '/path/to/SKILL.md',
      relativePath: '.github/skills/languages/python/SKILL.md',
    };
    const item = SkillTreeItem.skill(entry);
    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.equal(item.contextValue, 'skill');
    assert.equal(item.command?.command, 'vscode.open');
  });

  it('skill() truncates long descriptions to 60 chars', () => {
    const longDesc = 'A'.repeat(80);
    const entry = {
      name: 'Long Skill', category: 'dev', description: longDesc,
      filePath: '/p', relativePath: 'r',
    };
    const item = SkillTreeItem.skill(entry);
    assert.ok((item.description as string).length <= 60);
    assert.ok((item.description as string).endsWith('...'));
  });

  it('category() creates a collapsed item with children', () => {
    const children = [SkillTreeItem.info('child1'), SkillTreeItem.info('child2')];
    const cat = SkillTreeItem.category('Development', 'code', children, 2);
    assert.equal(cat.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.equal(cat.children?.length, 2);
    assert.equal(cat.contextValue, 'skillCategory');
    assert.equal(cat.description, '2');
  });
});
