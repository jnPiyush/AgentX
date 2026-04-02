import { strict as assert } from 'assert';
import {
  checkAllDependencies,
  type EnvironmentReport,
} from '../../utils/dependencyChecker';
import {
  buildPowerShellVersionCommand,
  checkPowerShell,
  getWindowsPowerShellCorePathCandidates,
  resolvePowerShellCoreExecutable,
} from '../../utils/dependencyCheckerInternals';
// Note: checkNodeJs has been removed from the dependency list.
// Node.js is always present (it hosts the extension) so checking for it is redundant.

// ---------------------------------------------------------------------------
// Integration tests for dependencyChecker.
//
// These call the real checkAllDependencies() which probes the actual
// environment.  Node.js is guaranteed to be present (we are running in it).
// Other tools (git, pwsh, gh) may or may not exist -- tests only assert
// structural invariants and the Node.js detection.
// ---------------------------------------------------------------------------

describe('dependencyChecker', () => {
  describe('resolvePowerShellCoreExecutable', () => {
    it('should prefer a discovered Windows PowerShell 7 path over PATH lookup', () => {
      const env = {
        ProgramFiles: 'C:\\Program Files',
      } as NodeJS.ProcessEnv;
      const candidate = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

      const executable = resolvePowerShellCoreExecutable(
        'win32',
        (value) => value === candidate,
        env,
      );

      assert.equal(executable, `"${candidate}"`);
    });

    it('should fall back to pwsh when no Windows PowerShell 7 path exists', () => {
      const executable = resolvePowerShellCoreExecutable('win32', () => false, {
        ProgramFiles: 'C:\\Program Files',
      } as NodeJS.ProcessEnv);

      assert.equal(executable, 'pwsh');
    });

    it('should list stable Windows PowerShell install candidates', () => {
      const candidates = getWindowsPowerShellCorePathCandidates({
        ProgramFiles: 'C:\\Program Files',
      } as NodeJS.ProcessEnv);

      assert.ok(candidates.includes('C:\\Program Files\\PowerShell\\7\\pwsh.exe'));
      assert.ok(candidates.includes('C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe'));
    });

    it('should build a shell-safe version probe command for Unix', () => {
      assert.equal(
        buildPowerShellVersionCommand('pwsh', 'linux'),
        "pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'",
      );
    });

    it('should build a platform-correct version probe command for Windows', () => {
      assert.equal(
        buildPowerShellVersionCommand('pwsh', 'win32'),
        'pwsh -NoProfile -Command $PSVersionTable.PSVersion.ToString()',
      );
    });

    it('should detect PowerShell Core on Windows without double-quote expansion', async () => {
      const commands: string[] = [];

      const result = await checkPowerShell({
        platform: 'win32',
        resolveExecutable: () => 'pwsh',
        execute: async (command) => {
          commands.push(command);
          if (command.startsWith('pwsh ')) {
            return 'PowerShell 7.5.4';
          }
          if (command.startsWith('powershell.exe ')) {
            return '5.1.22621.2506';
          }
          return '';
        },
      });

      // Legacy powershell.exe probe is skipped when pwsh already meets the minimum.
      assert.deepEqual(commands, [
        'pwsh -NoProfile -Command $PSVersionTable.PSVersion.ToString()',
      ]);
      assert.equal(result.found, true);
      assert.equal(result.version, '7.5.4');
      assert.equal(result.message, 'PowerShell 7.5.4 detected.');
    });

    it('should probe legacy powershell.exe on Windows only when pwsh is missing or too old', async () => {
      const commands: string[] = [];

      const result = await checkPowerShell({
        platform: 'win32',
        resolveExecutable: () => 'pwsh',
        execute: async (command) => {
          commands.push(command);
          if (command.startsWith('powershell.exe ')) {
            return '5.1.22621.2506';
          }
          return ''; // pwsh not found
        },
      });

      assert.deepEqual(commands, [
        'pwsh -NoProfile -Command $PSVersionTable.PSVersion.ToString()',
        'powershell.exe -NoProfile -Command $PSVersionTable.PSVersion.ToString()',
      ]);
      assert.equal(result.found, false);
      assert.ok(result.message.includes('Windows PowerShell 5.1'));
    });
  });

  describe('checkAllDependencies', () => {
    let report: EnvironmentReport;

    before(async function () {
      this.timeout(30_000); // exec calls may be slow
      report = await checkAllDependencies();
    });

    it('should return EnvironmentReport shape', () => {
      assert.ok(report.timestamp, 'timestamp should be set');
      assert.ok(Array.isArray(report.results), 'results should be an array');
      assert.strictEqual(report.results.length, 5, 'should check 5 dependencies');
      assert.strictEqual(typeof report.healthy, 'boolean');
      assert.strictEqual(typeof report.criticalCount, 'number');
      assert.strictEqual(typeof report.warningCount, 'number');
    });

    it('should include fix metadata for every result', () => {
      for (const result of report.results) {
        assert.ok(result.fixUrl, `${result.name} should have fixUrl`);
        assert.ok(result.fixLabel, `${result.name} should have fixLabel`);
      }
    });

    it('should have a valid ISO timestamp', () => {
      const parsed = Date.parse(report.timestamp);
      assert.ok(!isNaN(parsed), 'timestamp should be a valid date');
    });

    it('should adjust GitHub CLI severity based on integrations', async function () {
      this.timeout(30_000);
      const localReport = await checkAllDependencies();
      const ghLocal = localReport.results.find((r) => r.name === 'GitHub CLI (gh)');
      assert.ok(ghLocal, 'GitHub CLI entry should exist');
      assert.strictEqual(ghLocal.severity, 'optional', 'gh should be optional with no integrations');

      const githubReport = await checkAllDependencies({ githubConnected: true, adoConnected: false });
      const ghGithub = githubReport.results.find((r) => r.name === 'GitHub CLI (gh)');
      assert.ok(ghGithub, 'GitHub CLI entry should exist');
      assert.strictEqual(ghGithub.severity, 'required', 'gh should be required with github integration');

      const claudeLocal = localReport.results.find((r) => r.name === 'Claude Code CLI');
      assert.ok(claudeLocal, 'Claude Code CLI entry should exist');
      assert.strictEqual(claudeLocal.severity, 'optional', 'Claude Code CLI should be optional by default');

      const claudeReport = await checkAllDependencies({
        githubConnected: false,
        adoConnected: false,
        llmProvider: 'claude-code',
      });
      const claudeConfigured = claudeReport.results.find((r) => r.name === 'Claude Code CLI');
      assert.ok(claudeConfigured, 'Claude Code CLI entry should exist when Claude subscription mode is active');
      assert.strictEqual(claudeConfigured.severity, 'required', 'Claude Code CLI should be required for claude-code mode');
    });

    it('should count criticals correctly', () => {
      const expectedCritical = report.results.filter(
        (r) => r.severity === 'required' && !r.found,
      ).length;
      assert.strictEqual(report.criticalCount, expectedCritical);
    });
  });
});
