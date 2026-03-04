import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StaleIssueDetector } from '../../intelligence/detectors/staleIssueDetector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;

function seedState(
  agent: string,
  state: string,
  issueNumber: number | undefined,
  hoursAgo: number,
): void {
  const stateDir = path.join(agentxDir, 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  const updatedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(
    path.join(stateDir, `${agent}.json`),
    JSON.stringify({ agent, state, issueNumber, updatedAt }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaleIssueDetector', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-stale-test-'));
    agentxDir = path.join(tmpDir, '.agentx');
    fs.mkdirSync(agentxDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty results for missing state dir', async () => {
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should return empty results for no stale issues', async () => {
    seedState('engineer', 'working', 42, 1); // 1h ago -- not stale (threshold=24h)
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should detect working state exceeding inProgressHours', async () => {
    seedState('engineer', 'working', 42, 30); // 30h ago -- stale (threshold=24h)
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.detector, 'stale');
    assert.strictEqual(results[0]!.severity, 'warning');
    assert.ok(results[0]!.message.includes('#42'));
    assert.ok(results[0]!.message.includes('In Progress'));
  });

  it('should mark critical when exceeding 2x inProgressHours', async () => {
    seedState('engineer', 'working', 10, 50); // 50h > 24*2=48h threshold
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.severity, 'critical');
  });

  it('should detect blocked state exceeding inReviewHours', async () => {
    seedState('reviewer', 'blocked', 7, 60); // 60h > 48h threshold
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.severity, 'warning');
    assert.ok(results[0]!.message.includes('In Review'));
  });

  it('should detect idle state exceeding backlogDays', async () => {
    seedState('architect', 'idle', 5, 10 * 24); // 10 days > 7 day threshold
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.severity, 'info');
    assert.ok(results[0]!.message.includes('Backlog'));
  });

  it('should not flag idle without issueNumber', async () => {
    seedState('architect', 'idle', undefined, 10 * 24);
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should respect custom thresholds', async () => {
    seedState('engineer', 'working', 42, 5); // 5h ago
    const detector = new StaleIssueDetector(agentxDir, {
      inProgressHours: 2, // custom low threshold
    });
    const results = await detector.detect();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.severity, 'critical'); // 5h > 2*2=4h
  });

  it('should skip files with invalid updatedAt', async () => {
    const stateDir = path.join(agentxDir, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'broken.json'),
      JSON.stringify({ agent: 'broken', state: 'working', issueNumber: 1, updatedAt: 'not-a-date' }),
    );
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 0);
  });

  it('should handle multiple agents with mixed staleness', async () => {
    seedState('engineer', 'working', 42, 30);  // stale
    seedState('reviewer', 'blocked', 7, 2);     // not stale
    seedState('architect', 'idle', 5, 20 * 24); // stale
    const detector = new StaleIssueDetector(agentxDir);
    const results = await detector.detect();
    assert.strictEqual(results.length, 2);
  });

  it('should have correct name property', () => {
    const detector = new StaleIssueDetector(agentxDir);
    assert.strictEqual(detector.name, 'stale-issue');
  });
});
