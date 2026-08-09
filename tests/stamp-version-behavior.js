#!/usr/bin/env node

const assert = require('assert');
const { updatePackageLockContent } = require('../scripts/stamp-version');

function fixture(eol) {
  const packageLock = {
    name: 'agentx',
    version: '8.7.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'agentx', version: '8.7.0' },
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
  if (eol === '\r\n') {
    assert.strictEqual(/(?<!\r)\n/.test(output), false);
  }
}

console.log('[PASS] package-lock version stamping supports LF and CRLF');
