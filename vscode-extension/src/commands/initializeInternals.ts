import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveWindowsShell } from '../utils/shell';

export const BRANCH = 'master';
export const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;

export const ESSENTIAL_DIRS: string[] = [];

export const RUNTIME_ASSET_DIRS: Array<{ source: string; destination: string }> = [
  {
    source: path.join('.github', 'agentx', '.agentx', 'templates', 'memories'),
    destination: 'memories',
  },
];

/**
 * Asset trees copied from the extension bundle into the user workspace `.github/`
 * so external tools (notably GitHub Copilot CLI) that only read the workspace's
 * `.github/` folder can discover AgentX agents, skills, instructions, prompts,
 * templates, and schemas. The VS Code extension itself still resolves these
 * via `runtimeAssets.resolveAssetPath` -- this copy is purely for surfaces
 * that have no extension-context awareness.
 *
 * NOTE: scripts/ (score-output.ps1, validate-handoff.ps1) are referenced by bundled agents but
 * are NOT seeded here because they are not included in the extension bundle's .github/agentx/ tree.
 * Users who need those scripts can install them via packs/agentx-copilot-cli/install.ps1 -Force.
 * Adding scripts/ seeding requires a separate bundle-packaging change.
 */
export const COPILOT_CLI_ASSET_DIRS: Array<{ source: string; destination: string }> = [
  { source: path.join('.github', 'agentx', 'agents'), destination: path.join('.github', 'agents') },
  { source: path.join('.github', 'agentx', 'skills'), destination: path.join('.github', 'skills') },
  { source: path.join('.github', 'agentx', 'instructions'), destination: path.join('.github', 'instructions') },
  { source: path.join('.github', 'agentx', 'prompts'), destination: path.join('.github', 'prompts') },
  { source: path.join('.github', 'agentx', 'templates'), destination: path.join('.github', 'templates') },
  { source: path.join('.github', 'agentx', 'schemas'), destination: path.join('.github', 'schemas') },
];

const WORKSPACE_WRAPPER_FILES = [
  { relativePath: path.join('.agentx', 'agentx.ps1'), entryFile: 'agentx.ps1', shell: 'pwsh' as const },
  { relativePath: path.join('.agentx', 'local-issue-manager.ps1'), entryFile: 'local-issue-manager.ps1', shell: 'pwsh' as const },
  { relativePath: path.join('.agentx', 'agentx.sh'), entryFile: 'agentx.sh', shell: 'bash' as const },
  { relativePath: path.join('.agentx', 'local-issue-manager.sh'), entryFile: 'local-issue-manager.sh', shell: 'bash' as const },
];

export const ESSENTIAL_FILES: string[] = [];

export const RUNTIME_DIRS = [
  '.agentx/state',
  '.agentx/digests',
  '.agentx/sessions',
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

export async function promptWorkspaceRoot(title: string): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0].uri.fsPath;
  }

  const pick = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { placeHolder: 'Select workspace folder', title },
  );

  return pick?.folder.uri.fsPath;
}

export function readJsonWithComments<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as T;
    } catch {
      let stripped = '';
      let inStr = false;
      let esc = false;
      for (let index = 0; index < raw.length; index++) {
        const char = raw[index];
        if (esc) {
          stripped += char;
          esc = false;
          continue;
        }
        if (inStr) {
          if (char === '\\') {
            esc = true;
          } else if (char === '"') {
            inStr = false;
          }
          stripped += char;
          continue;
        }
        if (char === '"') {
          inStr = true;
          stripped += char;
          continue;
        }
        if (char === '/' && raw[index + 1] === '/') {
          while (index < raw.length && raw[index] !== '\n') {
            index++;
          }
          continue;
        }
        if (char === '/' && raw[index + 1] === '*') {
          index += 2;
          while (index < raw.length && !(raw[index] === '*' && raw[index + 1] === '/')) {
            index++;
          }
          index++;
          continue;
        }
        stripped += char;
      }
      return JSON.parse(stripped) as T;
    }
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
  for (const asset of COPILOT_CLI_ASSET_DIRS) {
    copyDirRecursive(
      path.join(extensionRoot, asset.source),
      path.join(workspaceRoot, asset.destination),
      overwrite,
    );
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

export const CLI_ASSET_STATE_FILE = path.join('.agentx', 'cli-asset-state.json');

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
): { refreshed: string[]; stillValid: string[]; skipped: string[] } {
  const refreshed: string[] = [];
  const stillValid: string[] = [];
  const skipped: string[] = [];

  for (const asset of COPILOT_CLI_ASSET_DIRS) {
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

  return { refreshed, stillValid, skipped };
}

/**
 * Append AgentX CLI symlink destinations to `.gitignore` under a dedicated
 * marker block so the symlinks themselves are not committed.
 */
export function appendCliSymlinksToGitignore(workspaceRoot: string): void {
  const markerStart = '# --- AgentX CLI symlinks (auto-generated, do not edit this block) ---';
  const markerEnd = '# --- /AgentX CLI symlinks ---';
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

function renderPowerShellWrapper(entryFile: string, extensionRoot: string): string {
  const runtimeRelativePath = quotePowerShellLiteral(path.join('.github', 'agentx', '.agentx', entryFile));
  const preferredExtensionRoot = quotePowerShellLiteral(extensionRoot);

  return [
    '#!/usr/bin/env pwsh',
    "$ErrorActionPreference = 'Stop'",
    "$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path",
    '',
    'function Resolve-AgentXExtensionRoot {',
    '  $candidatePaths = @(',
    '    $env:AGENTX_EXTENSION_ROOT',
    `    '${preferredExtensionRoot}'`,
    '  ) | Where-Object { $_ -and (Test-Path $_) }',
    '',
    '  foreach ($candidate in $candidatePaths) {',
    '    return (Resolve-Path $candidate).Path',
    '  }',
    '',
    '  $searchRoots = @(',
    "    (Join-Path $HOME '.vscode\\extensions'),",
    "    (Join-Path $HOME '.vscode-insiders\\extensions')",
    '  )',
    '',
    '  foreach ($searchRoot in $searchRoots) {',
    '    if (-not (Test-Path $searchRoot)) { continue }',
    '    $matches = @(',
    "      Get-ChildItem -Path $searchRoot -Directory -Filter 'jnpiyush.agentx-*' -ErrorAction SilentlyContinue",
    '      | Sort-Object Name -Descending',
    '    )',
    '',
    '    foreach ($match in $matches) {',
    `      $runtimeEntry = Join-Path $match.FullName '${runtimeRelativePath}'`,
    '      if (Test-Path $runtimeEntry) {',
    '        return $match.FullName',
    '      }',
    '    }',
    '  }',
    '',
    "  throw 'AgentX extension runtime not found. Reinstall the AgentX extension or set AGENTX_EXTENSION_ROOT.'",
    '}',
    '',
    '$extensionRoot = Resolve-AgentXExtensionRoot',
    '$env:AGENTX_WORKSPACE_ROOT = $workspaceRoot',
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

function renderBashWrapper(entryFile: string, extensionRoot: string): string {
  const runtimeRelativePath = quoteShellLiteral(toPosixPath(path.join('.github', 'agentx', '.agentx', entryFile)));
  const preferredExtensionRoot = quoteShellLiteral(toPosixPath(extensionRoot));

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"',
    `runtime_relative='${runtimeRelativePath}'`,
    '',
    'resolve_agentx_extension_root() {',
    '  local candidate=""',
    '',
    '  if [[ -n "${AGENTX_EXTENSION_ROOT:-}" && -f "${AGENTX_EXTENSION_ROOT}/${runtime_relative}" ]]; then',
    "    printf '%s\\n' \"$AGENTX_EXTENSION_ROOT\"",
    '    return 0',
    '  fi',
    '',
    `  candidate='${preferredExtensionRoot}'`,
    '  if [[ -f "${candidate}/${runtime_relative}" ]]; then',
    "    printf '%s\\n' \"$candidate\"",
    '    return 0',
    '  fi',
    '',
    '  local search_root=""',
    '  local match=""',
    '  for search_root in "$HOME/.vscode/extensions" "$HOME/.vscode-insiders/extensions"; do',
    '    [[ -d "$search_root" ]] || continue',
    '    while IFS= read -r match; do',
    '      if [[ -f "${match}/${runtime_relative}" ]]; then',
    "        printf '%s\\n' \"$match\"",
    '        return 0',
    '      fi',
    "    done < <(find \"$search_root\" -maxdepth 1 -mindepth 1 -type d -name 'jnpiyush.agentx-*' | sort -r)",
    '  done',
    '',
    "  echo 'AgentX extension runtime not found. Reinstall the AgentX extension or set AGENTX_EXTENSION_ROOT.' >&2",
    '  return 1',
    '}',
    '',
    'extension_root="$(resolve_agentx_extension_root)"',
    'export AGENTX_WORKSPACE_ROOT="$workspace_root"',
    'exec "${extension_root}/${runtime_relative}" "$@"',
    '',
  ].join('\n');
}

export function writeWorkspaceRuntimeWrappers(extensionRoot: string, workspaceRoot: string): void {
  for (const wrapper of WORKSPACE_WRAPPER_FILES) {
    const targetPath = path.join(workspaceRoot, wrapper.relativePath);
    const content = wrapper.shell === 'pwsh'
      ? renderPowerShellWrapper(wrapper.entryFile, extensionRoot)
      : renderBashWrapper(wrapper.entryFile, extensionRoot);

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf-8');
  }
}

export function downloadFile(url: string, dest: string, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let done = false;

    const timer = setTimeout(() => {
      if (done) { return; }
      done = true;
      file.destroy();
      fs.unlink(dest, () => {});
      reject(new Error(`Download timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const request = (requestUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        clearTimeout(timer);
        done = true;
        reject(new Error('Too many redirects'));
        return;
      }

      const transport = requestUrl.startsWith('https') ? https : http;
      transport.get(requestUrl, (response: {
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
          request(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode && response.statusCode !== 200) {
          clearTimeout(timer);
          done = true;
          reject(new Error(`Download failed with status ${response.statusCode}`));
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
        clearTimeout(timer);
        done = true;
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

export function mergeGitignore(root: string): void {
  const markerStart = '# --- AgentX (auto-generated, do not edit this block) ---';
  const markerEnd = '# --- /AgentX ---';
  const agentxEntries = [
    '# AgentX runtime state',
    '.agentx/',
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