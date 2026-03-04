import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DependencyMonitor } from '../../intelligence/detectors/dependencyMonitor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;

interface SeedOpts {
  agent: string;
  state: string;
  issueNumber: number;
  blockedBy?: number[];
  blocks?: number[];
}

function seedState(opts: SeedOpts): void {
  const stateDir = path.join(agentxDir, 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, `${opts.agent}-${opts.issueNumber}.json`),
    JSON.stringify({
      agent: opts.agent,
      state: opts.state,
      issueNumber: opts.issueNumber,
      blockedBy: opts.blockedBy ?? [],
      blocks: opts.blocks ?? [],
      updatedAt: new Date().toISOString(),
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DependencyMonitor', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-depmon-test-'));
    agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty for no state dir', async () => {
    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should return empty for no blockers', async () => {
    seedState({ agent: 'engineer', state: 'working', issueNumber: 1 });
    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should detect fully unblocked issues', async () => {
    seedState({ agent: 'engineer', state: 'done', issueNumber: 10 }); // blocker - done
    seedState({ agent: 'engineer', state: 'working', issueNumber: 20, blockedBy: [10] });

    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.severity, 'info');
    assert.ok(results[0]!.message.includes('#20'));
    assert.ok(results[0]!.message.includes('unblocked'));
  });

  it('should detect partially resolved blockers', async () => {
    seedState({ agent: 'engineer', state: 'done', issueNumber: 10 });     // resolved
    seedState({ agent: 'engineer', state: 'working', issueNumber: 11 });   // unresolved
    seedState({
      agent: 'engineer', state: 'working', issueNumber: 20,
      blockedBy: [10, 11],
    });

    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.severity, 'info');
    assert.ok(results[0]!.message.includes('#10'));
    assert.ok(results[0]!.message.includes('still blocked'));
  });

  it('should detect circular dependencies', async () => {
    seedState({ agent: 'engineer', state: 'working', issueNumber: 1, blockedBy: [2] });
    seedState({ agent: 'engineer', state: 'working', issueNumber: 2, blockedBy: [3] });
    seedState({ agent: 'engineer', state: 'working', issueNumber: 3, blockedBy: [1] });

    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();

    const circulars = results.filter((r) => r.severity === 'critical');
    assert.ok(circulars.length >= 1, 'Should detect at least one circular dependency');
    assert.ok(circulars[0]!.message.includes('Circular'));
  });

  it('should not flag non-existent blockers as unresolved', async () => {
    // Issue 20 blocked by 99 which is not in state files -- missing = resolved
    seedState({ agent: 'engineer', state: 'working', issueNumber: 20, blockedBy: [99] });

    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();
    const infoResults = results.filter((r) => r.severity === 'info');
    assert.strictEqual(infoResults.length, 1);
    assert.ok(infoResults[0]!.message.includes('unblocked'));
  });

  it('should handle states without issueNumber', async () => {
    const stateDir = path.join(agentxDir, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'orphan.json'),
      JSON.stringify({ agent: 'engineer', state: 'idle', updatedAt: new Date().toISOString() }),
    );

    const monitor = new DependencyMonitor(agentxDir);
    const results = await monitor.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should have correct name', () => {
    const monitor = new DependencyMonitor(agentxDir);
    assert.strictEqual(monitor.name, 'dependency');
  });
});
