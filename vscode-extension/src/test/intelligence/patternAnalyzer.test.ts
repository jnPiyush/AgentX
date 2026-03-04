import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PatternAnalyzer } from '../../intelligence/detectors/patternAnalyzer';
import { type OutcomeRecord } from '../../memory/outcomeTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let memoryDir: string;

function makeOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  const defaults: OutcomeRecord = {
    id: `out-engineer-1-${Date.now()}`,
    agent: 'engineer',
    issueNumber: 1,
    result: 'pass',
    actionSummary: 'Implemented feature',
    rootCause: null,
    lesson: 'Tests pass after refactoring the module',
    iterationCount: 1,
    timestamp: new Date().toISOString(),
    sessionId: 'ses-1',
    labels: ['type:story'],
  };
  return { ...defaults, ...overrides };
}

function seedOutcomes(records: OutcomeRecord[]): void {
  const outDir = path.join(memoryDir, 'outcomes');
  fs.mkdirSync(outDir, { recursive: true });

  const entries = records.map((r) => ({
    id: r.id,
    agent: r.agent,
    issueNumber: r.issueNumber,
    result: r.result,
    actionSummary: r.actionSummary,
    timestamp: r.timestamp,
    labels: r.labels,
  }));

  fs.writeFileSync(
    path.join(outDir, 'outcome-manifest.json'),
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), entries }),
  );

  // Write individual record files
  for (const record of records) {
    fs.writeFileSync(
      path.join(outDir, `${record.id}.json`),
      JSON.stringify(record),
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatternAnalyzer', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-pattern-test-'));
    memoryDir = path.join(tmpDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty for missing outcomes directory', async () => {
    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should return empty for empty manifest', async () => {
    const outDir = path.join(memoryDir, 'outcomes');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'outcome-manifest.json'),
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), entries: [] }),
    );
    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should not flag patterns below threshold', async () => {
    // Only 2 failures with same keyword -- below default threshold of 3
    seedOutcomes([
      makeOutcome({ id: 'o1', result: 'fail', lesson: 'Timeout error when connecting to database' }),
      makeOutcome({ id: 'o2', result: 'fail', lesson: 'Database timeout on large query' }),
    ]);

    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    // Should not detect failure patterns (below threshold of 3)
    const failureResults = results.filter((r) => r.severity !== 'info');
    assert.strictEqual(failureResults.length, 0);
  });

  it('should detect recurring failure patterns above threshold', async () => {
    // 3+ failures with shared keyword "timeout"
    seedOutcomes([
      makeOutcome({ id: 'o1', result: 'fail', lesson: 'Timeout error in API call', issueNumber: 1 }),
      makeOutcome({ id: 'o2', result: 'fail', lesson: 'Request timeout during load test', issueNumber: 2 }),
      makeOutcome({ id: 'o3', result: 'fail', lesson: 'Connection timeout under heavy load', issueNumber: 3 }),
    ]);

    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    const warnings = results.filter((r) => r.severity === 'warning' || r.severity === 'critical');
    assert.ok(warnings.length >= 1, 'Should detect at least one failure pattern');
    assert.ok(warnings[0]!.message.includes('timeout'));
  });

  it('should mark critical for patterns at 2x threshold', async () => {
    // 6 failures with shared keyword (2x default of 3)
    const records = Array.from({ length: 6 }, (_, i) =>
      makeOutcome({
        id: `o${i}`,
        result: 'fail',
        lesson: `Build failure caused by missing dependency issue ${i}`,
        issueNumber: i + 1,
      }),
    );
    seedOutcomes(records);

    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    const criticals = results.filter((r) => r.severity === 'critical');
    assert.ok(criticals.length >= 1, 'Should have critical severity for 2x patterns');
  });

  it('should detect success patterns for promotion', async () => {
    // 3+ successes with shared keyword "refactoring"
    seedOutcomes([
      makeOutcome({ id: 's1', result: 'pass', lesson: 'Refactoring improved code quality' }),
      makeOutcome({ id: 's2', result: 'pass', lesson: 'Refactoring reduced complexity' }),
      makeOutcome({ id: 's3', result: 'pass', lesson: 'Refactoring eliminated duplication' }),
    ]);

    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    const infoResults = results.filter((r) => r.severity === 'info');
    assert.ok(infoResults.length >= 1, 'Should detect success patterns');
    assert.ok(infoResults.some((r) => r.message.includes('success pattern')));
  });

  it('should respect custom minPatternCount', async () => {
    seedOutcomes([
      makeOutcome({ id: 'o1', result: 'fail', lesson: 'Compile error in module' }),
      makeOutcome({ id: 'o2', result: 'fail', lesson: 'Module compile error fix needed' }),
    ]);

    // Lower threshold to 2
    const analyzer = new PatternAnalyzer(memoryDir, 2);
    const results = await analyzer.detect();
    const warnings = results.filter((r) => r.severity === 'warning' || r.severity === 'critical');
    assert.ok(warnings.length >= 1, 'Should detect patterns with custom threshold');
  });

  it('should handle partial results in failure analysis', async () => {
    seedOutcomes([
      makeOutcome({ id: 'o1', result: 'partial', lesson: 'Partial coverage on integration tests' }),
      makeOutcome({ id: 'o2', result: 'partial', lesson: 'Integration coverage partially complete' }),
      makeOutcome({ id: 'o3', result: 'partial', lesson: 'Integration tests partial pass rate' }),
    ]);

    const analyzer = new PatternAnalyzer(memoryDir);
    const results = await analyzer.detect();
    // Partial results count as failures in pattern analysis
    const patternAlerts = results.filter((r) => r.severity === 'warning' || r.severity === 'critical');
    assert.ok(patternAlerts.length >= 1, 'Should include partial results in failure analysis');
  });

  it('should have correct name', () => {
    const analyzer = new PatternAnalyzer(memoryDir);
    assert.strictEqual(analyzer.name, 'pattern');
  });
});
