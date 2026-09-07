import * as vscode from 'vscode';
import * as path from 'path';
import {
 createTemplateTreeItem,
 parseTemplate,
 resolveTemplateFiles,
 TemplateDef,
 TemplateContext,
 TemplateTreeItem,
} from './templateTreeProviderInternals';

/**
 * Tree data provider for the Templates sidebar view.
 * Shows available markdown templates from workspace overrides, hidden runtime defaults,
 * or extension-bundled defaults.
 */
export class TemplateTreeProvider implements vscode.TreeDataProvider<TemplateTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<TemplateTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: TemplateContext) {}

 refresh(): void {
  this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: TemplateTreeItem): vscode.TreeItem {
  return element;
 }

 async getChildren(element?: TemplateTreeItem): Promise<TemplateTreeItem[]> {
  if (element) {
   return element.children || [];
  }

   if (!this.agentx.workspaceRoot) {
    return [];
   }

   const templateFiles = resolveTemplateFiles(this.agentx);
   if (templateFiles.length === 0) {
   return [TemplateTreeItem.info('No templates found')];
  }

   return templateFiles.map((filePath) => this.createTemplateItem(filePath, path.basename(filePath)));
 }

 /**
  * Build a tree item for a template file.
  */
 private createTemplateItem(filePath: string, fileName: string): TemplateTreeItem {
    return createTemplateTreeItem(filePath, fileName);
 }

 /**
  * Parse frontmatter inputs from a template markdown file.
  * Handles the YAML `inputs:` block with nested keys.
  */
 static parseTemplate(filePath: string, fileName: string): TemplateDef {
  return parseTemplate(filePath, fileName);
 }
}

export { TemplateTreeItem };
