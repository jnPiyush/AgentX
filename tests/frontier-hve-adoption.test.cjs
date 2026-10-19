'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

function runPwshJson(scriptRel, args, cwd = root) {
  const result = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, scriptRel), ...args, '-Json'], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
  });
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    json: result.stdout.trim() ? JSON.parse(result.stdout.trim()) : null,
  };
}

test('Frontier-HVE parity scripts are registered in CLI, MCP, VSIX generator, and core pack manifest', () => {
  const cli = fs.readFileSync(path.join(root, '.frontier', 'runtime', 'frontier-cli.ps1'), 'utf8');
  const mcp = fs.readFileSync(path.join(root, '.frontier', 'runtime', 'mcp-server', 'index.js'), 'utf8');
  const copy = fs.readFileSync(path.join(root, 'vscode-extension', 'scripts', 'copy-assets.js'), 'utf8');
  const core = JSON.parse(fs.readFileSync(path.join(root, 'packs', 'frontier-core', 'manifest.json'), 'utf8'));

  for (const scriptName of ['provenance.ps1', 'templates.ps1', 'recommend-skills.ps1']) {
    assert.ok(fs.existsSync(path.join(root, 'scripts', scriptName)), `Missing scripts/${scriptName}`);
    assert.ok(copy.includes(`'${scriptName}'`), `copy-assets.js missing ${scriptName}`);
    assert.ok(core.artifacts.scripts.includes(`scripts/${scriptName}`), `frontier-core manifest missing scripts/${scriptName}`);
  }

  for (const cmd of ['provenance', 'templates', 'recommend-skills', 'context-load', 'check-context-load']) {
    assert.ok(cli.includes(`'${cmd}'`), `frontier-cli.ps1 router missing ${cmd}`);
  }

  for (const tool of ['frontier_provenance', 'frontier_templates', 'frontier_recommend_skills']) {
    assert.ok(mcp.includes(`name: '${tool}'`), `MCP server missing ${tool}`);
  }

  for (const rule of ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']) {
    assert.ok(cli.includes(`'${rule}'`), `frontier-cli.ps1 recovery rules missing ${rule}`);
  }
});

test('templates.ps1 enforces non-overwriting configure/init, SHA-256 provenance, section checks, and path safety', () => {
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-templates-test-'));
  try {
    fs.mkdirSync(path.join(tempWorkspace, '.frontier'), { recursive: true });
    fs.writeFileSync(path.join(tempWorkspace, '.frontier', 'config.json'), '{"provider":"local"}\n');

    const cfgFirst = runPwshJson('scripts/templates.ps1', ['-Action', 'configure', '-WorkspaceRoot', tempWorkspace]);
    assert.equal(cfgFirst.status, 0, cfgFirst.stderr);
    assert.equal(cfgFirst.json.status, 'configured');

    // Second configure must refuse overwrite
    const cfgSecond = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/templates.ps1'), '-Action', 'configure', '-WorkspaceRoot', tempWorkspace], {
      encoding: 'utf8',
    });
    assert.notEqual(cfgSecond.status, 0, 'configure must refuse to overwrite existing frontier.templates.json');

    // Unsafe slug traversal must fail closed
    const badSlug = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/templates.ps1'), '-Action', 'init', '-Type', 'prd', '-Slug', '../escape', '-WorkspaceRoot', tempWorkspace], {
      encoding: 'utf8',
    });
    assert.notEqual(badSlug.status, 0, 'init must reject path traversal in slug');

    // Initialize PRD document
    const initPrd = runPwshJson('scripts/templates.ps1', ['-Action', 'init', '-Type', 'prd', '-Slug', 'leave-portal', '-WorkspaceRoot', tempWorkspace]);
    assert.equal(initPrd.status, 0, initPrd.stderr);
    const prdPath = path.join(tempWorkspace, initPrd.json.path);
    assert.ok(fs.existsSync(prdPath));

    // Re-init on existing document must refuse overwrite
    const initDuplicate = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/templates.ps1'), '-Action', 'init', '-Type', 'prd', '-Slug', 'leave-portal', '-WorkspaceRoot', tempWorkspace], {
      encoding: 'utf8',
    });
    assert.notEqual(initDuplicate.status, 0, 'init must refuse to overwrite an existing deliverable');

    // Validate valid initialized PRD
    const valClean = runPwshJson('scripts/templates.ps1', ['-Action', 'validate', '-Type', 'prd', '-Slug', 'leave-portal', '-WorkspaceRoot', tempWorkspace]);
    assert.equal(valClean.status, 0, valClean.stderr);
    assert.equal(valClean.json.valid, true);

    // Tamper with provenance SHA-256 and add an unfilled {{FILL: ...}} placeholder
    const originalContent = fs.readFileSync(prdPath, 'utf8');
    const tampered = originalContent.replace(/sha256=[a-f0-9]{64}/, 'sha256=' + '0'.repeat(64)) + '\n{{FILL: missing detail}}\n';
    fs.writeFileSync(prdPath, tampered, 'utf8');

    const valTampered = runPwshJson('scripts/templates.ps1', ['-Action', 'validate', '-Type', 'prd', '-Slug', 'leave-portal', '-WorkspaceRoot', tempWorkspace]);
    assert.equal(valTampered.status, 1, 'tampered provenance and unfilled placeholder must exit 1');
    assert.equal(valTampered.json.valid, false);
    assert.ok(valTampered.json.failures.some(f => f.includes('SHA-256 mismatch')));
    assert.ok(valTampered.json.failures.some(f => f.includes('{{FILL:')));
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test('provenance.ps1 verifies components and fails closed when --Require is unmet', () => {
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-provenance-test-'));
  try {
    fs.mkdirSync(path.join(tempWorkspace, '.frontier', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tempWorkspace, '.frontier', 'config.json'), '{"provider":"local"}\n');

    // Unmet required component must exit 1
    const unmet = runPwshJson('scripts/provenance.ps1', ['-Agent', 'engineer', '-Require', 'loop,templates', '-WorkspaceRoot', tempWorkspace]);
    assert.equal(unmet.status, 1, 'unmet required provenance components must exit 1');
    assert.equal(unmet.json.passed, false);
    assert.equal(unmet.json.failures.length, 2);

    // Populate verified loop state
    fs.writeFileSync(path.join(tempWorkspace, '.frontier', 'state', 'loop-state.json'), JSON.stringify({
      active: false,
      status: 'complete',
      iteration: 1,
    }));

    const metLoop = runPwshJson('scripts/provenance.ps1', ['-Agent', 'engineer', '-Require', 'loop', '-WorkspaceRoot', tempWorkspace]);
    assert.equal(metLoop.status, 0, metLoop.stderr);
    assert.equal(metLoop.json.passed, true);
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
});

test('recommend-skills.ps1 enforces MaxSkills and MaxTokens loadout budgets and scrub.ps1 checks ModuleGuard/PrototypeGuard', () => {
  const rec = runPwshJson('scripts/recommend-skills.ps1', ['-Prompt', 'api design security testing code review', '-MaxSkills', '3', '-MaxTokens', '1200']);
  assert.equal(rec.status, 0, rec.stderr);
  assert.ok(rec.json.totalSkills <= 3);
  assert.ok(rec.json.totalTokens <= 1200);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-guard-test-'));
  try {
    const sampleFile = path.join(tempDir, 'sample.ts');
    const lines = Array.from({ length: 505 }, (_, idx) => `export const line${idx} = "sqlite3 chromadb";`);
    fs.writeFileSync(sampleFile, lines.join('\n'), 'utf8');

    const scrubRes = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/scrub.ps1'), '-Path', sampleFile, '-ModuleGuard', '-PrototypeGuard', '-Json'], {
      encoding: 'utf8',
    });
    assert.equal(scrubRes.status, 0, scrubRes.stderr);
    const findings = JSON.parse(scrubRes.stdout.trim());
    assert.ok(findings.some(f => f.category === 'module-size'), 'Expected module-size finding for >500 line file');
    assert.ok(findings.some(f => f.category === 'prototype-guardrail'), 'Expected prototype-guardrail finding for sqlite3/chromadb');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

