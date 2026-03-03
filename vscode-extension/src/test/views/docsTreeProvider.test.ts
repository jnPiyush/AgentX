import { strict as assert } from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DocsTreeProvider, DocsTreeItem } from '../../views/docsTreeProvider';

// Minimal AgentXContext stub
function createStubContext(workspaceRoot: string | undefined) {
 return {
  workspaceRoot,
  checkInitialized: async () => !!workspaceRoot,
 } as any;
}

/**
 * Create a temp workspace with a docs/ directory structure.
 */
function createDocsDir(structure: Record<string, string | Record<string, string>>): string {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-docs-'));
 const docsDir = path.join(root, 'docs');
 fs.mkdirSync(docsDir, { recursive: true });

 for (const [name, content] of Object.entries(structure)) {
  if (typeof content === 'string') {
   fs.writeFileSync(path.join(docsDir, name), content, 'utf-8');
  } else {
   // It's a subfolder
   const subDir = path.join(docsDir, name);
   fs.mkdirSync(subDir, { recursive: true });
   for (const [fileName, fileContent] of Object.entries(content)) {
    fs.writeFileSync(path.join(subDir, fileName), fileContent, 'utf-8');
   }
  }
 }
 return root;
}

describe('DocsTreeProvider', () => {
 it('should return empty when no workspace root', async () => {
  const provider = new DocsTreeProvider(createStubContext(undefined));
  const items = await provider.getChildren();
  assert.equal(items.length, 0);
 });

 it('should show info when docs/ does not exist', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-docs-'));
  const provider = new DocsTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok((items[0].label as string).includes('No docs/ folder found'));
 });

 it('should list files in docs/', async () => {
  const root = createDocsDir({
   'GUIDE.md': '# Guide',
   'README.md': '# Readme',
  });
  const provider = new DocsTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 2);
  const names = items.map(i => i.label);
  assert.ok(names.includes('GUIDE.md'));
  assert.ok(names.includes('README.md'));
 });

 it('should show folders before files', async () => {
  const root = createDocsDir({
   'GUIDE.md': '# Guide',
   'prd': { 'PRD-1.md': '# PRD 1' },
  });
  const provider = new DocsTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 2);
  // Folder should come first
  assert.equal(items[0].label, 'prd');
  assert.ok(items[0].isFolder);
  assert.equal(items[1].label, 'GUIDE.md');
  assert.ok(!items[1].isFolder);
 });

 it('should expand folders to show their contents', async () => {
  const root = createDocsDir({
   'adr': { 'ADR-001.md': '# ADR', 'ADR-002.md': '# ADR 2' },
  });
  const provider = new DocsTreeProvider(createStubContext(root));
  const topItems = await provider.getChildren();
  assert.equal(topItems.length, 1);
  assert.equal(topItems[0].label, 'adr');

  // Expand the folder
  const children = await provider.getChildren(topItems[0]);
  assert.equal(children.length, 2);
  const childNames = children.map(i => i.label);
  assert.ok(childNames.includes('ADR-001.md'));
  assert.ok(childNames.includes('ADR-002.md'));
 });

 it('should open file on click', async () => {
  const root = createDocsDir({
   'GUIDE.md': '# Guide',
  });
  const provider = new DocsTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok(items[0].command);
  assert.equal(items[0].command!.command, 'vscode.open');
  assert.ok((items[0].command!.arguments![0] as any).fsPath.includes('GUIDE.md'));
 });

 it('should skip hidden files and folders', async () => {
  const root = createDocsDir({
   '.hidden': '# hidden',
   'visible.md': '# visible',
  });
  const provider = new DocsTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'visible.md');
 });

 it('should refresh and fire event', () => {
  const provider = new DocsTreeProvider(createStubContext(undefined));
  let fired = false;
  provider.onDidChangeTreeData(() => { fired = true; });
  provider.refresh();
  assert.ok(fired);
 });

 describe('DocsTreeItem.info', () => {
  it('should create an info item', () => {
   const item = DocsTreeItem.info('Some message');
   assert.equal(item.label, 'Some message');
   assert.equal(item.contextValue, 'infoItem');
  });
 });

 describe('buildChildren', () => {
  it('should return empty for non-existent directory', () => {
   const items = DocsTreeProvider.buildChildren('/path/that/does/not/exist');
   assert.equal(items.length, 0);
  });
 });

 describe('fileIcon', () => {
  it('should return markdown icon for .md files', () => {
   const icon = DocsTreeProvider.fileIcon('README.md');
   assert.equal((icon as any).id, 'markdown');
  });

  it('should return json icon for .json files', () => {
   const icon = DocsTreeProvider.fileIcon('config.json');
   assert.equal((icon as any).id, 'json');
  });

  it('should return file icon for unknown extensions', () => {
   const icon = DocsTreeProvider.fileIcon('something.xyz');
   assert.equal((icon as any).id, 'file');
  });
 });
});
