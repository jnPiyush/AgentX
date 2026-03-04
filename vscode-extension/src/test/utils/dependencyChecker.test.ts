import { strict as assert } from 'assert';
import { checkAllDependencies, type EnvironmentReport } from '../../utils/dependencyChecker';

// ---------------------------------------------------------------------------
// Integration tests for dependencyChecker.
//
// These call the real checkAllDependencies() which probes the actual
// environment.  Node.js is guaranteed to be present (we are running in it).
// Other tools (git, pwsh, gh) may or may not exist -- tests only assert
// structural invariants and the Node.js detection.
// ---------------------------------------------------------------------------

describe('dependencyChecker', () => {
  describe('checkAllDependencies', () => {
    let report: EnvironmentReport;

    before(async function () {
      this.timeout(30_000); // exec calls may be slow
      report = await checkAllDependencies();
    });

    it('should return EnvironmentReport shape', () => {
      assert.ok(report.timestamp, 'timestamp should be set');
      assert.ok(Array.isArray(report.results), 'results should be an array');
      assert.strictEqual(report.results.length, 4, 'should check 4 dependencies');
      assert.strictEqual(typeof report.healthy, 'boolean');
      assert.strictEqual(typeof report.criticalCount, 'number');
      assert.strictEqual(typeof report.warningCount, 'number');
    });

    it('should detect Node.js as installed', () => {
      const node = report.results.find((r) => r.name === 'Node.js');
      assert.ok(node, 'Node.js entry should exist');
      assert.strictEqual(node.found, true, 'Node.js should be found');
      assert.ok(node.version.length > 0, 'version should be non-empty');
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

    it('should adjust GitHub CLI severity based on mode', async function () {
      this.timeout(30_000);
      const localReport = await checkAllDependencies('local');
      const ghLocal = localReport.results.find((r) => r.name === 'GitHub CLI (gh)');
      assert.ok(ghLocal, 'GitHub CLI entry should exist');
      assert.strictEqual(ghLocal.severity, 'optional', 'gh should be optional in local mode');

      const githubReport = await checkAllDependencies('github');
      const ghGithub = githubReport.results.find((r) => r.name === 'GitHub CLI (gh)');
      assert.ok(ghGithub, 'GitHub CLI entry should exist');
      assert.strictEqual(ghGithub.severity, 'required', 'gh should be required in github mode');
    });

    it('should count criticals correctly', () => {
      const expectedCritical = report.results.filter(
        (r) => r.severity === 'required' && !r.found,
      ).length;
      assert.strictEqual(report.criticalCount, expectedCritical);
    });
  });
});
