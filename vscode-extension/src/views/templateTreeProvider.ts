import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

/**
 * Parsed input variable from a template's YAML frontmatter.
 */
interface TemplateInput {
 name: string;
 description: string;
 required: boolean;
 defaultValue: string;
}

/**
 * Parsed template definition.
 */
interface TemplateDef {
 /** Display name derived from filename (e.g. "PRD" from PRD-TEMPLATE.md). */
 name: string;
 /** Full filesystem path. */
 filePath: string;
 /** Parsed input variables from frontmatter. */
 inputs: TemplateInput[];
}

/**
 * Icon mapping for well-known template types.
 */
const TEMPLATE_ICONS: Record<string, string> = {
 PRD: 'file-text',
 ADR: 'law',
 SPEC: 'symbol-file',
 UX: 'color-mode',
 REVIEW: 'checklist',
 'SECURITY-PLAN': 'shield',
 PROGRESS: 'graph',
};

/**
 * Tree data provider for the Templates sidebar view.
 * Shows available markdown templates from `.github/templates/`
 * with their input variables as expandable children.
 */
export class TemplateTreeProvider implements vscode.TreeDataProvider<TemplateTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<TemplateTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

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

  // Try workspace templates first, fall back to extension-bundled templates
  const root = this.agentx.workspaceRoot;
  if (!root && !this.agentx.extensionContext) { return []; }
  const workspaceDir = root ? path.join(root, '.github', 'templates') : '';
  const extPath = this.agentx.extensionContext?.extensionPath;
  const bundledDir = extPath ? path.join(extPath, '.github', 'agentx', 'templates') : '';
  const templatesDir = (workspaceDir && fs.existsSync(workspaceDir)) ? workspaceDir
   : (bundledDir && fs.existsSync(bundledDir)) ? bundledDir : '';

  if (!templatesDir) {
   return [TemplateTreeItem.info('No templates found')];
  }

  const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
   return [TemplateTreeItem.info('No templates found')];
  }

  return files.map(f => this.createTemplateItem(templatesDir, f));
 }

 /**
  * Parse a template file and build a tree item with input variable children.
  */
 private createTemplateItem(dir: string, fileName: string): TemplateTreeItem {
  const filePath = path.join(dir, fileName);
  const def = TemplateTreeProvider.parseTemplate(filePath, fileName);

  const hasChildren = def.inputs.length > 0;
  const item = new TemplateTreeItem(
   def.name,
   hasChildren
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None
  );

  // Icon
  const iconId = TEMPLATE_ICONS[def.name] || 'file';
  item.iconPath = new vscode.ThemeIcon(iconId);

  // Click opens the template file
  item.command = {
   command: 'vscode.open',
   title: 'Open Template',
   arguments: [vscode.Uri.file(filePath)],
  };

  item.tooltip = `Open ${def.name} template (${def.inputs.length} input${def.inputs.length !== 1 ? 's' : ''})`;
  item.description = `${def.inputs.length} input${def.inputs.length !== 1 ? 's' : ''}`;
  item.contextValue = 'templateItem';

  // Build children from inputs
  if (def.inputs.length > 0) {
   item.children = def.inputs.map(input => {
    const reqTag = input.required ? '(required)' : '(optional)';
    const defTag = input.defaultValue ? ` [default: ${input.defaultValue}]` : '';
    const label = `${input.name} ${reqTag}${defTag}`;

    const child = new TemplateTreeItem(label, vscode.TreeItemCollapsibleState.None);
    child.iconPath = new vscode.ThemeIcon(
     input.required ? 'star-full' : 'star-empty'
    );
    child.tooltip = input.description || input.name;
    child.contextValue = 'templateInput';
    return child;
   });
  }

  return item;
 }

 /**
  * Parse frontmatter inputs from a template markdown file.
  * Handles the YAML `inputs:` block with nested keys.
  */
 static parseTemplate(filePath: string, fileName: string): TemplateDef {
  const name = fileName.replace(/-TEMPLATE\.md$/i, '').replace(/\.md$/i, '');
  const inputs: TemplateInput[] = [];

  try {
   const content = fs.readFileSync(filePath, 'utf-8');
   const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
   if (fmMatch) {
    const fm = fmMatch[1];
    // Find the inputs: block and parse each variable
    const inputsMatch = fm.match(/^inputs:\s*\r?\n([\s\S]*)/m);
    if (inputsMatch) {
     const block = inputsMatch[1];
     // Each input starts with a line indented by 1 level (1-2 spaces) followed by a key:
     // Its properties are indented further (2-4 more spaces).
     const lines = block.split(/\r?\n/);
     let currentInput: Partial<TemplateInput> | null = null;

     for (const line of lines) {
      // Top-level input key (1 space indent, word followed by colon)
      const keyMatch = line.match(/^ (\w[\w-]*):\s*$/);
      if (keyMatch) {
       if (currentInput && currentInput.name) {
        inputs.push({
         name: currentInput.name,
         description: currentInput.description || '',
         required: currentInput.required || false,
         defaultValue: currentInput.defaultValue || '',
        });
       }
       currentInput = { name: keyMatch[1] };
       continue;
      }

      // Property of current input (deeper indent)
      if (currentInput) {
       const propMatch = line.match(/^\s{2,}(\w+):\s*(.*)$/);
       if (propMatch) {
        const [, prop, val] = propMatch;
        const cleanVal = val.replace(/^["']|["']$/g, '').trim();
        switch (prop) {
         case 'description': currentInput.description = cleanVal; break;
         case 'required': currentInput.required = cleanVal === 'true'; break;
         case 'default': currentInput.defaultValue = cleanVal; break;
        }
       }
      }
     }
     // Push last input
     if (currentInput && currentInput.name) {
      inputs.push({
       name: currentInput.name,
       description: currentInput.description || '',
       required: currentInput.required || false,
       defaultValue: currentInput.defaultValue || '',
      });
     }
    }
   }
  } catch {
   // If file can't be read, return empty inputs
  }

  return { name, filePath, inputs };
 }
}

export class TemplateTreeItem extends vscode.TreeItem {
 children?: TemplateTreeItem[];

 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState
 ) {
  super(label, collapsibleState);
 }

 static info(text: string): TemplateTreeItem {
  const item = new TemplateTreeItem(text, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('info');
  item.contextValue = 'infoItem';
  return item;
 }
}
