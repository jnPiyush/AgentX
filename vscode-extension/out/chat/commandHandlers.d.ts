import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
/**
 * Metadata attached to every ChatResult for followup logic.
 */
export interface AgentXChatMetadata {
    command?: string;
    agentName?: string;
    issueNumber?: string;
    workflowType?: string;
    initialized: boolean;
}
/**
 * Dispatch a slash command to the appropriate handler.
 */
export declare function handleSlashCommand(request: vscode.ChatRequest, _context: vscode.ChatContext, response: vscode.ChatResponseStream, _token: vscode.CancellationToken, agentx: AgentXContext): Promise<vscode.ChatResult>;
//# sourceMappingURL=commandHandlers.d.ts.map