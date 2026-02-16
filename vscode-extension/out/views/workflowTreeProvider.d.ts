import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
/**
 * Tree data provider for the Workflows sidebar view.
 * Shows available TOML workflow templates.
 */
export declare class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowItem> {
    private agentx;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | WorkflowItem | undefined>;
    constructor(agentx: AgentXContext);
    refresh(): void;
    getTreeItem(element: WorkflowItem): vscode.TreeItem;
    getChildren(): Promise<WorkflowItem[]>;
}
declare class WorkflowItem extends vscode.TreeItem {
    constructor(label: string, filePath: string, type: 'workflow' | 'info', iconId?: string);
}
export {};
//# sourceMappingURL=workflowTreeProvider.d.ts.map