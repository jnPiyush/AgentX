/**
 * Natural-language intent router for the @agentx chat participant.
 *
 * Translates conversational phrases into AgentX CLI commands.
 * First slice: deterministic phrase rules + confirmation gate for destructive ops.
 * Future slice: LM-backed classifier fallback for broader phrasing coverage.
 */
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

// Pending-confirmation store keyed by workspace root. In-memory only --
// if VS Code reloads mid-confirmation, the user just retypes the request.
const PENDING_INTENTS = new Map<string, PendingIntent>();

// Proposed commands expire after this interval to prevent accidental execution
// of hours-old confirmations (e.g. across chat sessions on the same workspace).
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Replaceable time source so tests can control expiry without mocking global Date.
let nowFn: () => number = Date.now.bind(Date);

const PROVIDER_VALUES = ['ado', 'github', 'local'] as const;
type ProviderValue = typeof PROVIDER_VALUES[number];

const SYNC_TARGETS = ['github', 'ado'] as const;
type SyncTarget = typeof SYNC_TARGETS[number];

const GIT_DIRECTIONS = ['push', 'pull'] as const;
type GitDirection = typeof GIT_DIRECTIONS[number];

/** Map free-text status phrases to the canonical AgentX status values. */
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
  for (const alias of STATUS_ALIASES) {
    if (alias.pattern.test(trimmed)) { return alias.value; }
  }
  return undefined;
}

const VALID_ROLES = new Set([
  'pm', 'ux', 'architect', 'engineer', 'reviewer',
  'devops', 'data-scientist', 'tester', 'consulting-research',
]);

interface IntentMatch {
  readonly id: string;
  readonly description: string;
  readonly subcommand: string;
  readonly args: ReadonlyArray<string>;
  readonly destructive: boolean;
}

interface PendingIntent extends IntentMatch {
  readonly proposedAt: number;
}

/** Phrase rule. The first capture group (if any) is fed to `argMapper`. */
interface PhraseRule {
  readonly id: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly subcommand: string;
  readonly pattern: RegExp;
  readonly argMapper: (match: RegExpMatchArray) => ReadonlyArray<string> | undefined;
}

const PHRASE_RULES: ReadonlyArray<PhraseRule> = [
  // ============================================================
  // READ-ONLY VERBS (execute immediately, no confirmation)
  // ============================================================

  // --- Configuration ---
  {
    id: 'config-show',
    description: 'Show current AgentX configuration',
    destructive: false,
    subcommand: 'config',
    pattern: /^(?:show|what(?:'s| is)|display|view)\s+(?:my\s+|the\s+|current\s+)?config(?:uration)?\??$/i,
    argMapper: () => ['show'],
  },

  // --- Backlog and queue ---
  {
    id: 'ready-queue',
    description: 'Show priority-sorted ready queue',
    destructive: false,
    subcommand: 'ready',
    pattern: /^(?:show\s+)?(?:what(?:'s| is)\s+)?(?:the\s+)?ready(?:\s+queue)?\??$|^what\s+should\s+i\s+work\s+on\??$/i,
    argMapper: () => [],
  },
  {
    id: 'agent-state',
    description: 'Show agent state',
    destructive: false,
    subcommand: 'state',
    pattern: /^(?:show\s+)?(?:agent\s+)?states?\??$/i,
    argMapper: () => [],
  },
  {
    id: 'issue-deps',
    description: 'Show dependencies for an issue',
    destructive: false,
    subcommand: 'deps',
    pattern: /^(?:show\s+)?(?:deps|dependencies|blockers)\s+(?:for|of)?\s*#?(\d+)\??$|^what\s+blocks\s+#?(\d+)\??$/i,
    argMapper: (m) => {
      const issue = m[1] ?? m[2];
      return issue ? [issue] : undefined;
    },
  },

  // --- Issue inspection ---
  {
    id: 'issue-list',
    description: 'List all issues',
    destructive: false,
    subcommand: 'issue',
    pattern: /^(?:list|show|view)\s+(?:all\s+|the\s+)?issues\??$|^issues\??$/i,
    argMapper: () => ['list'],
  },
  {
    id: 'issue-get',
    description: 'Show details of a specific issue',
    destructive: false,
    subcommand: 'issue',
    pattern: /^(?:show|get|view|describe)\s+issue\s+#?(\d+)\??$|^(?:show|get|view)\s+#(\d+)\??$/i,
    argMapper: (m) => {
      const issue = m[1] ?? m[2];
      return issue ? ['get', issue] : undefined;
    },
  },

  // --- Loop control (read) ---
  {
    id: 'loop-status',
    description: 'Show iterative loop status',
    destructive: false,
    subcommand: 'loop',
    pattern: /^(?:show\s+)?loop(?:\s+status)?\??$|^what(?:'s| is)\s+(?:the\s+)?loop\??$/i,
    argMapper: () => ['status'],
  },

  // --- Workflow / agents ---
  {
    id: 'workflow-list',
    description: 'List agent handoff chains',
    destructive: false,
    subcommand: 'workflow',
    pattern: /^(?:list|show)\s+(?:all\s+)?(?:workflows|agents|handoff(?:\s+chains)?)\??$/i,
    argMapper: () => [],
  },
  {
    id: 'workflow-for-agent',
    description: 'Show workflow steps for an agent or issue type',
    destructive: false,
    subcommand: 'workflow',
    pattern: /^(?:show|view|describe)\s+(?:the\s+)?workflow\s+(?:for|of)\s+([a-z][a-z0-9-]*)\??$|^what(?:'s| is)\s+(?:the\s+)?workflow\s+for\s+([a-z][a-z0-9-]*)\??$/i,
    argMapper: (m) => {
      const agent = (m[1] ?? m[2] ?? '').toLowerCase();
      return agent ? [agent] : undefined;
    },
  },

  // --- Reporting / inspection ---
  {
    id: 'digest',
    description: 'Generate weekly digest',
    destructive: false,
    subcommand: 'digest',
    pattern: /^(?:show|generate|run|view)\s+(?:the\s+|weekly\s+)?digest\??$|^digest\??$/i,
    argMapper: () => [],
  },
  {
    id: 'audit',
    description: 'Run audit checks',
    destructive: false,
    subcommand: 'audit',
    pattern: /^(?:run|show|view)\s+(?:the\s+)?audit\??$|^audit\??$/i,
    argMapper: () => [],
  },
  {
    id: 'lessons',
    description: 'Show captured lessons',
    destructive: false,
    subcommand: 'lessons',
    pattern: /^(?:show|list|view)\s+lessons\??$|^lessons\??$/i,
    argMapper: () => [],
  },
  {
    id: 'tokens',
    description: 'Show token budget usage',
    destructive: false,
    subcommand: 'tokens',
    pattern: /^(?:show|count|check)\s+tokens?\??$|^tokens?\??$|^(?:show|check)\s+token\s+budget\??$/i,
    argMapper: () => [],
  },

  // --- Bundles and parallel runs (read) ---
  {
    id: 'bundle-list',
    description: 'List task bundles',
    destructive: false,
    subcommand: 'bundle',
    pattern: /^(?:list|show)\s+(?:all\s+|the\s+)?bundles\??$|^bundles\??$/i,
    argMapper: () => ['list'],
  },
  {
    id: 'parallel-list',
    description: 'List bounded-parallel runs',
    destructive: false,
    subcommand: 'parallel',
    pattern: /^(?:list|show)\s+(?:all\s+|the\s+)?(?:parallel(?:\s+runs)?|bounded[\s-]?parallel(?:\s+runs)?)\??$/i,
    argMapper: () => ['list'],
  },

  // --- Validation (positional, read-only) ---
  {
    id: 'validate-handoff',
    description: 'Validate handoff artifacts for an issue and role',
    destructive: false,
    subcommand: 'validate',
    pattern: /^validate\s+(?:issue\s+)?#?(\d+)\s+(?:for\s+|as\s+)?([a-z][a-z-]*)\??$/i,
    argMapper: (m) => {
      const issue = m[1];
      const role = (m[2] ?? '').toLowerCase();
      if (!issue || !VALID_ROLES.has(role)) { return undefined; }
      return [issue, role];
    },
  },

  // ============================================================
  // DESTRUCTIVE VERBS (require explicit confirmation)
  // ============================================================

  // --- Provider switch ---
  {
    id: 'config-set-provider',
    description: 'Change the active backlog provider',
    destructive: true,
    subcommand: 'config',
    pattern: /^(?:change|switch|set|use)\s+(?:the\s+)?(?:adapter|provider|backend)\s+(?:to\s+)?(ado|github|local)$|^(?:change|switch|set|use)\s+(?:to\s+)?(ado|github|local)(?:\s+(?:adapter|provider|backend))?$/i,
    argMapper: (m) => {
      const raw = (m[1] ?? m[2] ?? '').toLowerCase();
      if (!isProviderValue(raw)) { return undefined; }
      return ['set', 'provider', raw];
    },
  },

  // --- Issue mutations ---
  {
    id: 'issue-close',
    description: 'Close an issue',
    destructive: true,
    subcommand: 'issue',
    pattern: /^close\s+(?:issue\s+)?#?(\d+)\.?$/i,
    argMapper: (m) => (m[1] ? ['close', m[1]] : undefined),
  },
  {
    id: 'issue-update-status',
    description: 'Update an issue status',
    destructive: true,
    subcommand: 'issue',
    pattern: /^(?:set|move|update|mark)\s+issue\s+#?(\d+)\s+(?:status\s+)?(?:to\s+|as\s+)([a-z][a-z\s-]*?)\.?$|^move\s+#?(\d+)\s+to\s+([a-z][a-z\s-]*?)\.?$/i,
    argMapper: (m) => {
      const issue = m[1] ?? m[3];
      const rawStatus = m[2] ?? m[4];
      if (!issue || !rawStatus) { return undefined; }
      const status = normalizeStatus(rawStatus);
      if (!status) { return undefined; }
      return ['update', '-n', issue, '-s', status];
    },
  },

  // --- Loop control (mutate) ---
  {
    id: 'loop-cancel',
    description: 'Cancel the current iterative loop',
    destructive: true,
    subcommand: 'loop',
    pattern: /^cancel\s+(?:the\s+)?loop\.?$/i,
    argMapper: () => ['cancel'],
  },
  {
    id: 'loop-complete',
    description: 'Mark the iterative loop complete with a summary (and optional evidence path)',
    destructive: true,
    subcommand: 'loop',
    // Optional trailer "evidence <path>" or "with evidence <path>" maps to -e <path>.
    // The CLI requires --evidence on loop complete; without it, completion fails with
    // a clear CLI error pointing the user to provide a final gate artifact.
    pattern: /^(?:complete|finish|finalize|close)\s+(?:the\s+)?loop\s*(?:with\s+|saying\s+|:\s*)(.+?)(?:\s+(?:with\s+)?evidence\s+(\S+))?\.?$/i,
    argMapper: (m) => {
      const summary = (m[1] ?? '').trim();
      if (summary.length === 0) { return undefined; }
      const evidence = (m[2] ?? '').trim();
      const args = ['complete', '-s', summary];
      if (evidence.length > 0) {
        args.push('-e', evidence);
      }
      return args;
    },
  },
  {
    id: 'loop-iterate',
    description: 'Record a loop iteration with a progress summary',
    destructive: true,
    subcommand: 'loop',
    pattern: /^(?:iterate|tick|advance)\s+(?:the\s+)?loop\s*(?:with\s+|saying\s+|:\s*)(.+)$/i,
    argMapper: (m) => {
      const summary = (m[1] ?? '').trim();
      return summary.length > 0 ? ['iterate', '-s', summary] : undefined;
    },
  },
  {
    id: 'loop-start',
    description: 'Start an iterative loop with a prompt',
    destructive: true,
    subcommand: 'loop',
    pattern: /^(?:start|begin|kick\s+off)\s+(?:a\s+|the\s+)?loop\s*(?:for\s+|with\s+|on\s+|about\s+|:\s*)(.+)$/i,
    argMapper: (m) => {
      const prompt = (m[1] ?? '').trim();
      return prompt.length > 0 ? ['start', '-p', prompt] : undefined;
    },
  },

  // --- Sync ---
  {
    id: 'backlog-sync',
    description: 'Force-sync local backlog to a remote provider',
    destructive: true,
    subcommand: 'backlog-sync',
    pattern: /^(?:sync|push|force[\s-]?sync)\s+(?:the\s+)?backlog(?:\s+(?:to|with)\s+(github|ado))?\.?$/i,
    argMapper: (m) => {
      if (!m[1]) { return undefined; } // require explicit target; avoid wrong-provider assumptions
      const target = m[1].toLowerCase();
      if (!isSyncTarget(target)) { return undefined; }
      return [target, '--force'];
    },
  },
  {
    id: 'git-sync',
    description: 'Run git push or pull through AgentX git-sync',
    destructive: true,
    subcommand: 'git-sync',
    pattern: /^(?:run\s+)?git[\s-]?sync\s+(push|pull)\.?$|^git\s+(push|pull)\s+(?:via\s+|through\s+)?agentx\.?$/i,
    argMapper: (m) => {
      const dir = ((m[1] ?? m[2]) ?? '').toLowerCase();
      if (!isGitDirection(dir)) { return undefined; }
      return [dir];
    },
  },

  // --- Hire (scaffolding) ---
  {
    id: 'hire-agent',
    description: 'Scaffold a new agent definition',
    destructive: true,
    subcommand: 'hire',
    pattern: /^hire\s+([a-z][a-z0-9-]*)\.?$|^scaffold\s+(?:a\s+)?(?:new\s+)?agent\s+([a-z][a-z0-9-]*)\.?$/i,
    argMapper: (m) => {
      const name = ((m[1] ?? m[2]) ?? '').toLowerCase();
      return name ? [name] : undefined;
    },
  },
];

function isProviderValue(value: string): value is ProviderValue {
  return (PROVIDER_VALUES as ReadonlyArray<string>).includes(value);
}

function isSyncTarget(value: string): value is SyncTarget {
  return (SYNC_TARGETS as ReadonlyArray<string>).includes(value);
}

function isGitDirection(value: string): value is GitDirection {
  return (GIT_DIRECTIONS as ReadonlyArray<string>).includes(value);
}

function matchPhrase(userText: string): IntentMatch | undefined {
  const text = userText.trim();
  for (const rule of PHRASE_RULES) {
    rule.pattern.lastIndex = 0;
    const m = text.match(rule.pattern);
    if (!m) { continue; }
    const args = rule.argMapper(m);
    if (!args) { continue; }
    return {
      id: rule.id,
      description: rule.description,
      subcommand: rule.subcommand,
      args: args,
      destructive: rule.destructive,
    };
  }
  return undefined;
}

const CONFIRM_PATTERN = /^(yes|confirm|run|ok|okay|do it|proceed|go)\.?$/i;
const CANCEL_PATTERN = /^(no|cancel|abort|stop|nevermind|never mind)\.?$/i;

function getRootKey(agentx: AgentXContext): string | undefined {
  return agentx.workspaceRoot;
}

function getPending(agentx: AgentXContext): PendingIntent | undefined {
  const key = getRootKey(agentx);
  return key ? PENDING_INTENTS.get(key) : undefined;
}

function setPending(agentx: AgentXContext, intent: IntentMatch): void {
  const key = getRootKey(agentx);
  if (!key) { return; }
  PENDING_INTENTS.set(key, { ...intent, proposedAt: nowFn() });
}

function clearPending(agentx: AgentXContext): void {
  const key = getRootKey(agentx);
  if (key) { PENDING_INTENTS.delete(key); }
}

/** Test-only: drop all pending intents across roots. */
export function resetIntentRouterStateForTests(): void {
  PENDING_INTENTS.clear();
  nowFn = Date.now.bind(Date);
}

/** Test-only: override the time source for TTL testing. */
export function setNowFnForTests(fn: () => number): void {
  nowFn = fn;
}

function renderProposed(intent: IntentMatch): string {
  const cmd = formatCli(intent);
  return [
    `**Proposed:** \`${cmd}\``,
    '',
    intent.description,
    '',
    'Reply **yes** (or `confirm`) to run, **no** (or `cancel`) to abort.',
  ].join('\n');
}

function renderRan(intent: IntentMatch, output: string): string {
  const cmd = formatCli(intent);
  const trimmed = output.trim();
  const body = trimmed.length > 0 ? trimmed : '(no output)';
  return [
    `Ran \`${cmd}\`:`,
    '',
    '```text',
    body,
    '```',
  ].join('\n');
}

function formatCli(intent: IntentMatch): string {
  const parts = ['agentx', intent.subcommand, ...intent.args].filter((p) => p.length > 0);
  return parts.join(' ');
}

async function executeIntent(
  intent: IntentMatch,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult> {
  try {
    response.progress(`Running ${formatCli(intent)}...`);
    const out = await agentx.runCli(intent.subcommand, [...intent.args]);
    response.markdown(renderRan(intent, out));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    response.markdown(`**AgentX intent failed:** \`${formatCli(intent)}\`\n\n${msg}`);
  }
  return {};
}

/**
 * Try to translate a free-text phrase into a CLI invocation.
 * Returns `undefined` when no rule matches so the caller falls through to
 * usage guidance or other handlers.
 */
export async function tryHandleNaturalLanguageIntent(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult | undefined> {
  const text = userText.trim();
  if (!text) { return undefined; }

  // 1. Resolve any pending confirmation BEFORE attempting a fresh phrase match.
  const pending = getPending(agentx);
  if (pending) {
    if (nowFn() - pending.proposedAt > PENDING_TTL_MS) {
      clearPending(agentx);
      if (CONFIRM_PATTERN.test(text)) {
        response.markdown('Previous proposed command has expired. Please re-issue your request.');
        return {};
      }
      // Non-confirm after expiry: fall through to fresh phrase match.
    } else if (CONFIRM_PATTERN.test(text)) {
      clearPending(agentx);
      return executeIntent(pending, response, agentx);
    } else if (CANCEL_PATTERN.test(text)) {
      clearPending(agentx);
      response.markdown(`Cancelled \`${formatCli(pending)}\`.`);
      return {};
    } else {
      // Anything else: drop the stale pending intent and let the next match (or
      // the rest of the router) handle the new phrase.
      clearPending(agentx);
    }
  }

  // 2. Phrase rule match.
  const match = matchPhrase(text);
  if (!match) { return undefined; }

  if (match.destructive) {
    if (!agentx.workspaceRoot) {
      response.markdown('**No workspace open.** Open a folder with AgentX before running commands.');
      return {};
    }
    setPending(agentx, match);
    response.markdown(renderProposed(match));
    return {};
  }

  return executeIntent(match, response, agentx);
}
