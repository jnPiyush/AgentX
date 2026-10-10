import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { parseConfigurationJson } from './configurationJson';
import { readBoundedUtf8 } from './boundedFile';

export interface WorkspaceBinding {
  readonly schemaVersion: 1;
  readonly identity: string;
  readonly workspaceRoot: string;
  readonly stateRoot: string;
  readonly authority: string;
  readonly mode: 'private' | 'repository';
}

export function canonicalWorkspaceRoot(root: string): string {
  const value = fs.realpathSync.native(root);
  if (/^[\\/]{2}/.test(value)) {
    throw new Error('Network-share workspaces are not supported by automatic local Frontier state.');
  }
  if (!fs.statSync(value).isDirectory()) { throw new Error('Frontier requires a filesystem folder.'); }
  if (value === path.parse(value).root) {
    throw new Error('Open a project folder rather than a filesystem root to use automatic Frontier state.');
  }
  return path.resolve(value);
}

export function workspaceIdentity(root: string, authority: string): string {
  if (process.platform === 'win32') {
    // Win32 normalization drops trailing dots and spaces, so such paths have no stable identity.
    const segment = root.split(/[\\/]+/).find(part => part !== '.' && part !== '..' && /[. ]$/.test(part));
    if (segment) {
      throw new Error(`Frontier workspace paths must not contain segments ending in a dot or space: ${segment}`);
    }
  }
  const value = workspacePathKey(root).replace(/\\/g, '/');
  return createHash('sha256').update(`frontier-workspace-v1\n${authority}\n${value}`).digest('hex');
}

export function workspacePathKey(root: string): string {
  const value = path.resolve(root);
  return process.platform === 'win32'
    ? value.replace(/[A-Z]/g, letter => letter.toLowerCase()) : value;
}

export function containsWorkspacePath(root: string, target: string): boolean {
  const parent = workspacePathKey(root);
  const child = workspacePathKey(target);
  return child === parent || child.startsWith(parent + path.sep);
}

export function assertStatePath(target: string): void {
  if (!path.isAbsolute(target)) { throw new Error('Frontier storage must be an absolute path.'); }
  const resolved = path.resolve(target);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let entry: fs.Stats;
    try { entry = fs.lstatSync(current); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { continue; }
      throw error;
    }
    if (entry.isSymbolicLink() || (entry.isFile() && entry.nlink > 1)) {
      throw new Error(`Frontier storage must not contain links: ${current}`);
    }
  }
}

function samePath(first: string, second: string): boolean {
  return workspacePathKey(first) === workspacePathKey(second);
}

export function readWorkspaceBinding(
  stateRoot: string, root: string, authority: string,
): WorkspaceBinding | undefined {
  assertStatePath(stateRoot);
  if (!fs.existsSync(stateRoot)) { return undefined; }
  const filename = path.join(stateRoot, 'workspace-binding.json');
  assertStatePath(filename);
  const text = readBoundedUtf8(filename, 16384, 'Frontier workspace binding is oversized.');
  if (text === undefined) {
    throw new Error('Frontier private state is incomplete; existing files were preserved for recovery.');
  }
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Frontier workspace binding.');
  }
  const binding = value as Record<string, unknown>;
  if (binding.schemaVersion !== 1 || typeof binding.identity !== 'string'
    || binding.identity !== workspaceIdentity(root, authority)
    || binding.authority !== authority || typeof binding.workspaceRoot !== 'string'
    || typeof binding.stateRoot !== 'string' || !samePath(binding.workspaceRoot, root)
    || !samePath(binding.stateRoot, stateRoot)
    || (binding.mode !== 'private' && binding.mode !== 'repository')) {
    throw new Error('Frontier private state belongs to a different workspace, authority or profile.');
  }
  if (binding.mode === 'private') {
    const configPath = path.join(stateRoot, 'config.json');
    assertStatePath(configPath);
    const config = parseConfigurationJson(fs.readFileSync(configPath, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Private Frontier configuration must be a JSON object.');
    }
    assertStatePath(path.join(stateRoot, 'operation.lock'));
    if (!fs.statSync(path.join(stateRoot, 'operation.lock')).isFile()) {
      throw new Error('Private Frontier operation lease is missing.');
    }
  }
  return {
    schemaVersion: 1, identity: binding.identity,
    workspaceRoot: binding.workspaceRoot, stateRoot: binding.stateRoot,
    authority, mode: binding.mode === 'private' ? 'private' : 'repository',
  };
}

export function privateWorkspacePath(storageRoot: string, root: string, authority: string): string {
  let ancestor = path.resolve(storageRoot);
  const missing: string[] = [];
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) { throw new Error('Frontier storage has no accessible filesystem ancestor.'); }
    missing.unshift(path.basename(ancestor));
    ancestor = parent;
  }
  const canonicalStorage = path.join(fs.realpathSync.native(ancestor), ...missing);
  const destination = path.join(canonicalStorage, 'workspaces', workspaceIdentity(root, authority));
  if (containsWorkspacePath(root, destination)) {
    throw new Error('Private Frontier storage must be outside the analyzed workspace.');
  }
  assertStatePath(destination);
  return destination;
}

export function provisionWorkspace(
  stateRoot: string, root: string, authority: string, version: string,
  mode: WorkspaceBinding['mode'] = 'private',
): WorkspaceBinding {
  const existing = readWorkspaceBinding(stateRoot, root, authority);
  if (existing) { return existing; }
  const parent = path.dirname(stateRoot);
  assertStatePath(parent);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temporary = path.join(parent, `${path.basename(stateRoot)}.${randomUUID()}.tmp`);
  const binding: WorkspaceBinding = {
    schemaVersion: 1, identity: workspaceIdentity(root, authority),
    workspaceRoot: root, stateRoot, authority, mode,
  };
  try {
    fs.mkdirSync(temporary, { mode: 0o700 });
    const write = (name: string, value: unknown) => fs.writeFileSync(path.join(temporary, name),
      JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    write('workspace-binding.json', binding);
    if (mode === 'private') {
      write('config.json', {
        provider: 'local', integration: 'local', mode: 'local', enforceIssues: false,
        nextIssueNumber: 1, created: new Date().toISOString(),
      });
    }
    write('version.json', { version, installedAt: new Date().toISOString() });
    fs.writeFileSync(path.join(temporary, 'operation.lock'), '', { mode: 0o600, flag: 'wx' });
    fs.mkdirSync(path.join(temporary, 'state'), { mode: 0o700 });
    try { fs.renameSync(temporary, stateRoot); } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(code ?? '') || !fs.existsSync(stateRoot)) {
        throw error;
      }
      const concurrent = readWorkspaceBinding(stateRoot, root, authority);
      if (!concurrent) { throw error; }
      return concurrent;
    }
    return binding;
  } finally {
    if (fs.existsSync(temporary)) { fs.rmSync(temporary, { recursive: true, force: true }); }
  }
}
