#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { downloadAndUnzipVSCode, runTests } = require('@vscode/test-electron');

function disableWindowsInstallerMutex(vscodeExecutablePath) {
  if (process.platform !== 'win32') {
    return;
  }

  const installRoot = fs.statSync(vscodeExecutablePath).isDirectory()
    ? vscodeExecutablePath
    : path.dirname(vscodeExecutablePath);
  const productPath = [
    path.join(installRoot, 'resources', 'app', 'product.json'),
    ...fs.readdirSync(installRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(installRoot, entry.name, 'resources', 'app', 'product.json')),
  ].find((candidate) => fs.existsSync(candidate));
  if (!productPath) {
    throw new Error(`Unable to locate product.json below ${installRoot}`);
  }
  const product = JSON.parse(fs.readFileSync(productPath, 'utf8'));
  product.win32MutexName = `agentx-e2e-${process.pid}`;
  product.win32VersionedUpdate = false;
  fs.writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
}

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '..');
  const extensionTestsPath = path.resolve(extensionDevelopmentPath, 'out', 'e2e', 'suite', 'index');
  const evidencePath = path.resolve(extensionDevelopmentPath, '..', '.agentx', 'state', 'evidence', 'extension-host-e2e.log');
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-e2e-'));
  const resultPath = path.join(workspacePath, 'extension-host-result.json');

  fs.mkdirSync(path.join(workspacePath, '.agentx'), { recursive: true });
  fs.writeFileSync(
    path.join(workspacePath, '.agentx', 'config.json'),
    `${JSON.stringify({ provider: 'local', integration: 'local', mode: 'local', enforceIssues: false }, null, 2)}\n`,
  );

  if (process.platform === 'win32') {
    process.env.PATH = `C:\\Program Files\\PowerShell\\7;${process.env.PATH ?? ''}`;
  }
  process.env.AGENTX_E2E_WORKSPACE = workspacePath;

  try {
    const vscodeExecutablePath = await downloadAndUnzipVSCode({
      version: 'stable',
      extensionDevelopmentPath,
    });
    disableWindowsInstallerMutex(vscodeExecutablePath);

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: { AGENTX_E2E_RESULT_PATH: resultPath },
      vscodeExecutablePath,
      launchArgs: [
        workspacePath,
        '--disable-extensions',
        '--skip-welcome',
        '--skip-release-notes',
      ],
    });
    if (!fs.existsSync(resultPath)) {
      throw new Error('Extension Host exited without a passing Mocha result marker');
    }
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    if (result.status !== 'pass' || result.tests < 1) {
      throw new Error(`Invalid Extension Host result marker: ${JSON.stringify(result)}`);
    }
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      [
        'AgentX VS Code Extension Host E2E',
        `Status: PASS (${result.tests} test(s))`,
        'Assertions: extension activation, command registration, four sidebar contributions, loop-status execution',
        `VS Code executable: ${vscodeExecutablePath}`,
        `Completed: ${new Date().toISOString()}`,
        '',
      ].join('\n'),
    );
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[FAIL] Extension Host E2E: ${error.stack || error.message}`);
  process.exit(1);
});
