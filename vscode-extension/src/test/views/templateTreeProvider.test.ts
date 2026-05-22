import { strict as assert } from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TemplateTreeProvider, TemplateTreeItem } from '../../views/templateTreeProvider';
import { clearRegistryCache } from '../../utils/registryLoader';

// Minimal AgentXContext stub
function createStubContext(workspaceRoot: string | undefined) {
 return {
  workspaceRoot,
  checkInitialized: async () => !!workspaceRoot,
 } as any;
}

/**
 * Create a temp directory with template files for testing.
 */
function createTemplatesDir(templates: Record<string, string>): string {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-tmpl-'));
 const dir = path.join(root, '.github', 'templates');
 fs.mkdirSync(dir, { recursive: true });
 for (const [name, content] of Object.entries(templates)) {
  fs.writeFileSync(path.join(dir, name), content, 'utf-8');
 }
 return root;
}

function createRuntimeTemplatesDir(templates: Record<string, string>): string {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-runtime-tmpl-'));
 const dir = path.join(root, '.agentx', 'runtime', 'templates');
 fs.mkdirSync(dir, { recursive: true });
 for (const [name, content] of Object.entries(templates)) {
  fs.writeFileSync(path.join(dir, name), content, 'utf-8');
 }
 return root;
}

describe('TemplateTreeProvider', () => {
 it('should return empty when no workspace root', async () => {
  const provider = new TemplateTreeProvider(createStubContext(undefined));
  const items = await provider.getChildren();
  assert.equal(items.length, 0);
 });

 it('should show info when templates dir does not exist', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-tmpl-'));
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok((items[0].label as string).includes('No templates'));
 });

 it('should list templates from hidden runtime defaults when no workspace override exists', async () => {
  const root = createRuntimeTemplatesDir({
   'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "runtime"\n  required: true\n---\n# PRD',
  });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'PRD');
  assert.ok((items[0].command!.arguments![0] as any).fsPath.includes(path.join('.agentx', 'runtime', 'templates')));
 });

 it('should prefer workspace template overrides over hidden runtime defaults', async () => {
  const root = createTemplatesDir({
   'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "workspace"\n  required: true\n---\n# PRD',
  });
  const runtimeDir = path.join(root, '.agentx', 'runtime', 'templates');
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, 'PRD-TEMPLATE.md'), '---\ninputs:\n a:\n  description: "runtime"\n  required: false\n---\n# PRD', 'utf-8');

  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok((items[0].command!.arguments![0] as any).fsPath.includes(path.join('.github', 'templates')));
 });

 it('should show info when templates dir is empty', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-tmpl-'));
  const dir = path.join(root, '.github', 'templates');
  fs.mkdirSync(dir, { recursive: true });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok((items[0].label as string).includes('No templates'));
 });

 it('should list template files', async () => {
  const root = createTemplatesDir({
   'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "test"\n  required: true\n---\n# PRD',
   'ADR-TEMPLATE.md': '---\ninputs:\n b:\n  description: "other"\n  required: false\n---\n# ADR',
  });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 2);
  const names = items.map(i => i.label);
  assert.ok(names.includes('ADR'));
  assert.ok(names.includes('PRD'));
 });

 it('should open template file on click', async () => {
  const root = createTemplatesDir({
   'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "test"\n  required: true\n---\n# PRD',
  });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.ok(items[0].command);
  assert.equal(items[0].command!.command, 'vscode.open');
  assert.ok((items[0].command!.arguments![0] as any).fsPath.includes('PRD-TEMPLATE.md'));
 });

 it('should show input count as description', async () => {
  const root = createTemplatesDir({
   'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "x"\n  required: true\n b:\n  description: "y"\n  required: false\n---\n# PRD',
  });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items[0].description, '2 inputs');
 });

 it('should not expose input metadata as expandable children', async () => {
  const root = createTemplatesDir({
   'REVIEW-TEMPLATE.md': '---\ninputs:\n story_title:\n  description: "Title"\n  required: true\n  default: ""\n reviewer:\n  description: "Reviewer name"\n  required: false\n  default: "Agent"\n---\n# Review',
  });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);

  const children = await provider.getChildren(items[0]);
  assert.equal(children.length, 0);
 });

 it('should handle template with no frontmatter', async () => {
  const root = createTemplatesDir({
   'SIMPLE-TEMPLATE.md': '# Just a heading\nNo frontmatter here.',
  });
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'SIMPLE');
  assert.equal(items[0].description, '0 inputs');
 });

 it('should ignore non-md files', async () => {
  const root = createTemplatesDir({
   'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "x"\n  required: true\n---\n# PRD',
  });
  // Add a non-md file
  fs.writeFileSync(
   path.join(root, '.github', 'templates', 'README.txt'),
   'Not a template',
   'utf-8'
  );
  const provider = new TemplateTreeProvider(createStubContext(root));
  const items = await provider.getChildren();
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'PRD');
 });

 describe('parseTemplate', () => {
  it('should parse inputs with all properties', () => {
   const root = createTemplatesDir({
    'TEST-TEMPLATE.md': '---\ninputs:\n epic_title:\n  description: "Title of the Epic"\n  required: true\n  default: ""\n priority:\n  description: "Priority level"\n  required: false\n  default: "p2"\n---\n# Test',
   });
   const filePath = path.join(root, '.github', 'templates', 'TEST-TEMPLATE.md');
   const def = TemplateTreeProvider.parseTemplate(filePath, 'TEST-TEMPLATE.md');

   assert.equal(def.name, 'TEST');
   assert.equal(def.inputs.length, 2);

   assert.equal(def.inputs[0].name, 'epic_title');
   assert.equal(def.inputs[0].description, 'Title of the Epic');
   assert.equal(def.inputs[0].required, true);
   assert.equal(def.inputs[0].defaultValue, '');

   assert.equal(def.inputs[1].name, 'priority');
   assert.equal(def.inputs[1].description, 'Priority level');
   assert.equal(def.inputs[1].required, false);
   assert.equal(def.inputs[1].defaultValue, 'p2');
  });

  it('should return empty inputs for file without frontmatter', () => {
   const root = createTemplatesDir({
    'PLAIN-TEMPLATE.md': '# No frontmatter',
   });
   const filePath = path.join(root, '.github', 'templates', 'PLAIN-TEMPLATE.md');
   const def = TemplateTreeProvider.parseTemplate(filePath, 'PLAIN-TEMPLATE.md');
   assert.equal(def.name, 'PLAIN');
   assert.equal(def.inputs.length, 0);
  });
 });

 describe('TemplateTreeItem.info', () => {
  it('should create an info item', () => {
   const item = TemplateTreeItem.info('Some message');
   assert.equal(item.label, 'Some message');
   assert.equal(item.contextValue, 'infoItem');
  });
 });

 describe('JSON registry path', () => {
  beforeEach(() => clearRegistryCache());
  afterEach(() => clearRegistryCache());

  it('should prefer templates.json registry over filesystem scan when registry is present', async () => {
   // Create the actual template file so resolveRegistryAssetPath can find it
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-tmpl-reg-'));
   const templateDir = path.join(root, '.github', 'templates');
   fs.mkdirSync(templateDir, { recursive: true });
   fs.writeFileSync(
    path.join(templateDir, 'PRD-TEMPLATE.md'),
    '---\ninputs:\n a:\n  description: "x"\n  required: true\n---\n# PRD',
    'utf-8',
   );

   // Also put an ADR template on disk that the registry intentionally omits
   fs.writeFileSync(
    path.join(templateDir, 'ADR-TEMPLATE.md'),
    '---\ninputs:\n a:\n  description: "y"\n  required: true\n---\n# ADR',
    'utf-8',
   );

   // Write a registry that lists only PRD
   const registryDir = path.join(root, '.github', 'registries');
   fs.mkdirSync(registryDir, { recursive: true });
   fs.writeFileSync(
    path.join(registryDir, 'templates.json'),
    JSON.stringify({
     $schemaVersion: 1,
     totalCount: 1,
     templates: [{ name: 'PRD', path: '.github/templates/PRD-TEMPLATE.md' }],
    }, null, 2),
    'utf-8',
   );

   const provider = new TemplateTreeProvider(createStubContext(root));
   const items = await provider.getChildren();

   // Registry lists only PRD, so the provider must not return ADR
   const labels = items.map((i) => i.label as string);
   assert.ok(labels.includes('PRD'), 'registry-listed template should appear');
   assert.ok(!labels.includes('ADR'), 'template absent from registry should be excluded when registry is present');

   fs.rmSync(root, { recursive: true, force: true });
  });

  it('should fall back to filesystem scan when templates.json is absent', async () => {
   const root = createTemplatesDir({
    'PRD-TEMPLATE.md': '---\ninputs:\n a:\n  description: "x"\n  required: true\n---\n# PRD',
    'ADR-TEMPLATE.md': '---\ninputs:\n a:\n  description: "y"\n  required: true\n---\n# ADR',
   });

   const provider = new TemplateTreeProvider(createStubContext(root));
   const items = await provider.getChildren();

   const labels = items.map((i) => i.label as string);
   assert.ok(labels.includes('PRD'), 'PRD should appear via filesystem scan');
   assert.ok(labels.includes('ADR'), 'ADR should appear via filesystem scan when no registry exists');

   fs.rmSync(root, { recursive: true, force: true });
  });
 });

 it('should refresh and fire event', () => {
  const provider = new TemplateTreeProvider(createStubContext(undefined));
  let fired = false;
  provider.onDidChangeTreeData(() => { fired = true; });
  provider.refresh();
  assert.ok(fired);
 });
});
