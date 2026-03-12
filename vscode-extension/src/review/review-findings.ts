import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';

export type ReviewFindingSeverity = 'high' | 'medium' | 'low';
export type ReviewFindingStatus = 'Backlog' | 'Ready' | 'In Progress' | 'In Review' | 'Done';
export type ReviewFindingPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type ReviewFindingPromotion = 'review-only' | 'recommended' | 'required';
export type ReviewFindingType = 'bug' | 'story' | 'docs';

export interface ReviewFindingRecord {
  readonly id: string;
  readonly title: string;
  readonly sourceReview: string;
  readonly sourceIssue: number | undefined;
  readonly severity: ReviewFindingSeverity;
  readonly status: ReviewFindingStatus;
  readonly priority: ReviewFindingPriority;
  readonly owner: string;
  readonly promotion: ReviewFindingPromotion;
  readonly suggestedType: ReviewFindingType;
  readonly labels: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<string>;
  readonly backlogIssue: number | undefined;
  readonly created: string;
  readonly updated: string;
  readonly summary: string;
  readonly impact: ReadonlyArray<string>;
  readonly recommendedAction: ReadonlyArray<string>;
  readonly promotionNotes: ReadonlyArray<string>;
  readonly relativePath: string;
}

export interface ReviewFindingIssueDraft {
  readonly title: string;
  readonly body: string;
  readonly labels: ReadonlyArray<string>;
}

export interface ReviewFindingPromotionResult {
  readonly finding: ReviewFindingRecord;
  readonly issueNumber: number;
  readonly alreadyPromoted: boolean;
}

const FINDINGS_DIR = path.join('docs', 'reviews', 'findings');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'm');
  const match = body.match(pattern);
  return match ? match[1].trim() : '';
}

function extractParagraph(section: string): string {
  const value = section.trim();
  if (!value) {
    return '';
  }

  return value.split(/\r?\n\r?\n/)[0].replace(/\r?\n/g, ' ').trim();
}

function extractBullets(section: string): string[] {
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function findingsRoot(root: string): string {
  return path.join(root, FINDINGS_DIR);
}

function findingFilePath(root: string, relativePath: string): string {
  return path.join(root, ...relativePath.split('/'));
}

function listFindingPaths(root: string): string[] {
  const directory = findingsRoot(root);
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((entry) => /^FINDING-.+\.md$/i.test(entry))
    .map((entry) => `${FINDINGS_DIR.replace(/\\/g, '/')}/${entry}`)
    .sort();
}

function normalizeStatus(value: string | undefined): ReviewFindingStatus {
  const allowed: ReadonlyArray<ReviewFindingStatus> = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done'];
  if (value && allowed.includes(value as ReviewFindingStatus)) {
    return value as ReviewFindingStatus;
  }
  return 'Backlog';
}

function normalizePriority(value: string | undefined): ReviewFindingPriority {
  const allowed: ReadonlyArray<ReviewFindingPriority> = ['p0', 'p1', 'p2', 'p3'];
  if (value && allowed.includes(value as ReviewFindingPriority)) {
    return value as ReviewFindingPriority;
  }
  return 'p2';
}

function normalizeSeverity(value: string | undefined): ReviewFindingSeverity {
  const allowed: ReadonlyArray<ReviewFindingSeverity> = ['high', 'medium', 'low'];
  if (value && allowed.includes(value as ReviewFindingSeverity)) {
    return value as ReviewFindingSeverity;
  }
  return 'medium';
}

function normalizePromotion(value: string | undefined): ReviewFindingPromotion {
  const allowed: ReadonlyArray<ReviewFindingPromotion> = ['review-only', 'recommended', 'required'];
  if (value && allowed.includes(value as ReviewFindingPromotion)) {
    return value as ReviewFindingPromotion;
  }
  return 'recommended';
}

function normalizeType(value: string | undefined): ReviewFindingType {
  const allowed: ReadonlyArray<ReviewFindingType> = ['bug', 'story', 'docs'];
  if (value && allowed.includes(value as ReviewFindingType)) {
    return value as ReviewFindingType;
  }
  return 'story';
}

function toUniqueLabels(record: ReviewFindingRecord): string[] {
  const labels = [...record.labels];
  if (!labels.some((label) => label.startsWith('type:'))) {
    labels.push(`type:${record.suggestedType}`);
  }
  if (!labels.some((label) => label.startsWith('priority:'))) {
    labels.push(`priority:${record.priority}`);
  }
  return [...new Set(labels)].sort();
}

function serializeList(values: ReadonlyArray<string>): string {
  return values.join(',');
}

function serializeFinding(record: ReviewFindingRecord): string {
  const lines = [
    '---',
    `id: ${record.id}`,
    `title: ${record.title}`,
    `source_review: ${record.sourceReview}`,
    `source_issue: ${record.sourceIssue ?? ''}`,
    `severity: ${record.severity}`,
    `status: ${record.status}`,
    `priority: ${record.priority}`,
    `owner: ${record.owner}`,
    `promotion: ${record.promotion}`,
    `suggested_type: ${record.suggestedType}`,
    `labels: ${serializeList(record.labels)}`,
    `dependencies: ${serializeList(record.dependencies)}`,
    `evidence: ${serializeList(record.evidence)}`,
    `backlog_issue: ${record.backlogIssue ?? ''}`,
    `created: ${record.created}`,
    `updated: ${record.updated}`,
    '---',
    '',
    `# Review Finding: ${record.title}`,
    '',
    '## Summary',
    '',
    record.summary || '{Add summary.}',
    '',
    '## Impact',
    '',
    ...(record.impact.length > 0 ? record.impact.map((item) => `- ${item}`) : ['- {Add impact.}']),
    '',
    '## Recommended Action',
    '',
    ...(record.recommendedAction.length > 0
      ? record.recommendedAction.map((item) => `- ${item}`)
      : ['- {Add recommended action.}']),
    '',
    '## Promotion Notes',
    '',
    ...(record.promotionNotes.length > 0
      ? record.promotionNotes.map((item) => `- ${item}`)
      : ['- {Add promotion notes.}']),
    '',
  ];

  return lines.join('\n');
}

function saveFinding(root: string, record: ReviewFindingRecord): void {
  const filePath = findingFilePath(root, record.relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serializeFinding(record), 'utf-8');
}

export function loadReviewFindingRecords(root: string): ReviewFindingRecord[] {
  const records: ReviewFindingRecord[] = [];

  for (const relativePath of listFindingPaths(root)) {
    const filePath = findingFilePath(root, relativePath);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(raw);
    if (!frontmatter.id || !frontmatter.title || !frontmatter.source_review) {
      continue;
    }

    const body = stripFrontmatter(raw);
    records.push({
      id: frontmatter.id,
      title: frontmatter.title,
      sourceReview: frontmatter.source_review,
      sourceIssue: frontmatter.source_issue ? Number(frontmatter.source_issue) : undefined,
      severity: normalizeSeverity(frontmatter.severity),
      status: normalizeStatus(frontmatter.status),
      priority: normalizePriority(frontmatter.priority),
      owner: frontmatter.owner || 'unassigned',
      promotion: normalizePromotion(frontmatter.promotion),
      suggestedType: normalizeType(frontmatter.suggested_type),
      labels: parseList(frontmatter.labels),
      dependencies: parseList(frontmatter.dependencies),
      evidence: parseList(frontmatter.evidence),
      backlogIssue: frontmatter.backlog_issue ? Number(frontmatter.backlog_issue) : undefined,
      created: frontmatter.created || '',
      updated: frontmatter.updated || '',
      summary: extractParagraph(extractSection(body, 'Summary')),
      impact: extractBullets(extractSection(body, 'Impact')),
      recommendedAction: extractBullets(extractSection(body, 'Recommended Action')),
      promotionNotes: extractBullets(extractSection(body, 'Promotion Notes')),
      relativePath,
    });
  }

  return records.sort((left, right) => left.id.localeCompare(right.id));
}

export function findReviewFindingById(root: string, findingId: string): ReviewFindingRecord | undefined {
  return loadReviewFindingRecords(root).find((record) => record.id.toLowerCase() === findingId.toLowerCase());
}

export function getPromotableReviewFindings(root: string): ReviewFindingRecord[] {
  return loadReviewFindingRecords(root).filter((record) => record.promotion !== 'review-only' && !record.backlogIssue);
}

export function buildReviewFindingIssueDraft(record: ReviewFindingRecord): ReviewFindingIssueDraft {
  const labels = toUniqueLabels(record);
  const bodyLines = [
    `## Source Review`,
    `- Finding: ${record.id}`,
    `- Review: ${record.sourceReview}`,
    `- Source Issue: ${record.sourceIssue ? `#${record.sourceIssue}` : 'unknown'}`,
    '',
    '## Finding Metadata',
    `- Severity: ${record.severity}`,
    `- Priority: ${record.priority}`,
    `- Owner: ${record.owner}`,
    `- Promotion: ${record.promotion}`,
    '',
    '## Summary',
    record.summary || 'No summary provided.',
    '',
    '## Impact',
    ...(record.impact.length > 0 ? record.impact.map((item) => `- ${item}`) : ['- Impact not captured in the finding record.']),
    '',
    '## Recommended Action',
    ...(record.recommendedAction.length > 0
      ? record.recommendedAction.map((item) => `- ${item}`)
      : ['- Recommended action not captured in the finding record.']),
  ];

  if (record.dependencies.length > 0) {
    bodyLines.push('', '## Dependencies', ...record.dependencies.map((item) => `- ${item}`));
  }

  if (record.evidence.length > 0) {
    bodyLines.push('', '## Evidence Links', ...record.evidence.map((item) => `- ${item}`));
  }

  if (record.promotionNotes.length > 0) {
    bodyLines.push('', '## Promotion Notes', ...record.promotionNotes.map((item) => `- ${item}`));
  }

  return {
    title: `Resolve review finding: ${record.title}`,
    body: bodyLines.join('\n'),
    labels,
  };
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function updatePromotedFinding(
  root: string,
  record: ReviewFindingRecord,
  issueNumber: number,
): ReviewFindingRecord {
  const nextRecord: ReviewFindingRecord = {
    ...record,
    backlogIssue: issueNumber,
    status: 'Backlog',
    updated: new Date().toISOString().slice(0, 10),
  };
  saveFinding(root, nextRecord);
  return nextRecord;
}

export async function promoteReviewFinding(
  agentx: AgentXContext,
  findingId: string,
): Promise<ReviewFindingPromotionResult> {
  const root = agentx.workspaceRoot;
  if (!root) {
    throw new Error('AgentX needs an open workspace to promote review findings.');
  }

  const finding = findReviewFindingById(root, findingId);
  if (!finding) {
    throw new Error(`Review finding ${findingId} was not found.`);
  }

  if (finding.backlogIssue) {
    return {
      finding,
      issueNumber: finding.backlogIssue,
      alreadyPromoted: true,
    };
  }

  const draft = buildReviewFindingIssueDraft(finding);
  const output = await agentx.runCli('issue', [
    'create',
    '--title-base64',
    encodeBase64(draft.title),
    '--body-base64',
    encodeBase64(draft.body),
    '-l',
    draft.labels.join(','),
  ]);
  const match = output.match(/#(\d+)/);
  if (!match) {
    throw new Error('AgentX created the issue, but the new issue number could not be parsed.');
  }

  const issueNumber = Number(match[1]);
  const updatedFinding = updatePromotedFinding(root, finding, issueNumber);
  return {
    finding: updatedFinding,
    issueNumber,
    alreadyPromoted: false,
  };
}

export function getReviewFindingSummary(agentx: AgentXContext): string {
  const root = agentx.workspaceRoot;
  if (!root) {
    return 'No findings';
  }
  const records = loadReviewFindingRecords(root);
  const openCount = records.filter((record) => record.status !== 'Done').length;
  return `${openCount} open`;
}

export function getReviewFindingTooltip(agentx: AgentXContext): string {
  const root = agentx.workspaceRoot;
  if (!root) {
    return 'No workspace open for review findings.';
  }
  const records = loadReviewFindingRecords(root);
  if (records.length === 0) {
    return 'No durable review finding records found under docs/reviews/findings.';
  }

  return records
    .map((record) => `${record.id}: ${record.severity}, ${record.status}, ${record.title}`)
    .join('\n');
}

export function getPromotableFindingSummary(agentx: AgentXContext): string {
  const root = agentx.workspaceRoot;
  if (!root) {
    return 'No findings';
  }
  const records = getPromotableReviewFindings(root);
  return records.length === 0 ? 'none' : `${records.length} ready`;
}

export function getPromotableFindingTooltip(agentx: AgentXContext): string {
  const root = agentx.workspaceRoot;
  if (!root) {
    return 'No workspace open for review findings.';
  }
  const records = getPromotableReviewFindings(root);
  if (records.length === 0) {
    return 'No promotable review findings detected.';
  }

  return records
    .map((record) => `${record.id}: ${record.priority}, ${record.promotion}, ${record.title}`)
    .join('\n');
}

export function renderReviewFindingsMarkdown(records: ReadonlyArray<ReviewFindingRecord>): string {
  const workflowGuidePath = 'docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md';
  const lines = [
    '**Review Findings**',
    '',
    `Open findings: ${records.filter((record) => record.status !== 'Done').length}`,
    `Promotable findings: ${records.filter((record) => record.promotion !== 'review-only' && !record.backlogIssue).length}`,
    '',
  ];

  if (records.length === 0) {
    lines.push(
      'No durable review findings were found.',
      '',
      `Reference guide: ${workflowGuidePath}`,
      'Template: docs/reviews/FINDING-TEMPLATE.md',
    );
    return lines.join('\n');
  }

  for (const record of records) {
    lines.push(`- **${record.id}**: ${record.title}`);
    lines.push(`  Severity: ${record.severity}`);
    lines.push(`  Status: ${record.status}`);
    lines.push(`  Priority: ${record.priority}`);
    lines.push(`  Promotion: ${record.promotion}`);
    lines.push(`  Owner: ${record.owner}`);
    if (record.backlogIssue) {
      lines.push(`  Backlog issue: #${record.backlogIssue}`);
    }
    if (record.summary) {
      lines.push(`  Summary: ${record.summary}`);
    }
    if (record.evidence.length > 0) {
      lines.push(`  Evidence: ${record.evidence.join(', ')}`);
    }
    lines.push(`  Record: ${record.relativePath}`);
    lines.push('');
  }

  lines.push(`Reference guide: ${workflowGuidePath}`);
  return lines.join('\n').trim();
}

export function renderReviewFindingsText(records: ReadonlyArray<ReviewFindingRecord>): string {
  return renderReviewFindingsMarkdown(records).replace(/\*\*/g, '');
}