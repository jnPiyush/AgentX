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
const { StringDecoder } = require('node:string_decoder');

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
  if (env.FRONTIER_REPO_ROOT !== undefined) {
    const configuredRoot = env.FRONTIER_REPO_ROOT;
    if (typeof configuredRoot !== 'string' || !path.isAbsolute(configuredRoot)) {
      throw new Error('FRONTIER_REPO_ROOT must be an absolute repository path.');
    }
    const root = path.resolve(configuredRoot);
    if (resolveCliEntry(root)) return root;
    throw new Error(`FRONTIER_REPO_ROOT does not contain a Frontier runtime CLI or workspace wrapper: ${root}`);
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
  const workspaceRoot = hooks.workspaceRoot ?? repoRoot;
  if (!path.isAbsolute(workspaceRoot) || !fs.statSync(workspaceRoot, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('Frontier MCP workspace must be an existing absolute filesystem directory.');
  }
  const active = new Map();
  let stopped = false;
  const failureResult = (message) => ({ exitCode: -1, stdout: '', stderr: message });
  const run = (args, signal, onProgress) => {
    if (stopped || signal?.aborted) return Promise.resolve(failureResult('Request cancelled or server shutting down.'));
    if (active.size) return Promise.resolve(failureResult('CLI busy or previous child termination unconfirmed.'));
    let child;
    try {
      child = (hooks.spawn || spawn)('pwsh', ['-NoProfile', '-NonInteractive', '-File', cliEntry, ...args], {
        cwd: workspaceRoot, env: {
          ...process.env, FRONTIER_NONINTERACTIVE: '1', FRONTIER_NONINTERACTIVE_HUMAN: '1',
          FRONTIER_WORKSPACE_ROOT: workspaceRoot,
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
      let progressBuffer = '';
      const stdoutDecoder = new StringDecoder('utf8');
      const stderrDecoder = new StringDecoder('utf8');
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
        const decoder = stream === 'stdout' ? stdoutDecoder : stderrDecoder;
        const text = decoder.write(data.subarray(0, available));
        if (stream === 'stdout') stdout += text; else stderr += text;
        bytes += Math.min(available, data.length);
        if (data.length > available) terminate(`[output-limit] Output exceeded ${maxBytes} bytes.`);
        if (stream === 'stdout' && onProgress && !failure) {
          progressBuffer += text;
          const lines = progressBuffer.split(/\r?\n/);
          progressBuffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith('[MILESTONE]')) onProgress(line);
          }
        }
      };
      const timeout = setTimeout(() => terminate('[timeout] CLI execution timed out.'), hooks.timeoutMs || 600000);
      child.stdout.on('data', chunk => capture(chunk, 'stdout'));
      child.stderr.on('data', chunk => capture(chunk, 'stderr'));
      child.on('error', error => terminate(`[spawn-error] ${error.message}`));
      child.once('close', code => {
        stdout += stdoutDecoder.end();
        stderr += stderrDecoder.end();
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
    isError: ![0, 3, 4].includes(exitCode),
    ...(exitCode === 3 ? { structuredContent: { status: 'pending_owner_review_or_verification', exitCode } } : {}),
    ...(exitCode === 4 ? { structuredContent: { status: 'cancelled', exitCode } } : {}),
  };
}

function readRunResult(result) {
  const lastLine = result.stdout.trim().split(/\r?\n/).at(-1);
  try { return JSON.parse(lastLine); }
  catch { throw new Error('Frontier run returned no valid final JSON result. No approval was recorded.'); }
}

function pendingToolResult(pending, message = 'User input is required before this task can continue.') {
  return {
    content: [{ type: 'text', text: `${message}\n${JSON.stringify(pending, null, 2)}` }],
    structuredContent: { status: 'awaiting_user_input', pendingInteraction: pending },
    isError: false,
  };
}

function authorizationToolResult(status, message) {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { status, sessionCreated: false },
    isError: false,
  };
}

function supportsFormInput(server) {
  const capability = server.getClientCapabilities()?.elicitation;
  return !!capability && ('form' in capability || Object.keys(capability).length === 0);
}

async function resumeWithHostInput(server, runner, pending, signal, onProgress) {
  if (!pending || typeof pending.sessionId !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(pending.sessionId) ||
      !/^[a-f0-9]{32}$/.test(pending.inputId) || !['plan', 'question'].includes(pending.kind)) {
    throw new Error('Invalid pending-input state from the native runtime.');
  }
  if (!supportsFormInput(server)) {
    return pendingToolResult(pending,
      'This host has no form elicitation. The task remains pending; respond using the trusted Frontier CLI run/resume command.');
  }
  const isPlan = pending.kind === 'plan';
  if (isPlan && (!Number.isInteger(pending.planVersion) || pending.planVersion < 1 ||
      !/^[a-f0-9]{64}$/.test(pending.digest) || !pending.plan)) {
    throw new Error('Pending plan identity is invalid.');
  }
  let response;
  try {
    response = await server.elicitInput({
      mode: 'form',
      message: isPlan
        ? `Review the exact Frontier plan below. Approval does not authorize separate test or release gates.\n${JSON.stringify(pending, null, 2)}`
        : `${pending.question}${pending.choices?.length ? `\nChoices: ${pending.choices.join('; ')}` : ''}`,
      requestedSchema: isPlan ? {
        type: 'object',
        properties: {
          decision: { type: 'string', enum: ['approve', 'revise', 'cancel_task'], title: 'Plan decision' },
          feedback: { type: 'string', maxLength: 12000, title: 'Changes requested (required for revise)' },
        },
        required: ['decision'],
      } : {
        type: 'object',
        properties: { answer: { type: 'string', minLength: 1, maxLength: 12000, title: 'Your answer' } },
        required: ['answer'],
      },
    }, { signal, timeout: 120000 });
  } catch (error) {
    return pendingToolResult(pending, `Host input was unavailable: ${error.message}. No decision was applied.`);
  }
  if (response.action !== 'accept') {
    return pendingToolResult(pending, 'The input request was declined or dismissed. No approval was recorded.');
  }
  const content = response.content || {};
  const args = ['run', '--resume-session', pending.sessionId, '--input-id', pending.inputId];
  if (isPlan) {
    if (!['approve', 'revise', 'cancel_task'].includes(content.decision)) {
      return pendingToolResult(pending, 'A valid explicit plan decision is required.');
    }
    const feedback = typeof content.feedback === 'string' ? content.feedback.trim() : '';
    if ((content.decision === 'approve' && feedback) ||
        (content.decision === 'revise' && !feedback)) {
      return pendingToolResult(pending, 'Request changes with feedback, or approve the unchanged plan. Approval with edits is not supported.');
    }
    args.push('--input-decision', content.decision === 'cancel_task' ? 'cancel' : content.decision,
      '--plan-version', String(pending.planVersion), '--plan-digest', pending.digest);
    if (feedback) args.push('--clarification-response', feedback);
  } else {
    if (typeof content.answer !== 'string' || !content.answer.trim()) {
      return pendingToolResult(pending, 'An empty answer does not resolve the question.');
    }
    args.push('--input-decision', 'answer', '--clarification-response', content.answer);
  }
  args.push('--json');
  const result = await runner.run(args, signal, onProgress);
  if (result.exitCode === 2) {
    return pendingToolResult(readRunResult(result).pendingInteraction);
  }
  return toolResult(result);
}

// ---------- tool catalog ----------

const TOOLS = [
  {
    name: 'frontier_workspace',
    description: 'Report the bound source workspace, selected state directory, runtime location, indexing policy and host-tool boundary. Use this instead of assuming repository-local .frontier state.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    build: () => ['workspace-state', 'info'],
  },
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
    name: 'frontier_loop_prepare',
    description:
      'Prepare non-test loop evidence: run incremental preflight, create a factual review packet, diagnose reviewer file/diff access, or record phase timing. Never executes test suites or grants approval. A reviewer-check describes only the host that actually calls it.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['preflight', 'review-packet', 'reviewer-check', 'timing'] },
        stage: { type: 'string', enum: ['boundary', 'final'] },
        requirements: { type: 'string', description: 'Workspace-relative requirements document for a review packet' },
        packet: { type: 'string', description: 'Generated packet path for reviewer-check' },
        reviewer: { type: 'string', description: 'Calling reviewer id, not an approval or identity attestation' },
        phase: { type: 'string', enum: ['implementation', 'verification', 'review', 'rework', 'waiting'] },
        stop: { type: 'boolean', description: 'Stop attributed timing; unreported intervals remain unattributed' },
        force: { type: 'boolean', description: 'Re-execute non-test preflight checks instead of reusing eligible receipts' },
      },
      required: ['action'],
    },
    build: a => {
      const fields = {
        preflight: ['force'],
        'review-packet': ['stage', 'requirements'],
        'reviewer-check': ['packet', 'reviewer'],
        timing: ['phase', 'stop'],
      };
      if (!Object.hasOwn(fields, a.action) || Object.keys(a).some(key => key !== 'action' && !fields[a.action].includes(key))) {
        throw new Error('Unsupported loop preparation action or argument.');
      }
      for (const key of fields[a.action]) {
        if (a[key] === undefined) continue;
        if (['force', 'stop'].includes(key)) {
          if (typeof a[key] !== 'boolean') throw new Error(`${key} must be a boolean.`);
        } else if (typeof a[key] !== 'string' || !a[key].trim() || a[key].length > 4096 || /[\u0000-\u001f]/.test(a[key])) {
          throw new Error(`${key} must be bounded nonempty text.`);
        }
      }
      if (a.stage && !['boundary', 'final'].includes(a.stage)) throw new Error('Unsupported review stage.');
      if (a.phase && !['implementation', 'verification', 'review', 'rework', 'waiting'].includes(a.phase)) {
        throw new Error('Unsupported timing phase.');
      }
      if (a.action === 'reviewer-check' && (!a.packet || !a.reviewer)) throw new Error('packet and reviewer are required.');
      if (a.stop && a.phase) throw new Error('Specify phase or stop, not both.');
      return ['loop', a.action, '--json',
        ...(a.stage ? ['--stage', a.stage] : []),
        ...(a.requirements ? ['--requirements', a.requirements] : []),
        ...(a.packet ? ['--packet', a.packet] : []),
        ...(a.reviewer ? ['--reviewer', a.reviewer] : []),
        ...(a.phase ? ['--phase', a.phase] : []),
        ...(a.stop ? ['--stop'] : []), ...(a.force ? ['--force'] : []),
      ];
    },
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
    description: 'Run the configured ship pipeline for an issue. Private workspaces use the installed Frontier script, never a same-named project script. Separate test and delivery consent gates still apply.',
    inputSchema: {
      type: 'object',
      properties: { issue: { type: 'number' } },
      required: ['issue'],
    },
    build: (a) => ['ship', '-Issue', String(a.issue)],
  },
  {
    name: 'frontier_context',
    description: 'Return bounded task-relevant source pointers from the selected Frontier workspace. Reads the cached graph by default and schedules a background refresh when stale; sync updates incrementally first and refresh re-extracts everything. Preserves curated map notes and indexing policy; no model calls.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 4096, description: 'Task, symbol or area to locate; omit for repository orientation.' },
        agent: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9-]{0,79}$', description: 'Optional role ID, such as engineer.' },
        maxChars: { type: 'integer', minimum: 512, maximum: 16000 },
        tokenBudget: { type: 'integer', minimum: 256, maximum: 8000 },
        detail: { type: 'string', enum: ['map', 'evidence'] },
        graphHops: { type: 'integer', minimum: 0, maximum: 2 },
        subsystem: { type: 'string', maxLength: 256 },
        sync: { type: 'boolean', default: false, description: 'Update the graph incrementally before answering.' },
        refresh: { type: 'boolean', default: false, description: 'Re-extract every file before answering (slowest).' },
      },
      additionalProperties: false,
    },
    build: (a) => {
      if (Object.keys(a).some(key => !['query', 'agent', 'maxChars', 'tokenBudget', 'detail', 'graphHops', 'subsystem', 'sync', 'refresh'].includes(key))) {
        throw new Error('Unsupported repository context argument.');
      }
      const query = a.query === undefined ? '' : a.query;
      const maxChars = a.maxChars === undefined ? (a.tokenBudget === undefined ? 4000 : 16000) : a.maxChars;
      if (typeof query !== 'string' || query.length > 4096) throw new Error('query must be a string of at most 4096 characters.');
      if (!Number.isInteger(maxChars) || maxChars < 512 || maxChars > 16000) throw new Error('maxChars must be an integer from 512 to 16000.');
      if (a.agent !== undefined && (typeof a.agent !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/i.test(a.agent))) throw new Error('agent must be a role ID.');
      if (a.sync !== undefined && typeof a.sync !== 'boolean') throw new Error('sync must be boolean.');
      if (a.refresh !== undefined && typeof a.refresh !== 'boolean') throw new Error('refresh must be boolean.');
      if (a.tokenBudget !== undefined && (!Number.isInteger(a.tokenBudget) || a.tokenBudget < 256 || a.tokenBudget > 8000)) throw new Error('tokenBudget must be an integer from 256 to 8000.');
      if (a.detail !== undefined && !['map', 'evidence'].includes(a.detail)) throw new Error('detail must be map or evidence.');
      if (a.graphHops !== undefined && (!Number.isInteger(a.graphHops) || a.graphHops < 0 || a.graphHops > 2)) throw new Error('graphHops must be 0, 1 or 2.');
      if (a.subsystem !== undefined && (typeof a.subsystem !== 'string' || a.subsystem.length > 256 ||
          /(^|[\\/])\.\.?([\\/]|$)|^[\\/]|[\x00-\x1f:*?"<>|]/.test(a.subsystem))) throw new Error('subsystem must be a relative directory prefix.');
      const args = ['context', '--json', '--query64', Buffer.from(query, 'utf8').toString('base64'), '--max-chars', String(maxChars)];
      if (a.agent) args.push('-a', a.agent);
      if (a.sync) args.push('--sync');
      if (a.refresh) args.push('--refresh');
      if (a.tokenBudget !== undefined) args.push('--tokens', String(a.tokenBudget));
      if (a.detail !== undefined) args.push('--detail', a.detail);
      if (a.graphHops !== undefined) args.push('--hops', String(a.graphHops));
      if (a.subsystem !== undefined) args.push('--subsystem64', Buffer.from(a.subsystem, 'utf8').toString('base64'));
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
      'Run a named Frontier agent in guided mode: clarify, propose a plan, wait for host input, then report milestones. HydraFusion requires host-confirmed bounded automation, an active owner loop and explicit credit budget; candidates still need independent approval.',
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
      additionalProperties: false,
    },
    build: (a) => {
      if (Object.keys(a).some(key => !['agent', 'prompt', 'model', 'max', 'issue', 'engine', 'feedback'].includes(key))) {
        throw new Error('Unsupported run argument; model-supplied approval or interaction overrides are not accepted.');
      }
      if (typeof a.agent !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(a.agent) ||
          typeof a.prompt !== 'string' || !a.prompt.trim() || a.prompt.length > 16000) {
        throw new Error('A valid agent ID and task prompt of at most 16000 characters are required.');
      }
      if (a.engine !== undefined && !['native', 'hydrafusion'].includes(a.engine)) {
        throw new Error('engine must be native or hydrafusion.');
      }
      if (a.max !== undefined && (!Number.isInteger(a.max) || a.max < 1 || a.max > 1000)) {
        throw new Error('max must be an integer from 1 to 1000.');
      }
      if (a.feedback !== undefined && (typeof a.feedback !== 'string' || !a.feedback.trim())) {
        throw new Error('feedback must name an owner-recorded report.');
      }
      const args = ['run', '-a', a.agent, '-p', a.prompt, '--json'];
      if (a.model) args.push('-m', a.model);
      if (a.max != null) args.push('--max', String(a.max));
      if (a.issue != null) args.push('-i', String(a.issue));
      if (a.engine) args.push('--engine', a.engine);
      if (a.feedback) args.push('--feedback', a.feedback);
      return args;
    },
  },
  {
    name: 'frontier_resume',
    description: 'Inspect a pending native task and request genuine user input through host elicitation. No model-supplied approval or answer is accepted. Unsupported hosts remain pending.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$' } },
      required: ['sessionId'],
      additionalProperties: false,
    },
    build: (a) => {
      if (Object.keys(a).some(key => key !== 'sessionId') ||
          typeof a.sessionId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(a.sessionId)) {
        throw new Error('A valid sessionId is required; decisions must come from host input.');
      }
      return ['run', '--session-info', a.sessionId, '--json'];
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
    description: 'Stage stable discovered patterns as skills for human review; they are not loaded by agents until published with the frontier graduate publish CLI command.',
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

function createServer(runner) {
const server = new Server(
  { name: 'frontier', version: '9.8.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const tool = TOOL_BY_NAME[req.params.name];
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      isError: true,
    };
  }
  let argv;
  let progressSequence = 0;
  const progressToken = req.params._meta?.progressToken;
  const onProgress = progressToken === undefined ? undefined : (message) => {
    void extra.sendNotification({
      method: 'notifications/progress',
      params: { progressToken, progress: ++progressSequence, message },
    }).catch(error => {
      process.stderr.write(`[frontier-mcp] progress delivery failed: ${error.message}\n`);
    });
  };
  try {
    argv = tool.build(req.params.arguments || {});
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${err.message}` }],
      isError: true,
    };
  }
  if (tool.name === 'frontier_run' && req.params.arguments?.engine === 'hydrafusion') {
    if (!supportsFormInput(server)) {
      return authorizationToolResult('authorization_required', 'HydraFusion requires explicit bounded automation authorization. This host cannot collect it; use the trusted CLI with --interaction autonomous after reviewing the task and budget. No session was created.');
    }
    try {
      const authorization = await server.elicitInput({
        mode: 'form',
        message: `Authorize this bounded HydraFusion candidate task? Existing tool, budget, independent review and test gates remain unchanged.\n${JSON.stringify(req.params.arguments)}`,
        requestedSchema: {
          type: 'object',
          properties: { authorize: { type: 'boolean', title: 'Authorize this candidate task without guided planning' } },
          required: ['authorize'],
        },
      }, { signal: extra.signal, timeout: 120000 });
      if (authorization.action !== 'accept' || authorization.content?.authorize !== true) {
        return authorizationToolResult('not_authorized', 'Candidate execution was not authorized; no session or model call was created.');
      }
      argv.push('--interaction', 'autonomous');
    } catch (error) {
      return authorizationToolResult('authorization_required', `Host authorization was unavailable: ${error.message}. No session or candidate was created.`);
    }
  }
  const result = await runner.run(argv, extra.signal, onProgress);
  if (tool.name === 'frontier_context' && result.exitCode === 0) {
    try {
      const packet = JSON.parse(result.stdout.trim());
      if (typeof packet.context !== 'string') throw new Error('Missing bounded context.');
      const { context, ...metadata } = packet;
      return {
        content: [{ type: 'text', text: context }],
        structuredContent: metadata,
        isError: packet.status === 'incompatible',
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Invalid repository context response: ${error.message}` }], isError: true };
    }
  }
  if (tool.name === 'frontier_resume' || (tool.name === 'frontier_run' && result.exitCode === 2)) {
    if (![0, 2].includes(result.exitCode)) return toolResult(result);
    try {
      const pending = readRunResult(result).pendingInteraction;
      if (!pending) {
        return { content: [{ type: 'text', text: 'This session has no pending input. Inspect its status; no decision was applied.' }], isError: true };
      }
      return await resumeWithHostInput(server, runner, pending, extra.signal, onProgress);
    } catch (error) {
      return { content: [{ type: 'text', text: `Frontier input error: ${error.message}` }], isError: true };
    }
  }
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
  const runner = createCliRunner(repoRoot, {
    workspaceRoot: process.env.FRONTIER_WORKSPACE_ROOT ?? repoRoot,
  });
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
