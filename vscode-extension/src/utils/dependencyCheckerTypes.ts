export interface IntegrationProvider {
  githubConnected: boolean;
  adoConnected: boolean;
  llmProvider?: string;
}

export type DependencySeverity = 'required' | 'recommended' | 'optional';

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

export interface EnvironmentReport {
  results: DependencyResult[];
  healthy: boolean;
  criticalCount: number;
  warningCount: number;
  timestamp: string;
}
