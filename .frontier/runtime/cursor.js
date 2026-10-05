'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { isDeepStrictEqual } = require('node:util');

const ASSET_ROOT = path.resolve(__dirname, '..', '..');
const MAX_JSON_BYTES = 1024 * 1024;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const sameDirectory = (left, right) => {
  // Windows folding is ASCII-only, matching the workspace identity contract.
  const normalize = value => process.platform === 'win32'
    ? path.resolve(value).replace(/[A-Z]/g, letter => letter.toLowerCase()) : path.resolve(value);
  return normalize(left) === normalize(right);
};

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

function translateHookInput(event, payload, workspace) {
  if (!isObject(payload)) throw new Error('Cursor hook input must be an object.');
  if (workspace && payload.workspace_roots !== undefined &&
      (!Array.isArray(payload.workspace_roots) ||
       payload.workspace_roots.some(root => typeof root !== 'string' || !path.isAbsolute(root)) ||
       !payload.workspace_roots.some(root => sameDirectory(root, workspace)))) {
    throw new Error('Cursor hook workspace roots do not include the bound Frontier workspace.');
  }
  if (event === 'sessionStart') {
    return {
      hook_event_name: 'SessionStart',
      session_id: payload.session_id ?? payload.conversation_id ?? '',
      ...(typeof payload.source === 'string' ? { source: payload.source } : {}),
    };
  }
  if (event !== 'preToolUse' || typeof payload.tool_name !== 'string' || !isObject(payload.tool_input)) {
    throw new Error('Cursor preToolUse requires a tool name and object tool input.');
  }
  const name = payload.tool_name;
  if (/^Shell$/i.test(name) && workspace) {
    const directory = payload.tool_input.working_directory ?? payload.cwd ?? workspace;
    if (typeof directory !== 'string' || !sameDirectory(path.resolve(workspace, directory), workspace)) {
      throw new Error('Run Cursor shell tools from the initialized workspace root so Frontier can validate relative paths.');
    }
  }
  const readOnly = /^(Read|Grep|Glob|LS|List|ReadFile|Search|WebSearch|WebFetch|AskQuestion|TodoWrite|Task)$/i.test(name);
  const remoteMethod = /^MCP:(?:.*[._:-])?(create_or_update_file|push_files|delete_file)$/i.exec(name);
  const remoteWrite = /github.*(?:create_or_update_file|push_files|delete_file)$/i.test(name);
  const tool = remoteMethod ? `mcp_github_${remoteMethod[1].toLowerCase()}`
    : /^Shell$/i.test(name) ? 'runCommands'
    : readOnly ? 'cursor_read'
      : remoteWrite || /^MCP:/i.test(name) ? name : 'apply_patch';
  const filePaths = [];
  for (const key of ['path', 'file_path', 'filePath', 'target_file', 'targetFile', 'relative_workspace_path']) {
    const value = payload.tool_input[key];
    if (typeof value === 'string') filePaths.push({ path: value });
  }
  for (const key of ['paths', 'files']) {
    const values = payload.tool_input[key];
    if (Array.isArray(values)) {
      for (const value of values) { if (typeof value === 'string') filePaths.push({ path: value }); }
    }
  }
  for (const key of ['patch', 'input']) {
    const patch = payload.tool_input[key];
    if (typeof patch === 'string') {
      for (const match of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)) {
        filePaths.push({ path: match[1].trim() });
      }
    }
  }
  if (/^(Write|Edit|Delete|StrReplace|ApplyPatch|MultiEdit|edit_file|write_file|delete_file)$/i.test(name) && !filePaths.length) {
    throw new Error('Cursor file mutation lacks a recognized path; Frontier cannot validate protected state.');
  }
  return { hook_event_name: 'PreToolUse', tool_name: tool,
    tool_input: { ...payload.tool_input, cursor_paths: filePaths } };
}

function translateHookResult(event, result) {
  if (result.error) throw result.error;
  if (result.status === 2 && event === 'preToolUse') {
    const message = (result.stderr || 'Frontier policy denied this action.').trim().slice(0, 2000);
    return { permission: 'deny', user_message: message, agent_message: message };
  }
  if (result.status !== 0) throw new Error(`Frontier policy hook exited ${result.status}: ${(result.stderr ?? '').trim()}`);
  const response = result.stdout?.trim() ? JSON.parse(result.stdout) : {};
  if (!isObject(response) || (response.continue !== undefined && response.continue !== true)) {
    throw new Error('Invalid Frontier policy response.');
  }
  if (event === 'preToolUse') {
    if (response.systemMessage !== undefined && typeof response.systemMessage !== 'string') {
      throw new Error('Invalid Frontier policy message.');
    }
    return { permission: 'allow', ...(response.systemMessage
      ? { user_message: response.systemMessage, agent_message: response.systemMessage } : {}) };
  }
  const additional = [response.systemMessage, response.hookSpecificOutput?.additionalContext].filter(Boolean);
  if (additional.some(value => typeof value !== 'string')) throw new Error('Invalid repository primer context.');
  return additional.length ? { additional_context: additional.join('\n') } : {};
}

function readHookInput() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => { process.stdin.destroy(); reject(new Error('Cursor hook input timed out.')); }, 2000);
    process.stdin.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) { clearTimeout(timer); process.stdin.destroy(); reject(new Error('Cursor hook input exceeds its limit.')); }
      else chunks.push(chunk);
    });
    process.stdin.once('error', error => { clearTimeout(timer); reject(error); });
    process.stdin.once('end', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
    });
  });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 18) throw new Error('Cursor integration requires Node.js 18 or later.');
  const args = process.argv.slice(2);
  if (args[0] !== '--workspace' || !path.isAbsolute(args[1] ?? '')) throw new Error('An absolute bound workspace is required.');
  const workspace = path.resolve(args[1]);
  const action = args[2] ?? 'status';
  if (action === 'read' && args.length === 4) { process.stdout.write(readAsset(args[3])); return; }
  if (action === 'setup' && (args.length === 3 || (args.length === 4 && args[3] === '--restore-mcp'))) {
    process.stdout.write(`${JSON.stringify(setupCursor(workspace, { restoreMcp: args[3] === '--restore-mcp' }))}\n`);
    return;
  }
  if (action === 'hook') {
    const event = args[3];
    try {
      if (args.length !== 4) throw new Error('A Cursor hook event is required.');
      const input = translateHookInput(event, await readHookInput(), workspace);
      if (event === 'preToolUse' && input.tool_name === 'cursor_read') {
        process.stdout.write('{"permission":"allow"}\n');
        return;
      }
      if (event === 'sessionStart' &&
          !fs.statSync(path.join(workspace, '.frontier', 'config.json'), { throwIfNoEntry: false })?.isFile()) {
        process.stdout.write(`${JSON.stringify({ additional_context: 'Frontier repository support is not initialized in this workspace. Run Frontier: Initialize Repository Support, then Frontier: Initialize Cursor. Repository discovery was not run.' })}\n`);
        return;
      }
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
        path.join(__dirname, 'frontier-cli.ps1'), 'policy-hook'], {
        cwd: workspace, env: { ...process.env, FRONTIER_WORKSPACE_ROOT: workspace },
        input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 65536,
      });
      process.stdout.write(`${JSON.stringify(translateHookResult(event, result))}\n`);
    } catch (error) {
      process.stderr.write(`[frontier-cursor] ${error.message}\n`);
      const response = event === 'preToolUse'
        ? { permission: 'deny', user_message: error.message, agent_message: error.message }
        : { additional_context: `Frontier context unavailable: ${error.message}. Run frontier context explicitly.` };
      process.stdout.write(`${JSON.stringify(response)}\n`);
      if (event === 'preToolUse') process.exitCode = 2;
    }
    return;
  }
  if (action === 'status' && args.length <= 3) {
    checkMcpDependencies();
    process.stdout.write(`${JSON.stringify({ mcpReady: true, workspace, assetRoot: ASSET_ROOT })}\n`);
    return;
  }
  if (action === 'runtime' && args.length === 3) {
    process.stdout.write(`${JSON.stringify({ integration: 'frontier-cursor', workspace, assetRoot: ASSET_ROOT })}\n`);
    return;
  }
  throw new Error('Usage: frontier cursor setup [--restore-mcp] | read <canonical-path> | status');
}

module.exports = { readAsset, mergeConfiguration, translateHookInput, translateHookResult, setupCursor };
if (require.main === module) main().catch(error => { process.stderr.write(`[frontier-cursor] ${error.message}\n`); process.exitCode = 1; });
