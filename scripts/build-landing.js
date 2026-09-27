#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'docs', 'ux', 'prototypes', 'landing');
const destination = path.join(root, 'public');
const brandIcon = path.join(root, 'vscode-extension', 'resources', 'frontier-ai-coding-harness.svg');

fs.copyFileSync(brandIcon, path.join(root, 'docs', 'assets', 'frontier-logo.svg'));
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
fs.mkdirSync(path.join(destination, 'assets'), { recursive: true });
fs.copyFileSync(brandIcon, path.join(destination, 'assets', 'frontier-logo.svg'));
const index = path.join(destination, 'index.html');
fs.writeFileSync(
  index,
  fs.readFileSync(index, 'utf8').replaceAll('../../../assets/frontier-logo.svg', 'assets/frontier-logo.svg'),
  'utf8',
);
process.stdout.write(`[PASS] Built landing output at ${destination}\n`);
