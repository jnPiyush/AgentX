import { EnvironmentReport } from '../utils/dependencyChecker';
/**
 * Result of the critical pre-check.
 * `passed` is true only when all required dependencies are present.
 */
export interface PreCheckResult {
    passed: boolean;
    report: EnvironmentReport;
}
/**
 * Run the full environment check and present an interactive report.
 * Called by the `agentx.checkEnvironment` command and on first activation.
 */
export declare function runSetupWizard(mode: string): Promise<void>;
/**
 * Lightweight startup check - runs silently after activation and only
 * surfaces a notification when critical problems are detected.
 * When missing required dependencies are found it offers to auto-install them.
 */
export declare function runStartupCheck(mode: string): Promise<void>;
/**
 * Check every required dependency and, if any are missing, prompt the user
 * to install them automatically. VS Code extensions are installed via the
 * Extensions API; external CLI tools are installed via a terminal.
 *
 * @param mode  - The AgentX operating mode ('local' or 'github').
 * @param blocking - When true (default), shows a modal dialog that demands
 *   action before the user can continue. When false, uses a
 *   non-modal warning (suitable for background startup checks).
 * @returns PreCheckResult - `passed` is true when all required deps
 *   are satisfied (either already present or successfully installed).
 */
export declare function runCriticalPreCheck(mode: string, blocking?: boolean): Promise<PreCheckResult>;
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