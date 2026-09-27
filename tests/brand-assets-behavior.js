#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { before, test } = require('node:test');

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
  assert.match(read('README.md'), /src="docs\/assets\/frontier-logo\.svg"/);
  assert.match(read('vscode-extension/README.md'), /src="resources\/frontier-ai-coding-harness\.png"/);
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
