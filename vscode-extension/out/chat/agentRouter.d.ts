import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
/**
 * Route rule: maps keyword patterns to agent files.
 * Order matters -- first match wins.
 */
export interface RouteRule {
    agentFile: string;
    keywords: RegExp;
    description: string;
}
/**
 * Classify a natural language prompt and route to the appropriate agent.
 */
export declare function routeNaturalLanguage(request: vscode.ChatRequest, _chatContext: vscode.ChatContext, response: vscode.ChatResponseStream, _token: vscode.CancellationToken, agentx: AgentXContext): Promise<vscode.ChatResult>;
export declare function classifyPrompt(prompt: string): RouteRule;
//# sourceMappingURL=agentRouter.d.ts.map