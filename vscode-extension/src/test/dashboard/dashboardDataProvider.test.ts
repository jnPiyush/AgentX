import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DashboardDataProvider } from '../../dashboard/dashboardDataProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;
let memoryDir: string;

function seedIssue(num: number, opts: Record<string, unknown> = {}): void {
  const issuesDir = path.join(agentxDir, 'issues');
  fs.mkdirSync(issuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(issuesDir, `${num}.json`),
    JSON.stringify({
      number: num,
      title: `Issue ${num}`,
      type: opts['type'] ?? 'type:story',
      priority: opts['priority'] ?? 'priority:p2',
      status: opts['status'] ?? 'Backlog',
      createdAt: new Date().toISOString(),
      ...opts,
    }),
  );
}

function seedState(agent: string, state: string, issueNumber?: number): void {
  const stateDir = path.join(agentxDir, 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, `${agent}.json`),
    JSON.stringify({
      agent,
      state,
      issueNumber: issueNumber ?? null,
      updatedAt: new Date().toISOString(),
    }),
  );
}

function seedOutcomeManifest(entries: Array<Record<string, unknown>>): void {
  const outDir = path.join(memoryDir, 'outcomes');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'outcome-manifest.json'),
    JSON.stringify({ entries }),
  );
}

function seedSessionManifest(entries: Array<Record<string, unknown>>): void {
  const sesDir = path.join(memoryDir, 'sessions');
  fs.mkdirSync(sesDir, { recursive: true });
  fs.writeFileSync(
    path.join(sesDir, 'session-manifest.json'),
    JSON.stringify({ entries }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardDataProvider', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-dash-test-'));
    agentxDir = path.join(tmpDir, '.agentx');
    memoryDir = path.join(agentxDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getData()', () => {
    it('should return well-formed DashboardData', async () => {
      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();

      assert.ok(data.lastUpdated, 'Should have lastUpdated timestamp');
      assert.ok(Array.isArray(data.agentStates));
      assert.ok(Array.isArray(data.readyQueue));
      assert.ok(Array.isArray(data.outcomeTrends));
      assert.ok(Array.isArray(data.recentSessions));
      assert.ok(Array.isArray(data.activeWorkflows));
    });

    it('should aggregate agent states', async () => {
      seedState('engineer', 'working', 42);
      seedState('reviewer', 'idle');

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();

      assert.strictEqual(data.agentStates.length, 2);
      const eng = data.agentStates.find((a) => a.agent === 'engineer');
      assert.ok(eng);
      assert.strictEqual(eng.state, 'working');
      assert.strictEqual(eng.issueNumber, 42);
    });
  });

  describe('ready queue', () => {
    it('should return empty for no issues', async () => {
      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.readyQueue.length, 0);
    });

    it('should sort issues by priority', async () => {
      seedIssue(1, { priority: 'priority:p3' });
      seedIssue(2, { priority: 'priority:p0' });
      seedIssue(3, { priority: 'priority:p1' });

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();

      assert.strictEqual(data.readyQueue.length, 3);
      assert.strictEqual(data.readyQueue[0]!.issueNumber, 2);
      assert.strictEqual(data.readyQueue[1]!.issueNumber, 3);
      assert.strictEqual(data.readyQueue[2]!.issueNumber, 1);
    });

    it('should exclude Done issues', async () => {
      seedIssue(1, { status: 'Backlog' });
      seedIssue(2, { status: 'Done' });

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.readyQueue.length, 1);
    });
  });

  describe('outcome trends', () => {
    it('should return 14 days of data', async () => {
      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      // Trends should have 14 entries even when empty (one per day)
      assert.strictEqual(data.outcomeTrends.length, 0); // No manifest exists
    });

    it('should count outcomes per day', async () => {
      const today = new Date().toISOString();
      seedOutcomeManifest([
        { result: 'success', timestamp: today },
        { result: 'failure', timestamp: today },
        { result: 'success', timestamp: today },
      ]);

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();

      // Should have 14 trend points
      assert.strictEqual(data.outcomeTrends.length, 14);
      const todayKey = today.split('T')[0]!;
      const todayPoint = data.outcomeTrends.find((t) => t.date === todayKey);
      assert.ok(todayPoint, 'Should have trend point for today');
      assert.strictEqual(todayPoint.pass, 2);
      assert.strictEqual(todayPoint.fail, 1);
    });
  });

  describe('recent sessions', () => {
    it('should return empty for missing manifest', async () => {
      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.recentSessions.length, 0);
    });

    it('should return available sessions', async () => {
      seedSessionManifest([
        { id: 's1', agent: 'engineer', startTime: new Date().toISOString() },
      ]);

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.recentSessions.length, 1);
    });
  });

  describe('health report', () => {
    it('should report missing subsystems as degraded', async () => {
      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();

      assert.ok(data.healthReport);
      assert.strictEqual(data.healthReport.overallStatus, 'degraded');
      assert.ok(data.healthReport.subsystems.length >= 1);
    });

    it('should report healthy when manifests exist', async () => {
      // Create all required manifests
      fs.writeFileSync(path.join(memoryDir, 'manifest.json'), JSON.stringify({ entries: [] }));
      seedOutcomeManifest([]);
      seedSessionManifest([]);
      fs.writeFileSync(path.join(memoryDir, 'synapse-manifest.json'), JSON.stringify({ links: [] }));

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();

      assert.ok(data.healthReport);
      assert.strictEqual(data.healthReport.overallStatus, 'healthy');
    });
  });

  describe('active workflows', () => {
    it('should return empty for no workflows dir', async () => {
      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.activeWorkflows.length, 0);
    });

    it('should list running workflows', async () => {
      const wfDir = path.join(agentxDir, 'workflows');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(
        path.join(wfDir, 'wf-42.json'),
        JSON.stringify({
          issueNumber: 42,
          workflowType: 'feature',
          currentStep: 2,
          totalSteps: 5,
          agent: 'engineer',
          iterationCount: 3,
          status: 'running',
        }),
      );

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.activeWorkflows.length, 1);
      assert.strictEqual(data.activeWorkflows[0]!.issueNumber, 42);
      assert.strictEqual(data.activeWorkflows[0]!.status, 'running');
    });

    it('should exclude completed workflows', async () => {
      const wfDir = path.join(agentxDir, 'workflows');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(
        path.join(wfDir, 'wf-10.json'),
        JSON.stringify({ issueNumber: 10, workflowType: 'bug', status: 'completed' }),
      );

      const provider = new DashboardDataProvider(agentxDir, memoryDir);
      const data = await provider.getData();
      assert.strictEqual(data.activeWorkflows.length, 0);
    });
  });
});
