#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { updatePackageLockContent } = require('../scripts/stamp-version');

function fixture(eol) {
  const packageLock = {
    name: 'agentx',
    version: '8.7.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'agentx', version: '8.7.0' },
      'node_modules/brace-expansion': {
        version: '1.1.12',
        integrity: 'sha1-C7oicf631Fiw0xrRNiWqpHVEMeI=',
      },
      'node_modules/supports-color': {
        version: '8.1.1',
        integrity: 'sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==',
      },
    },
  };
  return `${JSON.stringify(packageLock, null, 2).replace(/\n/g, eol)}${eol}`;
}

for (const eol of ['\n', '\r\n']) {
  const input = fixture(eol);
  const output = updatePackageLockContent(input, '8.7.1');

  assert.strictEqual((output.match(/"version": "8\.7\.1"/g) || []).length, 2);
  assert.strictEqual(output.includes('"version": "8.7.0"'), false);
  assert.strictEqual(output.includes(eol), true);
  const expected = JSON.parse(input);
  expected.version = '8.7.1';
  expected.packages[''].version = '8.7.1';
  assert.deepStrictEqual(JSON.parse(output), expected);
  if (eol === '\r\n') {
    assert.strictEqual(/(?<!\r)\n/.test(output), false);
  }
}

console.log('[PASS] package-lock version stamping supports LF and CRLF');

const current = fs.readFileSync(path.join(__dirname, '..', 'vscode-extension/package-lock.json'), 'utf8');
const expected = JSON.parse(current);
expected.version = '99.0.0';
expected.packages[''].version = '99.0.0';
assert.deepStrictEqual(JSON.parse(updatePackageLockContent(current, '99.0.0')), expected);
console.log('[PASS] Fixed brand-like checksum fixtures and current dependency entries remain unchanged');
