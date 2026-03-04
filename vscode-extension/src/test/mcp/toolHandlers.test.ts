import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  handleSetAgentState,
  handleCreateIssue,
  handleTriggerWorkflow,
  handleMemorySearch,
} from '../../mcp/toolHandlers';
import {
  type SetAgentStateInput,
  type CreateIssueInput,
  type TriggerWorkflowInput,
  type MemorySearchInput,
} from '../../mcp/mcpTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let agentxDir: string;
let memoryDir: string;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Tool Handlers', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-tool-test-'));
    agentxDir = path.join(tmpDir, '.agentx');
    memoryDir = path.join(agentxDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // set-agent-state
  // -----------------------------------------------------------------------

  describe('handleSetAgentState', () => {
    it('should set agent state and write state file', () => {
      const input: SetAgentStateInput = { agent: 'engineer', state: 'working', issueNumber: 42 };
      const result = handleSetAgentState(input, agentxDir);

      assert.ok(result.success);
      assert.ok(result.message.includes('engineer'));
      assert.ok(result.message.includes('working'));

      const stateFile = path.join(agentxDir, 'state', 'engineer.json');
      assert.ok(fs.existsSync(stateFile));

      const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.strictEqual(data.agent, 'engineer');
      assert.strictEqual(data.state, 'working');
      assert.strictEqual(data.issueNumber, 42);
    });

    it('should reject invalid agent name', () => {
      const input: SetAgentStateInput = { agent: 'invalid-agent' as any, state: 'idle' };
      const result = handleSetAgentState(input, agentxDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid agent'));
    });

    it('should reject invalid state', () => {
      const input: SetAgentStateInput = { agent: 'engineer', state: 'flying' as any };
      const result = handleSetAgentState(input, agentxDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid state'));
    });

    it('should handle optional issueNumber', () => {
      const input: SetAgentStateInput = { agent: 'reviewer', state: 'idle' };
      const result = handleSetAgentState(input, agentxDir);

      assert.ok(result.success);
      const data = result.data as Record<string, unknown>;
      assert.strictEqual(data['issueNumber'], null);
    });

    it('should create state directory if missing', () => {
      const stateDir = path.join(agentxDir, 'state');
      assert.ok(!fs.existsSync(stateDir));

      const input: SetAgentStateInput = { agent: 'architect', state: 'working' };
      handleSetAgentState(input, agentxDir);

      assert.ok(fs.existsSync(stateDir));
    });
  });

  // -----------------------------------------------------------------------
  // create-issue
  // -----------------------------------------------------------------------

  describe('handleCreateIssue', () => {
    it('should create an issue file with correct data', () => {
      const input: CreateIssueInput = {
        title: 'Test issue',
        type: 'story',
        priority: 'p1',
        description: 'A test description',
      };
      const result = handleCreateIssue(input, agentxDir);

      assert.ok(result.success);
      assert.ok(result.message.includes('#1'));
      assert.ok(result.message.includes('Test issue'));

      const issueFile = path.join(agentxDir, 'issues', '1.json');
      assert.ok(fs.existsSync(issueFile));

      const data = JSON.parse(fs.readFileSync(issueFile, 'utf-8'));
      assert.strictEqual(data.number, 1);
      assert.strictEqual(data.title, 'Test issue');
      assert.strictEqual(data.type, 'type:story');
      assert.strictEqual(data.status, 'Backlog');
    });

    it('should auto-increment issue numbers', () => {
      handleCreateIssue({ title: 'First', type: 'bug' }, agentxDir);
      handleCreateIssue({ title: 'Second', type: 'story' }, agentxDir);
      const result = handleCreateIssue({ title: 'Third', type: 'feature' }, agentxDir);

      assert.ok(result.success);
      assert.ok(result.message.includes('#3'));
    });

    it('should reject invalid issue type', () => {
      const input: CreateIssueInput = { title: 'Bad type', type: 'invalid' as any };
      const result = handleCreateIssue(input, agentxDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid issue type'));
    });

    it('should reject invalid priority', () => {
      const input: CreateIssueInput = { title: 'Bad priority', type: 'story', priority: 'p9' as any };
      const result = handleCreateIssue(input, agentxDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid priority'));
    });

    it('should include labels in output', () => {
      const input: CreateIssueInput = {
        title: 'With labels',
        type: 'bug',
        labels: ['needs:ux', 'team:alpha'],
      };
      const result = handleCreateIssue(input, agentxDir);

      assert.ok(result.success);
      const data = result.data as Record<string, unknown>;
      const labels = data['labels'] as string[];
      assert.ok(labels.includes('type:bug'));
      assert.ok(labels.includes('needs:ux'));
      assert.ok(labels.includes('team:alpha'));
    });
  });

  // -----------------------------------------------------------------------
  // trigger-workflow
  // -----------------------------------------------------------------------

  describe('handleTriggerWorkflow', () => {
    it('should trigger a workflow for an existing issue', () => {
      // Create issue first
      handleCreateIssue({ title: 'Target issue', type: 'story' }, agentxDir);

      const input: TriggerWorkflowInput = { issueNumber: 1, workflowType: 'story' };
      const result = handleTriggerWorkflow(input, agentxDir);

      assert.ok(result.success);
      assert.ok(result.message.includes('story'));
      assert.ok(result.message.includes('#1'));

      const wfFile = path.join(agentxDir, 'workflows', 'workflow-1.json');
      assert.ok(fs.existsSync(wfFile));
    });

    it('should fail for non-existent issue', () => {
      const input: TriggerWorkflowInput = { issueNumber: 999, workflowType: 'bug' };
      const result = handleTriggerWorkflow(input, agentxDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('not found'));
    });

    it('should reject invalid workflow type', () => {
      const input: TriggerWorkflowInput = { issueNumber: 1, workflowType: 'invalid' as any };
      const result = handleTriggerWorkflow(input, agentxDir);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid workflow type'));
    });
  });

  // -----------------------------------------------------------------------
  // memory-search
  // -----------------------------------------------------------------------

  describe('handleMemorySearch', () => {
    it('should return empty results for empty memory', () => {
      const input: MemorySearchInput = { query: 'test' };
      const result = handleMemorySearch(input, memoryDir);

      assert.ok(result.success);
      assert.ok(result.message.includes('0 result'));
    });

    it('should search observations by keyword', () => {
      // Seed observation manifest
      fs.writeFileSync(
        path.join(memoryDir, 'manifest.json'),
        JSON.stringify({ entries: [
          { id: 'obs-1', summary: 'Fixed the login timeout bug' },
          { id: 'obs-2', summary: 'Added health endpoint' },
        ] }),
      );

      const result = handleMemorySearch({ query: 'login' }, memoryDir);
      assert.ok(result.success);
      const data = result.data as Array<{ id: string }>;
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'obs-1');
    });

    it('should search outcomes by lesson', () => {
      const outDir = path.join(memoryDir, 'outcomes');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, 'outcome-manifest.json'),
        JSON.stringify({ entries: [
          { id: 'out-1', lesson: 'Always validate input before processing' },
          { id: 'out-2', lesson: 'Use retry with backoff for transient failures' },
        ] }),
      );

      const result = handleMemorySearch({ query: 'validate', store: 'outcomes' }, memoryDir);
      assert.ok(result.success);
      const data = result.data as Array<{ id: string }>;
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'out-1');
    });

    it('should search sessions by description', () => {
      const sesDir = path.join(memoryDir, 'sessions');
      fs.mkdirSync(sesDir, { recursive: true });
      fs.writeFileSync(
        path.join(sesDir, 'session-manifest.json'),
        JSON.stringify({ entries: [
          { id: 'ses-1', description: 'Implemented Phase 3 MCP server' },
          { id: 'ses-2', description: 'Fixed dashboard rendering' },
        ] }),
      );

      const result = handleMemorySearch({ query: 'dashboard', store: 'sessions' }, memoryDir);
      assert.ok(result.success);
      const data = result.data as Array<{ id: string }>;
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'ses-2');
    });

    it('should respect limit parameter', () => {
      fs.writeFileSync(
        path.join(memoryDir, 'manifest.json'),
        JSON.stringify({ entries: Array.from({ length: 20 }, (_, i) => ({
          id: `obs-${i}`, summary: `match item ${i}`,
        })) }),
      );

      const result = handleMemorySearch({ query: 'match', limit: 5 }, memoryDir);
      assert.ok(result.success);
      const data = result.data as unknown[];
      assert.strictEqual(data.length, 5);
    });

    it('should reject invalid store', () => {
      const result = handleMemorySearch({ query: 'test', store: 'invalid' as any }, memoryDir);
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Invalid store'));
    });
  });
});
