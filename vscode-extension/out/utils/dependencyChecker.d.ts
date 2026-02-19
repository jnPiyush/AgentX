/**
 * Severity level for dependency check results.
 */
export type DependencySeverity = 'required' | 'recommended' | 'optional';
/**
 * Result of a single dependency check.
 */
export interface DependencyResult {
    name: string;
    found: boolean;
    version: string;
    severity: DependencySeverity;
    message: string;
    fixCommand?: string;
    fixUrl?: string;
    fixLabel?: string;
}
/**
 * Full environment check report.
 */
export interface EnvironmentReport {
    results: DependencyResult[];
    healthy: boolean;
    criticalCount: number;
    warningCount: number;
    timestamp: string;
}
/**
 * Run all dependency checks and return a full environment report.
 *
 * @param mode - The AgentX operating mode ('local' or 'github').
 */
export declare function checkAllDependencies(mode?: string): Promise<EnvironmentReport>;
//# sourceMappingURL=dependencyChecker.d.ts.map