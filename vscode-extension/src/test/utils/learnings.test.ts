import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getLearningCaptureTarget,
  loadLearningRecords,
  rankLearnings,
  renderBrainstormGuidanceMarkdown,
  renderCaptureGuidanceMarkdown,
  renderCompoundLoopMarkdown,
} from '../../utils/learnings';

describe('learnings utility', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-learnings-'));
    fs.mkdirSync(path.join(tmpDir, 'docs', 'artifacts', 'learnings'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'guides'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'artifacts', 'learnings', 'LEARNING-162.md'),
      [
        '---',
        'id: LEARNING-162',
        'title: Separate curated learnings from runtime observations',
        'category: memory',
        'subcategory: retrieval-ranking',
        'phases: planning,review',
        'validation: approved',
        'evidence: high',
        'mode: shared',
        'keywords: learnings,metadata,ranking,retrieval,planning,review',
        'sources: docs/artifacts/adr/ADR-162.md,docs/artifacts/specs/SPEC-162.md',
        '---',
        '## Summary',
        'Use curated durable learnings for retrieval, not raw observations.',
        '',
        '## Guidance',
        '- Filter by metadata before ranking.',
        '- Keep planning and review retrieval deterministic.',
        '',
        '## Use When',
        '- Designing ranked learnings retrieval.',
        '',
        '## Avoid',
        '- Treating every session note as durable knowledge.',
        '',
      ].join('\n'),
      'utf-8',
    );

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'artifacts', 'learnings', 'LEARNING-163.md'),
      [
        '---',
        'id: LEARNING-163',
        'title: Use a five-phase knowledge-compounding lifecycle',
        'category: workflow-contract',
        'subcategory: compound-capture',
        'phases: planning,review,capture',
        'validation: approved',
        'evidence: high',
        'mode: shared',
        'keywords: workflow,compound capture,review,handoff,artifacts,plan,progress',
        'sources: docs/artifacts/adr/ADR-163.md,docs/artifacts/specs/SPEC-163.md',
        '---',
        '## Summary',
        'Treat compound capture as a formal post-review phase over existing artifacts.',
        '',
        '## Guidance',
        '- Resolve capture after review.',
        '- Reuse existing artifact families.',
        '',
        '## Use When',
        '- Defining lifecycle handoffs.',
        '',
        '## Avoid',
        '- Creating a sidecar learning backlog.',
        '',
      ].join('\n'),
      'utf-8',
    );

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guides', 'KNOWLEDGE-REVIEW-WORKFLOWS.md'),
      '# Knowledge And Review Workflows\n',
      'utf-8',
    );

    fs.mkdirSync(path.join(tmpDir, '.agentx', 'state'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.agentx', 'state', 'harness-state.json'),
      JSON.stringify({
        version: 1,
        threads: [{
          id: 'thread-1',
          title: 'Improve compound capture',
          taskType: 'story',
          status: 'active',
          issueNumber: 163,
          planPath: 'docs/plans/EXEC-PLAN-163.md',
          startedAt: '2026-03-12T10:00:00Z',
          updatedAt: '2026-03-12T10:10:00Z',
        }],
        turns: [],
        items: [],
        evidence: [],
      }, null, 2),
      'utf-8',
    );

    fs.mkdirSync(path.join(tmpDir, 'docs', 'artifacts', 'reviews', 'findings'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'artifacts', 'reviews', 'findings', 'FINDING-163-001.md'),
      [
        '---',
        'id: FINDING-163-001',
        'title: Promote reusable review outcome',
        'source_review: docs/artifacts/reviews/REVIEW-163.md',
        'source_issue: 163',
        'severity: high',
        'status: Backlog',
        'priority: p1',
        'owner: reviewer',
        'promotion: required',
        'suggested_type: story',
        'labels: type:story,priority:p1',
        'dependencies: ',
        'evidence: docs/artifacts/reviews/REVIEW-163.md',
        'backlog_issue: ',
        'created: 2026-03-12',
        'updated: 2026-03-12',
        '---',
        '',
        '# Review Finding: Promote reusable review outcome',
        '',
        '## Summary',
        '',
        'Capture the reusable review outcome.',
        '',
        '## Impact',
        '',
        '- Future loops lose the result if it is not captured.',
        '',
        '## Recommended Action',
        '',
        '- Promote the finding and preserve a learning artifact.',
        '',
        '## Promotion Notes',
        '',
        '- Required.',
        '',
      ].join('\n'),
      'utf-8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads curated learning records from docs/artifacts/learnings', () => {
    const records = loadLearningRecords(tmpDir);
    assert.equal(records.length, 2);
    assert.equal(records[0].id, 'LEARNING-162');
    assert.ok(records[0].guidance.includes('Filter by metadata before ranking.'));
  });

  it('ranks workflow-contract learnings highly for planning workflow queries', () => {
    const records = rankLearnings(tmpDir, 'planning', 'workflow handoff review capture');
    assert.equal(records.length, 2);
    assert.equal(records[0].id, 'LEARNING-163');
    assert.ok(records[0].rationale.includes('phase:planning'));
  });

  it('renders capture guidance with the expected artifact location', () => {
    const markdown = renderCaptureGuidanceMarkdown(tmpDir);
    assert.ok(markdown.includes('docs/artifacts/learnings/LEARNING-<issue>.md'));
    assert.ok(markdown.includes('Reference guide'));
  });

  it('resolves the active harness thread as the default learning capture target', () => {
    const target = getLearningCaptureTarget(tmpDir);
    assert.equal(target?.issueNumber, 163);
    assert.equal(target?.title, 'Improve compound capture');
  });

  it('renders brainstorm guidance with planning learnings', () => {
    const markdown = renderBrainstormGuidanceMarkdown(
      tmpDir,
      'workflow review capture',
      rankLearnings(tmpDir, 'planning', 'workflow review capture'),
    );
    assert.ok(markdown.includes('Brainstorm'));
    assert.ok(markdown.includes('Top planning learnings'));
    assert.ok(markdown.includes('Use a five-phase knowledge-compounding lifecycle'));
  });

  it('renders compound loop guidance with review findings and capture steps', () => {
    const markdown = renderCompoundLoopMarkdown(tmpDir);
    assert.ok(markdown.includes('Compound Loop'));
    assert.ok(markdown.includes('Promotable findings: 1'));
    assert.ok(markdown.includes('Create or update a curated learning capture artifact.'));
  });
});
