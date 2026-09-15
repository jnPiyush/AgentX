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

const checksums = [
  ['vscode-extension/package-lock.json', 'node_modules/brace-expansion', 'sha1-C7oicf631Fiw0xrRNiWqpHVEMeI='],
  ['vscode-extension/package-lock.json', 'node_modules/supports-color', 'sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=='],
  ['companions/whatsapp/package-lock.json', 'node_modules/glob/node_modules/brace-expansion', 'sha1-C7oicf631Fiw0xrRNiWqpHVEMeI='],
  ['companions/whatsapp/package-lock.json', 'node_modules/whatsapp-web.js/node_modules/brace-expansion', 'sha1-C7oicf631Fiw0xrRNiWqpHVEMeI='],
];
for (const [file, dependency, integrity] of checksums) {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  assert.strictEqual(lock.packages[dependency].integrity, integrity, `${file}: ${dependency}`);
}
console.log('[PASS] Brand-like substrings in dependency integrity hashes remain unchanged');
