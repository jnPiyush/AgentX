// Pure helpers for the Run Council command. No vscode imports here so this
// module is trivially unit-testable.

export interface CouncilRosterEntry {
  readonly role: string;
  readonly model: string; // e.g. "openai/gpt-5.4"
  /**
   * Per-role instruction parsed from the brief's fenced [AGENT-TODO] block.
   * The script writes this as `Role instruction: <text>` and varies it by
   * purpose pack (prd-scope / adr-options / ai-design / code-review /
   * research). Falls back to the generic Analyst/Strategist/Skeptic
   * instructions when not present (legacy briefs).
   */
  readonly instruction?: string;
}

export interface ParsedCouncilBrief {
  readonly question: string;
  readonly context: string; // empty string if no Supporting Context section
  readonly roster: ReadonlyArray<CouncilRosterEntry>;
  /** Purpose pack name from `**Purpose pack:**` header, '' if absent. */
  readonly purposePack: string;
  /** True if at least one [AGENT-TODO] block is still present in the file. */
  readonly hasPendingRoles: boolean;
}

export interface ModelSelector {
  readonly vendor?: string;
  readonly family?: string;
}

/**
 * Diversity tier achieved when picking a model for a role.
 *  - 'vendor': the role landed on a vendor not yet used by another role
 *    (preferred -- maximises independent priors and outage isolation).
 *  - 'model':  the vendor is already used by another role, but at least the
 *    specific model (vendor+family+name) is unique in this run.
 *  - 'role':   even the model identity is reused; only the role instruction
 *    differentiates the response. Last-resort fallback.
 */
export type DiversityTier = 'vendor' | 'model' | 'role';

export interface CouncilRoleResult {
  readonly role: string;
  readonly model: string;
  readonly status: 'ok' | 'no-model' | 'failed';
  readonly response?: string;
  readonly error?: string;
  /** Vendor of the model that actually responded (when status is 'ok'). */
  readonly resolvedVendor?: string;
  /** Family of the model that actually responded (when status is 'ok'). */
  readonly resolvedFamily?: string;
  /** Diversity tier achieved when this role's model was picked. */
  readonly diversityTier?: DiversityTier;
}

/**
 * Stable identity key for a language model used to detect Tier-2 reuse
 * (same model picked for two roles). Combines vendor, family, and name so
 * `gpt-5.4` and `gpt-5.5` count as different even though they share a vendor
 * and family family.
 */
export function modelKey(m: { vendor?: string; family?: string; name?: string }): string {
  const v = (m.vendor ?? '').trim().toLowerCase();
  const f = (m.family ?? '').trim().toLowerCase();
  const n = (m.name ?? '').trim().toLowerCase();
  return `${v}|${f}|${n}`;
}

const QUESTION_HEADER = '## Question';
const CONTEXT_HEADER = '## Supporting Context';
const ROSTER_HEADER = '## Council Roster';
const RESPONSES_HEADER = '## Member Responses';
const SYNTHESIS_HEADER = '## Synthesis';
const PURPOSE_PACK_PATTERN = /^\*\*Purpose pack:\*\*\s*(.+)$/m;

function extractSection(content: string, startHeader: string, ...stopHeaders: string[]): string {
  const startIdx = content.indexOf(startHeader);
  if (startIdx < 0) { return ''; }
  const afterHeader = startIdx + startHeader.length;
  let endIdx = content.length;
  for (const stop of stopHeaders) {
    const i = content.indexOf(stop, afterHeader);
    if (i >= 0 && i < endIdx) { endIdx = i; }
  }
  return content.slice(afterHeader, endIdx).trim();
}

/**
 * Parse a Council Brief markdown file produced by scripts/model-council.ps1.
 * Extracts the question, optional supporting context, the role/model roster
 * (with each role's purpose-pack instruction when present), and the purpose
 * pack name.
 */
export function parseCouncilBrief(content: string): ParsedCouncilBrief {
  const question = extractSection(
    content,
    QUESTION_HEADER,
    CONTEXT_HEADER,
    ROSTER_HEADER,
    RESPONSES_HEADER,
    SYNTHESIS_HEADER,
  );

  const context = extractSection(
    content,
    CONTEXT_HEADER,
    ROSTER_HEADER,
    RESPONSES_HEADER,
    SYNTHESIS_HEADER,
  );

  const rosterBlock = extractSection(
    content,
    ROSTER_HEADER,
    RESPONSES_HEADER,
    SYNTHESIS_HEADER,
  );

  const responsesBlock = extractSection(
    content,
    RESPONSES_HEADER,
    SYNTHESIS_HEADER,
  );

  const purposeMatch = PURPOSE_PACK_PATTERN.exec(content);
  const purposePack = purposeMatch ? purposeMatch[1].trim() : '';

  // Step 1: parse the roster table (role + model).
  const baseRoster: Array<{ role: string; model: string }> = [];
  for (const line of rosterBlock.split(/\r?\n/)) {
    // Match table rows: | Analyst | `openai/gpt-5.4` |
    const m = /^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*$/.exec(line);
    if (!m) { continue; }
    const role = m[1].trim();
    const model = m[2].trim();
    if (role.toLowerCase() === 'role' || role.startsWith('-')) { continue; }
    baseRoster.push({ role, model });
  }

  // Step 2: walk each role's response block to extract purpose-pack
  // `Role instruction:` line written by scripts/model-council.ps1.
  const roster: CouncilRosterEntry[] = baseRoster.map((entry) =>
    ({ ...entry, instruction: extractRoleInstruction(responsesBlock, entry.role) }),
  );

  const hasPendingRoles = /\[AGENT-TODO\]/.test(content);

  return { question, context, roster, purposePack, hasPendingRoles };
}

/**
 * Sentinel HTML comment used to preserve a role's purpose-pack instruction
 * across reruns. The first pass over a fresh brief reads the instruction
 * from the `Role instruction:` line inside the [AGENT-TODO] fenced block.
 * `replaceRoleBlock` deletes that fenced block when it writes the response,
 * so the same instruction is re-emitted as this comment so a second pass
 * can recover it. Markdown renderers ignore HTML comments, so it stays
 * invisible in the rendered brief.
 *
 * Payload is base64 (alphabet `[A-Za-z0-9+/=]`) so instruction text
 * containing `--` (which would terminate an HTML comment) is safe.
 */
const INSTRUCTION_MARKER_PREFIX = '<!-- agentx:role-instruction:base64 ';
const INSTRUCTION_MARKER_SUFFIX = ' -->';
const INSTRUCTION_MARKER_PATTERN = /<!-- agentx:role-instruction:base64 ([A-Za-z0-9+/=]+) -->/;

function encodeInstructionMarker(instruction: string): string {
  const b64 = Buffer.from(instruction, 'utf8').toString('base64');
  return `${INSTRUCTION_MARKER_PREFIX}${b64}${INSTRUCTION_MARKER_SUFFIX}`;
}

function decodeInstructionMarker(block: string): string | undefined {
  const m = INSTRUCTION_MARKER_PATTERN.exec(block);
  if (!m) { return undefined; }
  try {
    const decoded = Buffer.from(m[1], 'base64').toString('utf8').trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract the per-role instruction for the named role from the Member
 * Responses section. Tries two sources in order:
 *   1. The `<!-- agentx:role-instruction:base64 ... -->` sentinel comment
 *      written by `replaceRoleBlock` on a prior run. Authoritative when
 *      present because we emitted it ourselves; preferred over the text
 *      line so a model response that happens to contain the string
 *      "Role instruction:" cannot shadow the real instruction.
 *   2. The `Role instruction:` line inside the [AGENT-TODO] fenced block
 *      (present on a fresh brief before any role has been filled in).
 * Returns undefined when neither is present (legacy briefs or hand-edited
 * responses where the marker was stripped).
 */
function extractRoleInstruction(responsesBlock: string, role: string): string | undefined {
  if (!responsesBlock) { return undefined; }
  const headingPattern = new RegExp(`^### ${escapeRegex(role)}\\s+--`, 'm');
  const headingMatch = headingPattern.exec(responsesBlock);
  if (!headingMatch) { return undefined; }

  const afterHeading = headingMatch.index + headingMatch[0].length;
  const nextHeading = responsesBlock.slice(afterHeading).search(/\n(?:### |## )/);
  const blockEnd = nextHeading >= 0 ? afterHeading + nextHeading : responsesBlock.length;
  const block = responsesBlock.slice(afterHeading, blockEnd);

  const fromMarker = decodeInstructionMarker(block);
  if (fromMarker) { return fromMarker; }
  const instrMatch = /^Role instruction:\s*(.+)$/m.exec(block);
  return instrMatch ? instrMatch[1].trim() : undefined;
}

/**
 * Map a Council member model identifier (e.g. "openai/gpt-5.4") to a list of
 * vscode.lm.selectChatModels selectors to try in order. Vendor and family
 * selectors come first; the empty (any-model) selector is included only when
 * `allowAnyFallback` is true. Diversity-sensitive callers should pass
 * `allowAnyFallback: false` so a missing vendor cannot silently collapse the
 * council to a single provider.
 */
export function modelSelectorCandidates(
  modelId: string,
  options?: { allowAnyFallback?: boolean },
): ModelSelector[] {
  const allowAny = options?.allowAnyFallback !== false; // default true for backward compat
  const normalized = modelId.trim().toLowerCase();
  const slashIdx = normalized.indexOf('/');
  const vendorPart = slashIdx > 0 ? normalized.slice(0, slashIdx) : '';
  const familyPart = slashIdx > 0 ? normalized.slice(slashIdx + 1) : normalized;

  const candidates: ModelSelector[] = [];
  if (familyPart) {
    candidates.push({ family: familyPart });
  }
  if (vendorPart) {
    candidates.push({ vendor: vendorPart });
  }
  if (allowAny) {
    // Optional final fallback: any available chat model. Only when caller
    // accepts vendor collapse (e.g. single-role workflows).
    candidates.push({});
  }
  return candidates;
}

/**
 * Build the role-specific user prompt sent to the council member model.
 * Mirrors the prompt body produced by scripts/model-council.ps1
 * Invoke-CouncilMember so manual and extension-driven runs produce comparable
 * responses.
 */
export function buildRolePrompt(args: {
  role: string;
  roleInstruction: string;
  question: string;
  context: string;
}): string {
  const promptBody = args.context
    ? `${args.question}\n\nSupporting context:\n${args.context}`
    : args.question;

  return [
    `You are sitting on a Model Council as the **${args.role}**. Three council members`,
    'with different reasoning styles are independently answering the same question.',
    'Do NOT try to be balanced -- speak from your assigned role.',
    '',
    'Your role-specific instruction:',
    args.roleInstruction,
    '',
    'Respond in this structure:',
    '  ## Position',
    '  (2-4 sentences -- your top-line answer from your role)',
    '',
    '  ## Key Reasoning',
    '  (3-6 bullets -- the most important supporting points)',
    '',
    '  ## What Could Make Me Wrong',
    '  (2-3 bullets -- concrete evidence that would change your view)',
    '',
    'Question:',
    promptBody,
  ].join('\n');
}

/**
 * Generic fallback role instructions matching the script's `research` pack.
 * Purpose-pack-specific instructions are read directly from the brief's
 * fenced [AGENT-TODO] block by `parseCouncilBrief`. Use these only when the
 * brief does not include an explicit `Role instruction:` line (legacy briefs
 * or non-standard rosters).
 */
export const ROLE_INSTRUCTIONS: Readonly<Record<string, string>> = {
  Analyst: 'Decompose the question. Identify what evidence would settle it. Flag weak claims and demand specifics.',
  Strategist: 'Step back. Identify the strategic frame, second-order effects, and the recommendation a senior partner would give.',
  Skeptic: 'Be contrarian. Identify the strongest argument AGAINST the consensus position. Surface failure modes and missing counter-evidence.',
};

/**
 * Resolve the role instruction text. Prefers the per-role instruction parsed
 * from the brief (which carries purpose-pack semantics) and falls back to the
 * generic research-pack instruction when the brief has none.
 */
export function getRoleInstruction(role: string, briefInstruction?: string): string {
  const trimmed = briefInstruction?.trim();
  if (trimmed) { return trimmed; }
  return ROLE_INSTRUCTIONS[role] ?? 'Speak from your assigned role.';
}

/**
 * Validate that the resolved council members cover at least the expected
 * number of distinct vendors. Returns the unique vendor set, the worst
 * diversity tier achieved across all responding roles, and a `collapsed`
 * flag preserved for backward compat (true iff 2+ ok members all share one
 * vendor). Vendors of `undefined` or empty string are ignored.
 *
 * Worst-tier semantics: a council where two roles got `vendor` and one role
 * fell back to `model` reports `tier='model'` -- the council's overall
 * diversity claim is bounded by the weakest link.
 */
export function summarizeVendorDiversity(
  results: ReadonlyArray<CouncilRoleResult>,
): {
  vendors: ReadonlySet<string>;
  collapsed: boolean;
  /** Worst tier across all ok results; 'none' if no role responded ok. */
  tier: DiversityTier | 'none';
} {
  const vendors = new Set<string>();
  let okCount = 0;
  // Tier ordering: vendor (best) > model > role (worst). We track the
  // worst-seen so a single role landing on Tier 3 collapses the whole
  // council's tier label.
  const tierRank: Record<DiversityTier, number> = { vendor: 0, model: 1, role: 2 };
  let worstRank = -1;
  let worstTier: DiversityTier | 'none' = 'none';
  for (const r of results) {
    if (r.status !== 'ok') { continue; }
    okCount += 1;
    const v = r.resolvedVendor?.trim().toLowerCase();
    if (v) { vendors.add(v); }
    if (r.diversityTier) {
      const rank = tierRank[r.diversityTier];
      if (rank > worstRank) {
        worstRank = rank;
        worstTier = r.diversityTier;
      }
    }
  }
  // Diversity is "collapsed" when 2+ members responded but they all share
  // a single vendor. Single-member rosters cannot be diverse.
  const collapsed = okCount >= 2 && vendors.size <= 1;
  return { vendors, collapsed, tier: worstTier };
}

/**
 * Replace the [AGENT-TODO] block (and its accompanying fenced prompt block)
 * for the given role with the provided response text. Idempotent: if the role
 * heading is not found the original content is returned unchanged.
 *
 * When `instruction` is provided, an HTML-comment sentinel encoding the
 * instruction is emitted before the response so `parseCouncilBrief` can
 * recover the per-role purpose-pack instruction on a subsequent rerun.
 * Without this, the second pass would silently fall back to the generic
 * research-pack instruction even when the brief was scoped to adr-options /
 * code-review / prd-scope / ai-design.
 */
export function replaceRoleBlock(
  content: string,
  role: string,
  response: string,
  instruction?: string,
): string {
  // Find the role heading: "### <role> -- `<model>`"
  const headingPattern = new RegExp(`^### ${escapeRegex(role)}\\s+--`, 'm');
  const headingMatch = headingPattern.exec(content);
  if (!headingMatch) { return content; }

  const headingStart = headingMatch.index;
  const afterHeading = content.indexOf('\n', headingStart);
  if (afterHeading < 0) { return content; }

  // The next "### " or "## " marks the boundary of this role's block.
  const nextHeading = content.slice(afterHeading).search(/\n(?:### |## )/);
  const blockEnd = nextHeading >= 0 ? afterHeading + nextHeading : content.length;

  const before = content.slice(0, afterHeading + 1);
  const after = content.slice(blockEnd);
  const trimmedInstruction = instruction?.trim();
  const marker = trimmedInstruction
    ? `${encodeInstructionMarker(trimmedInstruction)}\n`
    : '';
  // Single blank line, optional preserved-instruction marker, the response,
  // then a single trailing blank line.
  return `${before}\n${marker}${response.trim()}\n${after}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
