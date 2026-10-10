import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FrontierContext } from '../frontierContext';

export function registerFrontierMcp(
  context: vscode.ExtensionContext, frontier: FrontierContext,
): void {
  if (typeof vscode.lm?.registerMcpServerDefinitionProvider !== 'function') {
    console.warn('Frontier dynamic MCP is unavailable in this host; native Frontier chat remains available.');
    return;
  }
  const changed = new vscode.EventEmitter<void>();
  const workspaces = new Map<string, vscode.WorkspaceFolder>();
  const bundle = path.join(context.extensionPath, '.github', 'frontier');
  const server = path.join(bundle, '.frontier', 'runtime', 'mcp-server', 'index.js');
  const provider: vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition> = {
    onDidChangeMcpServerDefinitions: changed.event,
    provideMcpServerDefinitions() {
      workspaces.clear();
      if (!vscode.workspace.isTrusted) { return []; }
      const definitions: vscode.McpStdioServerDefinition[] = [];
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        if (!['file', 'vscode-remote'].includes(folder.uri.scheme)) { continue; }
        try {
          const root = frontier.workspaceState.assertAvailable(folder.uri.fsPath);
          const identity = frontier.workspaceState.identity(root);
          const label = `Frontier - ${folder.name} (${identity.slice(0, 12)})`;
          let mode = 'unavailable';
          try { mode = frontier.workspaceState.inspect(root)?.mode ?? 'automatic'; }
          catch (error) { console.error(`Frontier MCP state unavailable for ${folder.name}:`, error); }
          workspaces.set(label, folder);
          const graphEnabled = vscode.workspace.getConfiguration('frontier', folder.uri)
            .get<boolean>('repositoryContext.enabled', true);
          const definition = new vscode.McpStdioServerDefinition(label, 'node', [server],
            {}, `${context.extension.packageJSON.version}:${identity}:${mode}:graph=${graphEnabled}`);
          definition.cwd = folder.uri;
          definitions.push(definition);
        } catch (error) {
          console.error(`Frontier MCP discovery failed for ${folder.name}:`, error);
        }
      }
      return definitions;
    },
    async resolveMcpServerDefinition(definition, token) {
      if (token.isCancellationRequested) { return undefined; }
      const folder = workspaces.get(definition.label);
      if (!folder) { throw new Error('This Frontier MCP definition is stale. Refresh its workspace definitions.'); }
      if (!fs.existsSync(server)) { throw new Error('The bundled Frontier MCP server is missing. Reinstall Frontier.'); }
      const root = await frontier.ensureWorkspaceReady(folder.uri.fsPath);
      if (token.isCancellationRequested) { return undefined; }
      const environment = await frontier.getRuntimeEnvironment(root);
      if (token.isCancellationRequested) { return undefined; }
      frontier.workspaceState.assertAvailable(root);
      const env = Object.fromEntries(Object.entries(environment).map(([key, value]) => [key, value ?? null]));
      const resolved = new vscode.McpStdioServerDefinition(definition.label, 'node', [server], {
        ...env, FRONTIER_REPO_ROOT: bundle,
      }, definition.version);
      resolved.cwd = folder.uri;
      return resolved;
    },
  };
  context.subscriptions.push(changed,
    vscode.lm.registerMcpServerDefinitionProvider('frontier.workspace', provider),
    vscode.workspace.onDidChangeWorkspaceFolders(() => changed.fire()),
    vscode.workspace.onDidGrantWorkspaceTrust(() => changed.fire()),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('frontier')) { changed.fire(); }
    }));
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(context.globalStorageUri, 'workspaces/*/workspace-binding.json'));
  context.subscriptions.push(watcher,
    watcher.onDidCreate(() => changed.fire()),
    watcher.onDidChange(() => changed.fire()),
    watcher.onDidDelete(() => changed.fire()));
}
