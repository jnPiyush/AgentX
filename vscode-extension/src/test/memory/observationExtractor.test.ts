import { strict as assert } from 'assert';
import { ObservationExtractor } from '../../memory/observationExtractor';
import { MAX_OBSERVATIONS_PER_CAPTURE } from '../../memory/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const AGENT = 'engineer';
const ISSUE = 42;
const SESSION = 'session-abc123';

function makeSummary(sections: {
  decisions?: string[];
  codeChanges?: string[];
  errors?: string[];
  keyFacts?: string[];
}): string {
  const parts: string[] = [
    '## Context Compaction Summary',
    '',
    'Compacted from 10 messages (~500 tokens).',
    '',
  ];

  if (sections.decisions?.length) {
    parts.push('### Decisions', ...sections.decisions.map((d) => `- ${d}`), '');
  }
  if (sections.codeChanges?.length) {
    parts.push('### Code Changes', ...sections.codeChanges.map((c) => `- ${c}`), '');
  }
  if (sections.errors?.length) {
    parts.push('### Errors Encountered', ...sections.errors.map((e) => `- ${e}`), '');
  }
  if (sections.keyFacts?.length) {
    parts.push('### Key Facts', ...sections.keyFacts.map((f) => `- ${f}`), '');
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// ObservationExtractor
// ---------------------------------------------------------------------------

describe('ObservationExtractor', () => {
  let extractor: ObservationExtractor;

  beforeEach(() => {
    extractor = new ObservationExtractor();
  });

  // -------------------------------------------------------------------------
  // Basic extraction
  // -------------------------------------------------------------------------

  it('returns empty array for empty summary', () => {
    const result = extractor.extractObservations('', AGENT, ISSUE, SESSION);
    assert.equal(result.length, 0);
  });

  it('returns empty array for whitespace-only summary', () => {
    const result = extractor.extractObservations('   \n\t  ', AGENT, ISSUE, SESSION);
    assert.equal(result.length, 0);
  });

  it('extracts decision observations from Decisions section', () => {
    const summary = makeSummary({
      decisions: ['decided to use JSON storage for Phase 1'],
    });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 1);
    assert.equal(result[0].category, 'decision');
    assert.ok(result[0].content.includes('decided to use JSON storage'));
  });

  it('extracts code-change observations from Code Changes section', () => {
    const summary = makeSummary({
      codeChanges: ['created file src/memory/types.ts', 'modified src/extension.ts'],
    });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 2);
    assert.ok(result.every((o) => o.category === 'code-change'));
    assert.ok(result[0].content.includes('src/memory/types.ts'));
  });

  it('extracts error observations from Errors Encountered section', () => {
    const summary = makeSummary({
      errors: ['error: Could not parse lock file -- stale lock detected'],
    });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 1);
    assert.equal(result[0].category, 'error');
    assert.ok(result[0].content.includes('stale lock'));
  });

  it('extracts key-fact observations from Key Facts section', () => {
    const summary = makeSummary({
      keyFacts: ['Important: memory budget is capped at 20K tokens'],
    });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 1);
    assert.equal(result[0].category, 'key-fact');
  });

  it('extracts observations from multiple sections', () => {
    const summary = makeSummary({
      decisions: ['decided to reuse FileLockManager'],
      codeChanges: ['created observationStore.ts'],
      errors: ['error: ENOENT on first run (expected, dir created)'],
      keyFacts: ['Important: manifest cache TTL is 30 seconds'],
    });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 4);
    const categories = result.map((o) => o.category);
    assert.ok(categories.includes('decision'));
    assert.ok(categories.includes('code-change'));
    assert.ok(categories.includes('error'));
    assert.ok(categories.includes('key-fact'));
  });

  // -------------------------------------------------------------------------
  // Observation fields
  // -------------------------------------------------------------------------

  it('sets agent, issueNumber, sessionId correctly', () => {
    const summary = makeSummary({ decisions: ['decided to use per-issue JSON files'] });
    const [obs] = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(obs.agent, AGENT);
    assert.equal(obs.issueNumber, ISSUE);
    assert.equal(obs.sessionId, SESSION);
  });

  it('generates unique IDs for each observation', () => {
    const summary = makeSummary({
      decisions: ['decided to use JSON', 'decided to use 30s cache TTL'],
    });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    const ids = result.map((o) => o.id);
    // All IDs must be unique strings.
    assert.equal(new Set(ids).size, ids.length);
    // IDs must follow the obs-{agent}-{issue} prefix.
    assert.ok(ids.every((id) => id.startsWith(`obs-${AGENT}-${ISSUE}`)));
  });

  it('sets a valid ISO-8601 timestamp', () => {
    const before = new Date().toISOString();
    const summary = makeSummary({ decisions: ['decided to store observations'] });
    const [obs] = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);
    const after = new Date().toISOString();

    assert.ok(obs.timestamp >= before);
    assert.ok(obs.timestamp <= after);
  });

  it('estimates tokens > 0 for non-trivial content', () => {
    const summary = makeSummary({ decisions: ['decided to use JSON storage for Phase 1'] });
    const [obs] = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.ok(obs.tokens > 0);
  });

  it('truncates summary to at most 243 chars (240 + 3 for ellipsis)', () => {
    const longContent = 'decided to use a very long decision text: ' + 'x'.repeat(300);
    const summary = makeSummary({ decisions: [longContent] });
    const [obs] = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.ok(obs.summary.length <= 243, `summary length ${obs.summary.length} exceeds 243`);
  });

  it('does not truncate summary for short content', () => {
    const shortContent = 'decided to use JSON storage';
    const summary = makeSummary({ decisions: [shortContent] });
    const [obs] = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(obs.summary, shortContent);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('skips bullet items shorter than MIN_CONTENT_LENGTH', () => {
    // Very short bullets (< 10 chars) should be ignored.
    const summary = makeSummary({ decisions: ['short', 'ok this is longer enough to keep'] });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 1);
    assert.ok(result[0].content.includes('longer enough'));
  });

  it('respects MAX_OBSERVATIONS_PER_CAPTURE limit', () => {
    const manyDecisions = Array.from(
      { length: MAX_OBSERVATIONS_PER_CAPTURE + 20 },
      (_, i) => `decided to do thing number ${i + 1} which is important`,
    );
    const summary = makeSummary({ decisions: manyDecisions });
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.ok(
      result.length <= MAX_OBSERVATIONS_PER_CAPTURE,
      `extracted ${result.length} > MAX ${MAX_OBSERVATIONS_PER_CAPTURE}`,
    );
  });

  it('falls back to compaction-summary when no bullet sections are parsed', () => {
    // Plain text with no section headers or bullets.
    const summary = 'This is a plain text summary without any structured sections or bullet points.';
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 1);
    assert.equal(result[0].category, 'compaction-summary');
    assert.equal(result[0].content, summary);
  });

  it('handles asterisk bullets as well as dash bullets', () => {
    const summary = [
      '## Context Compaction Summary',
      '',
      '### Decisions',
      '* decided to use asterisk bullets too',
      '',
    ].join('\n');
    const result = extractor.extractObservations(summary, AGENT, ISSUE, SESSION);

    assert.equal(result.length, 1);
    assert.equal(result[0].category, 'decision');
    assert.ok(result[0].content.includes('asterisk bullets'));
  });
});
