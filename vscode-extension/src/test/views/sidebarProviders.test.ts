import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  __clearExtensions,
  __setExtension,
} from '../mocks/vscode';
import { WorkTreeProvider } from '../../views/workTreeProvider';
import { StatusTreeProvider } from '../../views/statusTreeProvider';

function createWorkspaceRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-sidebar-'));
  fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.agentx', 'issues'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'reviews', 'findings'), { recursive: true });
  return root;
}

function createAgentxStub(root: string) {
  return {
    workspaceRoot: root,
    githubConnected: true,
    adoConnected: false,
    getPendingClarification: async () => undefined,
    listExecutionPlanFiles: () => ['docs/plans/EXEC-PLAN-1.md'],
    getStatePath: (fileName: string) => path.join(root, '.agentx', 'state', fileName),
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
    fs.writeFileSync(
      path.join(root, 'docs', 'reviews', 'findings', 'FINDING-164-001.md'),
      '---\nid: FINDING-164-001\ntitle: Promote review gap\nsource_review: docs/artifacts/reviews/REVIEW-164.md\nsource_issue: 164\nseverity: high\nstatus: Backlog\npriority: p1\nowner: reviewer\npromotion: required\nsuggested_type: story\nlabels: type:story\ndependencies: #163\nevidence: docs/artifacts/reviews/REVIEW-164.md\nbacklog_issue: \ncreated: 2026-03-12\nupdated: 2026-03-12\n---\n\n# Review Finding: Promote review gap\n\n## Summary\n\nTrack the review gap.\n\n## Impact\n\n- Review follow-up can disappear.\n\n## Recommended Action\n\n- Promote it into backlog work.\n\n## Promotion Notes\n\n- Required.\n',
      'utf-8',
    );

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

    const actionChildren = await provider.getChildren(items[4]);
    assert.ok(actionChildren.some((item) => item.label === 'Brainstorm'));
    assert.ok(actionChildren.some((item) => item.label === 'Compound loop'));
    assert.ok(actionChildren.some((item) => item.label === 'Create learning capture'));
    assert.ok(actionChildren.some((item) => item.label === 'Review findings'));
    assert.ok(actionChildren.some((item) => item.label === 'Promote review finding'));
  });

  it('StatusTreeProvider should show current state, quality signals, and workflow catalog', async () => {
    const root = createWorkspaceRoot();
    fs.mkdirSync(path.join(root, 'docs', 'progress'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'EXEC-PLAN-1.md'), '# Plan', 'utf-8');
    fs.writeFileSync(path.join(root, 'docs', 'progress', 'EXEC-PLAN-1.md'), '# Progress', 'utf-8');
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
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'harness-state.json'), JSON.stringify({
      version: 1,
      threads: [{
        id: 'thread-1',
        title: 'Implement sidebar',
        taskType: 'story',
        status: 'complete',
        startedAt: '2026-03-09T10:00:00Z',
        updatedAt: '2026-03-09T10:10:00Z',
      }],
      turns: [],
      items: [],
      evidence: [{
        id: 'evidence-1',
        threadId: 'thread-1',
        evidenceType: 'completion',
        summary: 'Sidebar complete',
        createdAt: '2026-03-09T10:10:00Z',
      }],
    }), 'utf-8');
    fs.writeFileSync(
      path.join(root, 'docs', 'reviews', 'findings', 'FINDING-164-001.md'),
      '---\nid: FINDING-164-001\ntitle: Promote review gap\nsource_review: docs/artifacts/reviews/REVIEW-164.md\nsource_issue: 164\nseverity: high\nstatus: Backlog\npriority: p1\nowner: reviewer\npromotion: required\nsuggested_type: story\nlabels: type:story\ndependencies: #163\nevidence: docs/artifacts/reviews/REVIEW-164.md\nbacklog_issue: \ncreated: 2026-03-12\nupdated: 2026-03-12\n---\n\n# Review Finding: Promote review gap\n\n## Summary\n\nTrack the review gap.\n',
      'utf-8',
    );

    const provider = new StatusTreeProvider(createAgentxStub(root));
    const items = await provider.getChildren();

    assert.equal(items.length, 5);

    const stateChildren = await provider.getChildren(items[1]);
    assert.ok(stateChildren.some((item) => item.label === 'Loop'));
    assert.ok(stateChildren.some((item) => item.label === 'Harness'));
    assert.ok(stateChildren.some((item) => item.label === 'Active workflow'));

    const qualityChildren = await provider.getChildren(items[2]);
    assert.ok(qualityChildren.some((item) => item.label === 'Evaluation' && item.description === '100% (5/5 checks)'));
    assert.ok(qualityChildren.some((item) => item.label === 'Reviewer handoff' && item.description === 'ready'));

    const catalogChildren = await provider.getChildren(items[3]);
    assert.ok(catalogChildren.some((item) => item.label === 'feature'));
    assert.ok(catalogChildren.some((item) => item.command));

    const actionsChildren = await provider.getChildren(items[4]);
    assert.ok(actionsChildren.some((item) => item.label === 'Compound loop'));
    assert.ok(actionsChildren.some((item) => item.label === 'Check environment'));
    assert.ok(actionsChildren.some((item) => item.label === 'Add integration'));
  });

  it('StatusTreeProvider should show overview with version, mode, and companion state', async () => {
    const root = createWorkspaceRoot();
    fs.writeFileSync(
      path.join(root, '.agentx', 'version.json'),
      JSON.stringify({ version: '8.3.0', mode: 'github' }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(root, '.agentx', 'config.json'),
      JSON.stringify({ mode: 'github' }),
      'utf-8',
    );
    __setExtension('ms-azuretools.vscode-azure-mcp-server', {});

    const provider = new StatusTreeProvider(createAgentxStub(root));
    const items = await provider.getChildren();

    const overviewChildren = await provider.getChildren(items[0]);
    assert.ok(overviewChildren.some((item) => item.label === 'Version' && item.description === '8.3.0'));
    assert.ok(overviewChildren.some((item) => item.label === 'Mode' && item.description === 'github'));
    assert.ok(overviewChildren.some((item) => item.label === 'GitHub MCP' && item.description === 'connected'));
    assert.ok(overviewChildren.some((item) => item.label === 'Azure skills' && item.description === 'installed'));
  });

  it('StatusTreeProvider should return overview-only when no workspace root', async () => {
    const provider = new StatusTreeProvider({
      workspaceRoot: undefined,
      githubConnected: false,
      adoConnected: false,
      getPendingClarification: async () => undefined,
      listExecutionPlanFiles: () => [],
      getStatePath: () => '',
    } as any);
    const items = await provider.getChildren();

    assert.equal(items.length, 1);
    assert.equal(items[0].label, 'Overview');
  });
});