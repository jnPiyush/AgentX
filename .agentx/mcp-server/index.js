#!/usr/bin/env node
/**
 * AgentX MCP Server (stdio).
 *
 * Wraps the AgentX PowerShell CLI (.agentx/agentx-cli.ps1) and exposes its key
 * commands as Model Context Protocol tools. Any MCP-compatible host -- GitHub
 * Copilot CLI, Claude Desktop, Cursor, VS Code MCP -- can call these tools
 * directly to drive the AgentX quality loop, query the ready queue, validate
 * handoffs, and ship issues.
 *
 * Discovery:
 *   - AGENTX_REPO_ROOT env var (preferred)   -- absolute path to AgentX repo
 *   - walks up from this file to find .agentx/agentx-cli.ps1
 *
 * Spawning:
 *   On Windows: pwsh -NoProfile -File <agentx-cli.ps1> <args>
 *   On *nix:    pwsh -NoProfile -File <agentx-cli.ps1> <args>
 *   (pwsh must be on PATH; PowerShell 7.4+ is required by AgentX.)
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// ---------- repo discovery ----------

function discoverRepoRoot() {
  if (process.env.AGENTX_REPO_ROOT) {
    const p = path.resolve(process.env.AGENTX_REPO_ROOT);
    if (fs.existsSync(path.join(p, '.agentx', 'agentx-cli.ps1'))) return p;
  }
  let cur = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(cur, '.agentx', 'agentx-cli.ps1'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error('Cannot locate AgentX repo root. Set AGENTX_REPO_ROOT to the repo path.');
}

const REPO_ROOT = discoverRepoRoot();
const CLI_SCRIPT = path.join(REPO_ROOT, '.agentx', 'agentx-cli.ps1');

// ---------- CLI invocation ----------

function runAgentX(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(
      'pwsh',
      ['-NoProfile', '-File', CLI_SCRIPT, ...args],
      { cwd: REPO_ROOT, env: { ...process.env, ...env } }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', (err) => {
      resolve({ exitCode: -1, stdout, stderr: stderr + '\n[spawn-error] ' + err.message });
    });
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

function toolResult({ exitCode, stdout, stderr }) {
  const body =
    `exit: ${exitCode}\n` +
    (stdout.trim() ? `stdout:\n${stdout.trim()}\n` : '') +
    (stderr.trim() ? `stderr:\n${stderr.trim()}\n` : '');
  return {
    content: [{ type: 'text', text: body || '(no output)' }],
    isError: exitCode !== 0,
  };
}

// ---------- tool catalog ----------

const TOOLS = [
  {
    name: 'agentx_loop_start',
    description:
      'Start the AgentX iterative quality loop for a task. MUST be called before any file edits. Records prompt and (optionally) issue number.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task description' },
        issue: { type: 'number', description: 'Optional GitHub or local issue number' },
      },
      required: ['prompt'],
    },
    build: (a) => ['loop', 'start', '-p', a.prompt, ...(a.issue != null ? ['-i', String(a.issue)] : [])],
  },
  {
    name: 'agentx_loop_iterate',
    description: 'Record a quality-loop iteration with summary and evidence path.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        evidence: { type: 'string', description: 'Path to test report, coverage, or scan artifact' },
      },
      required: ['summary'],
    },
    build: (a) => ['loop', 'iterate', '-s', a.summary, ...(a.evidence ? ['-e', a.evidence] : [])],
  },
  {
    name: 'agentx_loop_complete',
    description: 'Mark the AgentX quality loop complete. Requires 5+ iterations and a subagent review pass.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        evidence: { type: 'string' },
      },
      required: ['summary'],
    },
    build: (a) => ['loop', 'complete', '-s', a.summary, ...(a.evidence ? ['-e', a.evidence] : [])],
  },
  {
    name: 'agentx_loop_status',
    description: 'Report the current quality-loop state (iteration count, history, completion).',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['loop', 'status'],
  },
  {
    name: 'agentx_ready',
    description: 'Show the priority-sorted ready queue of unblocked work.',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['ready'],
  },
  {
    name: 'agentx_state',
    description: 'Show or update agent state. Without args, prints all agent states.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
        status: { type: 'string', enum: ['idle', 'working', 'blocked', 'done'] },
        issue: { type: 'number' },
      },
    },
    build: (a) => {
      const args = ['state'];
      if (a.agent) args.push('-a', a.agent);
      if (a.status) args.push('-s', a.status);
      if (a.issue != null) args.push('-i', String(a.issue));
      return args;
    },
  },
  {
    name: 'agentx_deps',
    description: 'Check dependencies/blockers for an issue.',
    inputSchema: {
      type: 'object',
      properties: { issue: { type: 'number' } },
      required: ['issue'],
    },
    build: (a) => ['deps', String(a.issue)],
  },
  {
    name: 'agentx_workflow',
    description: 'Print the workflow phase list for an agent role (engineer, architect, pm, ...).',
    inputSchema: {
      type: 'object',
      properties: { agent: { type: 'string' } },
      required: ['agent'],
    },
    build: (a) => ['workflow', a.agent],
  },
  {
    name: 'agentx_validate',
    description: 'Validate handoff deliverables for an issue at the named role boundary.',
    inputSchema: {
      type: 'object',
      properties: {
        issue: { type: 'number' },
        role: { type: 'string' },
      },
      required: ['issue', 'role'],
    },
    build: (a) => ['validate', String(a.issue), a.role],
  },
  {
    name: 'agentx_config_show',
    description: 'Show the active AgentX configuration (provider, mode, enforceIssues, ...).',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['config', 'show'],
  },
  {
    name: 'agentx_issue',
    description: 'Issue subcommand: list | get | create | update | close. Pass action plus any positional args.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'close', 'comment'] },
        args: { type: 'array', items: { type: 'string' } },
      },
      required: ['action'],
    },
    build: (a) => ['issue', a.action, ...((a.args || []))],
  },
  {
    name: 'agentx_ship',
    description: 'Run the autonomous fast-path (plan -> work -> review -> scrub -> test -> compound) for a single issue.',
    inputSchema: {
      type: 'object',
      properties: { issue: { type: 'number' } },
      required: ['issue'],
    },
    build: (a) => ['ship', '-Issue', String(a.issue)],
  },
  {
    name: 'agentx_digest',
    description: 'Generate the weekly digest of closed issues into .agentx/digests/DIGEST-<year>-W<week>.md.',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['digest'],
  },
  {
    name: 'agentx_hook',
    description:
      'Record an agent lifecycle hook. Used by orchestrators to mark when a role starts or finishes work. Finish enforces the quality-loop gate for loop-gated roles.',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', enum: ['start', 'finish'] },
        agent: { type: 'string' },
        issue: { type: 'number' },
      },
      required: ['phase', 'agent'],
    },
    build: (a) => {
      const args = ['hook', a.phase, a.agent];
      if (a.issue != null) args.push(String(a.issue));
      return args;
    },
  },
  {
    name: 'agentx_run',
    description:
      'Run an agent through the agentic loop (LLM + tools). Requires a configured LLM provider (GitHub Models, Claude Code, etc.). Use this to delegate a task to a named agent role.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent role name (engineer, architect, pm, ...)' },
        prompt: { type: 'string', description: 'Task description for the agent' },
        model: { type: 'string', description: 'Optional model id (e.g. gpt-4.1)' },
        max: { type: 'number', description: 'Max iterations (default 30)' },
        issue: { type: 'number', description: 'Optional issue number to associate' },
      },
      required: ['agent', 'prompt'],
    },
    build: (a) => {
      const args = ['run', '-a', a.agent, '-p', a.prompt];
      if (a.model) args.push('-m', a.model);
      if (a.max != null) args.push('--max', String(a.max));
      if (a.issue != null) args.push('-i', String(a.issue));
      return args;
    },
  },
  {
    name: 'agentx_backlog_sync',
    description: 'Sync the local backlog to a remote provider (currently: github). Use force=true to re-sync items already migrated.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['github'], default: 'github' },
        force: { type: 'boolean', default: false },
      },
    },
    build: (a) => {
      const args = ['backlog-sync', a.target || 'github'];
      if (a.force) args.push('--force');
      return args;
    },
  },
  {
    name: 'agentx_config_set',
    description: 'Set an AgentX configuration value (e.g. enforceIssues=true). Booleans and numbers are parsed automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string', description: 'String/bool/number as text; the CLI parses it' },
      },
      required: ['key', 'value'],
    },
    build: (a) => ['config', 'set', a.key, a.value],
  },
  {
    name: 'agentx_learn',
    description: 'Run the pattern-discovery (learn) pipeline over recent sessions and surface candidate patterns into .agentx/patterns/discovered.yaml.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['run', 'status', 'reset'], default: 'run' },
      },
    },
    build: (a) => {
      const args = ['learn'];
      if (a.action && a.action !== 'run') args.push(a.action);
      return args;
    },
  },
  {
    name: 'agentx_promote',
    description: 'Graduate stable discovered patterns into durable artifacts (skills, conventions, learnings).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['run', 'status'], default: 'run' },
      },
    },
    build: (a) => {
      const args = ['promote'];
      if (a.action && a.action !== 'run') args.push(a.action);
      return args;
    },
  },
];

const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

// ---------- MCP wiring ----------

const server = new Server(
  { name: 'agentx', version: '8.4.60' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOL_BY_NAME[req.params.name];
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      isError: true,
    };
  }
  let argv;
  try {
    argv = tool.build(req.params.arguments || {});
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${err.message}` }],
      isError: true,
    };
  }
  const result = await runAgentX(argv);
  return toolResult(result);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stderr only; stdout is reserved for the MCP protocol.
  process.stderr.write(`[agentx-mcp] ready (repo=${REPO_ROOT}, tools=${TOOLS.length})\n`);
}

main().catch((err) => {
  process.stderr.write(`[agentx-mcp] fatal: ${err.stack || err.message}\n`);
  process.exit(1);
});
