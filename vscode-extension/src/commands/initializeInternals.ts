import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveWindowsShell } from '../utils/shell';
import { resolveAndValidate } from '../utils/ssrfValidator';
import type { SsrfResolvedAddress } from '../utils/ssrfValidatorTypes';
import { parseConfigurationJson } from '../utils/configurationJson';
import { workspacePathKey } from '../utils/workspaceProfiles';

export const BRANCH = 'master';
export const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;

export function createPinnedLookup(
  approvedAddresses: readonly SsrfResolvedAddress[],
): http.RequestOptions['lookup'] {
  const pinned = approvedAddresses.find((address) => address.family === 4) ?? approvedAddresses[0];
  if (!pinned) {
    return undefined;
  }

  return (_hostname, options, callback) => {
    if (typeof options === 'object' && options.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}

export const ESSENTIAL_DIRS: string[] = [];

export const RUNTIME_ASSET_DIRS: Array<{ source: string; destination: string }> = [
  {
    source: path.join('.github', 'frontier', '.frontier', 'runtime', 'templates', 'memories'),
    destination: 'memories',
  },
];

/**
 * Root of the pristine seed tree inside the extension bundle.
 */
const SEED_ROOT = path.join('.github', 'frontier', 'seed');

/**
 * Asset trees linked or copied from the extension bundle into the user
 * workspace so external tools (notably GitHub Copilot CLI) that only read the
 * workspace can discover Frontier FDEs, skills, instructions, and prompts.
 *
 * All sources live under the bundle's `seed/` tree, which `copy-assets.js`
 * builds as a pristine, unrewritten mirror of the canonical repository layout
 * rooted at the workspace root. The mapping is therefore trivial:
 *   `<ext>/.github/frontier/seed/<path>` -> `<workspace>/<path>`
 * Because the canonical layout is the layout the agents were authored against,
 * every relative reference resolves after seeding.
 *
 * Do NOT seed from the rest of the bundle: those copies are link-rewritten for
 * the extension's nested layout and produce dangling references in a workspace.
 * `tests/copilot-host-compatibility-behavior.ps1` guards this.
 *
 * Host-owned files (workflows, ISSUE_TEMPLATE, CODEOWNERS, PULL_REQUEST_TEMPLATE,
 * LICENSE, NOTICE) are intentionally never seeded: they would collide with
 * repository configuration and legal files the user owns.
 */
export const COPILOT_CLI_ASSET_DIRS: Array<{ source: string; destination: string }> = [
  { source: path.join(SEED_ROOT, '.github', 'agents'), destination: path.join('.github', 'agents') },
  { source: path.join(SEED_ROOT, '.github', 'skills'), destination: path.join('.github', 'skills') },
  { source: path.join(SEED_ROOT, '.github', 'instructions'), destination: path.join('.github', 'instructions') },
  { source: path.join(SEED_ROOT, '.github', 'prompts'), destination: path.join('.github', 'prompts') },
  { source: path.join(SEED_ROOT, '.github', 'templates'), destination: path.join('.github', 'templates') },
  { source: path.join(SEED_ROOT, '.github', 'schemas'), destination: path.join('.github', 'schemas') },
  { source: path.join(SEED_ROOT, '.github', 'registries'), destination: path.join('.github', 'registries') },
  { source: path.join(SEED_ROOT, '.github', 'hooks'), destination: path.join('.github', 'hooks') },
];

/**
 * Workspace-root support trees the seeded agents reference by repository-relative
 * path (gate scripts, rubrics, workflow docs, packs, plugins). These are always
 * copied rather than symlinked: a junction at the workspace root would take over
 * a directory the user also writes to.
 */
export const COPILOT_CLI_SUPPORT_DIRS: Array<{ source: string; destination: string }> = [
  { source: path.join(SEED_ROOT, 'docs'), destination: 'docs' },
  { source: path.join(SEED_ROOT, 'scripts'), destination: 'scripts' },
  { source: path.join(SEED_ROOT, 'evaluation'), destination: 'evaluation' },
  { source: path.join(SEED_ROOT, 'packs'), destination: 'packs' },
  {
    source: path.join(SEED_ROOT, '.frontier', 'runtime', 'plugins'),
    destination: path.join('.frontier', 'runtime', 'plugins'),
  },
];

/**
 * Standalone seeded documents. `AGENT-PROTOCOL.md` is the most-referenced file in
 * the whole agent set, and `AGENTS.md` / `Skills.md` are the entry points every
 * agent links back to. Copilot CLI also discovers root `AGENTS.md` natively.
 */
export const COPILOT_CLI_ASSET_FILES: Array<{ source: string; destination: string }> = [
  {
    source: path.join(SEED_ROOT, '.github', 'AGENT-PROTOCOL.md'),
    destination: path.join('.github', 'AGENT-PROTOCOL.md'),
  },
  {
    source: path.join(SEED_ROOT, '.github', 'agent-delegation.md'),
    destination: path.join('.github', 'agent-delegation.md'),
  },
  {
    source: path.join(SEED_ROOT, '.github', 'copilot-instructions.md'),
    destination: path.join('.github', 'copilot-instructions.md'),
  },
  { source: path.join(SEED_ROOT, 'AGENTS.md'), destination: 'AGENTS.md' },
  { source: path.join(SEED_ROOT, 'Skills.md'), destination: 'Skills.md' },
  { source: path.join(SEED_ROOT, '.token-limits.json'), destination: '.token-limits.json' },
  {
    source: path.join(SEED_ROOT, '.frontier', 'runtime', 'workspace-state.ps1'),
    destination: path.join('.frontier', 'runtime', 'workspace-state.ps1'),
  },
];

const WORKSPACE_WRAPPER_FILES = [
  { relativePath: path.join('.frontier', 'runtime', 'frontier.ps1'), entryFile: 'frontier.ps1', shell: 'pwsh' as const },
  { relativePath: path.join('.frontier', 'runtime', 'frontier.sh'), entryFile: 'frontier.sh', shell: 'bash' as const },
  { relativePath: path.join('.frontier', 'runtime', 'local-issue-manager.ps1'), entryFile: 'local-issue-manager.ps1', shell: 'pwsh' as const },
  { relativePath: path.join('.frontier', 'runtime', 'local-issue-manager.sh'), entryFile: 'local-issue-manager.sh', shell: 'bash' as const },
];

export const ESSENTIAL_FILES: string[] = [];

export const RUNTIME_DIRS = [
  '.frontier/state',
  '.frontier/digests',
  '.frontier/sessions',
  'docs/artifacts/prd',
  'docs/artifacts/adr',
  'docs/artifacts/specs',
  'docs/artifacts/reviews',
  'docs/artifacts/reviews/findings',
  'docs/artifacts/learnings',
  'docs/ux',
  'docs/execution/plans',
  'docs/execution/progress',
  'memories',
  'memories/session',
];

export async function promptWorkspaceFolder(
  title: string,
): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Frontier: Open a workspace folder first.');
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const pick = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { placeHolder: 'Select workspace folder', title },
  );

  return pick?.folder;
}

export async function promptWorkspaceRoot(title: string): Promise<string | undefined> {
  return (await promptWorkspaceFolder(title))?.uri.fsPath;
}

export function readJsonWithComments<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return parseConfigurationJson(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

export function copyDirRecursive(src: string, dest: string, overwrite = false): void {
  if (!fs.existsSync(src)) { return; }
  if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, overwrite);
    } else if (overwrite || !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function copyBundledRuntimeAssets(extensionRoot: string, workspaceRoot: string): void {
  for (const asset of RUNTIME_ASSET_DIRS) {
    copyDirRecursive(
      path.join(extensionRoot, asset.source),
      path.join(workspaceRoot, asset.destination),
      false,
    );
  }
}

/**
 * Seed workspace `.github/{agents,skills,instructions,prompts,templates,schemas}`
 * from the extension bundle. Required by GitHub Copilot CLI and any other surface
 * that only reads the repo-local `.github/` folder for context. Always uses
 * overwrite=false to preserve any workspace overrides the user has committed to .github/.
 */
export function copyCopilotCliAssets(
  extensionRoot: string,
  workspaceRoot: string,
  overwrite = false,
): void {
  for (const asset of [...COPILOT_CLI_ASSET_DIRS, ...COPILOT_CLI_SUPPORT_DIRS]) {
    copyDirRecursive(
      path.join(extensionRoot, asset.source),
      path.join(workspaceRoot, asset.destination),
      overwrite,
    );
  }
  copyCopilotCliAssetFiles(extensionRoot, workspaceRoot, overwrite);
}

/**
 * Copy the workspace-root support trees and standalone reference documents the
 * seeded agent set links to. Always copies (never symlinks) so the same helper
 * serves both `copy` and `symlink` CLI asset modes.
 */
export function copyCopilotCliSupportAssets(
  extensionRoot: string,
  workspaceRoot: string,
  overwrite = false,
): void {
  for (const asset of COPILOT_CLI_SUPPORT_DIRS) {
    copyDirRecursive(
      path.join(extensionRoot, asset.source),
      path.join(workspaceRoot, asset.destination),
      overwrite,
    );
  }
  copyCopilotCliAssetFiles(extensionRoot, workspaceRoot, overwrite);
}

export function copyCopilotCliAssetFiles(
  extensionRoot: string,
  workspaceRoot: string,
  overwrite = false,
): void {
  for (const asset of COPILOT_CLI_ASSET_FILES) {
    const src = path.join(extensionRoot, asset.source);
    if (!fs.existsSync(src)) { continue; }

    const dest = path.join(workspaceRoot, asset.destination);
    if (!overwrite && fs.existsSync(dest)) { continue; }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// --- CLI asset symlink mode --------------------------------------------------

export type CliAssetMode = 'copy' | 'symlink';

export interface CliAssetState {
  mode: CliAssetMode;
  extensionRoot: string;
  destinations: string[]; // relative to workspace root
  updatedAt: string;
}

export const CLI_ASSET_STATE_FILE = path.join('.frontier', 'cli-asset-state.json');

export function readCliAssetState(workspaceRoot: string): CliAssetState | undefined {
  const statePath = path.join(workspaceRoot, CLI_ASSET_STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as CliAssetState;
  } catch {
    return undefined;
  }
}

export function writeCliAssetState(workspaceRoot: string, state: CliAssetState): void {
  const statePath = path.join(workspaceRoot, CLI_ASSET_STATE_FILE);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function findBrokenCopilotCliLinks(
  workspaceRoot: string,
  installation?: { readonly extensionRoot: string; readonly extensionId: string },
): string[] {
  const state = readCliAssetState(workspaceRoot);
  if (state?.mode !== 'symlink' || typeof state.extensionRoot !== 'string') { return []; }
  const broken: string[] = [];
  for (const asset of COPILOT_CLI_ASSET_DIRS) {
    const destination = path.join(workspaceRoot, asset.destination);
    const entry = fs.lstatSync(destination, { throwIfNoEntry: false });
    if (!entry?.isSymbolicLink()) { continue; }
    const target = path.resolve(path.dirname(destination), fs.readlinkSync(destination));
    const recordedTarget = workspacePathKey(target) === workspacePathKey(path.join(state.extensionRoot, asset.source));
    let targetInstall = target;
    for (const _segment of asset.source.split(/[\\/]/).filter(Boolean)) { targetInstall = path.dirname(targetInstall); }
    const siblingInstall = installation && installation.extensionId
      && workspacePathKey(path.dirname(targetInstall)) === workspacePathKey(path.dirname(installation.extensionRoot))
      && path.basename(targetInstall).toLowerCase().startsWith(`${installation.extensionId.toLowerCase()}-`)
      && workspacePathKey(target) === workspacePathKey(path.join(targetInstall, asset.source));
    if (!recordedTarget && !siblingInstall) { continue; }
    try { fs.statSync(destination); }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) { throw error; }
      broken.push(asset.destination);
    }
  }
  return broken;
}

function symlinkType(): 'junction' | 'dir' {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function targetExists(linkPath: string): boolean {
  try {
    fs.statSync(linkPath); // follows the link
    return true;
  } catch {
    return false;
  }
}

/**
 * Create directory symlinks (NTFS junctions on Windows) so the workspace
 * `.github/{agents,skills,...}` paths resolve into the installed extension
 * bundle without copying bytes. Skips destinations that already exist as a
 * real directory or file (preserves user content). Stale symlinks are
 * recreated against the supplied extensionRoot.
 *
 * Returns lists of destinations (workspace-relative) by outcome.
 */
export function createCopilotCliSymlinks(
  extensionRoot: string,
  workspaceRoot: string,
): { linked: string[]; refreshed: string[]; skipped: string[] } {
  const linked: string[] = [];
  const refreshed: string[] = [];
  const skipped: string[] = [];

  for (const asset of COPILOT_CLI_ASSET_DIRS) {
    const target = path.join(extensionRoot, asset.source);
    const linkPath = path.join(workspaceRoot, asset.destination);

    if (!fs.existsSync(target)) {
      skipped.push(asset.destination);
      continue;
    }
    const linkExists = fs.existsSync(linkPath) || isSymlink(linkPath);
    if (linkExists) {
      if (!isSymlink(linkPath)) {
        // Real directory or file -- never destroy user content.
        skipped.push(asset.destination);
        continue;
      }
      try {
        fs.unlinkSync(linkPath);
      } catch {
        skipped.push(asset.destination);
        continue;
      }
      try {
        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        fs.symlinkSync(target, linkPath, symlinkType());
        refreshed.push(asset.destination);
      } catch {
        skipped.push(asset.destination);
      }
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(linkPath), { recursive: true });
      fs.symlinkSync(target, linkPath, symlinkType());
      linked.push(asset.destination);
    } catch {
      skipped.push(asset.destination);
    }
  }

  // Workspace-root support trees and standalone reference documents cannot be
  // junctioned safely, so they are always copied. Without them the linked agent
  // trees resolve none of their protocol, rubric, doc, or gate-script references.
  copyCopilotCliSupportAssets(extensionRoot, workspaceRoot, false);

  return { linked, refreshed, skipped };
}

/**
 * Re-validate previously created CLI symlinks. Recreates any link whose
 * target no longer exists (e.g. the extension version folder changed after
 * an upgrade). Leaves real directories alone.
 */
export function refreshCopilotCliSymlinks(
  extensionRoot: string,
  workspaceRoot: string,
  destinations?: readonly string[],
): { refreshed: string[]; stillValid: string[]; skipped: string[] } {
  const refreshed: string[] = [];  const stillValid: string[] = [];
  const skipped: string[] = [];

  for (const asset of COPILOT_CLI_ASSET_DIRS) {
    if (destinations && !destinations.includes(asset.destination)) { continue; }
    const linkPath = path.join(workspaceRoot, asset.destination);
    if (!isSymlink(linkPath)) {
      if (fs.existsSync(linkPath)) {
        skipped.push(asset.destination);
      }
      continue;
    }

    if (targetExists(linkPath)) {
      stillValid.push(asset.destination);
      continue;
    }

    const target = path.join(extensionRoot, asset.source);
    if (!fs.existsSync(target)) {
      skipped.push(asset.destination);
      continue;
    }

    try {
      fs.unlinkSync(linkPath);
      fs.symlinkSync(target, linkPath, symlinkType());
      refreshed.push(asset.destination);
    } catch {
      skipped.push(asset.destination);
    }
  }

  // Support trees are copied, not linked, so they can go stale after an
  // extension upgrade. Explicit refresh is deliberately NON-destructive:
  // these destinations (docs/, scripts/, evaluation/,
  // AGENTS.md, Skills.md) are shared namespaces the user also authors in.
  // Overwriting here would silently destroy user content on every window open,
  // which is the exact failure this change set exists to eliminate. Missing
  // files are added; existing files are always preserved. Staleness of already
  // present files is tracked as TD-018.
  if (!destinations) { copyCopilotCliSupportAssets(extensionRoot, workspaceRoot, false); }
  if (destinations && refreshed.length && !skipped.length) {
    const state = readCliAssetState(workspaceRoot);
    if (state?.mode === 'symlink') {
      writeCliAssetState(workspaceRoot, { ...state, extensionRoot, updatedAt: new Date().toISOString() });
    }
  }

  return { refreshed, stillValid, skipped };
}

/**
 * Append Frontier CLI symlink destinations to `.gitignore` under a dedicated
 * marker block so the symlinks themselves are not committed.
 */
export function appendCliSymlinksToGitignore(workspaceRoot: string): void {
  const markerStart = '# --- Frontier CLI symlinks (auto-generated, do not edit this block) ---';
  const markerEnd = '# --- /Frontier CLI symlinks ---';
  const entries = COPILOT_CLI_ASSET_DIRS.map(
    (a) => '/' + toPosixPath(a.destination),
  );

  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const block = [markerStart, ...entries, markerEnd].join('\n');

  if (existing.includes(markerStart)) {
    const before = existing.substring(0, existing.indexOf(markerStart));
    const afterIndex = existing.indexOf(markerEnd);
    const after = afterIndex >= 0 ? existing.substring(afterIndex + markerEnd.length) : '';
    fs.writeFileSync(
      gitignorePath,
      (before.trimEnd() + '\n\n' + block + after).trimStart(),
      'utf-8',
    );
    return;
  }

  const appended = '\n\n' + block + '\n';
  fs.writeFileSync(gitignorePath, existing.trimEnd() + appended, 'utf-8');
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function quotePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteShellLiteral(value: string): string {
  return value.replace(/'/g, `'"'"'`);
}

function renderPowerShellWrapper(
  entryFile: string,
  extensionRoot: string,
  cursorBinding = false,
): string {
  const runtimeRelativePath = quotePowerShellLiteral(path.join('.github', 'frontier', '.frontier', 'runtime', entryFile));
  const preferredExtensionRoot = quotePowerShellLiteral(extensionRoot);
  const cursorCheck = (variable: string): string => cursorBinding
    ? ` -and (Test-Path -LiteralPath (Join-Path ${variable} '.github/frontier/.frontier/runtime/cursor.js') -PathType Leaf)`
    : '';
  const preferredLookup = [
    `  $preferredExtensionRoot = '${preferredExtensionRoot}'`,
    `  $preferredRuntimeEntry = Join-Path $preferredExtensionRoot '${runtimeRelativePath}'`,
    `  if ((Test-Path -LiteralPath $preferredRuntimeEntry -PathType Leaf)${cursorCheck('$preferredExtensionRoot')}) {`,
    '    return (Resolve-Path $preferredExtensionRoot).Path',
    '  }',
    '',
  ];

  return [
    '#!/usr/bin/env pwsh',
    "$ErrorActionPreference = 'Stop'",
    "$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path",
    '',
    'function Resolve-FrontierExtensionRoot {',
    '  $extensionRootOverride = $env:FRONTIER_EXTENSION_ROOT',
    '  if ($extensionRootOverride) {',
    `    $runtimeEntry = Join-Path $extensionRootOverride '${runtimeRelativePath}'`,
    `    if ((Test-Path -LiteralPath $runtimeEntry -PathType Leaf)${cursorCheck('$extensionRootOverride')}) {`,
    '      return (Resolve-Path $extensionRootOverride).Path',
    '    }',
    ...(cursorBinding ? ["    throw 'The explicit Frontier runtime override does not support Cursor.'"] : []),
    '  }',
    '',
    ...(cursorBinding ? preferredLookup : []),
    '  $searchRoots = @(',
    ...(cursorBinding ? [
      `    (Split-Path -Parent '${preferredExtensionRoot}'),`,
      "    (Join-Path $HOME '.cursor/extensions'),",
      "    (Join-Path $HOME '.cursor-server/extensions')",
    ] : [
      "    (Join-Path $HOME '.vscode\\extensions'),",
      "    (Join-Path $HOME '.vscode-insiders\\extensions')",
    ]),
    '  )',
    '',
    '  $matches = @(',
    '    foreach ($searchRoot in $searchRoots) {',
    '      if (-not (Test-Path $searchRoot)) { continue }',
    "      foreach ($match in Get-ChildItem -Path $searchRoot -Directory -Filter 'jnpiyush.agentx-*' -ErrorAction SilentlyContinue) {",
    "        if ($match.Name -match '^jnpiyush\\.agentx-(?<version>\\d+\\.\\d+\\.\\d+)') {",
    '          [pscustomobject]@{',
    '            Path = $match.FullName',
    "            Version = [version]$Matches['version']",
    '          }',
    '        }',
    '      }',
    '    }',
    '  ) | Sort-Object Version -Descending',
    '',
    '  foreach ($match in $matches) {',
    `    $runtimeEntry = Join-Path $match.Path '${runtimeRelativePath}'`,
    `    if ((Test-Path -LiteralPath $runtimeEntry -PathType Leaf)${cursorCheck('$match.Path')}) {`,
    '      return $match.Path',
    '    }',
    '  }',
    '',
    ...(!cursorBinding ? preferredLookup : []),
    "  throw 'Frontier extension runtime not found. Reinstall the Frontier extension or set FRONTIER_EXTENSION_ROOT.'",
    '}',
    '',
    '$extensionRoot = Resolve-FrontierExtensionRoot',
    '$env:FRONTIER_WORKSPACE_ROOT = $workspaceRoot',
    `& (Join-Path $extensionRoot '${runtimeRelativePath}') @args`,
    '$succeeded = $?',
    '$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }',
    'if ($succeeded) {',
    '  $exitCode = 0',
    '} elseif ($exitCode -eq 0) {',
    '  $exitCode = 1',
    '}',
    'exit $exitCode',
    '',
  ].join('\n');
}

function renderBashWrapper(
  entryFile: string,
  extensionRoot: string,
  cursorBinding = false,
): string {
  const runtimeRelativePath = quoteShellLiteral(toPosixPath(path.join('.github', 'frontier', '.frontier', 'runtime', entryFile)));
  const preferredExtensionRoot = quoteShellLiteral(toPosixPath(extensionRoot));
  const cursorCheck = (variable: string): string => cursorBinding
    ? ` && -f "\${${variable}}/.github/frontier/.frontier/runtime/cursor.js"`
    : '';
  const preferredLookup = [
    `  candidate='${preferredExtensionRoot}'`,
    `  if [[ -f "\${candidate}/\${runtime_relative}"${cursorCheck('candidate')} ]]; then`,
    "    printf '%s\\n' \"$candidate\"",
    '    return 0',
    '  fi',
    '',
  ];
  const searchRoots = cursorBinding
    ? `'${quoteShellLiteral(toPosixPath(path.dirname(extensionRoot)))}' "$HOME/.cursor/extensions" "$HOME/.cursor-server/extensions"`
    : '"$HOME/.vscode/extensions" "$HOME/.vscode-insiders/extensions"';

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"',
    `runtime_relative='${runtimeRelativePath}'`,
    '',
    'resolve_frontier_extension_root() {',
    '  local candidate=""',
    '  local extension_root_override="${FRONTIER_EXTENSION_ROOT:-}"',
    '',
    `  if [[ -n "$extension_root_override" && -f "\${extension_root_override}/\${runtime_relative}"${cursorCheck('extension_root_override')} ]]; then`,
    "    printf '%s\n' \"$extension_root_override\"",
    '    return 0',
    '  fi',
    '',
    ...(cursorBinding ? [
      '  if [[ -n "$extension_root_override" ]]; then',
      "    echo 'The explicit Frontier runtime override does not support Cursor.' >&2",
      '    return 1',
      '  fi',
      ...preferredLookup,
    ] : []),
    '  local match=""',
    '  while IFS=$\'\\t\' read -r _ match; do',
    '    [[ -n "$match" ]] || continue',
    `    if [[ -f "\${match}/\${runtime_relative}"${cursorCheck('match')} ]]; then`,
    "      printf '%s\\n' \"$match\"",
    '      return 0',
    '    fi',
    '  done < <(',
    '    local search_root=""',
    '    local version=""',
    '    local version_key=""',
    `    for search_root in ${searchRoots}; do`,
    '      [[ -d "$search_root" ]] || continue',
    '      while IFS= read -r match; do',
    '        version="${match##*/jnpiyush.agentx-}"',
    '        if [[ "$version" =~ ^([0-9]+)\\.([0-9]+)\\.([0-9]+) ]]; then',
    "          printf -v version_key '%010d.%010d.%010d' \"${BASH_REMATCH[1]}\" \"${BASH_REMATCH[2]}\" \"${BASH_REMATCH[3]}\"",
    "          printf '%s\\t%s\\n' \"$version_key\" \"$match\"",
    '        fi',
    "      done < <(find \"$search_root\" -maxdepth 1 -mindepth 1 -type d -name 'jnpiyush.agentx-*')",
    "    done | sort -t $'\\t' -k1,1r",
    '  )',
    '',
    ...(!cursorBinding ? preferredLookup : []),
    "  echo 'Frontier extension runtime not found. Reinstall the Frontier extension or set FRONTIER_EXTENSION_ROOT.' >&2",
    '  return 1',
    '}',
    '',
    'extension_root="$(resolve_frontier_extension_root)"',
    'export FRONTIER_WORKSPACE_ROOT="$workspace_root"',
    'exec "${extension_root}/${runtime_relative}" "$@"',
    '',
  ].join('\n');
}

export function writeWorkspaceRuntimeWrappers(
  extensionRoot: string,
  workspaceRoot: string,
  cursorBinding = false,
): void {
  for (const wrapper of WORKSPACE_WRAPPER_FILES) {
    const targetPath = path.join(workspaceRoot, wrapper.relativePath);
    const content = wrapper.shell === 'pwsh'
      ? renderPowerShellWrapper(wrapper.entryFile, extensionRoot, cursorBinding)
      : renderBashWrapper(wrapper.entryFile, extensionRoot, cursorBinding);

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf-8');
  }
}

export async function downloadFile(url: string, dest: string, timeoutMs = 60_000): Promise<void> {
  const initialValidation = await resolveAndValidate(url);
  if (!initialValidation.allowed) {
    throw new Error(`Download URL blocked by SSRF policy: ${initialValidation.reason ?? url}`);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let done = false;

    const fail = (error: Error) => {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      file.destroy();
      fs.unlink(dest, () => reject(error));
    };

    const timer = setTimeout(() => {
      if (done) { return; }
      fail(new Error(`Download timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const request = (
      requestUrl: string,
      redirectCount = 0,
      approvedAddresses: readonly SsrfResolvedAddress[] = [],
    ) => {
      if (redirectCount > 5) {
        fail(new Error('Too many redirects'));
        return;
      }

      const transport = requestUrl.startsWith('https') ? https : http;
      const lookup = createPinnedLookup(approvedAddresses);
      transport.get(requestUrl, { lookup }, (response: {
        statusCode?: number;
        headers: { location?: string };
        pipe: (stream: fs.WriteStream) => void;
        resume: () => void;
      }) => {
        if (
          response.statusCode
          && response.statusCode >= 300
          && response.statusCode < 400
          && response.headers.location
        ) {
          response.resume();
          let redirectUrl: string;
          try {
            redirectUrl = new URL(response.headers.location, requestUrl).toString();
          } catch {
            fail(new Error(`Invalid redirect URL: ${response.headers.location}`));
            return;
          }

          resolveAndValidate(redirectUrl)
            .then((validation) => {
              if (!validation.allowed) {
                fail(new Error(`Download redirect blocked by SSRF policy: ${validation.reason ?? redirectUrl}`));
                return;
              }
              request(validation.url, redirectCount + 1, validation.resolvedAddresses);
            })
            .catch((error: Error) => fail(error));
          return;
        }

        if (response.statusCode && response.statusCode !== 200) {
          fail(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          clearTimeout(timer);
          done = true;
          file.close();
          resolve();
        });
      }).on('error', (err: Error) => {
        fail(err);
      });
    };

    request(initialValidation.url, 0, initialValidation.resolvedAddresses);
  });
}

export function mergeGitignore(root: string): void {
  const markerStart = '# --- Frontier (auto-generated, do not edit this block) ---';
  const markerEnd = '# --- /Frontier ---';
  const agentxEntries = [
    '# Frontier runtime state',
    '.frontier/',
  ];

  const gitignorePath = path.join(root, '.gitignore');
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }

  if (existing.includes(markerStart)) {
    const before = existing.substring(0, existing.indexOf(markerStart));
    const afterIndex = existing.indexOf(markerEnd);
    const after = afterIndex >= 0
      ? existing.substring(afterIndex + markerEnd.length)
      : '';
    const block = [markerStart, ...agentxEntries, markerEnd].join('\n');
    fs.writeFileSync(gitignorePath, (before.trimEnd() + '\n\n' + block + after).trimStart(), 'utf-8');
    return;
  }

  const block = '\n\n' + [markerStart, ...agentxEntries, markerEnd].join('\n') + '\n';
  fs.writeFileSync(gitignorePath, existing.trimEnd() + block, 'utf-8');
}

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });

  if (process.platform === 'win32') {
    const resolved = resolveWindowsShell();
    if (!resolved) {
      throw new Error(
        'PowerShell 7.4+ (pwsh) is required. Install it from '
        + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell.',
      );
    }

    const { execShell: exec } = await import('../utils/shell');
    await exec(
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      path.dirname(zipPath),
      'pwsh',
    );
    return;
  }

  const { execShell: exec } = await import('../utils/shell');
  await exec(
    `unzip -qo "${zipPath}" -d "${destDir}"`,
    path.dirname(zipPath),
    'bash',
  );
}