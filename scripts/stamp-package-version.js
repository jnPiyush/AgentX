#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const packageDirectory = process.argv[2];
const version = process.argv[3];
if (!packageDirectory || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/stamp-package-version.js <package-directory> <semver>');
}

function updateJson(filePath, update) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  update(value);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const packagePath = path.resolve(packageDirectory, 'package.json');
const lockPath = path.resolve(packageDirectory, 'package-lock.json');
const serverPath = path.resolve(packageDirectory, 'index.js');
updateJson(packagePath, (manifest) => {
  manifest.version = version;
});
updateJson(lockPath, (lock) => {
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
});

try {
  const serverSource = fs.readFileSync(serverPath, 'utf8');
  const serverPattern = /({ name: 'agentx', version: ')\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(' })/;
  if (!serverPattern.test(serverSource)) {
    throw new Error(`AgentX server version declaration not found in ${serverPath}`);
  }
  fs.writeFileSync(serverPath, serverSource.replace(serverPattern, `$1${version}$2`));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

process.stdout.write(`[PASS] Stamped ${packageDirectory} to ${version}\n`);
