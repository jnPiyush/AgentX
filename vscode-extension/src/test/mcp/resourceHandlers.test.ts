import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  handleReadyQueue,
  handleAgentStates,
  handleHealth,
  handleOutcomes,
  handleSessions,
  handleSynapseLinks,
  handleKnowledge,
} from '../../mcp/resourceHandlers';

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
      title: `Issue #${num}`,
      type: opts['type'] ?? 'type:story',
      priority: opts['priority'] ?? 'priority:p2',
      status: opts['status'] ?? 'Backlog',
      labels: [],
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Resource Handlers', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-res-test-'));
    agentxDir = path.join(tmpDir, '.agentx');
    memoryDir = path.join(agentxDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // handleReadyQueue
  // -----------------------------------------------------------------------

  describe('handleReadyQueue', () => {
    it('should return empty array for empty issues dir', () => {
      const res = handleReadyQueue(agentxDir);
      assert.strictEqual(res.uri, 'agentx://ready-queue');
      assert.strictEqual(res.mimeType, 'application/json');
      const data = JSON.parse(res.text);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 0);
    });

    it('should return issues sorted by priority', () => {
      seedIssue(1, { priority: 'priority:p3' });
      seedIssue(2, { priority: 'priority:p0' });
      seedIssue(3, { priority: 'priority:p1' });

      const res = handleReadyQueue(agentxDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 3);
      assert.strictEqual(data[0].issueNumber, 2); // p0 first
      assert.strictEqual(data[1].issueNumber, 3); // p1 second
      assert.strictEqual(data[2].issueNumber, 1); // p3 last
    });

    it('should exclude Done issues', () => {
      seedIssue(1, { status: 'Backlog' });
      seedIssue(2, { status: 'Done' });

      const res = handleReadyQueue(agentxDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].issueNumber, 1);
    });
  });

  // -----------------------------------------------------------------------
  // handleAgentStates
  // -----------------------------------------------------------------------

  describe('handleAgentStates', () => {
    it('should return empty array for no state files', () => {
      const res = handleAgentStates(agentxDir);
      assert.strictEqual(res.uri, 'agentx://agent-states');
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 0);
    });

    it('should list all agent states', () => {
      seedState('engineer', 'working', 42);
      seedState('reviewer', 'idle');

      const res = handleAgentStates(agentxDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 2);

      const eng = data.find((a: any) => a.agent === 'engineer');
      assert.ok(eng);
      assert.strictEqual(eng.state, 'working');
      assert.strictEqual(eng.issueNumber, 42);
    });
  });

  // -----------------------------------------------------------------------
  // handleHealth
  // -----------------------------------------------------------------------

  describe('handleHealth', () => {
    it('should report error when no stores exist', () => {
      const res = handleHealth(memoryDir);
      assert.strictEqual(res.uri, 'agentx://health');
      const data = JSON.parse(res.text);
      assert.strictEqual(data.status, 'error');
      assert.strictEqual(data.stores.observations.exists, false);
    });

    it('should report healthy when manifests exist', () => {
      fs.writeFileSync(path.join(memoryDir, 'manifest.json'), JSON.stringify({ entries: [{ id: '1' }] }));
      const outDir = path.join(memoryDir, 'outcomes');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'outcome-manifest.json'), JSON.stringify({ entries: [] }));
      const sesDir = path.join(memoryDir, 'sessions');
      fs.mkdirSync(sesDir, { recursive: true });
      fs.writeFileSync(path.join(sesDir, 'session-manifest.json'), JSON.stringify({ entries: [] }));

      const res = handleHealth(memoryDir);
      const data = JSON.parse(res.text);
      // At least obs+outcomes+sessions exist, even if synapse doesn't
      assert.strictEqual(data.stores.observations.exists, true);
      assert.strictEqual(data.stores.observations.entryCount, 1);
    });

    it('should count entries in manifests', () => {
      fs.writeFileSync(path.join(memoryDir, 'manifest.json'), JSON.stringify({
        entries: [{ id: '1' }, { id: '2' }, { id: '3' }],
      }));

      const res = handleHealth(memoryDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.stores.observations.entryCount, 3);
    });
  });

  // -----------------------------------------------------------------------
  // handleOutcomes
  // -----------------------------------------------------------------------

  describe('handleOutcomes', () => {
    it('should return empty for missing manifest', () => {
      const res = handleOutcomes(memoryDir);
      const data = JSON.parse(res.text);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 0);
    });

    it('should return recent entries', () => {
      const outDir = path.join(memoryDir, 'outcomes');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'outcome-manifest.json'), JSON.stringify({
        entries: [
          { id: 'o1', result: 'pass', lesson: 'Lesson 1' },
          { id: 'o2', result: 'fail', lesson: 'Lesson 2' },
        ],
      }));

      const res = handleOutcomes(memoryDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].id, 'o1');
    });
  });

  // -----------------------------------------------------------------------
  // handleSessions
  // -----------------------------------------------------------------------

  describe('handleSessions', () => {
    it('should return empty for missing manifest', () => {
      const res = handleSessions(memoryDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 0);
    });

    it('should return recent sessions', () => {
      const sesDir = path.join(memoryDir, 'sessions');
      fs.mkdirSync(sesDir, { recursive: true });
      fs.writeFileSync(path.join(sesDir, 'session-manifest.json'), JSON.stringify({
        entries: [
          { id: 's1', agent: 'engineer', description: 'Phase 3 work' },
        ],
      }));

      const res = handleSessions(memoryDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 's1');
    });
  });

  // -----------------------------------------------------------------------
  // handleSynapseLinks
  // -----------------------------------------------------------------------

  describe('handleSynapseLinks', () => {
    it('should return empty for missing manifest', () => {
      const res = handleSynapseLinks(memoryDir);
      const data = JSON.parse(res.text);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 0);
    });

    it('should return links from manifest', () => {
      fs.writeFileSync(path.join(memoryDir, 'synapse-manifest.json'), JSON.stringify({
        links: [{ source: 'issue-1', target: 'issue-2', score: 0.85 }],
      }));

      const res = handleSynapseLinks(memoryDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].score, 0.85);
    });
  });

  // -----------------------------------------------------------------------
  // handleKnowledge
  // -----------------------------------------------------------------------

  describe('handleKnowledge', () => {
    it('should return empty for missing manifest', () => {
      const knowledgeDir = path.join(tmpDir, 'knowledge');
      const res = handleKnowledge(knowledgeDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 0);
    });

    it('should return entries from global manifest', () => {
      const knowledgeDir = path.join(tmpDir, 'knowledge');
      fs.mkdirSync(knowledgeDir, { recursive: true });
      fs.writeFileSync(path.join(knowledgeDir, 'global-manifest.json'), JSON.stringify({
        entries: [{ id: 'gk-1', title: 'Best Practice' }],
      }));

      const res = handleKnowledge(knowledgeDir);
      const data = JSON.parse(res.text);
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].title, 'Best Practice');
    });
  });
});
