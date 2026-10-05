'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('native loop helpers are included in standalone and extension delivery', () => {
  const copy = fs.readFileSync(path.join(root, 'vscode-extension', 'scripts', 'copy-assets.js'), 'utf8');
  const ps = fs.readFileSync(path.join(root, 'packs', 'frontier-copilot-cli', 'install.ps1'), 'utf8');
  const sh = fs.readFileSync(path.join(root, 'packs', 'frontier-copilot-cli', 'install.sh'), 'utf8');
  const core = JSON.parse(fs.readFileSync(path.join(root, 'packs', 'frontier-core', 'manifest.json'), 'utf8'));
  for (const filename of ['loop-engineering.ps1', 'loop-static-checks.js']) {
    assert.ok(copy.includes(`'${filename}'`));
    assert.ok(ps.includes(`'${filename}'`));
    assert.ok(sh.includes(`"${filename}"`));
    assert.ok(core.artifacts.scripts.includes(`.frontier/runtime/${filename}`));
  }
  assert.ok(ps.includes("Source = 'scripts/scrub.ps1'; Destination = '.github/frontier/scripts/scrub.ps1'"));
  assert.ok(sh.includes('copy_file "scripts/scrub.ps1" ".github/frontier/scripts/scrub.ps1"'));
  assert.ok(core.artifacts.scripts.includes('scripts/scrub.ps1'));
});

test('documentation parity uses the generator transformations without changing files', () => {
  const files = ['Skills.md', 'docs/WORKFLOW.md', 'docs/guides/CODING-HARNESS.md']
    .map(relative => path.join(root, 'vscode-extension', '.github', relative));
  const before = files.map(file => fs.readFileSync(file));
  const result = spawnSync(process.execPath, [path.join(root, 'vscode-extension', 'scripts', 'copy-assets.js'), '--check'], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });

  test('the correctness diff check ignores cosmetic whitespace but still detects conflict markers', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-loop-whitespace-'));
    const before = path.join(temporary, 'before.json');
    const after = path.join(temporary, 'after.json');
    const check = () => spawnSync('git', ['-c', 'core.whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab',
      'diff', '--no-index', '--check', before, after], { encoding: 'utf8', timeout: 10000 });
    try {
      fs.writeFileSync(before, '{"version":1}\n');
      fs.writeFileSync(after, '{"version":2}  \n\n');
      const cosmetic = check();
      assert.equal(cosmetic.error, undefined);
      assert.equal(cosmetic.status & 2, 0, cosmetic.stdout + cosmetic.stderr);
      fs.writeFileSync(after, '<<<<<<< HEAD\n{"version":1}\n=======\n{"version":2}\n>>>>>>> branch\n');
      const conflict = check();
      assert.equal(conflict.status & 2, 2, conflict.stdout + conflict.stderr);
      assert.match(conflict.stdout, /conflict marker/);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).mode, 'read-only');
  for (const [index, file] of files.entries()) assert.deepEqual(fs.readFileSync(file), before[index]);
});
