import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import type { DependencyResult } from './dependencyCheckerTypes';

const MIN_POWERSHELL_VERSION = '7.4.0';
const POWERSHELL_VERSION_COMMAND = '$PSVersionTable.PSVersion.ToString()';

export interface PowerShellCheckOptions {
  platform?: NodeJS.Platform;
  resolveExecutable?: () => string;
  execute?: (command: string, timeoutMs?: number) => Promise<string>;
}

export function getWindowsPowerShellCorePathCandidates(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const baseDirs = [
    env.ProgramFiles,
    env.ProgramW6432,
    'C:\\Program Files',
  ].filter((value): value is string => Boolean(value));

  return [...new Set(baseDirs)].flatMap((baseDir) => [
    path.join(baseDir, 'PowerShell', '7', 'pwsh.exe'),
    path.join(baseDir, 'PowerShell', '7-preview', 'pwsh.exe'),
  ]);
}

export function resolvePowerShellCoreExecutable(
  platform: NodeJS.Platform = process.platform,
  pathExists: (candidate: string) => boolean = fs.existsSync,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (platform !== 'win32') {
    return 'pwsh';
  }

  for (const candidate of getWindowsPowerShellCorePathCandidates(env)) {
    if (pathExists(candidate)) {
      return `"${candidate}"`;
    }
  }

  return 'pwsh';
}

export function tryExec(command: string, timeoutMs = 5_000): Promise<string> {
  return new Promise((resolve) => {
    // Use the platform default shell (cmd.exe on Windows, /bin/sh on Unix).
    // Overriding with powershell.exe causes Node.js to pass CMD-style /d /s /c flags
    // that powershell.exe does not understand, making every exec silently fail.
    exec(command, { timeout: timeoutMs }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export function buildPowerShellVersionCommand(executable: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    // On Windows, cmd.exe does NOT strip single quotes, so PowerShell would receive
    // '$PSVersionTable.PSVersion.ToString()' as a string literal, not executable code.
    // cmd.exe also does not expand $VARNAME, so no quoting is needed here.
    return `${executable} -NoProfile -Command ${POWERSHELL_VERSION_COMMAND}`;
  }
  // On Unix, single quotes prevent the shell (/bin/sh) from expanding $PSVersionTable.
  return `${executable} -NoProfile -Command '${POWERSHELL_VERSION_COMMAND}'`;
}

export function parseVersion(raw: string): string {
  const match = raw.match(/(\d+\.\d+[\w.-]*)/);
  return match ? match[1] : raw.trim().substring(0, 30);
}

export function compareSemver(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index++) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export async function checkPowerShell(options: PowerShellCheckOptions = {}): Promise<DependencyResult> {
  const platform = options.platform ?? process.platform;
  const execute = options.execute ?? tryExec;
  const pwshExecutable = options.resolveExecutable
    ? options.resolveExecutable()
    : resolvePowerShellCoreExecutable(platform);
  const rawPwsh = await execute(buildPowerShellVersionCommand(pwshExecutable, platform));
  const hasPwsh = rawPwsh.length > 0;
  const pwshVersion = hasPwsh ? parseVersion(rawPwsh) : '';
  const meetsMinimum = hasPwsh && compareSemver(pwshVersion, MIN_POWERSHELL_VERSION) >= 0;

  let legacyVersion = '';
  // Only probe legacy powershell.exe when pwsh 7+ is not already found.
  // Avoids an unnecessary exec call in the happy path.
  if (platform === 'win32' && !meetsMinimum) {
    const rawLegacy = await execute(buildPowerShellVersionCommand('powershell.exe', platform));
    legacyVersion = rawLegacy.length > 0 ? parseVersion(rawLegacy) : '';
  }

  let message = '';
  if (meetsMinimum) {
    message = `PowerShell ${pwshVersion} detected.`;
  } else if (hasPwsh) {
    message = `PowerShell ${pwshVersion} found, but AgentX requires PowerShell ${MIN_POWERSHELL_VERSION}+ (pwsh).`;
  } else if (legacyVersion) {
    message = `Windows PowerShell ${legacyVersion} found, but AgentX requires PowerShell ${MIN_POWERSHELL_VERSION}+ (pwsh).`;
  } else {
    message = `PowerShell ${MIN_POWERSHELL_VERSION}+ (pwsh) is required for AgentX PowerShell workflows.`;
  }

  return {
    name: 'PowerShell',
    found: meetsMinimum,
    version: hasPwsh ? pwshVersion : legacyVersion,
    severity: 'required',
    message,
    fixUrl: 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell',
    fixLabel: 'Install PowerShell 7.4+',
    fixCommand: platform === 'win32'
      ? 'winget install Microsoft.PowerShell'
      : platform === 'darwin'
        ? 'brew install powershell/tap/powershell'
        : 'sudo apt-get install -y powershell',
  };
}

export async function checkGit(): Promise<DependencyResult> {
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

export async function checkGitHubCli(): Promise<DependencyResult> {
  const raw = await tryExec('gh --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  // 'gh auth token' reads the locally stored credential and exits 0 with the
  // token on stdout when authenticated, or exits non-zero with empty stdout
  // when not authenticated.  This is faster and more reliable than parsing
  // 'gh auth status', which writes to stderr and whose message format can change.
  let authenticated = false;
  if (found) {
    const token = await tryExec('gh auth token');
    authenticated = token.length > 0;
  }

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

export async function checkAzureCli(): Promise<DependencyResult> {
  // Single call: 'az version --output json' returns both the CLI version and
  // all installed extension versions in one JSON document, avoiding a second
  // Python VM startup that 'az extension show' would require.
  const raw = await tryExec('az version --output json', 10_000);
  let found = false;
  let version = '';
  let extensionInstalled = false;

  if (raw.length > 0) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const azVer = parsed['azure-cli'];
      found = typeof azVer === 'string';
      version = found ? parseVersion(azVer as string) : '';
      const extensions = parsed['extensions'] as Record<string, unknown> | undefined;
      extensionInstalled = typeof extensions?.['azure-devops'] === 'string';
    } catch {
      // az printed a non-JSON preamble (e.g. upgrade notice); treat as found
      // but extension status unknown.
      found = true;
      version = parseVersion(raw);
    }
  }

  let message = '';
  if (!found) {
    message = 'Azure CLI not installed. Required for Azure DevOps provider operations.';
  } else if (!extensionInstalled) {
    message = `Azure CLI ${version} found but azure-devops extension is missing. Run: az extension add --name azure-devops`;
  } else {
    message = `Azure CLI ${version} detected with azure-devops extension.`;
  }

  return {
    name: 'Azure CLI (az)',
    found: found && extensionInstalled,
    version,
    severity: 'recommended',
    message,
    fixUrl: 'https://learn.microsoft.com/cli/azure/install-azure-cli',
    fixLabel: 'Install Azure CLI',
    // When the CLI is already installed but the extension is missing, the correct
    // fix is to add the extension — not reinstall the CLI binary.
    fixCommand: !found
      ? (process.platform === 'win32'
          ? 'winget install Microsoft.AzureCLI'
          : process.platform === 'darwin'
            ? 'brew install azure-cli'
            : 'curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash')
      : 'az extension add --name azure-devops',
  };
}

export async function checkClaudeCodeCli(): Promise<DependencyResult> {
  const raw = await tryExec('claude --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  let authenticated = false;
  if (found) {
    const authStatus = await tryExec('claude auth status', 10_000);
    authenticated = authStatus.length > 0;
  }

  let message = '';
  if (!found) {
    message = 'Claude Code CLI not installed. Required for Claude subscription mode.';
  } else if (!authenticated) {
    message = `Claude Code CLI ${version} found but not authenticated. Run: claude auth login`;
  } else {
    message = `Claude Code CLI ${version} detected and authenticated.`;
  }

  return {
    name: 'Claude Code CLI',
    found: found && authenticated,
    version,
    severity: 'optional',
    message,
    fixUrl: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
    fixLabel: 'Install Claude Code',
    fixCommand: process.platform === 'win32'
      ? 'irm https://claude.ai/install.ps1 | iex'
      : 'curl -fsSL https://claude.ai/install.sh | bash',
  };
}
