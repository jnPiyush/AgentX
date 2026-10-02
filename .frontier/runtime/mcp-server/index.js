#!/usr/bin/env node
/**
 * Frontier MCP Server (stdio).
 *
 * Wraps the Frontier PowerShell CLI (.frontier/runtime/frontier-cli.ps1) and exposes its key
 * commands as Model Context Protocol tools. Any MCP-compatible host -- GitHub
 * Copilot CLI, Claude Desktop, Cursor, VS Code MCP -- can call these tools
 * directly to drive the Frontier quality loop, query the ready queue, validate
 * handoffs, and ship issues.
 *
 * Discovery:
 *   - FRONTIER_REPO_ROOT env var (preferred)      -- absolute path to Frontier repo
 *   - HVE_REPO_ROOT env var (transitional)   -- partial-migration fallback
 *   - AGENTX_REPO_ROOT env var (deprecated)  -- published compatibility fallback
 *   - walks up from this file to find .frontier/runtime/frontier-cli.ps1
 *
 * Spawning:
 *   On Windows: pwsh -NoProfile -File <frontier-cli.ps1> <args>
 *   On *nix:    pwsh -NoProfile -File <frontier-cli.ps1> <args>
 *   (pwsh must be on PATH; PowerShell 7.4+ is required by Frontier.)
 */

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// ---------- repo discovery ----------

const CLI_RELATIVE_PATH = path.join('.frontier', 'runtime', 'frontier-cli.ps1');
const WRAPPER_RELATIVE_PATH = path.join('.frontier', 'runtime', 'frontier.ps1');

function resolveCliEntry(root) {
  return [CLI_RELATIVE_PATH, WRAPPER_RELATIVE_PATH].map(relative => path.join(root, relative))
    .find(candidate => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile());
}

function discoverRepoRoot(env = process.env, start = __dirname) {
  const key = ['FRONTIER_REPO_ROOT', 'HVE_REPO_ROOT', 'AGENTX_REPO_ROOT'].find(name => env[name] !== undefined);
  if (key) {
    const configuredRoot = env[key];
    if (typeof configuredRoot !== 'string' || !path.isAbsolute(configuredRoot)) {
      throw new Error(`${key} must be an absolute repository path.`);
    }
    const root = path.resolve(configuredRoot);
    if (resolveCliEntry(root)) return root;
    throw new Error(`${key} does not contain a Frontier runtime CLI or workspace wrapper: ${root}`);
  }
  let cur = start;
  for (let i = 0; i < 6; i++) {
    if (resolveCliEntry(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error('Cannot locate Frontier repo root. Set FRONTIER_REPO_ROOT to the repo path.');
}

// ---------- CLI invocation ----------

function createCliRunner(repoRoot, hooks = {}) {
  const cliEntry = resolveCliEntry(repoRoot) ?? path.join(repoRoot, CLI_RELATIVE_PATH);
  const active = new Map();
  let stopped = false;
  const failureResult = (message) => ({ exitCode: -1, stdout: '', stderr: message });
  const run = (args, signal) => {
    if (stopped || signal?.aborted) return Promise.resolve(failureResult('Request cancelled or server shutting down.'));
    if (active.size) return Promise.resolve(failureResult('CLI busy or previous child termination unconfirmed.'));
    let child;
    try {
      child = (hooks.spawn || spawn)('pwsh', ['-NoProfile', '-NonInteractive', '-File', cliEntry, ...args], {
        cwd: repoRoot, env: {
          ...process.env, FRONTIER_NONINTERACTIVE: '1', FRONTIER_WORKSPACE_ROOT: repoRoot,
          FRONTIER_OPERATION_TIMEOUT_SECONDS: String(Math.max(1, Math.floor((hooks.timeoutMs || 600000) / 1000) - 30)),
        },
        windowsHide: true, detached: (hooks.platform || process.platform) !== 'win32',
      });
    } catch (error) { return Promise.resolve(failureResult(`[spawn-error] ${error.message}`)); }
    const entry = {};
    active.set(child, entry);
    entry.promise = new Promise(resolve => {
      let stdout = '';
      let stderr = '';
      let bytes = 0;
      let failure = '';
      let settled = false;
      let childClosed = false;
      let treeTerminated = false;
      let escalation;
      let teardown;
      const maxBytes = hooks.maxOutputBytes || 1048576;
      const finish = (code, confirmed = true) => {
        if (confirmed) active.delete(child);
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearTimeout(escalation);
        clearTimeout(teardown);
        signal?.removeEventListener('abort', cancel);
        resolve({ exitCode: failure ? -1 : code ?? -1, stdout, stderr: `${stderr}${failure ? `\n${failure}` : ''}`, terminationConfirmed: confirmed });
      };
      const finishStopped = () => { if (childClosed && treeTerminated) finish(-1); };
      const kill = (name) => {
        try { (hooks.kill || process.kill)(-child.pid, name); }
        catch (groupError) {
          if (groupError.code !== 'ESRCH') throw new Error(`Process group rejected ${name}: ${groupError.message}`);
        }
      };
      const terminate = (reason) => {
        if (failure || settled) return;
        failure = reason;
        clearTimeout(timeout);
        teardown = setTimeout(() => {
          failure += '\n[termination-error] Child close not confirmed; further calls blocked.';
          child.stdout.destroy?.();
          child.stderr.destroy?.();
          child.unref?.();
          finish(-1, false);
        }, hooks.teardownMs || 8000);
        if (!Number.isInteger(child.pid) || child.pid <= 0) return;
        try {
          if ((hooks.platform || process.platform) === 'win32') {
            const result = (hooks.spawnSync || spawnSync)('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
              windowsHide: true, timeout: 5000, maxBuffer: 16384, encoding: 'utf8',
            });
            if (result.error || result.status !== 0) throw new Error(`taskkill failed: ${result.error?.message || result.stderr || `exit ${result.status}`}`);
            treeTerminated = true;
            finishStopped();
          } else {
            kill('SIGTERM');
            escalation = setTimeout(() => {
              try {
                kill('SIGKILL');
                treeTerminated = true;
                finishStopped();
              } catch (error) { failure += `\n[termination-error] ${error.message}`; }
            }, hooks.killGraceMs || 2000);
          }
        } catch (error) { failure += `\n[termination-error] ${String(error.message).slice(0, 2000)}`; }
      };
      const cancel = () => terminate('[cancelled] Request cancelled or server shutting down.');
      entry.cancel = cancel;
      const capture = (chunk, stream) => {
        if (settled || failure) return;
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const available = maxBytes - bytes;
        const text = data.subarray(0, available).toString();
        if (stream === 'stdout') stdout += text; else stderr += text;
        bytes += Math.min(available, data.length);
        if (data.length > available) terminate(`[output-limit] Output exceeded ${maxBytes} bytes.`);
      };
      const timeout = setTimeout(() => terminate('[timeout] CLI execution timed out.'), hooks.timeoutMs || 600000);
      child.stdout.on('data', chunk => capture(chunk, 'stdout'));
      child.stderr.on('data', chunk => capture(chunk, 'stderr'));
      child.on('error', error => terminate(`[spawn-error] ${error.message}`));
      child.once('close', code => {
        childClosed = true;
        if (failure) finishStopped(); else finish(code);
      });
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
    });
    return entry.promise;
  };
  const stop = async () => {
    stopped = true;
    const entries = [...active.values()];
    for (const entry of entries) entry.cancel();
    await Promise.all(entries.map(entry => entry.promise));
    if (active.size) throw new Error('Child termination unconfirmed during MCP shutdown.');
  };
  return { run, stop };
}

function toolResult({ exitCode, stdout, stderr }) {
  const body =
    `exit: ${exitCode}\n` +
    (stdout.trim() ? `stdout:\n${stdout.trim()}\n` : '') +
    (stderr.trim() ? `stderr:\n${stderr.trim()}\n` : '');
  return {
    content: [{ type: 'text', text: body || '(no output)' }],
    isError: exitCode !== 0 && exitCode !== 3,
    ...(exitCode === 3 ? { structuredContent: { status: 'pending_owner_review_or_verification', exitCode } } : {}),
  };
}

// ---------- tool catalog ----------

const TOOLS = [
  {
    name: 'frontier_loop_start',
    description:
      'Start the Frontier iterative quality loop for a task. MUST be called before any file edits. Records prompt and (optionally) issue number.',
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
    name: 'frontier_loop_iterate',
    description:
      'Record a quality-loop iteration. For the subagent review pass, also pass verdict, reviewer, high and medium -- a loop cannot complete without one.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        evidence: { type: 'string', description: 'Path to test report, coverage, or scan artifact' },
        outcome: { type: 'string', enum: ['pass', 'fail', 'partial'] },
        verdict: {
          type: 'string',
          enum: ['approved', 'changes-requested'],
          description: 'Reviewer verdict. Requires reviewer, high and medium.',
        },
        reviewer: { type: 'string', description: 'Reviewer id, required with verdict' },
        high: { type: 'number', description: 'HIGH finding count, required with verdict' },
        medium: { type: 'number', description: 'MEDIUM finding count, required with verdict' },
        low: { type: 'number', description: 'LOW finding count' },
      },
      required: ['summary'],
    },
    build: (a) => [
      'loop',
      'iterate',
      '-s',
      a.summary,
      ...(a.evidence ? ['-e', a.evidence] : []),
      ...(a.outcome ? ['-o', a.outcome] : []),
      ...(a.verdict ? ['--verdict', a.verdict] : []),
      ...(a.reviewer ? ['--reviewer', a.reviewer] : []),
      ...(a.high != null ? ['--high', String(a.high)] : []),
      ...(a.medium != null ? ['--medium', String(a.medium)] : []),
      ...(a.low != null ? ['--low', String(a.low)] : []),
    ],
  },
  {
    name: 'frontier_loop_complete',
    description:
      'Mark the Frontier quality loop complete. Requires the risk-based 1/2/3/5 iteration minimum and an approved reviewer verdict with zero HIGH and MEDIUM findings on the final work iteration. Does not run test suites. After success, ask the user whether to run the suite and wait for explicit approval before separate test execution.',
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
    name: 'frontier_loop_status',
    description: 'Report the current quality-loop state (iteration count, history, completion).',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['loop', 'status'],
  },
  {
    name: 'frontier_ready',
    description: 'Show the priority-sorted ready queue of unblocked work.',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['ready'],
  },
  {
    name: 'frontier_state',
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
    name: 'frontier_deps',
    description: 'Check dependencies/blockers for an issue.',
    inputSchema: {
      type: 'object',
      properties: { issue: { type: 'number' } },
      required: ['issue'],
    },
    build: (a) => ['deps', String(a.issue)],
  },
  {
    name: 'frontier_workflow',
    description: 'Print the workflow phase list for an agent role (engineer, architect, pm, ...).',
    inputSchema: {
      type: 'object',
      properties: { agent: { type: 'string' } },
      required: ['agent'],
    },
    build: (a) => ['workflow', a.agent],
  },
  {
    name: 'frontier_validate',
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
    name: 'frontier_config_show',
    description: 'Show the active Frontier configuration (provider, mode, enforceIssues, ...).',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['config', 'show'],
  },
  {
    name: 'frontier_issue',
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
    name: 'frontier_ship',
    description: 'Run the autonomous fast-path (plan -> work -> review -> scrub -> test -> compound) for a single issue.',
    inputSchema: {
      type: 'object',
      properties: { issue: { type: 'number' } },
      required: ['issue'],
    },
    build: (a) => ['ship', '-Issue', String(a.issue)],
  },
  {
    name: 'frontier_context',
    description: 'Return bounded task-relevant source pointers from the repository graph of an initialized Frontier workspace. Reads the cached graph by default and schedules a background refresh when stale; sync updates incrementally first and refresh re-extracts everything. Preserves curated map notes; no model calls.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 4096, description: 'Task, symbol or area to locate; omit for repository orientation.' },
        agent: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9-]{0,79}$', description: 'Optional role ID, such as engineer.' },
        maxChars: { type: 'integer', minimum: 512, maximum: 16000, default: 4000 },
        sync: { type: 'boolean', default: false, description: 'Update the graph incrementally before answering.' },
        refresh: { type: 'boolean', default: false, description: 'Re-extract every file before answering (slowest).' },
      },
      additionalProperties: false,
    },
    build: (a) => {
      if (Object.keys(a).some(key => !['query', 'agent', 'maxChars', 'sync', 'refresh'].includes(key))) {
        throw new Error('Unsupported repository context argument.');
      }
      const query = a.query === undefined ? '' : a.query;
      const maxChars = a.maxChars === undefined ? 4000 : a.maxChars;
      if (typeof query !== 'string' || query.length > 4096) throw new Error('query must be a string of at most 4096 characters.');
      if (!Number.isInteger(maxChars) || maxChars < 512 || maxChars > 16000) throw new Error('maxChars must be an integer from 512 to 16000.');
      if (a.agent !== undefined && (typeof a.agent !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/i.test(a.agent))) throw new Error('agent must be a role ID.');
      if (a.sync !== undefined && typeof a.sync !== 'boolean') throw new Error('sync must be boolean.');
      if (a.refresh !== undefined && typeof a.refresh !== 'boolean') throw new Error('refresh must be boolean.');
      const args = ['context', '--json', '--query64', Buffer.from(query, 'utf8').toString('base64'), '--max-chars', String(maxChars)];
      if (a.agent) args.push('-a', a.agent);
      if (a.sync) args.push('--sync');
      if (a.refresh) args.push('--refresh');
      return args;
    },
  },
  {
    name: 'frontier_digest',
    description: 'Generate the weekly digest of closed issues into .frontier/digests/DIGEST-<year>-W<week>.md.',
    inputSchema: { type: 'object', properties: {} },
    build: () => ['digest'],
  },
  {
    name: 'frontier_hook',
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
    name: 'frontier_run',
    description:
      'Run a named Frontier agent. engine=hydrafusion generates an isolated candidate only: an active owner loop, explicit credit budget and supported Copilot CLI are required. Exit 3 is pending independent review, not task completion.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent role name (engineer, architect, pm, ...)' },
        prompt: { type: 'string', description: 'Task description for the agent' },
        model: { type: 'string', description: 'Optional model id (e.g. gpt-4.1); not valid with engine=hydrafusion' },
        max: { type: 'integer', minimum: 1, maximum: 1000, description: 'Native iterations or observed HydraFusion model calls (default 30)' },
        issue: { type: 'number', description: 'Optional issue number to associate' },
        engine: { type: 'string', enum: ['native', 'hydrafusion'], description: 'Execution engine; omit to use the workspace executionEngine setting' },
        feedback: { type: 'string', description: 'Owner-recorded candidate-bound changes-requested report for a bounded HydraFusion refinement' },
      },
      required: ['agent', 'prompt'],
    },
    build: (a) => {
      if (a.engine !== undefined && !['native', 'hydrafusion'].includes(a.engine)) {
        throw new Error('engine must be native or hydrafusion.');
      }
      if (a.max !== undefined && (!Number.isInteger(a.max) || a.max < 1 || a.max > 1000)) {
        throw new Error('max must be an integer from 1 to 1000.');
      }
      if (a.feedback !== undefined && (typeof a.feedback !== 'string' || !a.feedback.trim())) {
        throw new Error('feedback must name an owner-recorded report.');
      }
      const args = ['run', '-a', a.agent, '-p', a.prompt];
      if (a.model) args.push('-m', a.model);
      if (a.max != null) args.push('--max', String(a.max));
      if (a.issue != null) args.push('-i', String(a.issue));
      if (a.engine) args.push('--engine', a.engine);
      if (a.feedback) args.push('--feedback', a.feedback);
      return args;
    },
  },
  {
    name: 'frontier_engine',
    description: 'Inspect execution capabilities or isolated candidates. accept requires an independent candidate-bound approval already archived by the active owner loop; application remains pending final verification. No action invokes a model.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'inspect', 'accept', 'discard', 'recover'], default: 'status' },
        candidate: { type: 'string', pattern: '^hf-[0-9]{14}-[a-f0-9]{12}$' },
        review: { type: 'string', description: 'Owner-recorded independent review report; required for accept' },
      },
      additionalProperties: false,
    },
    build: (a) => {
      if (Object.keys(a).some(key => !['action', 'candidate', 'review'].includes(key))) throw new Error('Unsupported engine argument.');
      const action = a.action ?? 'status';
      if (!['status', 'inspect', 'accept', 'discard', 'recover'].includes(action)) throw new Error('Unsupported engine action.');
      if (action !== 'status' && (typeof a.candidate !== 'string' || !/^hf-[0-9]{14}-[a-f0-9]{12}$/.test(a.candidate))) {
        throw new Error('A valid candidate ID is required.');
      }
      if (action === 'accept' && (typeof a.review !== 'string' || !a.review.trim())) throw new Error('accept requires an independent review report.');
      const args = ['engine', action];
      if (action !== 'status') args.push(a.candidate);
      if (action === 'accept') args.push('--review', a.review);
      args.push('--json');
      return args;
    },
  },
  {
    name: 'frontier_backlog_sync',
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
    name: 'frontier_config_set',
    description: 'Set an Frontier configuration value (e.g. enforceIssues=true). Booleans and numbers are parsed automatically.',
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
    name: 'frontier_learn',
    description: 'Run the pattern-discovery (learn) pipeline over recent sessions and surface candidate patterns into .frontier/patterns/discovered.yaml.',
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
    name: 'frontier_promote',
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
const LEGACY_TOOL_BY_NAME = Object.fromEntries(
  TOOLS.map((tool) => [tool.name.replace(/^frontier_/, 'agentx_'), tool])
);

// ---------- MCP wiring ----------

function createServer(runner) {
const server = new Server(
  { name: 'frontier', version: '9.7.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const tool = TOOL_BY_NAME[req.params.name] || LEGACY_TOOL_BY_NAME[req.params.name];
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
  const result = await runner.run(argv, extra.signal);
  return toolResult(result);
});
server.onclose = () => {
  void runner.stop().catch(error => {
    process.stderr.write(`[frontier-mcp] shutdown failed: ${error.message}\n`);
    process.exitCode = 1;
  });
};
return server;
}

async function main() {
  const repoRoot = discoverRepoRoot();
  const runner = createCliRunner(repoRoot);
  const server = createServer(runner);
  const transport = new StdioServerTransport();
  let shutdown;
  const stop = () => {
    shutdown ||= Promise.resolve().then(async () => {
      try { await runner.stop(); } finally { await server.close(); }
    }).catch(error => {
      process.stderr.write(`[frontier-mcp] shutdown failed: ${error.message}\n`);
      process.exitCode = 1;
    });
    return shutdown;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdin.once('end', stop);
  await server.connect(transport);
  // Stderr only; stdout is reserved for the MCP protocol.
  process.stderr.write(`[frontier-mcp] ready (repo=${repoRoot}, tools=${TOOLS.length})\n`);
}

if (require.main === module) main().catch((err) => {
  process.stderr.write(`[frontier-mcp] fatal: ${err.stack || err.message}\n`);
  process.exit(1);
});

module.exports = { createCliRunner, createServer, discoverRepoRoot, main };
