'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const manifestScript = path.resolve(__dirname, '..', 'scripts', 'install-manifest.ps1');

test('source inventory patterns do not accidentally include optional companion scripts', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-manifest-scope-'));
  try {
    for (const file of ['scripts/owned.ps1', '.github/skills/example/scripts/helper.ps1', 'companions/example/scripts/optional.js']) {
      fs.mkdirSync(path.dirname(path.join(workspace, file)), { recursive: true });
      fs.writeFileSync(path.join(workspace, file), '// fixture');
    }
    const result = spawnSync('pwsh', ['-NoProfile', '-File', manifestScript, '-Action', 'generate'], {
      cwd: workspace, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(workspace, '.frontier', 'runtime', 'install-manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
    assert.ok(manifest.files.some(file => file.path === 'scripts/owned.ps1'));
    assert.ok(manifest.files.some(file => file.path === '.github/skills/example/scripts/helper.ps1'));
    assert.ok(!manifest.files.some(file => file.path.startsWith('companions/')));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('installed manifest tracks private Cursor templates, not optional shared user config', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-cursor-manifest-'));
  const hashes = value => crypto.createHash('sha256').update(value).digest('hex');
  try {
    const files = [
      { path: '.cursor/commands/frontier.md', sha256: hashes('role'), category: 'prompt' },
      { path: '.cursor/mcp.json', sha256: hashes('{}'), category: 'config', shared: true },
      { path: '.cursor/hooks.json', sha256: hashes('{}'), category: 'hook', shared: true },
    ];
    for (const file of files) {
      const privatePath = path.join(workspace, '.frontier', 'runtime', 'cursor-assets', file.path.substring(8));
      fs.mkdirSync(path.dirname(privatePath), { recursive: true });
      fs.writeFileSync(privatePath, file.category === 'prompt' ? 'role' : '{}');
    }
    fs.mkdirSync(path.join(workspace, '.cursor', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.cursor', 'commands', 'frontier.md'), 'role');
    const source = path.join(workspace, 'source-manifest.json');
    fs.writeFileSync(source, JSON.stringify({ version: '9.7.0', createdAt: new Date().toISOString(), files }));
    const install = spawnSync('pwsh', ['-NoProfile', '-File', manifestScript, '-Action', 'install', '-SourceManifest', source], {
      cwd: workspace, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(install.status, 0, install.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(workspace, '.frontier', 'runtime', 'install-manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(manifest.files.length, 4);
    assert.ok(!manifest.files.some(file => ['.cursor/mcp.json', '.cursor/hooks.json'].includes(file.path)));
    const verify = () => spawnSync('pwsh', ['-NoProfile', '-File', manifestScript, '-Action', 'verify', '-Strict'], {
      cwd: workspace, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(verify().status, 0, 'shared config absent before opting into Cursor');
    fs.writeFileSync(path.join(workspace, '.cursor', 'mcp.json'), '{"mcpServers":{"user":{"command":"user-server"}}}');
    assert.equal(verify().status, 0, 'user servers do not become wholly owned manifest files');
    fs.unlinkSync(path.join(workspace, '.frontier', 'runtime', 'cursor-assets', 'hooks.json'));
    assert.equal(verify().status, 1, 'missing canonical Cursor template is detected');
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
