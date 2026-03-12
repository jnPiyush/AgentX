import * as fs from 'fs';
import * as path from 'path';
import { readHarnessState } from './harnessState';

export type LearningsIntent = 'planning' | 'review' | 'capture';
export type LearningValidationState = 'draft' | 'reviewed' | 'approved' | 'superseded' | 'archived';
export type LearningEvidenceStrength = 'low' | 'medium' | 'high';

export interface LearningRecord {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly subcategory: string;
  readonly phases: ReadonlyArray<string>;
  readonly validation: LearningValidationState;
  readonly evidence: LearningEvidenceStrength;
  readonly mode: string;
  readonly keywords: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<string>;
  readonly summary: string;
  readonly guidance: ReadonlyArray<string>;
  readonly useWhen: ReadonlyArray<string>;
  readonly avoid: ReadonlyArray<string>;
  readonly relativePath: string;
  readonly updatedAt: number;
}

export interface RankedLearning extends LearningRecord {
  readonly score: number;
  readonly matchedSignals: ReadonlyArray<string>;
  readonly rationale: string;
}

const LEARNINGS_DIR = path.join('docs', 'learnings');

const CATEGORY_PREFERENCES: Record<LearningsIntent, ReadonlyArray<string>> = {
  planning: ['workflow-contract', 'memory', 'architecture', 'validation'],
  review: ['review', 'validation', 'workflow-contract', 'memory'],
  capture: ['workflow-contract', 'memory', 'review'],
};

const DEFAULT_QUERY: Record<LearningsIntent, string> = {
  planning: 'planning decomposition implementation workflow',
  review: 'review findings validation workflow',
  capture: 'knowledge capture solved problem reusable learning',
};

function listLearningFiles(root: string): string[] {
  const learningsDir = path.join(root, LEARNINGS_DIR);
  if (!fs.existsSync(learningsDir)) {
    return [];
  }

  return fs.readdirSync(learningsDir)
    .filter((entry) => /^LEARNING-.+\.md$/i.test(entry))
    .map((entry) => path.join(learningsDir, entry))
    .sort();
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }
  return fields;
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(
    `^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`,
    'm',
  );
  const match = body.match(pattern);
  return match ? match[1].trim() : '';
}

function extractFirstParagraph(section: string): string {
  const trimmed = section.trim();
  if (!trimmed) {
    return '';
  }

  const paragraph = trimmed.split(/\r?\n\r?\n/)[0];
  return paragraph.replace(/\r?\n/g, ' ').trim();
}

function extractBullets(section: string): string[] {
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function tokenize(value: string): string[] {
  return value.toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function getEvidenceScore(value: LearningEvidenceStrength): number {
  switch (value) {
    case 'high':
      return 4;
    case 'medium':
      return 2;
    default:
      return 0;
  }
}

function getValidationScore(value: LearningValidationState): number {
  switch (value) {
    case 'approved':
      return 4;
    case 'reviewed':
      return 2;
    case 'superseded':
    case 'archived':
      return -100;
    default:
      return 0;
  }
}

function getRecencyScore(updatedAt: number): number {
  const ageMs = Date.now() - updatedAt;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  if (ageMs <= thirtyDaysMs) {
    return 2;
  }
  if (ageMs <= ninetyDaysMs) {
    return 1;
  }
  return 0;
}

export function loadLearningRecords(root: string): LearningRecord[] {
  const records: LearningRecord[] = [];

  for (const filePath of listLearningFiles(root)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(raw);
    if (!frontmatter.id || !frontmatter.title) {
      continue;
    }

    const body = stripFrontmatter(raw);
    const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
    const stat = fs.statSync(filePath);

    const summarySection = extractSection(body, 'Summary');
    const guidanceSection = extractSection(body, 'Guidance');
    const useWhenSection = extractSection(body, 'Use When');
    const avoidSection = extractSection(body, 'Avoid');

    records.push({
      id: frontmatter.id,
      title: frontmatter.title,
      category: frontmatter.category ?? 'workflow-contract',
      subcategory: frontmatter.subcategory ?? 'general',
      phases: parseList(frontmatter.phases),
      validation: (frontmatter.validation ?? 'draft') as LearningValidationState,
      evidence: (frontmatter.evidence ?? 'medium') as LearningEvidenceStrength,
      mode: frontmatter.mode ?? 'shared',
      keywords: parseList(frontmatter.keywords),
      sources: parseList(frontmatter.sources),
      summary: extractFirstParagraph(summarySection),
      guidance: extractBullets(guidanceSection),
      useWhen: extractBullets(useWhenSection),
      avoid: extractBullets(avoidSection),
      relativePath,
      updatedAt: stat.mtimeMs,
    });
  }

  return records;
}

export function getDefaultLearningsQuery(root: string, intent: LearningsIntent): string {
  const harnessState = readHarnessState(root);
  const activeThread = [...harnessState.threads].reverse().find((thread) => thread.status === 'active');
  if (!activeThread) {
    return DEFAULT_QUERY[intent];
  }

  return `${activeThread.title} ${activeThread.taskType}`.trim();
}

export function rankLearnings(
  root: string,
  intent: LearningsIntent,
  query?: string,
  limit = 3,
): RankedLearning[] {
  const effectiveQuery = (query ?? getDefaultLearningsQuery(root, intent)).trim();
  const queryTokens = new Set(tokenize(effectiveQuery));
  const preferredCategories = CATEGORY_PREFERENCES[intent];

  const ranked: RankedLearning[] = [];

  for (const record of loadLearningRecords(root)) {
    const matchedSignals: string[] = [];
    let score = 0;

    const validationScore = getValidationScore(record.validation);
    if (validationScore <= -100) {
      continue;
    }
    score += validationScore;
    if (validationScore > 0) {
      matchedSignals.push(`validation:${record.validation}`);
    }

    const evidenceScore = getEvidenceScore(record.evidence);
    score += evidenceScore;
    if (evidenceScore > 0) {
      matchedSignals.push(`evidence:${record.evidence}`);
    }

    const phaseMatch = record.phases.some((phase) => phase.toLowerCase() === intent);
    if (phaseMatch) {
      score += 5;
      matchedSignals.push(`phase:${intent}`);
    }

    const categoryIndex = preferredCategories.indexOf(record.category);
    if (categoryIndex >= 0) {
      score += Math.max(1, 4 - categoryIndex);
      matchedSignals.push(`category:${record.category}`);
    }

    const recordTokens = new Set([
      ...tokenize(record.title),
      ...tokenize(record.summary),
      ...record.keywords.flatMap((keyword) => tokenize(keyword)),
    ]);
    const keywordOverlap = [...queryTokens].filter((token) => recordTokens.has(token)).length;
    if (keywordOverlap > 0) {
      score += keywordOverlap * 3;
      matchedSignals.push(`keywords:${keywordOverlap}`);
    }

    const recencyScore = getRecencyScore(record.updatedAt);
    score += recencyScore;
    if (recencyScore > 0) {
      matchedSignals.push('recent');
    }

    const sourceScore = Math.min(2, record.sources.length);
    score += sourceScore;
    if (sourceScore > 0) {
      matchedSignals.push(`sources:${record.sources.length}`);
    }

    const rationale = matchedSignals.length > 0
      ? `Ranked by ${matchedSignals.join(', ')}`
      : 'Ranked as a low-signal fallback candidate';

    ranked.push({
      ...record,
      score,
      matchedSignals,
      rationale,
    });
  }

  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.title.localeCompare(right.title);
  });

  return ranked.slice(0, limit);
}

export function renderRankedLearningsMarkdown(
  intent: LearningsIntent,
  records: ReadonlyArray<RankedLearning>,
  query: string,
): string {
  const heading = intent === 'planning'
    ? 'Planning Learnings'
    : intent === 'review'
      ? 'Review Learnings'
      : 'Capture Learnings';

  if (records.length === 0) {
    return [
      `**${heading}**`,
      '',
      `No curated learnings matched the current context${query ? ` for "${query}"` : ''}.`,
      '',
      'Fallback:',
      '- Continue with the normal workflow and rely on the active issue, plan, ADR, spec, and review artifacts.',
      '- If this work produces a new reusable pattern, capture it after review in `docs/learnings/LEARNING-<issue>.md`.',
    ].join('\n');
  }

  const lines: string[] = [
    `**${heading}**`,
    '',
    query ? `Context: ${query}` : 'Context: default workspace context',
    '',
  ];

  for (const record of records) {
    lines.push(`- **${record.title}** (${record.relativePath})`);
    lines.push(`  Score: ${record.score}`);
    lines.push(`  Why it surfaced: ${record.rationale}`);
    if (record.summary) {
      lines.push(`  Summary: ${record.summary}`);
    }
    for (const guidance of record.guidance.slice(0, 3)) {
      lines.push(`  Guidance: ${guidance}`);
    }
    if (record.sources.length > 0) {
      lines.push(`  Sources: ${record.sources.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function renderRankedLearningsText(
  intent: LearningsIntent,
  records: ReadonlyArray<RankedLearning>,
  query: string,
): string {
  return renderRankedLearningsMarkdown(intent, records, query).replace(/\*\*/g, '');
}

export function renderCaptureGuidanceMarkdown(root?: string): string {
  const guidePath = 'docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md';
  const learningsPath = 'docs/learnings/LEARNING-<issue>.md';
  const hasGuide = root ? fs.existsSync(path.join(root, guidePath)) : false;

  const lines = [
    '**Knowledge Capture Guidance**',
    '',
    'Trigger model:',
    '- **Mandatory** when the finished work creates reusable workflow, architecture, review, or operator guidance.',
    '- **Optional** when the work is useful but narrow, local, or low-leverage.',
    '- **Skip** when the outcome is trivial, transient, or already captured elsewhere.',
    '',
    'Operator-facing path:',
    '- Finish review first, then decide whether capture is mandatory, optional, or skipped.',
    `- Store curated capture artifacts under \`${learningsPath}\` and link them back to the issue, ADR/spec, review, and other source artifacts.`,
    '',
    'Autonomous execution path:',
    '- AgentX should resolve the same capture decision after review and include the resulting learning artifact or skip rationale in its close-out summary.',
    '- Keep the flow advisory-first until stronger automation is proven.',
  ];

  if (hasGuide) {
    lines.push('', `Reference guide: \`${guidePath}\``);
  }

  return lines.join('\n');
}
