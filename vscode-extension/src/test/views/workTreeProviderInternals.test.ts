import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildActionChildren,
  buildActiveAgentChildren,
  buildActiveThreadChildren,
  buildIssueChildren,
  buildOverviewChildren,
  buildWorkflowGuidanceChildren,
  formatTimestamp,
  getLocalIssues,
  readJsonFile,
} from '../../views/workTreeProviderInternals';

describe('workTreeProviderInternals', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-worktree-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('reads JSON files when they exist and returns undefined for missing or invalid files', () => {
    const validPath = path.join(tempRoot, 'valid.json');
    const invalidPath = path.join(tempRoot, 'invalid.json');
    fs.writeFileSync(validPath, JSON.stringify({ title: 'ok' }), 'utf-8');
    fs.writeFileSync(invalidPath, '{not json', 'utf-8');

    assert.deepEqual(readJsonFile<{ title: string }>(validPath), { title: 'ok' });
    assert.equal(readJsonFile(path.join(tempRoot, 'missing.json')), undefined);
    assert.equal(readJsonFile(invalidPath), undefined);
  });

  it('formats timestamps and preserves invalid values', () => {
    assert.equal(formatTimestamp(undefined), undefined);
    assert.equal(formatTimestamp(null), undefined);
    assert.equal(formatTimestamp('not-a-date'), 'not-a-date');
    assert.ok(formatTimestamp('2026-03-24T10:00:00Z'));
  });

  it('loads and sorts local issues while skipping invalid records', () => {
    const issuesDir = path.join(tempRoot, '.agentx', 'issues');
    fs.mkdirSync(issuesDir, { recursive: true });
    fs.writeFileSync(path.join(issuesDir, '2.json'), JSON.stringify({ number: 2, title: 'Second' }), 'utf-8');
    fs.writeFileSync(path.join(issuesDir, '1.json'), JSON.stringify({ number: 1, title: 'First' }), 'utf-8');
    fs.writeFileSync(path.join(issuesDir, 'broken.json'), '{oops', 'utf-8');

    const issues = getLocalIssues(tempRoot);

    assert.deepEqual(issues.map((issue) => issue.number), [1, 2]);
  });

  it('builds overview children with and without pending clarification', () => {
    const withPending = buildOverviewChildren(tempRoot, { agentName: 'Engineer' }, 3);
    const withoutPending = buildOverviewChildren(tempRoot, undefined, 0);

    assert.equal(withPending[1].label, 'Pending clarification');
    assert.equal(withPending[1].description, 'Engineer');
    assert.equal(withoutPending[1].description, 'none');
    assert.equal(withoutPending[2].description, '0');
  });

  it('builds active thread children for missing and populated active threads', () => {
    const emptyChildren = buildActiveThreadChildren(tempRoot, undefined, undefined);
    assert.equal(emptyChildren.length, 1);
    assert.equal(emptyChildren[0].label, 'No active harness thread.');

    const populatedChildren = buildActiveThreadChildren(
      tempRoot,
      {
        title: 'Implement feature',
        taskType: 'story',
        status: 'active',
        issueNumber: 42,
        updatedAt: '2026-03-24T10:00:00Z',
        planPath: 'docs/execution/plans/EXEC-PLAN-42.md',
      },
      3,
    );

    assert.ok(populatedChildren.some((item) => item.label === 'Open execution plan'));
    assert.ok(populatedChildren.some((item) => item.label === 'Open linked issue'));
    assert.ok(populatedChildren.some((item) => item.label === 'Check linked issue dependencies'));
    assert.equal(populatedChildren[2].description, '3');
  });

  it('builds active agent children for empty and populated agent lists', () => {
    const emptyChildren = buildActiveAgentChildren([]);
    assert.equal(emptyChildren.length, 1);
    assert.equal(emptyChildren[0].label, 'No agents are actively working.');

    const populatedChildren = buildActiveAgentChildren([
      ['engineer', { status: 'working', issue: 42 }],
      ['reviewer', { status: 'idle' }],
    ]);

    assert.equal(populatedChildren.length, 2);
    assert.equal(populatedChildren[0].command?.command, 'agentx.showIssue');
    assert.equal(populatedChildren[1].command?.command, 'agentx.showStatus');
  });

  it('builds issue children and caps the list to five items', () => {
    const emptyChildren = buildIssueChildren([]);
    assert.equal(emptyChildren.length, 1);
    assert.equal(emptyChildren[0].label, 'No open local issues found.');

    const issueChildren = buildIssueChildren([
      { number: 1, title: 'One', status: 'Backlog' },
      { number: 2, title: 'Two', status: 'Backlog' },
      { number: 3, title: 'Three', status: 'Backlog' },
      { number: 4, title: 'Four', status: 'Backlog' },
      { number: 5, title: 'Five', status: 'Backlog' },
      { number: 6, title: 'Six', status: 'Backlog' },
    ]);

    assert.equal(issueChildren.length, 5);
    assert.ok(String(issueChildren[0].label).includes('#1 One'));
  });

  it('builds the static action children list', () => {
    const children = buildActionChildren();

    assert.ok(children.some((item) => item.label === 'Brainstorm'));
    assert.ok(children.some((item) => item.label === 'Generate digest'));
  });

  it('builds workflow guidance children for missing and populated snapshots', () => {
    const emptyChildren = buildWorkflowGuidanceChildren(undefined);
    assert.equal(emptyChildren.length, 1);
    assert.equal(emptyChildren[0].label, 'Open a workspace folder to resolve workflow guidance.');

    const populatedChildren = buildWorkflowGuidanceChildren({
      currentCheckpoint: 'Plan',
      rationale: 'A plan exists but review evidence is missing.',
      recommendedAction: 'Kick off review',
      recommendedCommand: 'agentx.kickoffReview',
      recommendedCommandTitle: 'Kick Off Review',
      planDeepening: { allowed: true },
      reviewKickoff: { allowed: true },
      blockers: ['Waiting on review evidence'],
    } as any);

    assert.equal(populatedChildren[0].label, 'Kick off review');
    assert.ok(populatedChildren.some((item) => item.label === 'Deepen plan'));
    assert.ok(populatedChildren.some((item) => item.label === 'Kick off review'));
    assert.ok(populatedChildren.some((item) => item.label === 'Blocker'));
  });
});