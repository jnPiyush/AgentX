import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadLearningRecords,
  rankLearnings,
  renderCaptureGuidanceMarkdown,
} from '../../utils/learnings';

describe('learnings utility', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-learnings-'));
    fs.mkdirSync(path.join(tmpDir, 'docs', 'learnings'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'guides'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'learnings', 'LEARNING-162.md'),
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
        'sources: docs/adr/ADR-162.md,docs/specs/SPEC-162.md',
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
      path.join(tmpDir, 'docs', 'learnings', 'LEARNING-163.md'),
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
        'sources: docs/adr/ADR-163.md,docs/specs/SPEC-163.md',
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
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads curated learning records from docs/learnings', () => {
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
    assert.ok(markdown.includes('docs/learnings/LEARNING-<issue>.md'));
    assert.ok(markdown.includes('Reference guide'));
  });
});
