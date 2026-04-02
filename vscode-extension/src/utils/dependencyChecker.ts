import {
  checkClaudeCodeCli,
  checkAzureCli,
  checkGit,
  checkGitHubCli,
  checkPowerShell,
} from './dependencyCheckerInternals';
import type {
  EnvironmentReport,
  IntegrationProvider,
} from './dependencyCheckerTypes';

export type {
  DependencyResult,
  DependencySeverity,
  EnvironmentReport,
  IntegrationProvider,
} from './dependencyCheckerTypes';

/**
 * Run all dependency checks and return a full environment report.
 *
 * @param integrations - Provider with githubConnected / adoConnected flags.
 *   When omitted, defaults to no integrations (local-only behavior).
 */
export async function checkAllDependencies(
  integrations?: IntegrationProvider,
): Promise<EnvironmentReport> {
  const github = integrations?.githubConnected ?? false;
  const ado = integrations?.adoConnected ?? false;
  const llmProvider = (integrations?.llmProvider ?? '').trim().toLowerCase();
  // Run independent checks in parallel
  // NOTE: GitHub Copilot is bundled into VS Code 1.96+. No runtime
  // check is needed. The extension.ts activation guard
  // (vscode.chat?.createChatParticipant) provides graceful
  // degradation on older VS Code versions.
  const checks = await Promise.all([
    checkPowerShell(),
    checkGit(),
    checkGitHubCli(),
    checkAzureCli(),
    checkClaudeCodeCli(),
  ]);

  // Adjust severity based on active integrations
  const results = checks.map(r => {
    // GitHub CLI is required when GitHub integration is configured
    if (r.name === 'GitHub CLI (gh)') {
      r.severity = github ? 'required' : 'optional';
    }
    if (r.name === 'Azure CLI (az)') {
      r.severity = ado ? 'required' : 'optional';
    }
    if (r.name === 'Claude Code CLI') {
      r.severity = llmProvider === 'claude-code' ? 'required' : 'optional';
    }
    // PowerShell is recommended (not required) in local mode.
    // It is only required when GitHub or ADO integrations are active, because
    // those workflows rely on .ps1 CLI scripts. In local mode the workspace can
    // be initialised and used via Node.js alone; PowerShell can be added later.
    if (r.name === 'PowerShell' && !github && !ado) {
      r.severity = 'recommended';
    }
    return r;
  });

  const criticalCount = results.filter(r => r.severity === 'required' && !r.found).length;
  const warningCount = results.filter(r => r.severity === 'recommended' && !r.found).length;

  return {
    results,
    healthy: criticalCount === 0,
    criticalCount,
    warningCount,
    timestamp: new Date().toISOString(),
  };
}
