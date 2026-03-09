import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  __clearExtensions,
  __setExtension,
} from '../mocks/vscode';
import { WorkTreeProvider } from '../../views/workTreeProvider';
import { WorkflowTreeProvider } from '../../views/workflowTreeProvider';
import { QualityTreeProvider } from '../../views/qualityTreeProvider';
import { IntegrationTreeProvider } from '../../views/integrationTreeProvider';

function createWorkspaceRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-sidebar-'));
  fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.agentx', 'issues'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
  return root;
}

function createAgentxStub(root: string) {
  return {
    workspaceRoot: root,
    githubConnected: true,
    adoConnected: false,
    getPendingClarification: async () => undefined,
    listExecutionPlanFiles: () => ['docs/plans/EXEC-PLAN-1.md'],
  } as any;
}

describe('sidebar providers', () => {
  afterEach(() => {
    __clearExtensions();
  });

  it('WorkTreeProvider should show active work and local issues', async () => {
    const root = createWorkspaceRoot();
    fs.writeFileSync(
      path.join(root, '.agentx', 'state', 'agent-status.json'),
      JSON.stringify({ engineer: { status: 'working', issue: 7, lastActivity: '2026-03-09T10:00:00Z' } }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(root, '.agentx', 'state', 'harness-state.json'),
      JSON.stringify({
        version: 1,
        threads: [{
          id: 'thread-1',
          title: 'Implement sidebar',
          taskType: 'feature',
          status: 'active',
          issueNumber: 7,
          planPath: 'docs/plans/EXEC-PLAN-1.md',
          startedAt: '2026-03-09T10:00:00Z',
          updatedAt: '2026-03-09T10:05:00Z',
          currentTurnId: 'turn-1',
        }],
        turns: [{
          id: 'turn-1',
          threadId: 'thread-1',
          sequence: 1,
          status: 'active',
          startedAt: '2026-03-09T10:00:00Z',
        }],
        items: [],
        evidence: [],
      }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(root, '.agentx', 'issues', '7.json'),
      JSON.stringify({ number: 7, title: 'Add sidebar', state: 'open', status: 'In Progress' }),
      'utf-8',
    );
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'EXEC-PLAN-1.md'), '# Plan', 'utf-8');

    const provider = new WorkTreeProvider({
      ...createAgentxStub(root),
      getPendingClarification: async () => ({
        agentName: 'Engineer',
        prompt: 'Need acceptance criteria',
      }),
    });
    const items = await provider.getChildren();

    assert.equal(items.length, 5);
    assert.equal(items[1].label, 'Implement sidebar');

    const overviewChildren = await provider.getChildren(items[0]);
    assert.ok(overviewChildren.some((item) => item.label === 'Pending clarification'));
    assert.ok(overviewChildren.some((item) => item.command?.command === 'agentx.showPendingClarification'));

    const activeThreadChildren = await provider.getChildren(items[1]);
    assert.ok(activeThreadChildren.some((item) => item.label === 'Open linked issue'));
    assert.ok(activeThreadChildren.some((item) => item.command?.command === 'agentx.checkDeps'));

    const issueSection = items[3];
    const issueChildren = await provider.getChildren(issueSection);
    assert.equal(issueChildren.length, 1);
    assert.ok(String(issueChildren[0].label).includes('#7 Add sidebar'));
  });

  it('WorkflowTreeProvider should expose current state and workflow catalog', async () => {
    const root = createWorkspaceRoot();
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'loop-state.json'), JSON.stringify({
      active: true,
      status: 'active',
      prompt: 'Do the work',
      iteration: 2,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      startedAt: '2026-03-09T10:00:00Z',
      lastIterationAt: '2026-03-09T10:05:00Z',
      history: [],
    }), 'utf-8');
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'EXEC-PLAN-1.md'), '# Plan', 'utf-8');

    const provider = new WorkflowTreeProvider(createAgentxStub(root));
    const items = await provider.getChildren();

    assert.equal(items.length, 2);
    const catalogChildren = await provider.getChildren(items[1]);
    assert.ok(catalogChildren.some((item) => item.label === 'feature'));
    assert.ok(catalogChildren.some((item) => item.command));
  });

  it('QualityTreeProvider should show handoff state', async () => {
    const root = createWorkspaceRoot();
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'loop-state.json'), JSON.stringify({
      active: false,
      status: 'complete',
      prompt: 'Done',
      iteration: 3,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      startedAt: '2026-03-09T10:00:00Z',
      lastIterationAt: '2026-03-09T10:10:00Z',
      history: [],
    }), 'utf-8');

    const provider = new QualityTreeProvider(createAgentxStub(root));
    const items = await provider.getChildren();
    const summaryChildren = await provider.getChildren(items[0]);

    assert.ok(summaryChildren.some((item) => item.label === 'Reviewer handoff'));
    assert.ok(summaryChildren.some((item) => item.description === 'ready'));
  });

  it('IntegrationTreeProvider should show provider and companion state', async () => {
    const root = createWorkspaceRoot();
    fs.writeFileSync(
      path.join(root, '.agentx', 'version.json'),
      JSON.stringify({ version: '8.2.1', mode: 'github' }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(root, '.agentx', 'config.json'),
      JSON.stringify({ mode: 'github' }),
      'utf-8',
    );
    __setExtension('ms-azuretools.vscode-azure-github-copilot', {});

    const provider = new IntegrationTreeProvider(createAgentxStub(root));
    const items = await provider.getChildren();
    const providerChildren = await provider.getChildren(items[1]);

    assert.ok(providerChildren.some((item) => item.label === 'GitHub MCP'));
    assert.ok(providerChildren.some((item) => item.label === 'Azure companion'));
  });
});