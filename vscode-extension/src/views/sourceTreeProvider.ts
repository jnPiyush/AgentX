import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

/**
 * Icon mapping for well-known source folder names.
 */
const SRC_ICONS: Record<string, string> = {
 commands: 'terminal',
 utils: 'tools',
 views: 'preview',
 chat: 'comment-discussion',
 agentic: 'hubot',
 memory: 'database',
 test: 'beaker',
 tests: 'beaker',
 mocks: 'mirror',
 hooks: 'plug',
 components: 'symbol-class',
 models: 'symbol-interface',
 services: 'server',
 middleware: 'layers',
 config: 'gear',
 resources: 'file-media',
};

/**
 * Tree data provider for the Source sidebar view.
 * Shows files and folders under the workspace `vscode-extension/src/` or `src/` directory.
 * Clicking a file opens it in the editor.
 */
export class SourceTreeProvider implements vscode.TreeDataProvider<SourceTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<SourceTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
  this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: SourceTreeItem): vscode.TreeItem {
  return element;
 }

 async getChildren(element?: SourceTreeItem): Promise<SourceTreeItem[]> {
  const root = this.agentx.workspaceRoot;
  if (!root) { return []; }

  if (element) {
   return SourceTreeProvider.buildChildren(element.resourcePath);
  }

  // Try common source directory locations in priority order
  const srcDir = SourceTreeProvider.findSrcDir(root);
  if (!srcDir) {
   return [SourceTreeItem.info('No src/ folder found')];
  }

  return SourceTreeProvider.buildChildren(srcDir);
 }

 /**
  * Locate the source directory. Checks `vscode-extension/src/` first,
  * then falls back to `src/`.
  */
 static findSrcDir(root: string): string | undefined {
  const candidates = [
   path.join(root, 'vscode-extension', 'src'),
   path.join(root, 'src'),
  ];
  for (const candidate of candidates) {
   if (fs.existsSync(candidate)) { return candidate; }
  }
  return undefined;
 }

 /**
  * Read a directory and return sorted tree items (folders first, then files).
  */
 static buildChildren(dir: string): SourceTreeItem[] {
  let entries: fs.Dirent[];
  try {
   entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
   return [];
  }

  const folders: SourceTreeItem[] = [];
  const files: SourceTreeItem[] = [];

  for (const entry of entries) {
   // Skip hidden files/folders
   if (entry.name.startsWith('.')) { continue; }

   const fullPath = path.join(dir, entry.name);

   if (entry.isDirectory()) {
    const item = new SourceTreeItem(
     entry.name,
     vscode.TreeItemCollapsibleState.Collapsed,
     fullPath,
     true,
    );
    const iconId = SRC_ICONS[entry.name.toLowerCase()] || 'folder';
    item.iconPath = new vscode.ThemeIcon(iconId);
    item.tooltip = fullPath;
    item.contextValue = 'srcFolder';
    folders.push(item);
   } else {
    const item = new SourceTreeItem(
     entry.name,
     vscode.TreeItemCollapsibleState.None,
     fullPath,
     false,
    );
    item.iconPath = SourceTreeProvider.fileIcon(entry.name);
    item.tooltip = fullPath;
    item.contextValue = 'srcFile';
    item.command = {
     command: 'vscode.open',
     title: 'Open Source File',
     arguments: [vscode.Uri.file(fullPath)],
    };
    files.push(item);
   }
  }

  // Folders first, then files -- both alphabetically
  folders.sort((a, b) => a.label.toString().localeCompare(b.label.toString()));
  files.sort((a, b) => a.label.toString().localeCompare(b.label.toString()));

  return [...folders, ...files];
 }

 /**
  * Return an appropriate icon for a file based on its extension.
  */
 static fileIcon(name: string): vscode.ThemeIcon {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
   case '.ts': return new vscode.ThemeIcon('symbol-method');
   case '.tsx': return new vscode.ThemeIcon('symbol-class');
   case '.js': return new vscode.ThemeIcon('symbol-method');
   case '.jsx': return new vscode.ThemeIcon('symbol-class');
   case '.json': return new vscode.ThemeIcon('json');
   case '.md': return new vscode.ThemeIcon('markdown');
   case '.css':
   case '.scss':
   case '.less': return new vscode.ThemeIcon('symbol-color');
   case '.html': return new vscode.ThemeIcon('file-code');
   case '.svg':
   case '.png':
   case '.jpg': return new vscode.ThemeIcon('file-media');
   case '.py': return new vscode.ThemeIcon('symbol-method');
   case '.cs': return new vscode.ThemeIcon('symbol-method');
   default: return new vscode.ThemeIcon('file');
  }
 }
}

export class SourceTreeItem extends vscode.TreeItem {
 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  public readonly resourcePath: string,
  public readonly isFolder: boolean,
 ) {
  super(label, collapsibleState);
 }

 static info(text: string): SourceTreeItem {
  const item = new SourceTreeItem(text, vscode.TreeItemCollapsibleState.None, '', false);
  item.iconPath = new vscode.ThemeIcon('info');
  item.contextValue = 'infoItem';
  return item;
 }
}
