import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
/**
 * Provides contextual follow-up suggestions after each chat response.
 */
export declare class AgentXFollowupProvider implements vscode.ChatFollowupProvider {
    private readonly _agentx;
    constructor(_agentx: AgentXContext);
    provideFollowups(result: vscode.ChatResult, _context: vscode.ChatContext, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.ChatFollowup[]>;
}
//# sourceMappingURL=followupProvider.d.ts.map