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