import { strict as assert } from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SourceTreeProvider, SourceTreeItem } from '../../views/sourceTreeProvider';

// Minimal AgentXContext stub
function createStubContext(workspaceRoot: string | undefined) {
 return {
  workspaceRoot,
  checkInitialized: async () => !!workspaceRoot,
 } as any;
}

/**
 * Create a temp workspace with a src/ directory structure.
 */
function createSrcDir(
 structure: Record<string, string | Record<string, string>>,
 nested = false,
): string {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-src-'));
 const srcDir = nested
  ? path.join(root, 'vscode-extension', 'src')
  : path.join(root, 'src');
 fs.mkdirSync(srcDir, { recursive: true });

 for (const [name, content] of Object.entries(structure)) {
  if (typeof content === 'string') {
   fs.writeFileSync(path.join(srcDir, name), content, 'utf-8');
  } else {
   const subDir = path.join(srcDir, name);
   fs.mkdirSync(subDir, { recursive: true });
   for (const [fileName, fileContent] of Object.entries(content)) {
    fs.writeFileSync(path.join(subDir, fileName), fileContent, 'utf-8');
   }
  }
 }
 return root;
}

describe('SourceTreeProvider', () => {
 it('should return empty when no workspace root', async () => {
  const provider = new SourceTreeProvider(createStubContext(undefined));
  const items = await provider.getChildren();
  assert.equal(items.length, 0);
 });

 it('should show info when no src/ folder exists', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-src-'));
  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok((items[0].label as string).includes('No src/ folder found'));
 });

 it('should list files in src/', async () => {
  const root = createSrcDir({
   'extension.ts': 'export function activate() {}',
   'utils.ts': 'export const x = 1;',
  });
  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 2);
  const names = items.map(i => i.label);
  assert.ok(names.includes('extension.ts'));
  assert.ok(names.includes('utils.ts'));
 });

 it('should prefer vscode-extension/src/ over src/', async () => {
  const root = createSrcDir({ 'nested.ts': 'hello' }, true);
  // Also create a root-level src/
  const rootSrc = path.join(root, 'src');
  fs.mkdirSync(rootSrc, { recursive: true });
  fs.writeFileSync(path.join(rootSrc, 'root.ts'), 'world', 'utf-8');

  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  // Should show vscode-extension/src/ contents, not root src/
  const names = items.map(i => i.label);
  assert.ok(names.includes('nested.ts'));
  assert.ok(!names.includes('root.ts'));
 });

 it('should fall back to src/ when vscode-extension/src/ does not exist', async () => {
  const root = createSrcDir({
   'main.ts': 'console.log("hello");',
  });
  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'main.ts');
 });

 it('should show folders before files', async () => {
  const root = createSrcDir({
   'extension.ts': 'export function activate() {}',
   'commands': { 'init.ts': '// init' },
  });
  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 2);
  assert.equal(items[0].label, 'commands');
  assert.ok(items[0].isFolder);
  assert.equal(items[1].label, 'extension.ts');
  assert.ok(!items[1].isFolder);
 });

 it('should expand folders to show their contents', async () => {
  const root = createSrcDir({
   'utils': { 'shell.ts': '// shell', 'eventBus.ts': '// bus' },
  });
  const provider = new SourceTreeProvider(createStubContext(root));
  const topItems = await provider.getChildren();
  assert.equal(topItems.length, 1);

  const children = await provider.getChildren(topItems[0]);
  assert.equal(children.length, 2);
  const childNames = children.map(i => i.label);
  assert.ok(childNames.includes('shell.ts'));
  assert.ok(childNames.includes('eventBus.ts'));
 });

 it('should open file on click', async () => {
  const root = createSrcDir({
   'extension.ts': 'export function activate() {}',
  });
  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.ok(items[0].command);
  assert.equal(items[0].command!.command, 'vscode.open');
  assert.ok((items[0].command!.arguments![0] as any).fsPath.includes('extension.ts'));
 });

 it('should skip hidden files and folders', async () => {
  const root = createSrcDir({
   '.hidden.ts': '// hidden',
   'visible.ts': '// visible',
  });
  const provider = new SourceTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'visible.ts');
 });

 it('should refresh and fire event', () => {
  const provider = new SourceTreeProvider(createStubContext(undefined));
  let fired = false;
  provider.onDidChangeTreeData(() => { fired = true; });
  provider.refresh();
  assert.ok(fired);
 });

 describe('SourceTreeItem.info', () => {
  it('should create an info item', () => {
   const item = SourceTreeItem.info('Some message');
   assert.equal(item.label, 'Some message');
   assert.equal(item.contextValue, 'infoItem');
  });
 });

 describe('findSrcDir', () => {
  it('should return undefined when neither src dir exists', () => {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-src-'));
   const result = SourceTreeProvider.findSrcDir(root);
   assert.equal(result, undefined);
  });

  it('should find vscode-extension/src/ first', () => {
   const root = createSrcDir({ 'test.ts': '' }, true);
   fs.mkdirSync(path.join(root, 'src'), { recursive: true });
   const result = SourceTreeProvider.findSrcDir(root);
   assert.ok(result!.includes('vscode-extension'));
  });
 });

 describe('fileIcon', () => {
  it('should return symbol-method for .ts files', () => {
   const icon = SourceTreeProvider.fileIcon('index.ts');
   assert.equal((icon as any).id, 'symbol-method');
  });

  it('should return json icon for .json files', () => {
   const icon = SourceTreeProvider.fileIcon('config.json');
   assert.equal((icon as any).id, 'json');
  });

  it('should return file icon for unknown extensions', () => {
   const icon = SourceTreeProvider.fileIcon('something.xyz');
   assert.equal((icon as any).id, 'file');
  });
 });
});
