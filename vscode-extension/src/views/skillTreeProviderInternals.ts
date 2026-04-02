import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface SkillEntry {
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly filePath: string;
  readonly relativePath: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'architecture': 'Architecture',
  'development': 'Development',
  'languages': 'Languages',
  'operations': 'Operations',
  'infrastructure': 'Infrastructure',
  'data': 'Data',
  'ai-systems': 'AI Systems',
  'design': 'Design',
  'testing': 'Testing',
  'domain': 'Domain',
};

const CATEGORY_ICONS: Record<string, string> = {
  'architecture': 'symbol-structure',
  'development': 'code',
  'languages': 'symbol-class',
  'operations': 'server-process',
  'infrastructure': 'cloud',
  'data': 'database',
  'ai-systems': 'hubot',
  'design': 'paintcan',
  'testing': 'beaker',
  'domain': 'globe',
};

export class SkillTreeItem extends vscode.TreeItem {
  children?: SkillTreeItem[];

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }

  static info(label: string, description?: string): SkillTreeItem {
    const item = new SkillTreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    item.description = description;
    item.contextValue = 'skillInfo';
    return item;
  }

  static skill(entry: SkillEntry): SkillTreeItem {
    const item = new SkillTreeItem(entry.name, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('book');
    item.description = entry.description.length > 60
      ? entry.description.substring(0, 57) + '...'
      : entry.description;
    item.tooltip = entry.description;
    item.contextValue = 'skill';
    item.command = {
      command: 'vscode.open',
      title: 'Open Skill',
      arguments: [vscode.Uri.file(entry.filePath)],
    };
    return item;
  }

  static category(
    label: string,
    iconId: string,
    children: SkillTreeItem[],
    count: number,
  ): SkillTreeItem {
    const item = new SkillTreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon(iconId);
    item.children = children;
    item.description = `${count}`;
    item.contextValue = 'skillCategory';
    return item;
  }
}

function parseSkillDescription(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const descMatch = fmMatch[1].match(/description:\s*['"]?(.+?)['"]?\s*$/m);
      if (descMatch) {
        return descMatch[1].trim();
      }
    }
    return '';
  } catch {
    return '';
  }
}

function toTitleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function collectSkillEntries(
  workspaceRoot: string | undefined,
  extensionPath: string,
): SkillEntry[] {
  const entries: SkillEntry[] = [];
  const seen = new Set<string>();

  const searchDirs: Array<{ base: string; prefix: string }> = [];
  if (workspaceRoot) {
    searchDirs.push({ base: path.join(workspaceRoot, '.github', 'skills'), prefix: '.github/skills' });
  }
  searchDirs.push({ base: path.join(extensionPath, '.github', 'agentx', 'skills'), prefix: '.github/skills' });

  for (const { base, prefix } of searchDirs) {
    if (!fs.existsSync(base)) { continue; }

    let categories: string[];
    try {
      categories = fs.readdirSync(base).filter((d) => {
        try { return fs.statSync(path.join(base, d)).isDirectory(); } catch { return false; }
      });
    } catch { continue; }

    for (const category of categories) {
      const categoryDir = path.join(base, category);
      let skillDirs: string[];
      try {
        skillDirs = fs.readdirSync(categoryDir).filter((d) => {
          try { return fs.statSync(path.join(categoryDir, d)).isDirectory(); } catch { return false; }
        });
      } catch { continue; }

      for (const skillName of skillDirs) {
        const skillFile = path.join(categoryDir, skillName, 'SKILL.md');
        const key = `${category}/${skillName}`;
        if (seen.has(key) || !fs.existsSync(skillFile)) { continue; }
        seen.add(key);

        entries.push({
          name: toTitleCase(skillName),
          category,
          description: parseSkillDescription(skillFile),
          filePath: skillFile,
          relativePath: `${prefix}/${category}/${skillName}/SKILL.md`,
        });
      }
    }
  }

  return entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export function groupSkillsByCategory(entries: SkillEntry[]): SkillTreeItem[] {
  const grouped = new Map<string, SkillEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }

  const items: SkillTreeItem[] = [];
  const sortedCategories = [...grouped.keys()].sort();
  for (const category of sortedCategories) {
    const categoryEntries = grouped.get(category) ?? [];
    const label = CATEGORY_LABELS[category] ?? toTitleCase(category);
    const iconId = CATEGORY_ICONS[category] ?? 'folder';
    const children = categoryEntries.map((e) => SkillTreeItem.skill(e));
    items.push(SkillTreeItem.category(label, iconId, children, children.length));
  }

  return items;
}

export function createSkillTreeItem(entry: SkillEntry): SkillTreeItem {
  return SkillTreeItem.skill(entry);
}
