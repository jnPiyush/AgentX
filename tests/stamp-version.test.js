const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const nodeTest = require('node:test');
const { updateReadmeContent } = require('../scripts/stamp-version');

nodeTest.test('source-version stamping preserves publication facts and rejects missing badges', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const stampedReadme = updateReadmeContent(readme, '99.0.0');
  assert.strictEqual(stampedReadme, readme
    .replace(/badge\/Version-[0-9.]+-/, 'badge/Version-99.0.0-')
    .replace(/alt="Source version \d+\.\d+\.\d+"/, 'alt="Source version 99.0.0"'));
  assert.strictEqual(stampedReadme.includes('releases/tag/v99.0.0'), false);
  const missingBadge = spawnSync(process.execPath, ['-e',
    "require('./scripts/stamp-version').updateReadmeContent('missing source badge', '99.0.0')"],
  { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.strictEqual(missingBadge.status, 1);
  assert.match(missingBadge.stderr, /Pattern not found/);
});