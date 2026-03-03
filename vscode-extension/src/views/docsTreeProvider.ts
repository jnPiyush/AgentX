import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

/**
 * Icon mapping for well-known doc folder/file types.
 */
const DOC_ICONS: Record<string, string> = {
 prd: 'file-text',
 adr: 'law',
 specs: 'symbol-file',
 ux: 'color-mode',
 reviews: 'checklist',
 architecture: 'symbol-structure',
 deployment: 'rocket',
 testing: 'beaker',
 coaching: 'mortar-board',
 presentations: 'graph',
 assets: 'file-media',
 'data-science': 'database',
};

/**
 * Tree data provider for the Documents sidebar view.
 * Shows files and folders under the workspace `docs/` directory.
 * Clicking a file opens it in the editor (like templates).
 */
export class DocsTreeProvider implements vscode.TreeDataProvider<DocsTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<DocsTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
  this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: DocsTreeItem): vscode.TreeItem {
  return element;
 }

 async getChildren(element?: DocsTreeItem): Promise<DocsTreeItem[]> {
  const root = this.agentx.workspaceRoot;
  if (!root) { return []; }

  const dir = element ? element.resourcePath : path.join(root, 'docs');

  if (!fs.existsSync(dir)) {
   return element ? [] : [DocsTreeItem.info('No docs/ folder found')];
  }

  return DocsTreeProvider.buildChildren(dir);
 }

 /**
  * Read a directory and return sorted tree items (folders first, then files).
  */
 static buildChildren(dir: string): DocsTreeItem[] {
  let entries: fs.Dirent[];
  try {
   entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
   return [];
  }

  const folders: DocsTreeItem[] = [];
  const files: DocsTreeItem[] = [];

  for (const entry of entries) {
   // Skip hidden files/folders
   if (entry.name.startsWith('.')) { continue; }

   const fullPath = path.join(dir, entry.name);

   if (entry.isDirectory()) {
    const item = new DocsTreeItem(
     entry.name,
     vscode.TreeItemCollapsibleState.Collapsed,
     fullPath,
     true,
    );
    const iconId = DOC_ICONS[entry.name.toLowerCase()] || 'folder';
    item.iconPath = new vscode.ThemeIcon(iconId);
    item.tooltip = fullPath;
    item.contextValue = 'docFolder';
    folders.push(item);
   } else {
    const item = new DocsTreeItem(
     entry.name,
     vscode.TreeItemCollapsibleState.None,
     fullPath,
     false,
    );
    item.iconPath = DocsTreeProvider.fileIcon(entry.name);
    item.tooltip = fullPath;
    item.contextValue = 'docFile';
    item.command = {
     command: 'vscode.open',
     title: 'Open Document',
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
   case '.md': return new vscode.ThemeIcon('markdown');
   case '.json': return new vscode.ThemeIcon('json');
   case '.html': return new vscode.ThemeIcon('file-code');
   case '.css': return new vscode.ThemeIcon('symbol-color');
   case '.png':
   case '.jpg':
   case '.jpeg':
   case '.gif':
   case '.svg': return new vscode.ThemeIcon('file-media');
   case '.pdf': return new vscode.ThemeIcon('file-pdf');
   default: return new vscode.ThemeIcon('file');
  }
 }
}

export class DocsTreeItem extends vscode.TreeItem {
 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  public readonly resourcePath: string,
  public readonly isFolder: boolean,
 ) {
  super(label, collapsibleState);
 }

 static info(text: string): DocsTreeItem {
  const item = new DocsTreeItem(text, vscode.TreeItemCollapsibleState.None, '', false);
  item.iconPath = new vscode.ThemeIcon('info');
  item.contextValue = 'infoItem';
  return item;
 }
}
