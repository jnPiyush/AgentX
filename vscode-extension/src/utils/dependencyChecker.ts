import { exec } from 'child_process';

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
 * Execute a command and return stdout, or empty string on failure.
 */
function tryExec(command: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    exec(command, { shell, timeout: timeoutMs }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Parse a version string from command output.
 * Handles formats like "v20.11.0", "PowerShell 7.4.1", "git version 2.43.0", etc.
 */
function parseVersion(raw: string): string {
  const match = raw.match(/(\d+\.\d+[\w.-]*)/);
  return match ? match[1] : raw.trim().substring(0, 30);
}

/**
 * Check if Node.js is installed and meets minimum version.
 */
async function checkNodeJs(): Promise<DependencyResult> {
  const raw = await tryExec('node --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  let message = '';
  if (!found) {
    message = 'Node.js is not installed. Required for extension compilation and npm scripts.';
  } else {
    const major = parseInt(version.split('.')[0], 10);
    if (major < 18) {
      message = `Node.js ${version} found but v18+ is recommended.`;
    } else {
      message = `Node.js ${version} detected.`;
    }
  }

  return {
    name: 'Node.js',
    found,
    version,
    severity: 'required',
    message,
    fixUrl: 'https://nodejs.org/',
    fixLabel: 'Download Node.js',
    fixCommand: process.platform === 'win32'
      ? 'winget install OpenJS.NodeJS.LTS'
      : 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs',
  };
}

/**
 * Check if PowerShell (pwsh) is available.
 */
async function checkPowerShell(): Promise<DependencyResult> {
  // Check pwsh (cross-platform PowerShell 7+) first
  let raw = await tryExec('pwsh --version');
  let found = raw.length > 0;
  let version = found ? parseVersion(raw) : '';
  let usedFallback = false;

  // On Windows, fall back to built-in powershell.exe (v5.1)
  if (!found && process.platform === 'win32') {
    raw = await tryExec('powershell.exe -Command "$PSVersionTable.PSVersion.ToString()"');
    found = raw.length > 0;
    version = found ? parseVersion(raw) : '';
    usedFallback = found;
  }

  let message = '';
  let severity: DependencySeverity = 'required';

  if (!found) {
    message = 'PowerShell is not installed. Required for AgentX CLI scripts (.agentx/agentx.ps1).';
  } else if (usedFallback) {
    message = `Windows PowerShell ${version} found. PowerShell 7+ (pwsh) is recommended for best compatibility.`;
    severity = 'recommended';
  } else {
    message = `PowerShell ${version} detected.`;
  }

  return {
    name: 'PowerShell',
    found,
    version,
    severity: found && usedFallback ? 'recommended' : 'required',
    message,
    fixUrl: 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell',
    fixLabel: 'Install PowerShell 7',
    fixCommand: process.platform === 'win32'
      ? 'winget install Microsoft.PowerShell'
      : process.platform === 'darwin'
        ? 'brew install powershell/tap/powershell'
        : 'sudo apt-get install -y powershell',
  };
}

/**
 * Check if Git is installed.
 */
async function checkGit(): Promise<DependencyResult> {
  const raw = await tryExec('git --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  return {
    name: 'Git',
    found,
    version,
    severity: 'required',
    message: found
      ? `Git ${version} detected.`
      : 'Git is not installed. Required for version control and hooks.',
    fixUrl: 'https://git-scm.com/downloads',
    fixLabel: 'Download Git',
    fixCommand: process.platform === 'win32'
      ? 'winget install Git.Git'
      : process.platform === 'darwin'
        ? 'brew install git'
        : 'sudo apt-get install -y git',
  };
}

/**
 * Check if GitHub CLI (gh) is installed - needed for github mode.
 */
async function checkGitHubCli(): Promise<DependencyResult> {
  const raw = await tryExec('gh --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  // Check auth status if gh is available
  let authStatus = '';
  if (found) {
    authStatus = await tryExec('gh auth status 2>&1');
  }
  const authenticated = authStatus.includes('Logged in');

  let message = '';
  if (!found) {
    message = 'GitHub CLI not installed. Required for GitHub mode (issues, PRs, Projects).';
  } else if (!authenticated) {
    message = `GitHub CLI ${version} found but not authenticated. Run: gh auth login`;
  } else {
    message = `GitHub CLI ${version} detected and authenticated.`;
  }

  return {
    name: 'GitHub CLI (gh)',
    found,
    version,
    severity: 'recommended',
    message,
    fixUrl: 'https://cli.github.com/',
    fixLabel: 'Install GitHub CLI',
    fixCommand: process.platform === 'win32'
      ? 'winget install GitHub.cli'
      : process.platform === 'darwin'
        ? 'brew install gh'
        : 'sudo apt-get install -y gh',
  };
}

/**
 * Check if a VS Code extension is installed by its ID.
 */
async function checkVSCodeExtension(
  id: string,
  displayName: string,
  severity: DependencySeverity,
  reason: string
): Promise<DependencyResult> {
  // VS Code extensions can be checked by listing them via CLI
  const raw = await tryExec(`code --list-extensions 2>&1`);
  const extensions = raw.toLowerCase().split(/\r?\n/);
  const found = extensions.includes(id.toLowerCase());

  return {
    name: displayName,
    found,
    version: found ? 'installed' : '',
    severity,
    message: found
      ? `${displayName} is installed.`
      : `${displayName} is not installed. ${reason}`,
    fixCommand: `code --install-extension ${id}`,
    fixLabel: `Install ${displayName}`,
  };
}

/**
 * Run all dependency checks and return a full environment report.
 *
 * @param mode - The AgentX operating mode ('local' or 'github').
 */
export async function checkAllDependencies(mode: string = 'local'): Promise<EnvironmentReport> {
  // Run independent checks in parallel
  const checks = await Promise.all([
    checkNodeJs(),
    checkPowerShell(),
    checkGit(),
    checkGitHubCli(),
    checkVSCodeExtension(
      'github.copilot',
      'GitHub Copilot',
      'required',
      'Required for AI-powered agent interactions.'
    ),
    checkVSCodeExtension(
      'github.copilot-chat',
      'GitHub Copilot Chat',
      'required',
      'Required for @agentx chat participant and agent routing.'
    ),
  ]);

  // Adjust severity based on mode
  const results = checks.map(r => {
    // GitHub CLI is only required in github mode
    if (r.name === 'GitHub CLI (gh)') {
      r.severity = mode === 'github' ? 'required' : 'optional';
    }
    // PowerShell on non-Windows in local mode is optional (bash works too)
    if (r.name === 'PowerShell' && process.platform !== 'win32' && mode === 'local') {
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
