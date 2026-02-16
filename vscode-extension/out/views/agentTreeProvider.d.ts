import * as vscode from 'vscode';
import { AgentXContext, AgentDefinition } from '../agentxContext';
/**
 * Tree data provider for the Agents sidebar view.
 * Shows all agent definitions with their model, maturity, and status.
 */
export declare class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
    private agentx;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | AgentTreeItem | undefined>;
    constructor(agentx: AgentXContext);
    refresh(): void;
    getTreeItem(element: AgentTreeItem): vscode.TreeItem;
    getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]>;
    private createAgentItem;
}
export declare class AgentTreeItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly agent?: AgentDefinition | undefined;
    children?: AgentTreeItem[];
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, agent?: AgentDefinition | undefined);
}
//# sourceMappingURL=agentTreeProvider.d.ts.map