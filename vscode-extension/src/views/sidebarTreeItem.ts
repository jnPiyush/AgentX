import * as vscode from 'vscode';

export class SidebarTreeItem extends vscode.TreeItem {
 children?: SidebarTreeItem[];

 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState,
 ) {
  super(label, collapsibleState);
 }

 static info(label: string, description?: string): SidebarTreeItem {
  const item = new SidebarTreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('info');
  item.description = description;
  item.contextValue = 'sidebarInfo';
  return item;
 }

 static detail(
  label: string,
  iconId: string,
  description?: string,
  tooltip?: string,
 ): SidebarTreeItem {
  const item = new SidebarTreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(iconId);
  item.description = description;
  item.tooltip = tooltip ?? label;
  item.contextValue = 'sidebarDetail';
  return item;
 }

 static action(
  label: string,
  iconId: string,
  command: string,
  title: string,
  args: unknown[] = [],
  description?: string,
 ): SidebarTreeItem {
  const item = SidebarTreeItem.detail(label, iconId, description);
  item.command = { command, title, arguments: args };
  item.contextValue = 'sidebarAction';
  return item;
 }

 static section(
  label: string,
  iconId: string,
  children: SidebarTreeItem[],
  description?: string,
 ): SidebarTreeItem {
  const item = new SidebarTreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
  item.iconPath = new vscode.ThemeIcon(iconId);
  item.children = children;
  item.description = description;
  item.contextValue = 'sidebarSection';
  return item;
 }
}