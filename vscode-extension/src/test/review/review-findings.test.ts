import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildReviewFindingIssueDraft,
  loadReviewFindingRecords,
  promoteReviewFinding,
  renderReviewFindingsMarkdown,
} from '../../review/review-findings';

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('review findings', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-review-findings-'));
    writeFile(tmpDir, 'docs/reviews/findings/FINDING-164-001.md', [
      '---',
      'id: FINDING-164-001',
      'title: Add tracked follow-up for deferred parity gaps',
      'source_review: docs/reviews/REVIEW-164.md',
      'source_issue: 164',
      'severity: high',
      'status: Backlog',
      'priority: p1',
      'owner: reviewer',
      'promotion: required',
      'suggested_type: story',
      'labels: type:story,needs:changes',
      'dependencies: #163,#165',
      'evidence: docs/reviews/REVIEW-164.md,docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md',
      'backlog_issue: ',
      'created: 2026-03-12',
      'updated: 2026-03-12',
      '---',
      '',
      '# Review Finding: Add tracked follow-up for deferred parity gaps',
      '',
      '## Summary',
      '',
      'Deferred parity findings should become normal tracked work.',
      '',
      '## Impact',
      '',
      '- Important review outcomes can disappear after the current session.',
      '',
      '## Recommended Action',
      '',
      '- Promote approved parity gaps into the AgentX backlog.',
      '',
      '## Promotion Notes',
      '',
      '- Required because this gap affects future review workflow quality.',
      '',
    ].join('\n'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads durable review finding records from docs/reviews/findings', () => {
    const records = loadReviewFindingRecords(tmpDir);
    assert.equal(records.length, 1);
    assert.equal(records[0].id, 'FINDING-164-001');
    assert.equal(records[0].promotion, 'required');
    assert.equal(records[0].dependencies.length, 2);
  });

  it('builds a backlog-ready issue draft with metadata, dependencies, and evidence', () => {
    const record = loadReviewFindingRecords(tmpDir)[0];
    const draft = buildReviewFindingIssueDraft(record);

    assert.ok(draft.title.includes('Resolve review finding'));
    assert.ok(draft.labels.includes('priority:p1'));
    assert.ok(draft.body.includes('## Dependencies'));
    assert.ok(draft.body.includes('## Evidence Links'));
    assert.ok(draft.body.includes('Promote approved parity gaps'));
  });

  it('renders a markdown summary with open and promotable finding counts', () => {
    const markdown = renderReviewFindingsMarkdown(loadReviewFindingRecords(tmpDir));
    assert.ok(markdown.includes('Open findings: 1'));
    assert.ok(markdown.includes('Promotable findings: 1'));
    assert.ok(markdown.includes('FINDING-164-001'));
    assert.ok(markdown.includes('Reference guide: docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md'));
  });

  it('promotes a finding into a normal AgentX issue and links it back', async () => {
    const calls: Array<{ readonly subcommand: string; readonly args: ReadonlyArray<string> }> = [];
    const agentx = {
      workspaceRoot: tmpDir,
      runCli: async (subcommand: string, args: string[]) => {
        calls.push({ subcommand, args });
        return 'Created issue #73: Resolve review finding';
      },
    } as any;

    const result = await promoteReviewFinding(agentx, 'FINDING-164-001');
    const updated = loadReviewFindingRecords(tmpDir)[0];

    assert.equal(result.issueNumber, 73);
    assert.equal(result.alreadyPromoted, false);
    assert.equal(updated.backlogIssue, 73);
    assert.equal(updated.status, 'Backlog');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].subcommand, 'issue');
    assert.ok(calls[0].args.includes('--title-base64'));
    assert.ok(calls[0].args.includes('--body-base64'));
  });
});