'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { isDeepStrictEqual } = require('node:util');

const ASSET_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MAX_JSON_BYTES = 1024 * 1024;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    if (fallback === undefined) throw new Error(`Required configuration is missing: ${file}`);
    return fallback;
  }
  if (fs.statSync(file).size > MAX_JSON_BYTES) throw new Error(`Configuration exceeds its size limit: ${file}`);
  const value = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (!isObject(value)) throw new Error(`Configuration must be an object: ${file}`);
  return value;
}

function containedPath(root, relative) {
  const full = path.resolve(root, relative);
  const local = path.relative(root, full);
  if (!local || local.startsWith(`..${path.sep}`) || local === '..' || path.isAbsolute(local)) {
    throw new Error('Path is outside its canonical root.');
  }
  let current = root;
  for (const part of local.split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Managed path must not be a symbolic link: ${current}`);
    }
  }
  return full;
}

function readAsset(relative, assetRoot = ASSET_ROOT) {
  if (typeof relative !== 'string') throw new Error('A canonical asset path is required.');
  const normalized = relative.replace(/\\/g, '/');
  if (normalized.split('/').includes('..') ||
      !/^(?:AGENTS\.md|Skills\.md|\.github\/(?:AGENT-PROTOCOL\.md|agent-delegation\.md|copilot-instructions\.md|(?:agents|skills|instructions|templates|prompts|schemas|registries|security)\/.+)|docs\/.+|evaluation\/rubrics\/.+|packs\/.+|scripts\/.+)$/.test(normalized)) {
    throw new Error('Only canonical Frontier contract paths can be read.');
  }
  const candidates = [normalized];
  if (normalized.startsWith('.github/')) candidates.push(normalized.substring(8));
  candidates.unshift(`seed/${normalized}`);
  const file = candidates.map(candidate => containedPath(assetRoot, candidate))
    .find(candidate => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile());
  if (!file) throw new Error(`Canonical Frontier asset is missing: ${normalized}`);
  if (fs.statSync(file).size > 262144) throw new Error('Canonical asset exceeds the read limit.');
  return fs.readFileSync(file, 'utf8');
}

function mergeConfiguration(mcp, hooks, frontier, nativeHooks) {
  if (!isObject(mcp) || !isObject(mcp.mcpServers ?? {}) || !isObject(hooks) ||
      !isObject(hooks.hooks ?? {})) throw new Error('Cursor configuration sections must be objects.');
  if (hooks.version !== undefined && hooks.version !== 1) throw new Error('Unsupported Cursor hooks version.');
  const previous = mcp.mcpServers?.frontier;
  const legacyNode = previous?.command === 'node' && Array.isArray(previous.args) &&
    previous.args.length === 1 && previous.args[0] === '.frontier/runtime/mcp-server/index.js' &&
    Object.keys(previous).every(key => ['command', 'args'].includes(key));
  const legacyPowerShell = previous?.command === 'pwsh' && isDeepStrictEqual(previous.args, [
    '-NoProfile', '-NonInteractive', '-File', '${workspaceFolder}/.frontier/runtime/frontier.ps1', 'cursor', 'mcp',
  ]) && Object.keys(previous).every(key => ['command', 'args'].includes(key));
  const legacy = legacyNode || legacyPowerShell;
  if (previous && !legacy && !isDeepStrictEqual(previous, frontier)) {
    throw new Error('Cursor MCP name frontier conflicts with existing user configuration; rename it before setup.');
  }
  const mergedHooks = { ...(hooks.hooks ?? {}) };
  for (const [event, entries] of Object.entries(nativeHooks)) {
    const existing = mergedHooks[event] ?? [];
    if (!Array.isArray(existing) || existing.some(entry => !isObject(entry))) {
      throw new Error(`Cursor hook ${event} must be an array of objects.`);
    }
    mergedHooks[event] = [...existing];
    for (const entry of entries) {
      const previousDefault = { ...entry, timeout: 15 };
      // Earlier releases launched hooks through PowerShell; unchanged entries migrate to the Node launcher.
      const previousLauncher = `pwsh -NoProfile -NonInteractive -File ".frontier/runtime/frontier.ps1" cursor hook ${event}`;
      const isPreviousLauncher = item => item.command === previousLauncher &&
        Object.keys(item).every(key => ['command', 'timeout', 'failClosed'].includes(key)) &&
        [15, entry.timeout].includes(item.timeout) && [undefined, entry.failClosed].includes(item.failClosed);
      const current = mergedHooks[event]
        .map(item => isDeepStrictEqual(item, previousDefault) || isPreviousLauncher(item) ? entry : item)
        .filter((item, index, all) => item !== entry || all.indexOf(entry) === index);
      if (current.some(item => item.command === entry.command && !isDeepStrictEqual(item, entry))) {
        throw new Error(`Cursor hook ${event} conflicts with a customized Frontier command; existing configuration was preserved.`);
      }
      mergedHooks[event] = current;
      if (!current.some(item => isDeepStrictEqual(item, entry))) mergedHooks[event].push(entry);
    }
  }
  return {
    mcp: { ...mcp, mcpServers: { ...(mcp.mcpServers ?? {}), frontier } },
    hooks: { ...hooks, version: 1, hooks: mergedHooks },
  };
}

function checkMcpDependencies(assetRoot = ASSET_ROOT) {
  const server = path.join(assetRoot, '.frontier', 'runtime', 'mcp-server', 'index.js');
  const requireServer = createRequire(server);
  const expected = readJson(path.join(path.dirname(server), 'package.json')).dependencies['@modelcontextprotocol/sdk'];
  let directory = path.dirname(requireServer.resolve('@modelcontextprotocol/sdk/server/index.js'));
  while (directory !== path.dirname(directory)) {
    const metadata = path.join(directory, 'package.json');
    if (fs.existsSync(metadata)) {
      const data = readJson(metadata);
      if (data.name === '@modelcontextprotocol/sdk') {
        if (data.version !== expected) throw new Error(`MCP SDK ${data.version} does not match pinned ${expected}.`);
        requireServer('@modelcontextprotocol/sdk/server/index.js');
        return;
      }
    }
    directory = path.dirname(directory);
  }
  throw new Error('Pinned MCP SDK metadata was not found.');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function isLegacyAsset(relative, current, desired) {
  const normalized = value => value.toString('utf8').replace(/\r\n/g, '\n');
  // Only pristine previously shipped rules are eligible without an ownership record.
  const previousRules = {
    '.cursor/rules/000-frontier-core.mdc': 'cfd8987d5643ae4bdcf3252689c35c4b737d7c6e3849a6c6907ebab7da7ae033',
    '.cursor/rules/ai.mdc': 'f875107fd5619a0000e40e292963165d0b8b5cce3eaa9b119901240ea7a8c059',
    '.cursor/rules/csharp.mdc': 'e56eda267e8ad60b497b7cf95f8d556fca1f4e3899b523c4420720715edef7f6',
    '.cursor/rules/python.mdc': '719ca9f78a8c23c6d3d27d30eaa82d2e9f9bd0b8c0270c4c3f2d108a3c44ceb5',
    '.cursor/rules/react.mdc': '284cdd0e2af66fc42a245b1b84b43d5ce983f8d665b3e0eaab846ed46cbc3a7b',
    '.cursor/rules/typescript.mdc': '591677e79abefbe8e7ccfa6f66839e438c2f877da615f3228fa67e1c6d2484b0',
  };
  if (previousRules[relative]) {
    return digest(normalized(current)) === previousRules[relative];
  }
  if (!relative.startsWith('.cursor/commands/')) return false;
  let prior = normalized(desired).replace(
    /^Run `(?:pwsh -NoProfile -File )?\.frontier\/runtime\/frontier\.ps1 cursor read ([^`]+)` before taking action\./m,
    'Read `$1` before taking action.',
  );
  return normalized(current) === prior;
}

function setupCursor(workspace, options = {}) {
  if (!fs.statSync(path.join(workspace, '.frontier', 'config.json'), { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Initialize Frontier repository support before setting up Cursor.');
  }
  const lockPath = containedPath(workspace, '.frontier/cursor-setup.lock');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Cursor setup is already running or was interrupted. Confirm the owner stopped before removing .frontier/cursor-setup.lock.');
    throw error;
  }
  try { return configureCursor(workspace, options); }
  finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}

function configureCursor(workspace, options) {
  const assetRoot = options.assetRoot ?? ASSET_ROOT;
  const runtimeTemplates = path.join(assetRoot, '.frontier', 'runtime', 'cursor-assets');
  const templates = fs.existsSync(runtimeTemplates) ? runtimeTemplates : path.join(assetRoot, '.cursor');
  const mcpPath = containedPath(workspace, '.cursor/mcp.json');
  const hooksPath = containedPath(workspace, '.cursor/hooks.json');
  const ownershipPath = containedPath(workspace, '.frontier/cursor-assets.json');
  const templateMcp = readJson(path.join(templates, 'mcp.json'));
  const templateHooks = readJson(path.join(templates, 'hooks.json'));
  let merged = mergeConfiguration(readJson(mcpPath, {}), readJson(hooksPath, {}),
    templateMcp.mcpServers.frontier, templateHooks.hooks);
  const check = options.checkDependencies ?? (() => checkMcpDependencies(assetRoot));
  const standalone = fs.statSync(path.join(assetRoot, '.github', 'agents'), { throwIfNoEntry: false })?.isDirectory();
  if (options.restoreMcp) {
    if (!standalone) {
      throw new Error('Installed extension dependencies are immutable. Update/reinstall Frontier; dependency restore is only supported in a standalone Frontier tree.');
    }
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const restore = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command',
      `${npm} ci --ignore-scripts --omit=dev --no-fund`], {
      cwd: path.join(assetRoot, '.frontier', 'runtime', 'mcp-server'),
      encoding: 'utf8', timeout: 300000, maxBuffer: 4 * MAX_JSON_BYTES, windowsHide: true,
    });
    process.stderr.write(restore.stdout ?? '');
    process.stderr.write(restore.stderr ?? '');
    if (restore.error || restore.status !== 0) throw new Error(`MCP dependency restore failed: ${restore.error?.message ?? restore.status}`);
  }
  try { check(); }
  catch (error) {
    const remedy = standalone ? 'Run frontier cursor setup --restore-mcp.' : 'Update/reinstall the Frontier extension.';
    throw new Error(`Cursor MCP dependencies are not ready: ${error.message}. ${remedy}`);
  }
  merged = mergeConfiguration(readJson(mcpPath, {}), readJson(hooksPath, {}),
    templateMcp.mcpServers.frontier, templateHooks.hooks);
  const ownership = readJson(ownershipPath, { schemaVersion: 1, files: {} });
  if (ownership.schemaVersion !== 1 || !isObject(ownership.files)) throw new Error('Invalid Cursor asset ownership record.');
  const copied = [];
  const preserved = [];
  const files = {};
  const launchers = ['.frontier/runtime/cursor-mcp.js', '.frontier/runtime/cursor-hook.js'];
  const assets = launchers.map(relative => ({
    relative, source: path.join(assetRoot, ...relative.split('/')),
  }));
  for (const directory of ['commands', 'rules']) {
    const source = path.join(templates, directory);
    for (const name of fs.readdirSync(source)) {
      assets.push({ relative: `.cursor/${directory}/${name}`, source: path.join(source, name) });
    }
  }
  for (const asset of assets) {
      const { relative } = asset;
      const destination = containedPath(workspace, relative);
      const content = fs.readFileSync(asset.source);
      const wanted = digest(content);
      const current = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
      const actual = current ? digest(current) : null;
      if (actual && actual !== wanted && actual !== ownership.files[relative] &&
          !isLegacyAsset(relative, current, content)) {
        if (launchers.includes(relative)) {
          throw new Error(`The Cursor launcher ${relative} has a user override; existing configuration was preserved.`);
        }
        preserved.push(relative);
        continue;
      }
      if (actual !== wanted) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, content);
        copied.push(relative);
      }
      files[relative] = wanted;
  }
  const retired = [];
  for (const [relative, recorded] of Object.entries(ownership.files)) {
    // Remove only unmodified files that an earlier setup installed and the current version no longer ships.
    if (files[relative] || preserved.includes(relative) || !/^\.cursor\/(?:commands|rules)\/[^/\\]+$/.test(relative)) continue;
    const destination = containedPath(workspace, relative);
    const current = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
    if (!current) continue;
    if (digest(current) === recorded) {
      fs.unlinkSync(destination);
      retired.push(relative);
    } else {
      preserved.push(relative);
    }
  }
  writeJson(mcpPath, merged.mcp);
  writeJson(hooksPath, merged.hooks);
  writeJson(ownershipPath, { schemaVersion: 1, files });
  return { status: 'configured', copied, preserved, retired, mcpReady: true,
    message: preserved.length ? 'Custom Cursor overrides were preserved; inspect them for compatibility.' : 'Cursor is configured.' };
}

module.exports = { ASSET_ROOT, MAX_JSON_BYTES, readAsset, mergeConfiguration, checkMcpDependencies, setupCursor };