import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { collectAssetFiles } from '../utils/runtimeAssets';
import { loadTemplatesRegistry, resolveRegistryAssetPath } from '../utils/registryLoader';

interface TemplateInput {
 name: string;
 description: string;
 required: boolean;
 defaultValue: string;
}

export interface TemplateDef {
 name: string;
 filePath: string;
 inputs: TemplateInput[];
 error?: string;
}

export interface TemplateContext {
 readonly workspaceRoot?: string;
 readonly extensionContext?: { readonly extensionPath: string };
}

const TEMPLATE_ICONS: Record<string, string> = {
 PRD: 'file-text',
 ADR: 'law',
 SPEC: 'symbol-file',
 UX: 'color-mode',
 REVIEW: 'checklist',
 'SECURITY-PLAN': 'shield',
 PROGRESS: 'graph',
};

export class TemplateTreeItem extends vscode.TreeItem {
 children?: TemplateTreeItem[];

 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState,
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

export function resolveTemplateFiles(agentx: TemplateContext): string[] {
 const workspaceRoot = agentx.workspaceRoot;
 const extensionPath = agentx.extensionContext?.extensionPath;

 const registry = loadTemplatesRegistry(workspaceRoot, extensionPath);
 if (registry && registry.templates.length > 0) {
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const tmpl of registry.templates) {
   if (!tmpl?.path) { continue; }
   const absolute = resolveRegistryAssetPath(workspaceRoot, extensionPath, tmpl.path);
   if (!absolute || seen.has(absolute)) { continue; }
   seen.add(absolute);
   resolved.push(absolute);
  }
  if (resolved.length > 0) {
   return resolved.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  }
 }

 return collectAssetFiles(
  workspaceRoot,
  extensionPath,
  '.github/templates',
  (entry) => entry.endsWith('.md'),
 );
}

export function createTemplateTreeItem(filePath: string, fileName: string): TemplateTreeItem {
 const template = parseTemplate(filePath, fileName);
 const name = template.name;
 const item = new TemplateTreeItem(name, vscode.TreeItemCollapsibleState.None);

 item.iconPath = new vscode.ThemeIcon(TEMPLATE_ICONS[name] || 'file');
 item.command = {
  command: 'vscode.open',
  title: 'Open Template',
  arguments: [vscode.Uri.file(filePath)],
 };
 item.tooltip = `Open ${name} template`;
 item.contextValue = 'templateItem';
 item.description = `${template.inputs.length} input${template.inputs.length === 1 ? '' : 's'}`;
 if (template.error) {
  item.iconPath = new vscode.ThemeIcon('warning');
  item.description = 'Invalid metadata';
  item.tooltip = `${name}: ${template.error}`;
 }

 return item;
}

class TemplateMetadataError extends Error {}

function isMapping(value: unknown): value is Record<string, unknown> {
 return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInputName(name: string): void {
 if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name)) {
  throw new TemplateMetadataError(`Invalid input name: ${name}`);
 }
}

function readTemplateInputs(content: string): TemplateInput[] {
 const normalized = content.replace(/^\uFEFF/, '');
 const lines = normalized.split(/\r?\n/);
 const inputs: TemplateInput[] = [];
 let body = normalized;
 if (lines[0].trim() === '---') {
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) { throw new TemplateMetadataError('Unterminated frontmatter'); }
  const yaml = lines.slice(1, end).join('\n');
  let metadata: unknown = {};
  if (yaml.trim()) {
   try {
    metadata = parseYaml(yaml, { prettyErrors: false, strict: true, uniqueKeys: true });
   } catch (error) {
    // YAML alias resolution and expansion limits throw ReferenceError, not YAMLParseError.
    if (error instanceof ReferenceError) { throw new TemplateMetadataError(error.message); }
    throw error;
   }
  }
  if (!isMapping(metadata)) { throw new TemplateMetadataError('Frontmatter must be a mapping'); }
  if ('inputs' in metadata) {
  if (!isMapping(metadata.inputs)) {
   throw new TemplateMetadataError('Inputs must be a mapping');
  }
  for (const [name, definition] of Object.entries(metadata.inputs)) {
   validateInputName(name);
   if (!isMapping(definition)) {
    throw new TemplateMetadataError(`Input '${name}' must be a mapping`);
   }
   if (definition.description !== undefined && typeof definition.description !== 'string') {
    throw new TemplateMetadataError(`Input '${name}' description must be a string`);
   }
   if (definition.required !== undefined && typeof definition.required !== 'boolean') {
    throw new TemplateMetadataError(`Input '${name}' required must be a boolean`);
   }
   const value = definition.default;
   if (value !== undefined && value !== null
     && typeof value !== 'string' && typeof value !== 'boolean'
     && !(typeof value === 'number' && Number.isFinite(value))) {
    throw new TemplateMetadataError(`Input '${name}' default must be a scalar`);
   }
   inputs.push({
    name,
    description: typeof definition.description === 'string' ? definition.description : '',
    required: definition.required === true,
    defaultValue: value === undefined || value === null ? '' : String(value),
   });
  }
  }
  body = lines.slice(end + 1).join('\n');
 }

 const header: string[] = [];
 let fence = '';
 for (const line of body.split(/\r?\n/)) {
  const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (delimiter) {
   if (!fence) { fence = delimiter[1]; }
   else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length
     && !delimiter[2].trim()) { fence = ''; }
   continue;
  }
  if (fence) { continue; }
  if (/^#\s/.test(line)) { break; }
  header.push(line);
 }
 const declaration = /<!--\s*Inputs:\s*([\s\S]*?)\s*-->/.exec(header.join('\n'));
 if (declaration) {
  for (const value of declaration[1].split(',')) {
  const name = value.replace(/[{}$]/g, '').trim();
  if (!name) { continue; }
  validateInputName(name);
  if (!inputs.some(input => input.name === name)) {
   inputs.push({ name, description: '', required: false, defaultValue: '' });
  }
  }
 }
 return inputs;
}

export function parseTemplate(filePath: string, fileName: string): TemplateDef {
 const name = fileName.replace(/-TEMPLATE\.md$/i, '').replace(/\.md$/i, '');
 try {
  return { name, filePath, inputs: readTemplateInputs(fs.readFileSync(filePath, 'utf8')) };
 } catch (error) {
  const readFailure = error instanceof Error && 'code' in error && 'syscall' in error
  && (error.syscall === 'open' || error.syscall === 'read');
  if (error instanceof TemplateMetadataError || error instanceof YAMLParseError || readFailure) {
  return { name, filePath, inputs: [], error: error.message };
  }
  throw error;
 }
}