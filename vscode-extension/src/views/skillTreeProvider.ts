import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  collectSkillEntries,
  groupSkillsByCategory,
  SkillTreeItem,
} from './skillTreeProviderInternals';

/**
 * Tree data provider for the Skills sidebar view.
 * Shows all available skills grouped by category.
 */
export class SkillTreeProvider implements vscode.TreeDataProvider<SkillTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SkillTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly agentx: AgentXContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SkillTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SkillTreeItem): Promise<SkillTreeItem[]> {
    if (element) {
      return element.children ?? [];
    }

    const entries = collectSkillEntries(
      this.agentx.workspaceRoot,
      this.agentx.extensionContext.extensionPath,
    );
    if (entries.length === 0) {
      return [SkillTreeItem.info('No skills found')];
    }

    return groupSkillsByCategory(entries);
  }
}

export { SkillTreeItem };
