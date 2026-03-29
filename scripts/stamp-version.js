#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceVersionPath = 'version.json';
const extensionDir = path.join(root, 'vscode-extension');

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[OK] ${message}`);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function writeText(relativePath, content) {
  const targetPath = path.join(root, relativePath);
  if (fs.existsSync(targetPath)) {
    const current = fs.readFileSync(targetPath, 'utf8');
    if (current === content) {
      return;
    }
  }
  fs.writeFileSync(targetPath, content, 'utf8');
}

function parseArgs(argv) {
  const parsed = {
    setVersion: null,
    bumpType: null,
    packageVsix: false,
    vsixOutput: null,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--set') {
      parsed.setVersion = argv[index + 1] || null;
      index++;
      continue;
    }
    if (arg === '--bump') {
      parsed.bumpType = argv[index + 1] || null;
      index++;
      continue;
    }
    if (arg === '--package-vsix') {
      parsed.packageVsix = true;
      continue;
    }
    if (arg === '--vsix-output') {
      parsed.vsixOutput = argv[index + 1] || null;
      index++;
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (parsed.setVersion && parsed.bumpType) {
    fail('Use either --set <version> or --bump <major|minor|patch>, not both.');
  }

   if (parsed.vsixOutput && !parsed.packageVsix) {
    fail('Use --vsix-output only together with --package-vsix.');
  }

  return parsed;
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`Invalid version '${version}'. Expected MAJOR.MINOR.PATCH.`);
  }
}

function bumpVersion(version, bumpType) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      fail(`Unsupported bump type '${bumpType}'. Use major, minor, or patch.`);
  }
}

function replaceStrict(content, relativePath, pattern, replacement, label) {
  pattern.lastIndex = 0;
  if (!pattern.test(content)) {
    fail(`Pattern not found in ${relativePath}: ${label}`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
}

function updateJsonVersionFile(version) {
  const raw = readText(sourceVersionPath);
  const json = JSON.parse(raw);
  const versionChanged = json.version !== version;
  json.version = version;
  if (versionChanged || !json.updatedAt) {
    json.updatedAt = new Date().toISOString();
  }
  writeText(sourceVersionPath, `${JSON.stringify(json, null, 2)}\n`);
}

function updatePackageLock(version) {
  let content = readText('vscode-extension/package-lock.json');
  content = replaceStrict(
    content,
    'vscode-extension/package-lock.json',
    /("name": "agentx",\n  "version": ")\d+\.\d+\.\d+(")/,
    `$1${version}$2`,
    'top-level package-lock version',
  );
  content = replaceStrict(
    content,
    'vscode-extension/package-lock.json',
    /("": \{\n      "name": "agentx",\n      "version": ")\d+\.\d+\.\d+(")/,
    `$1${version}$2`,
    'root package entry version',
  );
  writeText('vscode-extension/package-lock.json', content);
}

function updateTextFile(relativePath, edits) {
  let content = readText(relativePath);
  for (const edit of edits) {
    content = replaceStrict(content, relativePath, edit.pattern, edit.replacement, edit.label);
  }
  writeText(relativePath, content);
}

function runCommand(command, args, cwd) {
  childProcess.execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
  });
}

function runShellCommand(command, cwd) {
  childProcess.execSync(command, {
    cwd,
    stdio: 'inherit',
  });
}

function quoteShellArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function assertFileExists(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) {
    fail(`Bundled asset missing: ${label} (${path.relative(root, absolutePath)})`);
  }
}

function assertBundledJsonVersion(relativePath, expectedVersion, label) {
  const absolutePath = path.join(root, relativePath);
  assertFileExists(absolutePath, label);
  const content = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (content.version !== expectedVersion) {
    fail(`${label} version mismatch in ${relativePath}. Expected ${expectedVersion}, found ${content.version}.`);
  }
}

function syncBundledAssets(version) {
  const copyAssetsScript = path.join(extensionDir, 'scripts', 'copy-assets.js');
  runCommand(process.execPath, [copyAssetsScript], extensionDir);

  const requiredFiles = [
    {
      relativePath: 'vscode-extension/.github/agentx/.agentx/agentic-runner.ps1',
      label: 'bundled agentic runner',
    },
    {
      relativePath: 'vscode-extension/.github/agentx/docs/QUALITY_SCORE.md',
      label: 'bundled quality score doc',
    },
    {
      relativePath: 'vscode-extension/.github/agentx/docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md',
      label: 'bundled knowledge review workflow guide',
    },
    {
      relativePath: 'vscode-extension/.github/agentx/packs/agentx-copilot-cli/install.ps1',
      label: 'bundled Copilot CLI installer',
    },
    {
      relativePath: 'vscode-extension/.github/agentx/packs/agentx-copilot-cli/install.sh',
      label: 'bundled Copilot CLI bash installer',
    },
  ];

  for (const file of requiredFiles) {
    assertFileExists(path.join(root, file.relativePath), file.label);
  }

  assertBundledJsonVersion(
    'vscode-extension/.github/agentx/packs/agentx-core/manifest.json',
    version,
    'bundled core pack manifest',
  );
  assertBundledJsonVersion(
    'vscode-extension/.github/agentx/packs/agentx-copilot-cli/manifest.json',
    version,
    'bundled Copilot CLI pack manifest',
  );

  info(`Synced bundled extension assets for ${version}`);
}

function packageVsix(version, vsixOutput) {
  const defaultOutput = path.join(extensionDir, `agentx-${version}.vsix`);
  const resolvedOutput = vsixOutput
    ? path.resolve(root, vsixOutput)
    : defaultOutput;
  const vsceBinary = path.join(
    extensionDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vsce.cmd' : 'vsce',
  );

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  if (fs.existsSync(resolvedOutput)) {
    fs.unlinkSync(resolvedOutput);
  }

  if (!fs.existsSync(vsceBinary)) {
    fail('VS Code extension packaging requires vscode-extension/node_modules/.bin/vsce. Run npm ci in vscode-extension first.');
  }

  if (process.platform === 'win32') {
    runShellCommand(
      `${quoteShellArg(vsceBinary)} package --out ${quoteShellArg(resolvedOutput)}`,
      extensionDir,
    );
  } else {
    runCommand(vsceBinary, ['package', '--out', resolvedOutput], extensionDir);
  }

  if (!fs.existsSync(resolvedOutput)) {
    fail(`VSIX package was not created at ${path.relative(root, resolvedOutput)}.`);
  }

  console.log(`[OK] Packaged VSIX ${path.relative(root, resolvedOutput)}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentVersionJson = JSON.parse(readText(sourceVersionPath));
  let targetVersion = currentVersionJson.version;
  const isBumpCommand = Boolean(args.bumpType);

  if (args.setVersion) {
    validateVersion(args.setVersion);
    targetVersion = args.setVersion;
  } else if (args.bumpType) {
    targetVersion = bumpVersion(targetVersion, args.bumpType);
  }

  validateVersion(targetVersion);
  updateJsonVersionFile(targetVersion);

  updateTextFile('vscode-extension/package.json', [
    {
      pattern: /("version": ")\d+\.\d+\.\d+(",)/,
      replacement: `$1${targetVersion}$2`,
      label: 'extension package version',
    },
  ]);

  updatePackageLock(targetVersion);

  updateTextFile('packs/agentx-core/manifest.json', [
    {
      pattern: /("version": ")\d+\.\d+\.\d+(",)/,
      replacement: `$1${targetVersion}$2`,
      label: 'core pack version',
    },
  ]);

  updateTextFile('packs/agentx-copilot-cli/manifest.json', [
    {
      pattern: /("version": ")\d+\.\d+\.\d+(",)/,
      replacement: `$1${targetVersion}$2`,
      label: 'copilot CLI pack version',
    },
  ]);

  updateTextFile('README.md', [
    {
      pattern: /releases\/tag\/v\d+\.\d+\.\d+/,
      replacement: `releases/tag/v${targetVersion}`,
      label: 'README release link',
    },
    {
      pattern: /badge\/Version-[0-9.]+-/,
      replacement: `badge/Version-${targetVersion}-`,
      label: 'README version badge',
    },
    {
      pattern: /alt="Version \d+\.\d+\.\d+"/,
      replacement: `alt="Version ${targetVersion}"`,
      label: 'README badge alt text',
    },
    {
      pattern: /## New In \d+\.\d+\.\d+/,
      replacement: `## New In ${targetVersion}`,
      label: 'README current release heading',
    },
  ]);

  updateTextFile('docs/QUALITY_SCORE.md', [
    {
      pattern: /## Component Scores \(v\d+\.\d+\.\d+\)/,
      replacement: `## Component Scores (v${targetVersion})`,
      label: 'quality score header',
    },
    {
      pattern: /\| AGENTS\.md \| A \| Slim TOC\/map \(v\d+\.\d+\.\d+\) \|/,
      replacement: `| AGENTS.md | A | Slim TOC/map (v${targetVersion}) |`,
      label: 'quality score AGENTS note',
    },
    {
      pattern: /\*\*Last updated\*\*: v\d+\.\d+\.\d+/,
      replacement: `**Last updated**: v${targetVersion}`,
      label: 'quality score footer version',
    },
  ]);

  updateTextFile('install.ps1', [
    {
      pattern: /Install AgentX v\d+\.\d+\.\d+ - Download, copy, configure\./,
      replacement: `Install AgentX v${targetVersion} - Download, copy, configure.`,
      label: 'installer synopsis',
    },
    {
      pattern: /\| AgentX v\d+\.\d+\.\d+ - AI Agent Orchestration \|/,
      replacement: `| AgentX v${targetVersion} - AI Agent Orchestration |`,
      label: 'installer banner',
    },
    {
      pattern: /\$previousVersion -ne "\d+\.\d+\.\d+"/,
      replacement: `$previousVersion -ne "${targetVersion}"`,
      label: 'installer upgrade comparison',
    },
    {
      pattern: /upgrading to v\d+\.\d+\.\d+\.\.\./,
      replacement: `upgrading to v${targetVersion}...`,
      label: 'installer upgrade message',
    },
    {
      pattern: /version = "\d+\.\d+\.\d+"/,
      replacement: `version = "${targetVersion}"`,
      label: 'installer version file payload',
    },
    {
      pattern: /Version \d+\.\d+\.\d+ recorded/,
      replacement: `Version ${targetVersion} recorded`,
      label: 'installer recorded message',
    },
    {
      pattern: /AgentX v\d+\.\d+\.\d+ installed!/,
      replacement: `AgentX v${targetVersion} installed!`,
      label: 'installer completion banner',
    },
  ]);

  updateTextFile('install.sh', [
    {
      pattern: /AgentX v\d+\.\d+\.\d+ Installer - Download, copy, configure\./,
      replacement: `AgentX v${targetVersion} Installer - Download, copy, configure.`,
      label: 'bash installer synopsis',
    },
    {
      pattern: /\| AgentX v\d+\.\d+\.\d+ - AI Agent Orchestration \|/,
      replacement: `| AgentX v${targetVersion} - AI Agent Orchestration |`,
      label: 'bash installer banner',
    },
    {
      pattern: /\[ "\$PREVIOUS_VERSION" != "\d+\.\d+\.\d+" \]/,
      replacement: `[ "$PREVIOUS_VERSION" != "${targetVersion}" ]`,
      label: 'bash installer upgrade comparison',
    },
    {
      pattern: /upgrading to v\d+\.\d+\.\d+\.\.\./,
      replacement: `upgrading to v${targetVersion}...`,
      label: 'bash installer upgrade message',
    },
    {
      pattern: /\\"version\\": \\"\d+\.\d+\.\d+\\"/,
      replacement: `\\"version\\": \\"${targetVersion}\\"`,
      label: 'bash installer version file payload',
    },
    {
      pattern: /Version \d+\.\d+\.\d+ recorded/,
      replacement: `Version ${targetVersion} recorded`,
      label: 'bash installer recorded message',
    },
    {
      pattern: /AgentX v\d+\.\d+\.\d+ installed!/,
      replacement: `AgentX v${targetVersion} installed!`,
      label: 'bash installer completion banner',
    },
  ]);

  updateTextFile('packs/agentx-copilot-cli/install.ps1', [
    {
      pattern: /Install AgentX Copilot CLI Plugin v\d+\.\d+\.\d+ into a workspace\./,
      replacement: `Install AgentX Copilot CLI Plugin v${targetVersion} into a workspace.`,
      label: 'CLI plugin installer synopsis',
    },
    {
      pattern: /\| AgentX Copilot CLI Plugin v\d+\.\d+\.\d+\s+\|/,
      replacement: `| AgentX Copilot CLI Plugin v${targetVersion}        |`,
      label: 'CLI plugin installer banner',
    },
    {
      pattern: /version = "\d+\.\d+\.\d+"/,
      replacement: `version = "${targetVersion}"`,
      label: 'CLI plugin version payload',
    },
    {
      pattern: /AgentX Copilot CLI Plugin v\d+\.\d+\.\d+ installed/,
      replacement: `AgentX Copilot CLI Plugin v${targetVersion} installed`,
      label: 'CLI plugin completion banner',
    },
  ]);

  updateTextFile('packs/agentx-copilot-cli/install.sh', [
    {
      pattern: /AgentX Copilot CLI Plugin v\d+\.\d+\.\d+ - Installer \(Bash\)/,
      replacement: `AgentX Copilot CLI Plugin v${targetVersion} - Installer (Bash)`,
      label: 'CLI plugin bash synopsis',
    },
    {
      pattern: /VERSION="\d+\.\d+\.\d+"/,
      replacement: `VERSION="${targetVersion}"`,
      label: 'CLI plugin bash version constant',
    },
  ]);

  updateTextFile('packs/agentx-copilot-cli/README.md', [
    {
      pattern: /- Version: `\d+\.\d+\.\d+`/,
      replacement: `- Version: \`${targetVersion}\``,
      label: 'CLI plugin README version',
    },
  ]);

  updateTextFile('vscode-extension/README.md', [
    {
      pattern: /badge\/Version-[0-9.]+-/,
      replacement: `badge/Version-${targetVersion}-`,
      label: 'extension README version badge',
    },
  ]);

  syncBundledAssets(targetVersion);
  info(`Stamped repo version ${targetVersion}`);

  if (isBumpCommand && !args.packageVsix) {
    info(`Semantic bump detected; packaging VSIX for ${targetVersion}`);
  }

  if (args.packageVsix || isBumpCommand) {
    packageVsix(targetVersion, args.vsixOutput);
  }
}

main();