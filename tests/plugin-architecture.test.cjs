'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const samplePluginDir = path.join(root, 'examples', 'plugins', 'oracle-offering');

function runPluginCmd(args, envOverrides = {}, cwd = root) {
  const result = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts', 'plugins.ps1'), ...args, '-Json'], {
    cwd,
    env: { ...process.env, ...envOverrides },
    encoding: 'utf8',
    timeout: 30000,
  });
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    json: result.stdout.trim() && result.stdout.trim().startsWith('{') || result.stdout.trim().startsWith('[')
      ? JSON.parse(result.stdout.trim())
      : null,
  };
}

test('oracle-offering sample plugin validates, passes routing tests, and packs reproducibly', () => {
  const val = runPluginCmd(['-Action', 'validate', '-Target', samplePluginDir]);
  assert.equal(val.status, 0, val.stderr);
  assert.equal(val.json.id, 'contoso-oracle-practice.oracle-offering');
  assert.equal(val.json.agents.length, 2);
  assert.equal(val.json.skills.length, 2);

  const routeTest = runPluginCmd(['-Action', 'test', '-Target', samplePluginDir]);
  assert.equal(routeTest.status, 0, routeTest.stderr);
  assert.equal(routeTest.json.passed, true);
  assert.equal(routeTest.json.failed.length, 0);

  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-plugin-pack-'));
  try {
    const pack1 = runPluginCmd(['-Action', 'pack', '-Target', samplePluginDir, '-Out', distDir]);
    assert.equal(pack1.status, 0, pack1.stderr);
    assert.ok(fs.existsSync(pack1.json.package));

    const pack2 = runPluginCmd(['-Action', 'pack', '-Target', samplePluginDir, '-Out', distDir]);
    assert.equal(pack2.status, 0, pack2.stderr);
    assert.equal(pack1.json.sha256, pack2.json.sha256, 'pack must produce a deterministic sha256 across runs');
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('plugin validator rejects executable scripts, hooks, undeclared assets, and unconsented agent tools', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-plugin-neg-'));
  try {
    const initRes = runPluginCmd([
      '-Action', 'init',
      '-Target', path.join(tmpDir, 'scaffold'),
      '-Name', 'sap-offering',
      '-Publisher', 'contoso-sap',
      '-DisplayName', 'SAP Offering',
    ]);
    assert.equal(initRes.status, 0, initRes.stderr);
    const pkgDir = initRes.json.package;

    const testInit = runPluginCmd(['-Action', 'test', '-Target', pkgDir]);
    assert.equal(testInit.status, 0, testInit.stderr);
    assert.equal(testInit.json.passed, true);

    // 1. Executable script inside package must be rejected
    const badScript = path.join(pkgDir, 'evil.ps1');
    fs.writeFileSync(badScript, 'Write-Host "bad"\n', 'utf8');
    const resScript = runPluginCmd(['-Action', 'validate', '-Target', pkgDir]);
    assert.notEqual(resScript.status, 0, 'executable script must be rejected');
    fs.unlinkSync(badScript);

    // 2. Undeclared agent file must be rejected
    const hiddenAgent = path.join(pkgDir, 'agents', 'undeclared.agent.md');
    fs.writeFileSync(hiddenAgent, '---\nname: undeclared\ndescription: hidden\n---\n', 'utf8');
    const resHidden = runPluginCmd(['-Action', 'validate', '-Target', pkgDir]);
    assert.notEqual(resHidden.status, 0, 'undeclared agent must be rejected');
    fs.unlinkSync(hiddenAgent);

    // 3. Agent requesting tool outside manifest tools must be rejected
    const agentFile = path.join(pkgDir, 'agents', 'sap-offering-expert.agent.md');
    const origAgent = fs.readFileSync(agentFile, 'utf8');
    fs.writeFileSync(agentFile, origAgent.replace('tools: [', 'tools: [execute/runInTerminal, '), 'utf8');
    const resTools = runPluginCmd(['-Action', 'validate', '-Target', pkgDir]);
    assert.notEqual(resTools.status, 0, 'agent tool outside manifest tools must be rejected');
    fs.writeFileSync(agentFile, origAgent, 'utf8');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('global store lifecycle, routing, reconcile, recommend-skills, and templates integration', () => {
  const storeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-plugin-home-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-plugin-ws-'));
  const env = { FRONTIER_PLUGIN_HOME: storeHome };

  try {
    fs.mkdirSync(path.join(workspace, '.frontier', 'state'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.frontier', 'config.json'), '{"provider":"local"}\n');

    // Inspect oracle-offering
    const inspected = runPluginCmd(['-Action', 'inspect', '-Target', samplePluginDir], env);
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.equal(inspected.json.needsConfirmation, true);

    // Install without -ConfirmHash must fail closed
    const noConfirm = runPluginCmd(['-Action', 'install', '-Target', samplePluginDir], env);
    assert.notEqual(noConfirm.status, 0, 'install without -ConfirmHash must fail closed');

    // Install with -ConfirmHash <sha256>
    const installed = runPluginCmd(['-Action', 'install', '-Target', samplePluginDir, '-ConfirmHash', inspected.json.sha256], env);
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(installed.json.installed, true);

    // Prompt routing: single match selects oracle-offering
    const routedOracle = runPluginCmd(['-Action', 'resolve', '-Target', 'Optimize our Oracle PL/SQL packages and Exadata tablespaces', '-WorkspaceRoot', workspace], env);
    assert.equal(routedOracle.status, 0, routedOracle.stderr);
    assert.equal(routedOracle.json.status, 'selected');
    assert.deepEqual(routedOracle.json.selected, ['oracle-offering']);

    // Prompt routing: missing hyphenated plugin stops session
    const routedMissing = runPluginCmd(['-Action', 'resolve', '-Target', 'Please use the mysql-offering plugin for this schema', '-WorkspaceRoot', workspace], env);
    assert.equal(routedMissing.status, 0, routedMissing.stderr);
    assert.equal(routedMissing.json.status, 'missing-plugin');
    assert.deepEqual(routedMissing.json.missing, ['mysql-offering']);

    // Recommend-skills integration: loads oracle-offering skills when selected
    const recRes = spawnSync('pwsh', [
      '-NoProfile', '-File', path.join(root, 'scripts', 'recommend-skills.ps1'),
      '-Prompt', 'Tune Oracle PL/SQL bulk collect and AWR execution plans',
      '-WorkspaceRoot', workspace,
      '-Json',
    ], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
    assert.equal(recRes.status, 0, recRes.stderr);
    const recJson = JSON.parse(recRes.stdout.trim());
    assert.equal(recJson.pluginRouting.status, 'selected');
    assert.ok(recJson.loaded.some(s => s.id.startsWith('oracle-offering:')), 'Expected oracle-offering plugin skill in loadout');

    // Templates integration: initialize and validate plugin-defined template kind (oracle-offering:assessment)
    const initAssm = spawnSync('pwsh', [
      '-NoProfile', '-File', path.join(root, 'scripts', 'templates.ps1'),
      '-Action', 'init',
      '-Type', 'oracle-offering:assessment',
      '-Slug', 'erp-db',
      '-WorkspaceRoot', workspace,
      '-Json',
    ], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
    assert.equal(initAssm.status, 0, initAssm.stderr);
    const initAssmJson = JSON.parse(initAssm.stdout.trim());
    assert.equal(initAssmJson.path, 'docs/oracle/ASSESSMENT-erp-db.md');

    const valAssm = spawnSync('pwsh', [
      '-NoProfile', '-File', path.join(root, 'scripts', 'templates.ps1'),
      '-Action', 'validate',
      '-Type', 'oracle-offering:assessment',
      '-Slug', 'erp-db',
      '-WorkspaceRoot', workspace,
      '-Json',
    ], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
    assert.equal(valAssm.status, 0, valAssm.stderr);
    assert.equal(JSON.parse(valAssm.stdout.trim()).valid, true);

    // Workspace requirements check (frontier.plugins.json)
    fs.writeFileSync(path.join(workspace, 'frontier.plugins.json'), JSON.stringify({
      version: 1,
      plugins: [
        { name: 'oracle-offering', range: '>=1.0.0 <2.0.0', source: 'index:oracle-offering@1.0.0' },
        { name: 'snowflake-offering', range: '>=1.0.0', source: 'index:snowflake-offering@1.0.0' },
      ],
    }), 'utf8');
    const reqRes = runPluginCmd(['-Action', 'requirements', '-Target', workspace], env);
    assert.equal(reqRes.status, 0, reqRes.stderr);
    assert.equal(reqRes.json.ok.length, 1);
    assert.equal(reqRes.json.missing.length, 1);
    assert.equal(reqRes.json.missing[0].name, 'snowflake-offering');

    // Reconcile detects store tampering and disables the plugin
    const installedReadme = path.join(storeHome, 'plugins', 'contoso-oracle-practice.oracle-offering', '1.0.0', 'README.md');
    fs.appendFileSync(installedReadme, '\nTampered content\n', 'utf8');
    const recStore = runPluginCmd(['-Action', 'reconcile'], env);
    assert.equal(recStore.status, 0, recStore.stderr);
    assert.equal(recStore.json.disabled.length, 1);
    assert.equal(recStore.json.disabled[0].reason, 'store content changed since install');
  } finally {
    fs.rmSync(storeHome, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
