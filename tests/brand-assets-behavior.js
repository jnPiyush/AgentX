#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { before, test } = require('node:test');
const { ReadmeProcessor } = require('../vscode-extension/node_modules/@vscode/vsce/out/package');
const { patchOptionsWithManifest } = require('../vscode-extension/node_modules/@vscode/vsce/out/util');

const root = path.resolve(__dirname, '..');
const resources = path.join(root, 'vscode-extension', 'resources');
const colourName = 'frontier-ai-coding-harness.svg';
const pngName = 'frontier-ai-coding-harness.png';
const monochromeName = 'frontier-ai-coding-harness-vscode.svg';
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const paths = svg => [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]);

before(() => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-landing.js')]);
});

test('Marketplace uses a transparent 256px PNG and Activity Bar uses the monochrome SVG', () => {
  const manifest = JSON.parse(read('vscode-extension/package.json'));
  assert.equal(manifest.icon, `resources/${pngName}`);
  const sidebar = manifest.contributes.viewsContainers.activitybar.find(view => view.id === 'frontier-sidebar');
  assert.equal(sidebar.icon, `resources/${monochromeName}`);
  const png = fs.readFileSync(path.join(resources, pngName));
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
  assert.equal(png[25], 6, 'RGBA PNG retains the transparent background');
});

test('coloured and theme icons share all five paths without external or active content', () => {
  const colour = fs.readFileSync(path.join(resources, colourName), 'utf8');
  const monochrome = fs.readFileSync(path.join(resources, monochromeName), 'utf8');
  assert.equal(paths(colour).length, 5);
  assert.deepEqual(paths(monochrome), paths(colour));
  assert.match(monochrome, /fill="currentColor"/);
  assert.doesNotMatch(monochrome, /#[0-9a-f]{3,8}\b/i);
  for (const svg of [colour, monochrome]) {
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image)\b|\son\w+=|\b(?:href|src)=/i);
  }
});

test('documentation and landing copies match the canonical coloured SVG', () => {
  const master = fs.readFileSync(path.join(resources, colourName));
  assert.deepEqual(fs.readFileSync(path.join(root, 'docs/assets/frontier-logo.svg')), master);
  assert.deepEqual(fs.readFileSync(path.join(root, 'public/assets/frontier-logo.svg')), master);
  assert.match(read('README.md'), /src="vscode-extension\/resources\/frontier-ai-coding-harness\.png"/);
  assert.match(read('vscode-extension/README.md'), /src="resources\/frontier-ai-coding-harness\.png"/);
});

test('packaged README resolves images from the extension directory, not the repository root', async () => {
  const manifest = JSON.parse(read('vscode-extension/package.json'));
  const options = {};
  patchOptionsWithManifest(options, manifest);
  const processor = new ReadmeProcessor(manifest, options);
  const processed = await processor.processFile({
    path: 'extension/readme.md',
    contents: read('vscode-extension/README.md'),
  });
  const markdown = processed.contents.toString('utf8');
  assert.match(markdown,
    /src="https:\/\/github\.com\/jnPiyush\/AgentX\/raw\/master\/vscode-extension\/resources\/frontier-ai-coding-harness\.png"/);
  assert.doesNotMatch(markdown, /\/raw\/HEAD\/resources\//);
  for (const name of ['architecture-flow', 'delivery-flow']) {
    assert.ok(markdown.includes(
      `https://github.com/jnPiyush/AgentX/raw/master/vscode-extension/resources/diagrams/${name}.png`,
    ));
  }
  const setupLink = markdown.match(/\]\((https:\/\/[^)]+GUIDE\.md#using-frontier[^)]+)\)/);
  assert.ok(setupLink);
  assert.equal(new URL(setupLink[1]).href,
    'https://github.com/jnPiyush/AgentX/blob/master/docs/GUIDE.md#using-frontier-with-github-copilot-cli-and-the-agents-window');
});

test('README diagrams have portable PNG exports and editable Mermaid sources', () => {
  const diagrams = [
    ['README.md', 'core-flow'],
    ['vscode-extension/README.md', 'architecture-flow'],
    ['vscode-extension/README.md', 'delivery-flow'],
  ];
  for (const [readme, name] of diagrams) {
    const markdown = read(readme);
    assert.doesNotMatch(markdown, /^```mermaid\b/m);
    assert.ok(markdown.includes(`resources/diagrams/${name}.png`), name);
    const source = fs.readFileSync(path.join(resources, 'diagrams', `${name}.mmd`), 'utf8');
    assert.match(source, /flowchart /);
    assert.match(source, /accTitle:/);
    const png = fs.readFileSync(path.join(resources, 'diagrams', `${name}.png`));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.ok(png.readUInt32BE(16) > 100 && png.readUInt32BE(20) > 100, name);
  }
});

test('portable diagram sources retain the README workflow relationships', () => {
  const source = name => fs.readFileSync(
    path.join(resources, 'diagrams', `${name}.mmd`), 'utf8');
  const core = source('core-flow');
  assert.match(core, /Intent\[.+\] --> Route\[/);
  for (const edge of ['Route --> Plan', 'Plan --> Build', 'Build --> Verify',
    'Verify -->|"findings"| Build', 'Verify --> Capture', 'Capture --> Done']) {
    assert.ok(core.includes(edge), edge);
  }
  const architecture = source('architecture-flow');
  for (const edge of ['Chat["Copilot Chat"] --> Context["Frontier Context"] --> Engine',
    'Engine --> View', 'Engine --> File', 'View -.->|"Queues and Workflows"| UI',
    'File -.->|"Skills and Templates"| Workspace']) {
    assert.ok(architecture.includes(edge), edge);
  }
  const delivery = source('delivery-flow');
  for (const edge of ['I["Install Extension"] --> W', 'W --> R', 'R --> B', 'B --> E',
    'E --> V', 'V --> C']) {
    assert.ok(delivery.includes(edge), edge);
  }
});

test('prototype and built landing resolve the new header icon and favicon', () => {
  const source = read('docs/ux/prototypes/landing/index.html');
  const built = read('public/index.html');
  assert.match(source, /src="\.\.\/\.\.\/\.\.\/assets\/frontier-logo\.svg"/);
  assert.match(built, /<link rel="icon"[^>]*href="assets\/frontier-logo\.svg"/);
  assert.match(built, /<img class="brand-mark"[^>]*src="assets\/frontier-logo\.svg"[^>]*alt=""/);
  assert.doesNotMatch(built, /class="brand-mark"[^>]*>X</);
  assert.doesNotMatch(built, /\.\.\/\.\.\/\.\.\/assets\/frontier-logo\.svg/);
});

test('obsolete robot resource files are retired', () => {
  for (const name of ['icon.png', 'icon.svg', 'frontier-icon.svg']) {
    assert.equal(fs.existsSync(path.join(resources, name)), false, `${name} must not ship`);
  }
});
