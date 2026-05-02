/**
 * Language-model-backed intent classifier for the @agentx chat participant.
 *
 * Translates conversational phrases into AgentX CLI commands using
 * `vscode.lm.selectChatModels`. Output is a structured JSON object that
 * is validated against an allowlisted catalog -- the LM cannot invent
 * subcommands or argument shapes.
 *
 * The regex-based router in `intentRouter.ts` remains the graceful-degradation
 * fallback when the language model API is unavailable (e.g. older VS Code,
 * no Copilot subscription), or when the LM returns an invalid / null result.
 */
import * as vscode from 'vscode';

const LM_TIMEOUT_MS = 5000;

/** Canonical CLI shape for a single intent. */
export interface IntentSpec {
  readonly id: string;
  readonly subcommand: string;
  readonly description: string;
  readonly destructive: boolean;
  /** Human-readable CLI shape shown to the LM in the system prompt. */
  readonly cliShape: string;
  /** Few-shot phrasing examples shown to the LM. */
  readonly examples: ReadonlyArray<string>;
  /**
   * Validate raw arguments produced by the LM (or any other source) and
   * return the canonical CLI args[] that `agentx <subcommand>` expects.
   * Returns `undefined` when the args are invalid or fail allowlist checks.
   */
  readonly validate: (rawArgs: ReadonlyArray<string>) => ReadonlyArray<string> | undefined;
}

/** Result returned to the intent router after a successful LM classification. */
export interface LmClassification {
  readonly id: string;
  readonly subcommand: string;
  readonly description: string;
  readonly args: ReadonlyArray<string>;
  readonly destructive: boolean;
  readonly confidence: 'high' | 'low';
  readonly reason: string;
}

const PROVIDER_VALUES = new Set(['ado', 'github', 'local']);
const SYNC_TARGETS = new Set(['github', 'ado']);
const GIT_DIRECTIONS = new Set(['push', 'pull']);
const VALID_ROLES = new Set([
  'pm', 'ux', 'architect', 'engineer', 'reviewer',
  'devops', 'data-scientist', 'tester', 'consulting-research',
]);
const STATUS_VALUES = new Set([
  'Backlog', 'Ready', 'In Progress', 'In Review', 'Validating', 'Done',
]);
const STATUS_ALIASES: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /^backlog$/i, value: 'Backlog' },
  { pattern: /^ready$/i, value: 'Ready' },
  { pattern: /^in[\s-]?progress$/i, value: 'In Progress' },
  { pattern: /^in[\s-]?review$/i, value: 'In Review' },
  { pattern: /^validating$/i, value: 'Validating' },
  { pattern: /^done$/i, value: 'Done' },
];

function normalizeStatus(raw: string): string | undefined {
  const trimmed = raw.trim();
  for (const a of STATUS_ALIASES) {
    if (a.pattern.test(trimmed)) { return a.value; }
  }
  if (STATUS_VALUES.has(trimmed)) { return trimmed; }
  return undefined;
}

function isDigitString(s: string | undefined): s is string {
  return typeof s === 'string' && /^\d+$/.test(s);
}

function isAgentName(s: string | undefined): s is string {
  return typeof s === 'string' && /^[a-z][a-z0-9-]*$/.test(s);
}

function expectNoArgs(rawArgs: ReadonlyArray<string>, fixed: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (rawArgs.length === 0) { return fixed; }
  return undefined;
}

/** Allowlisted intent catalog. Mirrors PHRASE_RULES in intentRouter.ts. */
export const INTENT_CATALOG: ReadonlyArray<IntentSpec> = [
  {
    id: 'config-show',
    subcommand: 'config',
    destructive: false,
    description: 'Show current AgentX configuration',
    cliShape: 'agentx config show',
    examples: ['show config', "what's my config?", 'view current configuration'],
    validate: (a) => expectNoArgs(a, ['show']),
  },
  {
    id: 'ready-queue',
    subcommand: 'ready',
    destructive: false,
    description: 'Show priority-sorted ready queue',
    cliShape: 'agentx ready',
    examples: ['show ready', 'what should I work on next', "what's ready"],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'agent-state',
    subcommand: 'state',
    destructive: false,
    description: 'Show agent state',
    cliShape: 'agentx state',
    examples: ['show state', 'show agent state', 'states'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'issue-deps',
    subcommand: 'deps',
    destructive: false,
    description: 'Show dependencies/blockers for an issue',
    cliShape: 'agentx deps <issue-number>',
    examples: ['show deps for #42', 'what blocks #99', 'dependencies of 17'],
    validate: (a) => isDigitString(a[0]) ? [a[0]] : undefined,
  },
  {
    id: 'issue-list',
    subcommand: 'issue',
    destructive: false,
    description: 'List all issues',
    cliShape: 'agentx issue list',
    examples: ['list issues', 'show all issues', 'issues'],
    validate: (a) => expectNoArgs(a, ['list']),
  },
  {
    id: 'issue-get',
    subcommand: 'issue',
    destructive: false,
    description: 'Show details of a specific issue',
    cliShape: 'agentx issue get <issue-number>',
    examples: ['show issue 42', 'view issue #17', 'get issue 99'],
    validate: (a) => isDigitString(a[0]) ? ['get', a[0]] : undefined,
  },
  {
    id: 'loop-status',
    subcommand: 'loop',
    destructive: false,
    description: 'Show iterative loop status',
    cliShape: 'agentx loop status',
    examples: ['loop status', 'show loop status', "what's the loop"],
    validate: (a) => expectNoArgs(a, ['status']),
  },
  {
    id: 'workflow-list',
    subcommand: 'workflow',
    destructive: false,
    description: 'List agent handoff chains',
    cliShape: 'agentx workflow',
    examples: ['list workflows', 'show all agents', 'show handoff chains'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'workflow-for-agent',
    subcommand: 'workflow',
    destructive: false,
    description: 'Show workflow steps for an agent',
    cliShape: 'agentx workflow <agent-name>',
    examples: ['show workflow for engineer', 'what is the workflow for architect', 'describe the workflow for ux-designer'],
    validate: (a) => isAgentName(a[0]) ? [a[0]] : undefined,
  },
  {
    id: 'digest',
    subcommand: 'digest',
    destructive: false,
    description: 'Generate weekly digest',
    cliShape: 'agentx digest',
    examples: ['show digest', 'generate weekly digest', 'digest'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'audit',
    subcommand: 'audit',
    destructive: false,
    description: 'Run audit checks',
    cliShape: 'agentx audit',
    examples: ['run audit', 'audit'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'lessons',
    subcommand: 'lessons',
    destructive: false,
    description: 'Show captured lessons',
    cliShape: 'agentx lessons',
    examples: ['show lessons', 'list lessons', 'lessons'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'tokens',
    subcommand: 'tokens',
    destructive: false,
    description: 'Show token budget usage',
    cliShape: 'agentx tokens',
    examples: ['count tokens', 'show token budget', 'tokens'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'bundle-list',
    subcommand: 'bundle',
    destructive: false,
    description: 'List task bundles',
    cliShape: 'agentx bundle list',
    examples: ['list bundles', 'bundles', 'show bundles'],
    validate: (a) => expectNoArgs(a, ['list']),
  },
  {
    id: 'parallel-list',
    subcommand: 'parallel',
    destructive: false,
    description: 'List bounded-parallel runs',
    cliShape: 'agentx parallel list',
    examples: ['list parallel runs', 'show bounded-parallel runs'],
    validate: (a) => expectNoArgs(a, ['list']),
  },
  {
    id: 'validate-handoff',
    subcommand: 'validate',
    destructive: false,
    description: 'Validate handoff artifacts for an issue and role',
    cliShape: 'agentx validate <issue-number> <role>',
    examples: ['validate 42 engineer', 'validate issue #17 for architect', 'validate 99 as reviewer'],
    validate: (a) => {
      const issue = a[0];
      const role = (a[1] ?? '').toLowerCase();
      if (!isDigitString(issue) || !VALID_ROLES.has(role)) { return undefined; }
      return [issue, role];
    },
  },
  {
    id: 'patterns-status',
    subcommand: 'patterns',
    destructive: false,
    description: 'Inspect discovered patterns and graduation candidates',
    cliShape: 'agentx patterns',
    examples: ['show patterns', 'list discovered patterns', 'patterns status'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'research-status',
    subcommand: 'research',
    destructive: false,
    description: 'Show the active metric-driven research experiment',
    cliShape: 'agentx research status',
    examples: ['show research', 'research status', 'show active experiment'],
    validate: (a) => expectNoArgs(a, ['status']),
  },
  {
    id: 'scrub-scan',
    subcommand: 'scrub',
    destructive: false,
    description: 'Scan a file or path for filler / comment-rot (no fix)',
    cliShape: 'agentx scrub [path]',
    examples: ['scrub scripts/ship.ps1', 'run scrub', 'scrub scan'],
    validate: (a) => {
      const path = (a[0] ?? '').trim();
      return path.length > 0 ? [path] : [];
    },
  },
  // -- destructive --
  {
    id: 'config-set-provider',
    subcommand: 'config',
    destructive: true,
    description: 'Change the active backlog provider',
    cliShape: 'agentx config set provider <ado|github|local>',
    examples: ['switch provider to github', 'use ado adapter', 'change backend to local'],
    validate: (a) => {
      const v = (a[0] ?? '').toLowerCase();
      return PROVIDER_VALUES.has(v) ? ['set', 'provider', v] : undefined;
    },
  },
  {
    id: 'issue-close',
    subcommand: 'issue',
    destructive: true,
    description: 'Close an issue',
    cliShape: 'agentx issue close <issue-number>',
    examples: ['close issue 42', 'close #17'],
    validate: (a) => isDigitString(a[0]) ? ['close', a[0]] : undefined,
  },
  {
    id: 'issue-update-status',
    subcommand: 'issue',
    destructive: true,
    description: 'Update an issue status',
    cliShape: 'agentx issue update -n <issue-number> -s <status>',
    examples: ['move issue 42 to in progress', 'set #17 to done', 'mark issue 99 as ready'],
    validate: (a) => {
      const issue = a[0];
      const rawStatus = a[1];
      if (!isDigitString(issue) || typeof rawStatus !== 'string') { return undefined; }
      const status = normalizeStatus(rawStatus);
      if (!status) { return undefined; }
      return ['update', '-n', issue, '-s', status];
    },
  },
  {
    id: 'loop-cancel',
    subcommand: 'loop',
    destructive: true,
    description: 'Cancel the current iterative loop',
    cliShape: 'agentx loop cancel',
    examples: ['cancel the loop', 'cancel loop'],
    validate: (a) => expectNoArgs(a, ['cancel']),
  },
  {
    id: 'loop-complete',
    subcommand: 'loop',
    destructive: true,
    description: 'Mark the iterative loop complete with a summary (and optional evidence path)',
    cliShape: 'agentx loop complete -s <summary> [-e <evidence-path>]',
    examples: ['complete the loop with: all gates passed', 'finalize loop saying done'],
    validate: (a) => {
      const summary = (a[0] ?? '').trim();
      if (summary.length === 0) { return undefined; }
      const out = ['complete', '-s', summary];
      const evidence = (a[1] ?? '').trim();
      if (evidence.length > 0) { out.push('-e', evidence); }
      return out;
    },
  },
  {
    id: 'loop-iterate',
    subcommand: 'loop',
    destructive: true,
    description: 'Record a loop iteration with a progress summary',
    cliShape: 'agentx loop iterate -s <summary>',
    examples: ['iterate the loop with: progress made', 'tick loop saying refactor done'],
    validate: (a) => {
      const summary = (a[0] ?? '').trim();
      return summary.length > 0 ? ['iterate', '-s', summary] : undefined;
    },
  },
  {
    id: 'loop-start',
    subcommand: 'loop',
    destructive: true,
    description: 'Start an iterative loop with a prompt',
    cliShape: 'agentx loop start -p <prompt>',
    examples: ['start a loop for: fix the bug', 'kick off loop on tests'],
    validate: (a) => {
      const prompt = (a[0] ?? '').trim();
      return prompt.length > 0 ? ['start', '-p', prompt] : undefined;
    },
  },
  {
    id: 'backlog-sync',
    subcommand: 'backlog-sync',
    destructive: true,
    description: 'Force-sync local backlog to a remote provider',
    cliShape: 'agentx backlog-sync <github|ado> --force',
    examples: ['sync backlog to github', 'force-sync backlog to ado'],
    validate: (a) => {
      const t = (a[0] ?? '').toLowerCase();
      return SYNC_TARGETS.has(t) ? [t, '--force'] : undefined;
    },
  },
  {
    id: 'git-sync',
    subcommand: 'git-sync',
    destructive: true,
    description: 'Run git push or pull through AgentX git-sync',
    cliShape: 'agentx git-sync <push|pull>',
    examples: ['git-sync push', 'git pull via agentx'],
    validate: (a) => {
      const d = (a[0] ?? '').toLowerCase();
      return GIT_DIRECTIONS.has(d) ? [d] : undefined;
    },
  },
  {
    id: 'hire-agent',
    subcommand: 'hire',
    destructive: true,
    description: 'Scaffold a new agent definition',
    cliShape: 'agentx hire <agent-name>',
    examples: ['hire policy-reviewer', 'scaffold a new agent risk-analyst'],
    validate: (a) => isAgentName(a[0]) ? [a[0]] : undefined,
  },
  {
    id: 'learn-observations',
    subcommand: 'learn',
    destructive: true,
    description: 'Capture observations from the current session into the patterns store',
    cliShape: 'agentx learn',
    examples: ['learn from this session', 'capture session observations', 'run learn'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'promote-patterns',
    subcommand: 'promote',
    destructive: true,
    description: 'Graduate stable patterns into skills',
    cliShape: 'agentx promote',
    examples: ['promote patterns', 'graduate stable patterns', 'run promote'],
    validate: (a) => expectNoArgs(a, []),
  },
  {
    id: 'scrub-fix',
    subcommand: 'scrub',
    destructive: true,
    description: 'Scrub files and apply safe deletions for filler / comment-rot',
    cliShape: 'agentx scrub [path] -Fix',
    examples: ['scrub and fix', 'scrub and fix scripts/', 'fix filler in docs/README.md'],
    validate: (a) => {
      const path = (a[0] ?? '').trim();
      return path.length > 0 ? [path, '-Fix'] : ['-Fix'];
    },
  },
  {
    id: 'research-end',
    subcommand: 'research',
    destructive: true,
    description: 'End the active research experiment',
    cliShape: 'agentx research -Action end',
    examples: ['end the experiment', 'stop research', 'finish the research experiment'],
    validate: (a) => expectNoArgs(a, ['-Action', 'end']),
  },
  {
    id: 'ship-issue',
    subcommand: 'ship',
    destructive: true,
    description: 'Run the ship pipeline (plan->work->review->scrub->test->compound) for an issue',
    cliShape: 'agentx ship -Issue <issue-number>',
    examples: ['ship issue 42', 'ship #17', 'ship 99'],
    validate: (a) => isDigitString(a[0]) ? ['-Issue', a[0]] : undefined,
  },
];

const CATALOG_BY_ID = new Map<string, IntentSpec>(INTENT_CATALOG.map((s) => [s.id, s]));

/** Test seam: override the time/timeout source for cancellation tests. */
let timeoutMs = LM_TIMEOUT_MS;
export function __setLmTimeoutForTests(ms: number): void { timeoutMs = ms; }
export function __resetLmTimeoutForTests(): void { timeoutMs = LM_TIMEOUT_MS; }

/** Test seam: force LM unavailable even if vscode.lm is mocked. */
let lmDisabled = false;
export function __setLmDisabledForTests(disabled: boolean): void { lmDisabled = disabled; }

function buildClassifierPrompt(userText: string): string {
  const lines: string[] = [];
  lines.push('You translate one user phrase into AgentX CLI commands.');
  lines.push('');
  lines.push('Allowed intents (use ONLY these ids):');
  for (const spec of INTENT_CATALOG) {
    const tag = spec.destructive ? ' (DESTRUCTIVE)' : '';
    lines.push(`- ${spec.id}: ${spec.description}${tag}`);
    lines.push(`  shape: ${spec.cliShape}`);
    lines.push(`  examples: ${spec.examples.map((e) => `"${e}"`).join(', ')}`);
  }
  lines.push('');
  lines.push('Argument contract (return the user-supplied values, no flag tokens):');
  lines.push('- issue numbers: digits only, no `#`');
  lines.push('- agent names / roles: pm, ux, architect, engineer, reviewer, devops, data-scientist, tester, consulting-research');
  lines.push('- providers: ado, github, local');
  lines.push('- sync targets: github, ado');
  lines.push('- git directions: push, pull');
  lines.push('- statuses: Backlog, Ready, In Progress, In Review, Validating, Done');
  lines.push('- summaries / prompts: keep verbatim user text, do not rewrite');
  lines.push('- loop-complete optional second arg is an evidence-file path; omit if not given');
  lines.push('');
  lines.push('Return STRICT JSON only, no prose, no code fences:');
  lines.push('{"id":"<intent-id-or-null>","args":[<strings>],"confidence":"high"|"low","reason":"<short>"}');
  lines.push('');
  lines.push('Rules:');
  lines.push('1. If the phrase does not clearly match an allowed intent, return id=null.');
  lines.push('2. Never invent issue numbers, agent names, providers, statuses, or paths -- use only what the user wrote.');
  lines.push('3. If a required argument is missing, return id=null.');
  lines.push('4. confidence=low when phrasing is ambiguous, abbreviated, or only loosely fits.');
  lines.push('5. reason: <=80 chars, plain text.');
  lines.push('');
  lines.push(`User phrase: """${userText}"""`);
  return lines.join('\n');
}

interface RawClassification {
  id: string | null;
  args?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

/** Extract a JSON object from raw model text, tolerating code fences and prose. */
export function extractJsonObject(raw: string): RawClassification | undefined {
  const trimmed = raw.trim();
  // Try direct parse first.
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') { return parsed as RawClassification; }
  } catch { /* fall through */ }
  // Fallback: find the first balanced { ... } block.
  const start = trimmed.indexOf('{');
  if (start < 0) { return undefined; }
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{') { depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const slice = trimmed.slice(start, i + 1);
        try {
          const parsed = JSON.parse(slice);
          if (parsed && typeof parsed === 'object') { return parsed as RawClassification; }
        } catch { /* keep scanning */ }
      }
    }
  }
  return undefined;
}

/** Convert a parsed raw classification to a validated LmClassification. */
export function validateClassification(raw: RawClassification | undefined): LmClassification | undefined {
  if (!raw || raw.id === null || typeof raw.id !== 'string') { return undefined; }
  const spec = CATALOG_BY_ID.get(raw.id);
  if (!spec) { return undefined; }
  const rawArgs: ReadonlyArray<string> = Array.isArray(raw.args)
    ? raw.args.filter((v): v is string => typeof v === 'string')
    : [];
  const validatedArgs = spec.validate(rawArgs);
  if (!validatedArgs) { return undefined; }
  const confidence: 'high' | 'low' = raw.confidence === 'low' ? 'low' : 'high';
  const reason = typeof raw.reason === 'string' ? raw.reason.slice(0, 200) : '';
  return {
    id: spec.id,
    subcommand: spec.subcommand,
    description: spec.description,
    args: validatedArgs,
    destructive: spec.destructive,
    confidence,
    reason,
  };
}

interface LmStream {
  text?: AsyncIterable<string>;
}

async function collectStream(resp: unknown): Promise<string> {
  const stream = (resp as LmStream)?.text;
  if (!stream) { return ''; }
  const parts: string[] = [];
  for await (const chunk of stream) {
    parts.push(typeof chunk === 'string' ? chunk : String(chunk));
  }
  return parts.join('');
}

interface LmApi {
  selectChatModels(selector?: { vendor?: string; family?: string }): Promise<Array<{
    sendRequest?(messages: unknown[], options?: unknown, token?: unknown): Promise<unknown>;
  }>>;
}

/**
 * Classify a user phrase with a VS Code language model, returning a validated
 * intent or undefined. Returns undefined when the LM API is unavailable, the
 * model rejects, the response is invalid JSON, or the proposed intent does
 * not match the allowlisted catalog.
 */
export async function classifyIntentWithLM(
  userText: string,
  token?: vscode.CancellationToken,
): Promise<LmClassification | undefined> {
  if (lmDisabled) { return undefined; }
  const lm = (vscode as unknown as { lm?: LmApi }).lm;
  if (!lm?.selectChatModels) { return undefined; }
  let model: { sendRequest?(messages: unknown[], options?: unknown, token?: unknown): Promise<unknown> } | undefined;
  try {
    const preferred = await lm.selectChatModels({ vendor: 'copilot' });
    model = preferred[0] ?? (await lm.selectChatModels({}))[0];
  } catch {
    return undefined;
  }
  if (!model?.sendRequest) { return undefined; }

  const messages = [{ role: 'user', content: buildClassifierPrompt(userText) }];

  const lmCall = (async () => {
    try {
      const resp = await model!.sendRequest!(messages, {}, token);
      const text = await collectStream(resp);
      return validateClassification(extractJsonObject(text));
    } catch {
      return undefined;
    }
  })();

  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), timeoutMs);
  });

  return Promise.race([lmCall, timeout]);
}
