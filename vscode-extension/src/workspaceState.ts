import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import {
  hasRepositoryState, registerFrontierStateDirectory, resolveRepositoryStatePath,
} from './utils/frontierPaths';
import {
  assertStatePath, canonicalWorkspaceRoot, containsWorkspacePath, privateWorkspacePath,
  provisionWorkspace, readWorkspaceBinding, WorkspaceBinding, workspaceIdentity,
} from './utils/workspaceProfiles';
import { parseConfigurationJson } from './utils/configurationJson';

function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Returns the marker path while a storage-mode transition may still be running. */
export function activeTransitionMarker(stateRoot: string): string | undefined {
  const marker = path.join(stateRoot, 'transition.lock');
  let text: string;
  try { text = fs.readFileSync(marker, 'utf8'); } catch (error) {
    // Windows transitions hold the marker open without sharing, so read failures mean active.
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? undefined : marker;
  }
  try {
    const owner: unknown = JSON.parse(text);
    if (owner && typeof owner === 'object' && 'pid' in owner
      && Number.isInteger(owner.pid) && (owner.pid as number) > 0) {
      return processAlive(owner.pid as number) ? marker : undefined;
    }
  } catch { /* An empty or partial marker may still be mid-write. */ }
  return marker;
}

function releaseLease(lease: string): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { fs.unlinkSync(lease); return; } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { return; }
      if (attempt === 2) {
        console.warn(`Frontier could not release editor lease ${lease}; `
          + 'run "frontier workspace-state recover" after this editor exits.', error);
      }
    }
  }
}

export class WorkspaceState {
  constructor(private readonly context: vscode.ExtensionContext) {}

  authority(root: string): string {
    const folder = this.folder(root);
    return folder?.uri.authority
      || (vscode.env.remoteName ? `${vscode.env.remoteName}:${os.hostname()}` : '');
  }

  identity(root: string): string {
    return workspaceIdentity(canonicalWorkspaceRoot(root), this.authority(root));
  }

  private folder(root: string): vscode.WorkspaceFolder | undefined {
    const canonical = canonicalWorkspaceRoot(root);
    const folders = vscode.workspace.workspaceFolders?.filter(folder => {
      if (!['file', 'vscode-remote'].includes(folder.uri.scheme)
        || !fs.existsSync(folder.uri.fsPath)) { return false; }
      try { return containsWorkspacePath(canonicalWorkspaceRoot(folder.uri.fsPath), canonical); }
      catch (error) {
        console.warn(`Frontier skipped unsupported workspace folder ${folder.name}:`, error);
        return false;
      }
    }) ?? [];
    if (new Set(folders.map(folder => folder.uri.authority)).size > 1) {
      throw new Error('Multiple remote authorities resolve to the same filesystem root in this host.');
    }
    return folders.sort((first, second) => second.uri.fsPath.length - first.uri.fsPath.length)[0];
  }

  assertAvailable(root: string): string {
    if (!vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before running Frontier operations.');
    }
    const folder = this.folder(root);
    if (!folder || !['file', 'vscode-remote'].includes(folder.uri.scheme)) {
      throw new Error('Frontier operations require an open local or remote filesystem folder.');
    }
    if ((folder.uri.scheme === 'vscode-remote' && !vscode.env.remoteName)
      || (vscode.env.remoteName && this.context.extension.extensionKind === vscode.ExtensionKind.UI)) {
      throw new Error('Install Frontier in the remote workspace extension host before running filesystem operations.');
    }
    const canonical = canonicalWorkspaceRoot(root);
    const canonicalFolder = canonicalWorkspaceRoot(folder.uri.fsPath);
    if (!containsWorkspacePath(canonicalFolder, canonical)) {
      throw new Error('The selected Frontier root resolves outside its workspace folder.');
    }
    return canonical;
  }

  inspect(root: string, allowMissingRepository = false): WorkspaceBinding | undefined {
    let canonical = root;
    try {
    canonical = canonicalWorkspaceRoot(root);
    const storage = this.context.globalStorageUri?.fsPath;
    const authority = this.authority(root);
    const binding = storage
      ? readWorkspaceBinding(privateWorkspacePath(storage, canonical, authority), canonical, authority)
      : undefined;
    if (binding?.mode === 'repository' && !hasRepositoryState(canonical) && !allowMissingRepository) {
      throw new Error('Repository-managed Frontier state was removed. Restore it or explicitly initialize this workspace.');
    }
    registerFrontierStateDirectory(root, binding?.mode === 'private' ? binding.stateRoot : undefined);
    registerFrontierStateDirectory(canonical, binding?.mode === 'private' ? binding.stateRoot : undefined);
    return binding;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      registerFrontierStateDirectory(root, failure);
      registerFrontierStateDirectory(canonical, failure);
      throw failure;
    }
  }

  ensure(root: string): string {
    const canonical = this.assertAvailable(root);
    let binding = this.inspect(root);
    if (!binding && !hasRepositoryState(canonical)) {
      if (['state', 'sessions', 'issues', 'version.json', 'cli-assets.json', 'cursor-assets.json']
        .some(name => fs.existsSync(resolveRepositoryStatePath(canonical, name)))) {
        throw new Error('Existing repository Frontier state has no configuration. Restore it or explicitly initialize repository support; no new private history was created.');
      }
      const settings = vscode.workspace.getConfiguration('frontier', vscode.Uri.file(canonical));
      if (!settings.get<boolean>('automaticWorkspaceState', true)) {
        throw new Error('Automatic Frontier state is disabled. Run Initialize Repository Support to opt in.');
      }
      const storage = this.context.globalStorageUri;
      if (!storage || !['file', 'vscode-remote'].includes(storage.scheme)) {
        throw new Error('Host-local Frontier storage is unavailable; no repository fallback was created.');
      }
      const authority = this.authority(root);
      binding = provisionWorkspace(privateWorkspacePath(storage.fsPath, canonical, authority),
        canonical, authority, String(this.context.extension.packageJSON.version));
    }
    if (binding?.mode !== 'private') {
      const filename = resolveRepositoryStatePath(canonical, 'config.json');
      assertStatePath(filename);
      const config = parseConfigurationJson(fs.readFileSync(filename, 'utf8'));
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Repository Frontier configuration must be a JSON object.');
      }
      if (!binding && this.context.globalStorageUri) {
        const authority = this.authority(root);
        binding = provisionWorkspace(
          privateWorkspacePath(this.context.globalStorageUri.fsPath, canonical, authority),
          canonical, authority, String(this.context.extension.packageJSON.version), 'repository');
      }
    }
    this.inspect(root);
    return canonical;
  }

  environment(root: string): NodeJS.ProcessEnv {
    const canonical = this.assertAvailable(root);
    const binding = this.inspect(root);
    return {
      FRONTIER_WORKSPACE_ROOT: canonical,
      FRONTIER_STATE_ROOT: binding?.mode === 'private' ? binding.stateRoot : undefined,
      FRONTIER_STATE_WORKSPACE: binding?.mode === 'private' ? canonical : undefined,
      FRONTIER_STATE_AUTHORITY: binding?.mode === 'private' ? binding.authority : undefined,
      FRONTIER_GRAPH_ENABLED: vscode.workspace.getConfiguration('frontier', vscode.Uri.file(root))
        .get<boolean>('repositoryContext.enabled', true) ? '1' : '0',
    };
  }

  async withMutation<T>(root: string, action: () => Promise<T>): Promise<T> {
    this.assertAvailable(root);
    const binding = this.inspect(root);
    if (binding?.mode !== 'private') { return action(); }
    const directory = path.join(binding.stateRoot, 'editor-leases');
    assertStatePath(directory);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const lease = path.join(directory, `${randomUUID()}.json`);
    fs.writeFileSync(lease, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    try {
      const current = this.inspect(root);
      const marker = activeTransitionMarker(binding.stateRoot);
      if (current?.mode !== 'private' || current.identity !== binding.identity || marker) {
        throw new Error(`Frontier storage mode is changing${marker ? ` (${marker})` : ''}. Retry after it finishes; `
          + 'if no transition is running, run "frontier workspace-state recover".');
      }
      this.assertAvailable(root);
      return await action();
    } finally { releaseLease(lease); }
  }

  readInteraction<T extends object>(root: string, kind: 'clarification' | 'setup'): T | undefined {
    this.inspect(root);
    const filename = this.interactionPath(root, kind);
    if (!fs.existsSync(filename)) { return undefined; }
    if (fs.statSync(filename).size > 262144) { throw new Error('Frontier pending input is oversized.'); }
    const record: unknown = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!record || typeof record !== 'object' || !('schemaVersion' in record)
      || record.schemaVersion !== 1 || !('identity' in record)
      || record.identity !== this.identity(root) || !('state' in record)
      || !record.state || typeof record.state !== 'object' || Array.isArray(record.state)
      || !('workspaceRoot' in record.state) || typeof record.state.workspaceRoot !== 'string'
      || this.identity(record.state.workspaceRoot) !== this.identity(root)) {
      throw new Error('Frontier pending input does not match this workspace profile.');
    }
    return record.state as T;
  }

  async writeInteraction<T>(root: string, kind: 'clarification' | 'setup', state?: T): Promise<void> {
    await this.withMutation(root, async () => {
      const filename = this.interactionPath(root, kind);
      if (state === undefined) {
        if (fs.existsSync(filename)) { fs.unlinkSync(filename); }
        return;
      }
      fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
      const temporary = `${filename}.${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, identity: this.identity(root), state }),
          { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, filename);
      } finally { if (fs.existsSync(temporary)) { fs.unlinkSync(temporary); } }
    });
  }

  private interactionPath(root: string, kind: 'clarification' | 'setup'): string {
    const binding = this.inspect(root);
    const directory = binding?.mode === 'private' ? binding.stateRoot : resolveRepositoryStatePath(root);
    const filename = path.join(directory, 'state', `pending-${kind}.json`);
    assertStatePath(filename);
    return filename;
  }
}
