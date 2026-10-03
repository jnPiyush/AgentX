const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const helpers = [
  'repository-context.ps1', 'repository-symbols.ps1', 'repository-retrieval.ps1',
  'repository-parser-worker.ps1', 'repository-process.cs', 'workspace-sandbox.ps1',
  'guided-interaction.ps1',
];

test('both standalone CLI runtime inventories contain every graph/native dependency', () => {
  const ps = read('packs/frontier-copilot-cli/install.ps1');
  const sh = read('packs/frontier-copilot-cli/install.sh');
  const manifest = JSON.parse(read('packs/frontier-copilot-cli/manifest.json'));
  for (const helper of helpers) {
    assert.ok(ps.includes(`'${helper}'`), `PowerShell inventory: ${helper}`);
    assert.ok(sh.includes(`"${helper}"`), `Bash inventory: ${helper}`);
    assert.ok(manifest.artifacts.runtime.some(file => file.endsWith(`/${helper}`)),
      `Pack manifest: ${helper}`);
  }
  for (const file of ['repository-parser/index.js', 'repository-parser/package.json',
    'repository-parser/package-lock.json']) {
    assert.ok(ps.includes(file));
    assert.ok(sh.includes(file));
  }
});

test('root and CLI installers bootstrap discovery after configuration and gate parser restore', () => {
  for (const file of ['install.ps1', 'install.sh', 'packs/frontier-copilot-cli/install.ps1',
    'packs/frontier-copilot-cli/install.sh']) {
    const content = read(file);
    assert.ok(content.includes('context --start-refresh'), `${file} must start discovery`);
    assert.ok(content.includes('context-parsers restore'), `${file} must offer explicit parser setup`);
    assert.ok(/GraphParsers|GRAPH_PARSERS/.test(content), `${file} must not install parsers implicitly`);
  }
});

test('managed parser manifest matches lockfile versions and has no lifecycle install hooks', () => {
  const manifest = JSON.parse(read('.frontier/runtime/repository-parser/package.json'));
  const lock = JSON.parse(read('.frontier/runtime/repository-parser/package-lock.json'));
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  for (const hook of ['preinstall', 'install', 'postinstall']) {
    assert.equal(manifest.scripts[hook], undefined);
  }
});

test('extension asset generator ships parser and shared boundary source', () => {
  const source = read('vscode-extension/scripts/copy-assets.js');
  for (const helper of helpers) assert.ok(source.includes(`'${helper}'`));
  assert.ok(source.includes('parserDestination'));
  assert.ok(source.includes('node_modules'));
});
