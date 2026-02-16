import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
/**
 * Tree data provider for the Ready Queue sidebar view.
 * Shows priority-sorted unblocked work items.
 */
export declare class ReadyQueueTreeProvider implements vscode.TreeDataProvider<ReadyItem> {
    private agentx;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | ReadyItem | undefined>;
    private items;
    constructor(agentx: AgentXContext);
    refresh(): void;
    getTreeItem(element: ReadyItem): vscode.TreeItem;
    getChildren(): Promise<ReadyItem[]>;
}
declare class ReadyItem extends vscode.TreeItem {
    readonly issueNumber: string;
    constructor(label: string, issueNumber: string, type: 'ready' | 'info');
}
export {};
//# sourceMappingURL=readyQueueTreeProvider.d.ts.map