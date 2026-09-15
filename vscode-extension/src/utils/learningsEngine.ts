import * as fs from 'fs';
import * as path from 'path';
import { readHarnessState } from './harnessState';
import { resolveWorkspaceRuntimeAssetPath } from './runtimeAssets';
import {
 CATEGORY_PREFERENCES,
 DEFAULT_QUERY,
 extractBullets,
 extractFirstParagraph,
 extractSection,
 getEvidenceScore,
 getRecencyScore,
 getValidationScore,
 listLearningFiles,
 parseFrontmatter,
 parseList,
 stripFrontmatter,
 tokenize,
} from './learningsInternals';
import type {
 LearningCaptureTarget,
 LearningEvidenceStrength,
 LearningRecord,
 LearningValidationState,
 LearningsIntent,
 RankedLearning,
} from './learningsTypes';
import {
 getPromotableReviewFindings,
 loadReviewFindingRecords,
} from '../review/review-findings';

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
   '- If this work produces a new reusable pattern, capture it after review in `docs/artifacts/learnings/LEARNING-<issue>.md`.',
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
 const learningsPath = 'docs/artifacts/learnings/LEARNING-<issue>.md';
 const resolvedGuidePath = resolveWorkspaceRuntimeAssetPath(root, guidePath);

 const lines = [
  '**Knowledge Capture Guidance**',
  '',
  'Trigger model:',
  '- **Mandatory** when the finished work creates reusable workflow, architecture, review, or operator guidance.',
  '- **Optional** when the work is useful but narrow, local, or low-leverage.',
  '- **Skip** when the outcome is trivial, transient, or already captured elsewhere.',
  '',
  'Evidence tiers:',
  '- Observations: raw runtime evidence such as evaluator notes, logs, traces, or captured execution facts. These help review, but they are not reusable guidance by default.',
  '- Findings: durable review problems or follow-up items that may need promotion into the backlog.',
  '- Learnings: curated reusable guidance that has enough validation to preserve across sessions.',
  '',
  'Operator-facing path:',
  '- Finish review first, then decide whether capture is mandatory, optional, or skipped.',
  `- Store curated capture artifacts under \`${learningsPath}\` and link them back to the issue, ADR/spec, review, and other source artifacts.`,
  '',
  'Autonomous execution path:',
  '- Frontier should resolve the same capture decision after review and include the resulting learning artifact or skip rationale in its close-out summary.',
  '- Keep the flow advisory-first until stronger automation is proven.',
 ];

 if (resolvedGuidePath) {
  lines.push('', `Reference guide: \`${resolvedGuidePath}\``);
 }

 return lines.join('\n');
}

export function getLearningCaptureTarget(root: string): LearningCaptureTarget | undefined {
 const harnessState = readHarnessState(root);
 const activeThread = [...harnessState.threads].reverse().find((thread) => thread.status === 'active');
 if (!activeThread) {
  return undefined;
 }

 return {
  issueNumber: activeThread.issueNumber ?? undefined,
  title: activeThread.title,
  taskType: activeThread.taskType,
  planPath: activeThread.planPath,
 };
}

export function renderBrainstormGuidanceMarkdown(
 root: string,
 query: string,
 records: ReadonlyArray<RankedLearning>,
): string {
 const target = getLearningCaptureTarget(root);
 const lines: string[] = [
  '**Brainstorm**',
  '',
  target
   ? `Active context: ${target.title}${target.issueNumber ? ` (#${target.issueNumber})` : ''}`
   : 'Active context: no active harness thread detected.',
  `Query: ${query}`,
  '',
  'Clarify before planning:',
  '- What problem are we actually solving, and what is explicitly out of scope?',
  '- Which existing repo patterns, review findings, or learnings should constrain the solution?',
  '- What evidence will prove the work is done: tests, validation, review artifact, or capture artifact?',
  '- What is the smallest change that still preserves future reuse and review quality?',
  '',
 ];

 if (records.length === 0) {
  lines.push('No planning learnings matched the current context.', '');
 } else {
  lines.push('Top planning learnings:', '');
  for (const record of records) {
   lines.push(`- **${record.title}** (${record.relativePath})`);
   if (record.summary) {
    lines.push(`  Summary: ${record.summary}`);
   }
   if (record.guidance.length > 0) {
    lines.push(`  Guidance: ${record.guidance[0]}`);
   }
  }
  lines.push('');
 }

 lines.push(
  'Next actions:',
  '- Run `frontier.runWorkflow` once the approach is narrowed enough to execute.',
  '- Re-check `Planning learnings` after the problem statement changes.',
 );

 return lines.join('\n');
}

export function renderCompoundLoopMarkdown(root: string): string {
 const captureQuery = getDefaultLearningsQuery(root, 'capture');
 const captureLearnings = rankLearnings(root, 'capture', captureQuery);
 const findings = loadReviewFindingRecords(root);
 const promotable = getPromotableReviewFindings(root);
 const target = getLearningCaptureTarget(root);
 const harnessState = readHarnessState(root);
 const openFindings = findings.filter((record) => record.status !== 'Done');

 const lines: string[] = [
  '**Compound Loop**',
  '',
  target
   ? `Active context: ${target.title}${target.issueNumber ? ` (#${target.issueNumber})` : ''}`
   : 'Active context: no active harness thread detected.',
  `Runtime observations: ${harnessState.evidence.length}`,
  `Open review findings: ${openFindings.length}`,
  `Promotable findings: ${promotable.length}`,
  `Curated capture candidates: ${captureLearnings.length}`,
  `Capture target: docs/artifacts/learnings/LEARNING-${target?.issueNumber ?? '<issue>'}.md`,
  '',
  'Tier checks:',
  '- Observations: confirm the raw runtime evidence is attached to the review or execution context.',
  '- Findings: decide whether any open or promotable review finding must be promoted before closeout.',
  '- Learnings: only create a curated learning when the outcome is reusable and validated enough to preserve.',
  '',
  'Compound checks:',
  '- Has review finished with enough evidence to preserve a reusable learning?',
  '- Should any durable review finding be promoted before the loop closes?',
  '- Is there a skip rationale if capture is intentionally not created?',
  '',
 ];

 if (captureLearnings.length > 0) {
  lines.push('Relevant capture learnings:', '');
  for (const record of captureLearnings) {
   lines.push(`- **${record.title}** (${record.relativePath})`);
   if (record.guidance.length > 0) {
    lines.push(`  Guidance: ${record.guidance[0]}`);
   }
  }
  lines.push('');
 }

 lines.push(
  'Recommended next actions:',
  '- Create or update a curated learning capture artifact.',
  '- Review durable findings and promote any required follow-up into the backlog.',
  '- Record an explicit skip rationale if no capture is warranted.',
  '',
  renderCaptureGuidanceMarkdown(root),
 );

 return lines.join('\n').trim();
}