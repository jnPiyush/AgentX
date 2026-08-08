#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'docs', 'ux', 'prototypes', 'landing');
const destination = path.join(root, 'public');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
process.stdout.write(`[PASS] Built landing output at ${destination}\n`);
