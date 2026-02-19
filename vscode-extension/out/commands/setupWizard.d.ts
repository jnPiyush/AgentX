/**
 * Run the full environment check and present an interactive report.
 * Called by the `agentx.checkEnvironment` command and on first activation.
 */
export declare function runSetupWizard(mode: string): Promise<void>;
/**
 * Lightweight startup check - runs silently after activation and only
 * surfaces a notification when critical problems are detected.
 */
export declare function runStartupCheck(mode: string): Promise<void>;
/**
 * Verify that key Copilot Chat settings are configured for AgentX.
 * Returns a list of suggested setting changes.
 */
export declare function checkCopilotChatConfig(): Promise<string[]>;
/**
 * Apply suggested Copilot Chat configuration fixes.
 */
export declare function applyCopilotConfigFixes(suggestions: string[]): Promise<void>;
//# sourceMappingURL=setupWizard.d.ts.map