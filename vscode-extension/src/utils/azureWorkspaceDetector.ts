import * as fs from 'fs';
import * as path from 'path';

const MAX_SCAN_DEPTH = 3;
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.turbo',
  'bin',
  'build',
  'dist',
  'node_modules',
  'obj',
  'out',
]);
const AZURE_DIRECTORY_NAMES = new Set([
  '.azure',
]);
const AZURE_FILE_NAMES = new Set([
  'azure-pipelines.yml',
  'azure-pipelines.yaml',
  'azure.yaml',
  'host.json',
  'local.settings.json',
]);
const AZURE_FILE_EXTENSIONS = new Set([
  '.bicep',
  '.bicepparam',
]);
const TEXT_HINT_FILES = [
  '.frontier/config.json',
  'README.md',
  'package.json',
  'pyproject.toml',
];
const AZURE_TEXT_HINTS = [
  /\bazure\b/i,
  /\bazd\b/i,
  /azure functions/i,
  /container apps/i,
  /app service/i,
  /static web apps/i,
];

function hasAzureTextHints(workspaceRoot: string): boolean {
  for (const relativePath of TEXT_HINT_FILES) {
    const filePath = path.join(workspaceRoot, relativePath);
    try {
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8').slice(0, 32_768);
      if (AZURE_TEXT_HINTS.some((pattern) => pattern.test(content))) {
        return true;
      }
    } catch {
      // Ignore unreadable hint files and continue scanning.
    }
  }

  return false;
}

export function workspaceUsesAzure(workspaceRoot?: string): boolean {
  if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
    return false;
  }

  const pending: Array<{ directory: string; depth: number }> = [
    { directory: workspaceRoot, depth: 0 },
  ];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current.directory, entry.name);

      if (entry.isDirectory()) {
        if (AZURE_DIRECTORY_NAMES.has(entry.name)) {
          return true;
        }

        if (current.depth < MAX_SCAN_DEPTH && !IGNORED_DIRECTORIES.has(entry.name)) {
          pending.push({ directory: entryPath, depth: current.depth + 1 });
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (AZURE_FILE_NAMES.has(entry.name)) {
        return true;
      }

      if (AZURE_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        return true;
      }
    }
  }

  return hasAzureTextHints(workspaceRoot);
}