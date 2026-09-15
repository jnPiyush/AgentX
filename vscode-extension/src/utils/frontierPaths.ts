import * as fs from 'fs';
import * as path from 'path';

export const FRONTIER_STATE_DIRECTORY = '.frontier';
export const TRANSITIONAL_STATE_DIRECTORY = '.hve';
export const LEGACY_STATE_DIRECTORY = '.agentx';
const LEGACY_RUNTIME_ENTRIES = new Set([
  'agentic-runner.ps1',
  'agentx-cli.ps1',
  'agentx.ps1',
  'agentx.sh',
  'frontier.ps1',
  'frontier.sh',
  'local-issue-manager.ps1',
  'local-issue-manager.sh',
  'install-manifest.json',
  'hooks',
  'mcp-server',
  'plugins',
  'templates',
]);

export function resolveFrontierStateDirectory(workspaceRoot: string): string {
  const frontierDirectory = path.join(workspaceRoot, FRONTIER_STATE_DIRECTORY);
  const transitionalDirectory = path.join(workspaceRoot, TRANSITIONAL_STATE_DIRECTORY);
  const legacyDirectory = path.join(workspaceRoot, LEGACY_STATE_DIRECTORY);

  if (fs.existsSync(frontierDirectory)) {
    return frontierDirectory;
  }
  if (fs.existsSync(transitionalDirectory)) {
    return transitionalDirectory;
  }
  if (fs.existsSync(legacyDirectory)) {
    return legacyDirectory;
  }
  return frontierDirectory;
}

export function resolveFrontierStatePath(workspaceRoot: string, ...segments: string[]): string {
  return path.join(resolveFrontierStateDirectory(workspaceRoot), ...segments);
}

export function hasFrontierState(workspaceRoot: string): boolean {
  return fs.existsSync(resolveFrontierStatePath(workspaceRoot, 'config.json'));
}

export function migrateLegacyState(workspaceRoot: string): boolean {
  const frontierDirectory = path.join(workspaceRoot, FRONTIER_STATE_DIRECTORY);
  const transitionalDirectory = path.join(workspaceRoot, TRANSITIONAL_STATE_DIRECTORY);
  const legacyDirectory = path.join(workspaceRoot, LEGACY_STATE_DIRECTORY);
  const marker = path.join(frontierDirectory, 'state', 'frontier-migration-v1.json');
  for (const candidate of [frontierDirectory, path.dirname(marker), marker]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) {
      throw new Error('State migration does not follow symbolic links.');
    }
  }
  const sources = [transitionalDirectory, legacyDirectory].filter(directory => fs.existsSync(directory));
  if (fs.existsSync(marker) || sources.length === 0) {
    return false;
  }
  let changed = false;
  const copyMissing = (source: string, destination: string, topLevel: boolean): void => {
    if (fs.lstatSync(source).isSymbolicLink()
        || (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink())) {
      throw new Error('State migration does not follow symbolic links.');
    }
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if ((topLevel && LEGACY_RUNTIME_ENTRIES.has(entry.name.toLowerCase()))
          || entry.name === 'frontier-migration-v1.json' || entry.name.endsWith('.lock')) { continue; }
      if (entry.isSymbolicLink()) { throw new Error('State migration does not follow symbolic links.'); }
      const target = path.join(destination, entry.name);
      if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isSymbolicLink()) { throw new Error('State migration does not follow symbolic links.'); }
        if (!entry.isDirectory() || !fs.statSync(target).isDirectory()) { continue; }
      }
      const origin = path.join(source, entry.name);
      if (entry.isDirectory()) { copyMissing(origin, target, false); }
      else {
        const temporary = `${target}.migrating-${process.pid}`;
        try {
          fs.copyFileSync(origin, temporary, fs.constants.COPYFILE_EXCL);
          fs.linkSync(temporary, target);
          changed = true;
        } finally { fs.rmSync(temporary, { force: true }); }
      }
    }
  };
  const lock = path.join(workspaceRoot, '.frontier-migration.lock');
  try { fs.mkdirSync(lock); }
  catch { throw new Error('State migration is busy. Retry after it finishes; recover a stale .frontier-migration.lock only after checking no migration is running.'); }
  try {
    if (fs.existsSync(marker)) { return false; }
    for (const source of sources) { copyMissing(source, frontierDirectory, true); }
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    const temporary = `${marker}.migrating-${process.pid}`;
    try {
      fs.writeFileSync(temporary, '{"version":1}\n', { flag: 'wx' });
      fs.linkSync(temporary, marker);
    } finally { fs.rmSync(temporary, { force: true }); }
  } finally { fs.rmdirSync(lock); }
  return changed;
}