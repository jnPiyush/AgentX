#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AgentX CLI - Unified Node.js implementation
// ---------------------------------------------------------------------------
// Replaces agentx.ps1, agentx.sh, local-issue-manager.ps1/sh,
// validate-handoff, capture-context, collect-metrics, and setup-hooks.
//
// Usage:
//   node .agentx/cli.mjs ready
//   node .agentx/cli.mjs issue create -t "Title" -l "type:story"
//   node .agentx/cli.mjs state -a engineer -s working -i 42
//   node .agentx/cli.mjs deps 42
//   node .agentx/cli.mjs workflow feature
//   node .agentx/cli.mjs loop start -p "Fix tests" -m 20
//   node .agentx/cli.mjs validate 42 engineer
//   node .agentx/cli.mjs hooks install
//   node .agentx/cli.mjs digest
//   node .agentx/cli.mjs version
//   node .agentx/cli.mjs help
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync, rmSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..');
const AGENTX_DIR = join(ROOT, '.agentx');
const STATE_FILE = join(AGENTX_DIR, 'state', 'agent-status.json');
const LOOP_STATE_FILE = join(AGENTX_DIR, 'state', 'loop-state.json');
const ISSUES_DIR = join(AGENTX_DIR, 'issues');
const WORKFLOWS_DIR = join(AGENTX_DIR, 'workflows');
const DIGESTS_DIR = join(AGENTX_DIR, 'digests');
const CONFIG_FILE = join(AGENTX_DIR, 'config.json');
const VERSION_FILE = join(AGENTX_DIR, 'version.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function readJson(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function writeJson(p, data) {
  ensureDir(dirname(p));
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function now() { return new Date().toISOString(); }

function getConfig() {
  return readJson(CONFIG_FILE) || { mode: 'local' };
}

function getMode() { return getConfig().mode || 'local'; }

function shell(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim(); }
  catch { return ''; }
}

// Colors (ANSI)
const C = {
  r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m',
  m: '\x1b[35m', c: '\x1b[36m', w: '\x1b[37m', d: '\x1b[90m', n: '\x1b[0m',
};

function log(msg) { console.log(msg); }

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0] || 'help';
const subArgs = args.slice(1);

function getFlag(flags, def) {
  for (let i = 0; i < subArgs.length; i++) {
    if (flags.includes(subArgs[i]) && i + 1 < subArgs.length) return subArgs[i + 1];
  }
  return def;
}

function hasFlag(flags) {
  return subArgs.some(a => flags.includes(a));
}

const jsonOutput = hasFlag(['--json', '-j']);

// ---------------------------------------------------------------------------
// ISSUE: Local issue manager
// ---------------------------------------------------------------------------

function issueCmd() {
  const action = subArgs[0] || 'list';
  switch (action) {
    case 'create': return issueCreate();
    case 'update': return issueUpdate();
    case 'close':  return issueClose();
    case 'get':    return issueGet();
    case 'comment': return issueComment();
    case 'list':   return issueList();
    default: log(`Unknown issue action: ${action}`); process.exit(1);
  }
}

function getNextIssueNumber() {
  const cfg = getConfig();
  const num = cfg.nextIssueNumber || 1;
  cfg.nextIssueNumber = num + 1;
  writeJson(CONFIG_FILE, cfg);
  return num;
}

function getIssue(num) { return readJson(join(ISSUES_DIR, `${num}.json`)); }

function saveIssue(issue) {
  ensureDir(ISSUES_DIR);
  writeJson(join(ISSUES_DIR, `${issue.number}.json`), issue);
}

function issueCreate() {
  const title = getFlag(['-t', '--title'], '');
  const body = getFlag(['-b', '--body'], '');
  const labelStr = getFlag(['-l', '--labels'], '');
  if (!title) { log('Error: --title is required'); process.exit(1); }

  const labels = labelStr.split(',').map(s => s.trim()).filter(Boolean);
  const num = getNextIssueNumber();
  const issue = {
    number: num, title, body, labels, status: 'Backlog', state: 'open',
    created: now(), updated: now(), comments: [],
  };
  saveIssue(issue);
  log(`${C.g}Created issue #${num}: ${title}${C.n}`);
  if (jsonOutput) log(JSON.stringify(issue, null, 2));
}

function issueUpdate() {
  const num = parseInt(getFlag(['-n', '--number'], '0'));
  if (!num) { log('Error: --number required'); process.exit(1); }
  const issue = getIssue(num);
  if (!issue) { log(`Error: Issue #${num} not found`); process.exit(1); }

  const title = getFlag(['-t', '--title'], '');
  const status = getFlag(['-s', '--status'], '');
  const labelStr = getFlag(['-l', '--labels'], '');
  if (title) issue.title = title;
  if (status) issue.status = status;
  if (labelStr) issue.labels = labelStr.split(',').map(s => s.trim()).filter(Boolean);
  issue.updated = now();
  saveIssue(issue);
  log(`${C.g}Updated issue #${num}${C.n}`);
  if (jsonOutput) log(JSON.stringify(issue, null, 2));
}

function issueClose() {
  const num = parseInt(getFlag(['-n', '--number'], '') || subArgs[1] || '0');
  if (!num) { log('Error: issue number required'); process.exit(1); }
  const issue = getIssue(num);
  if (!issue) { log(`Error: Issue #${num} not found`); process.exit(1); }
  issue.state = 'closed'; issue.status = 'Done'; issue.updated = now();
  saveIssue(issue);
  log(`${C.g}Closed issue #${num}${C.n}`);
}

function issueGet() {
  const num = parseInt(getFlag(['-n', '--number'], '') || subArgs[1] || '0');
  if (!num) { log('Error: issue number required'); process.exit(1); }
  const issue = getIssue(num);
  if (!issue) { log(`Error: Issue #${num} not found`); process.exit(1); }
  log(JSON.stringify(issue, null, 2));
}

function issueComment() {
  const num = parseInt(getFlag(['-n', '--number'], '0'));
  const body = getFlag(['-c', '--comment', '-b', '--body'], '');
  if (!num || !body) { log('Error: --number and --comment required'); process.exit(1); }
  const issue = getIssue(num);
  if (!issue) { log(`Error: Issue #${num} not found`); process.exit(1); }
  issue.comments.push({ body, created: now() });
  issue.updated = now();
  saveIssue(issue);
  log(`${C.g}Added comment to issue #${num}${C.n}`);
}

function issueList() {
  if (!existsSync(ISSUES_DIR)) { log('No issues found.'); return; }
  const files = readdirSync(ISSUES_DIR).filter(f => f.endsWith('.json'));
  const issues = files.map(f => readJson(join(ISSUES_DIR, f))).filter(Boolean);
  issues.sort((a, b) => b.number - a.number);

  if (jsonOutput) { log(JSON.stringify(issues, null, 2)); return; }
  if (issues.length === 0) { log(`${C.y}No issues found.${C.n}`); return; }

  log(`\n${C.c}Local Issues:${C.n}`);
  log(`${C.c}===========================================================${C.n}`);
  for (const i of issues) {
    const icon = i.state === 'open' ? '( )' : '(*)';
    const labels = i.labels?.length ? ` [${i.labels.join(', ')}]` : '';
    log(`${icon} #${i.number} ${i.status} - ${i.title}${labels}`);
  }
  log(`${C.c}===========================================================${C.n}`);
}

// ---------------------------------------------------------------------------
// READY: Show unblocked work
// ---------------------------------------------------------------------------

function getAllIssues() {
  const mode = getMode();
  if (mode === 'github') {
    try {
      const json = shell('gh issue list --state open --json number,title,labels,body,state --limit 200');
      if (json) {
        return JSON.parse(json).map(i => ({
          number: i.number, title: i.title, body: i.body || '', state: i.state,
          labels: (i.labels || []).map(l => l.name), status: '',
        }));
      }
    } catch { /* fall through to local */ }
  }
  if (!existsSync(ISSUES_DIR)) return [];
  return readdirSync(ISSUES_DIR).filter(f => f.endsWith('.json'))
    .map(f => readJson(join(ISSUES_DIR, f))).filter(Boolean);
}

function parseDeps(issue) {
  const deps = { blocks: [], blocked_by: [] };
  if (!issue.body) return deps;
  let inDeps = false;
  for (const line of issue.body.split('\n')) {
    if (/^\s*##\s*Dependencies/i.test(line)) { inDeps = true; continue; }
    if (/^\s*##\s/.test(line) && inDeps) break;
    if (!inDeps) continue;
    const blocksMatch = line.match(/^\s*-?\s*Blocks:\s*(.+)/i);
    if (blocksMatch) deps.blocks = [...blocksMatch[1].matchAll(/#(\d+)/g)].map(m => +m[1]);
    const byMatch = line.match(/^\s*-?\s*Blocked[- ]by:\s*(.+)/i);
    if (byMatch) deps.blocked_by = [...byMatch[1].matchAll(/#(\d+)/g)].map(m => +m[1]);
  }
  return deps;
}

function getPriority(issue) {
  for (const l of (issue.labels || [])) {
    const m = (typeof l === 'string' ? l : l.name || '').match(/priority:p(\d)/);
    if (m) return +m[1];
  }
  return 9;
}

function getType(issue) {
  for (const l of (issue.labels || [])) {
    const m = (typeof l === 'string' ? l : l.name || '').match(/type:(\w+)/);
    if (m) return m[1];
  }
  return 'story';
}

function cmdReady() {
  const all = getAllIssues();
  const mode = getMode();
  let open = mode === 'local'
    ? all.filter(i => i.state === 'open' && i.status === 'Ready')
    : all.filter(i => i.state === 'open');

  const ready = open.filter(issue => {
    const deps = parseDeps(issue);
    return !deps.blocked_by.some(bid => {
      const b = all.find(i => i.number === bid);
      return b && b.state === 'open';
    });
  }).sort((a, b) => getPriority(a) - getPriority(b));

  if (jsonOutput) { log(JSON.stringify(ready, null, 2)); return; }
  if (ready.length === 0) { log('No ready work found.'); return; }

  log(`\n${C.c}  Ready Work (unblocked, sorted by priority):${C.n}`);
  log(`${C.d}  ---------------------------------------------${C.n}`);
  for (const i of ready) {
    const p = getPriority(i);
    const pLabel = p < 9 ? `P${p}` : '  ';
    const pc = p === 0 ? C.r : p === 1 ? C.y : C.d;
    log(`  ${pc}[${pLabel}]${C.n} ${C.c}#${i.number}${C.n} ${C.d}(${getType(i)})${C.n} ${i.title}`);
  }
  log('');
}

// ---------------------------------------------------------------------------
// STATE: Agent status tracking
// ---------------------------------------------------------------------------

function cmdState() {
  const agent = getFlag(['-a', '--agent'], '');
  const set = getFlag(['-s', '--set'], '');
  const issue = parseInt(getFlag(['-i', '--issue'], '0'));

  const data = readJson(STATE_FILE) || {};

  if (agent && set) {
    data[agent] = { status: set, issue: issue || null, lastActivity: now() };
    writeJson(STATE_FILE, data);
    log(`${C.g}  Agent '${agent}' -> ${set}${C.n}`);
    if (issue) log(`${C.d}  Working on: #${issue}${C.n}`);
    return;
  }

  if (jsonOutput) { log(JSON.stringify(data, null, 2)); return; }

  log(`\n${C.c}  Agent Status:${C.n}`);
  log(`${C.d}  ---------------------------------------------${C.n}`);
  const agents = ['product-manager', 'ux-designer', 'architect', 'engineer', 'reviewer', 'devops-engineer'];
  for (const a of agents) {
    const info = data[a];
    const status = info?.status || 'idle';
    const sc = { working: C.y, reviewing: C.m, stuck: C.r, done: C.g }[status] || C.d;
    const ref = info?.issue ? ` -> #${info.issue}` : '';
    const dt = info?.lastActivity ? ` (${info.lastActivity.substring(0, 10)})` : '';
    log(`  ${C.w}${a}${C.n} ${sc}[${status}]${C.n}${C.d}${ref}${dt}${C.n}`);
  }
  log('');
}

// ---------------------------------------------------------------------------
// DEPS: Dependency check
// ---------------------------------------------------------------------------

function cmdDeps() {
  const num = parseInt(subArgs[0] || getFlag(['-n', '--number'], '0'));
  if (!num) { log('Usage: agentx deps <issue-number>'); process.exit(1); }

  const all = getAllIssues();
  const issue = all.find(i => i.number === num);
  if (!issue) { log(`Error: Issue #${num} not found`); process.exit(1); }

  const deps = parseDeps(issue);
  let hasBlockers = false;

  log(`\n${C.c}  Dependency Check: #${num} - ${issue.title}${C.n}`);
  log(`${C.d}  ---------------------------------------------${C.n}`);

  if (deps.blocked_by.length > 0) {
    log(`${C.y}  Blocked by:${C.n}`);
    for (const bid of deps.blocked_by) {
      const b = all.find(i => i.number === bid);
      if (b) {
        const ok = b.state === 'closed';
        log(`    ${ok ? C.g + '[PASS]' : C.r + '[FAIL]'} #${bid} - ${b.title} [${b.state}]${C.n}`);
        if (!ok) hasBlockers = true;
      } else {
        log(`    ${C.y}? #${bid} - (not found)${C.n}`);
      }
    }
  } else {
    log(`${C.g}  No blockers - ready to start.${C.n}`);
  }

  if (deps.blocks.length > 0) {
    log(`${C.d}  Blocks:${C.n}`);
    for (const bid of deps.blocks) {
      const b = all.find(i => i.number === bid);
      log(`${C.d}    -> #${bid} - ${b?.title || '(not found)'}${C.n}`);
    }
  }

  log(hasBlockers ? `\n${C.r}  [WARN] BLOCKED - resolve open blockers first.${C.n}\n`
                  : `\n${C.g}  [PASS] All clear - issue is unblocked.${C.n}\n`);
}

// ---------------------------------------------------------------------------
// DIGEST: Weekly summary
// ---------------------------------------------------------------------------

function cmdDigest() {
  ensureDir(DIGESTS_DIR);
  const all = getAllIssues();
  const closed = all.filter(i => i.state === 'closed').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  if (closed.length === 0) { log('No closed issues to digest.'); return; }

  const d = new Date();
  const weekNum = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + new Date(d.getFullYear(), 0, 1).getDay()) / 7)).padStart(2, '0')}`;
  const digestFile = join(DIGESTS_DIR, `DIGEST-${weekNum}.md`);

  const lines = [
    `# Weekly Digest - ${weekNum}`, '',
    `> Auto-generated on ${d.toISOString().substring(0, 16)}`, '',
    '## Completed Issues', '',
    '| # | Type | Title | Closed |', '|---|------|-------|--------|',
  ];
  for (const i of closed) {
    lines.push(`| #${i.number} | ${getType(i)} | ${i.title} | ${(i.updated || '').substring(0, 10)} |`);
  }
  lines.push('', '## Key Decisions', '', '_Review closed issues above and note key decisions._', '',
    '## Outcomes', '', `- **Issues closed**: ${closed.length}`, `- **Generated**: ${d.toISOString().substring(0, 10)}`, '');

  writeFileSync(digestFile, lines.join('\n'));
  log(`${C.g}  Digest generated: ${digestFile}${C.n}`);
  log(`${C.d}  Closed issues: ${closed.length}${C.n}`);
}

// ---------------------------------------------------------------------------
// WORKFLOW: Show/run workflow steps
// ---------------------------------------------------------------------------

function parseToml(file) {
  const content = readFileSync(file, 'utf-8');
  const steps = []; let cur = null; let wfName = ''; let wfDesc = '';
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (t === '[[steps]]') {
      if (cur) steps.push(cur);
      cur = { id: '', title: '', agent: '', needs: [], iterate: false, max_iterations: 10, completion_criteria: '', optional: false, condition: '', status_on_start: '', status_on_complete: '', output: '', template: '' };
    } else if (cur) {
      const m = t.match(/^(\w+)\s*=\s*(.+)$/);
      if (m) {
        const [, k, raw] = m;
        const v = raw.replace(/^["']|["']$/g, '').trim();
        if (k === 'needs') { cur.needs = v.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean); }
        else if (k === 'iterate' || k === 'optional') { cur[k] = v === 'true'; }
        else if (k === 'max_iterations') { cur[k] = parseInt(v) || 10; }
        else { cur[k] = v; }
      }
    } else {
      const nm = t.match(/^name\s*=\s*"(.+)"/);
      if (nm) wfName = nm[1];
      const dm = t.match(/^description\s*=\s*"(.+)"/);
      if (dm) wfDesc = dm[1];
    }
  }
  if (cur) steps.push(cur);
  return { name: wfName, description: wfDesc, steps };
}

function cmdWorkflow() {
  const type = subArgs[0] || getFlag(['-t', '--type'], '');
  if (!type) {
    log(`\n${C.c}  Available Workflows:${C.n}`);
    log(`${C.d}  ---------------------------------------------${C.n}`);
    if (existsSync(WORKFLOWS_DIR)) {
      for (const f of readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.toml'))) {
        const wf = parseToml(join(WORKFLOWS_DIR, f));
        log(`  ${C.w}${basename(f, '.toml')}${C.n} ${C.d}- ${wf.description}${C.n}`);
      }
    }
    log(`\n${C.d}  Usage: agentx workflow <type>${C.n}\n`);
    return;
  }

  const wfFile = join(WORKFLOWS_DIR, `${type}.toml`);
  if (!existsSync(wfFile)) { log(`Error: Workflow '${type}' not found`); process.exit(1); }

  const wf = parseToml(wfFile);
  log(`\n${C.c}  Workflow: ${type}${C.n}`);
  log(`${C.d}  ---------------------------------------------${C.n}`);

  let n = 1;
  for (const s of wf.steps) {
    const needs = s.needs.length ? ` ${C.d}(after: ${s.needs.join(', ')})${C.n}` : '';
    log(`  ${C.c}${n}.${C.n} ${C.w}${s.id}${C.n} -> ${C.y}${s.agent}${C.n}${needs}`);
    log(`${C.d}     ${s.title}${C.n}`);
    if (s.iterate) log(`     ${C.m}[LOOP] max ${s.max_iterations} iterations${C.n}`);
    n++;
  }
  log('');
}

// ---------------------------------------------------------------------------
// LOOP: Iterative refinement
// ---------------------------------------------------------------------------

function cmdLoop() {
  const action = subArgs[0] || 'status';
  switch (action) {
    case 'start':    return loopStart();
    case 'status':   return loopStatus();
    case 'iterate':  return loopIterate();
    case 'complete': return loopComplete();
    case 'cancel':   return loopCancel();
    default: log(`Unknown loop action: ${action}`);
  }
}

function loopStart() {
  const prompt = getFlag(['-p', '--prompt'], '');
  if (!prompt) { log('Error: --prompt required'); process.exit(1); }
  const max = parseInt(getFlag(['-m', '--max'], '20'));
  const criteria = getFlag(['-c', '--criteria'], 'TASK_COMPLETE');
  const issue = parseInt(getFlag(['-i', '--issue'], '0')) || null;

  const existing = readJson(LOOP_STATE_FILE);
  if (existing?.active) { log('An active loop exists. Cancel it first.'); return; }

  const state = {
    active: true, status: 'active', prompt, iteration: 1,
    maxIterations: max, completionCriteria: criteria,
    issueNumber: issue, startedAt: now(), lastIterationAt: now(),
    history: [{ iteration: 1, timestamp: now(), summary: 'Loop started', status: 'in-progress' }],
  };
  writeJson(LOOP_STATE_FILE, state);

  log(`\n${C.c}  Iterative Loop Started${C.n}`);
  log(`${C.d}  Iteration: 1/${max}  |  Criteria: ${criteria}${C.n}`);
  if (issue) log(`${C.d}  Issue: #${issue}${C.n}`);
  log(`\n${C.w}  Prompt:${C.n} ${prompt}\n`);
}

function loopStatus() {
  const state = readJson(LOOP_STATE_FILE);
  if (!state) { if (jsonOutput) log('{"active":false}'); else log('  No active loop.'); return; }
  if (jsonOutput) { log(JSON.stringify(state, null, 2)); return; }

  log(`\n${C.c}  Iterative Loop Status${C.n}`);
  log(`${C.d}  Active: ${state.active}  |  Iteration: ${state.iteration}/${state.maxIterations}${C.n}`);
  log(`${C.d}  Criteria: ${state.completionCriteria}${C.n}`);
  if (state.history?.length) {
    log(`\n${C.w}  History (last 5):${C.n}`);
    for (const h of state.history.slice(-5)) {
      log(`${C.d}    ${h.status === 'complete' ? '[PASS]' : '[...]'} Iteration ${h.iteration}: ${h.summary}${C.n}`);
    }
  }
  log('');
}

function loopIterate() {
  const state = readJson(LOOP_STATE_FILE);
  if (!state) { log('No loop state found.'); return; }
  if (!state.active) { state.active = true; state.status = 'active'; }

  const next = state.iteration + 1;
  if (next > state.maxIterations) {
    state.active = false;
    state.history.push({ iteration: next, timestamp: now(), summary: 'Max iterations reached', status: 'stopped' });
    writeJson(LOOP_STATE_FILE, state);
    log(`${C.r}  Max iterations (${state.maxIterations}) reached. Loop stopped.${C.n}`);
    return;
  }

  const summary = getFlag(['-s', '--summary'], `Iteration ${next}`);
  state.iteration = next;
  state.lastIterationAt = now();
  state.history.push({ iteration: next, timestamp: now(), summary, status: 'in-progress' });
  writeJson(LOOP_STATE_FILE, state);
  log(`\n${C.c}  Iteration ${next}/${state.maxIterations}${C.n}`);
  log(`${C.d}  Summary: ${summary}${C.n}\n`);
}

function loopComplete() {
  const state = readJson(LOOP_STATE_FILE);
  if (!state?.active) { log('No active loop.'); return; }
  const summary = getFlag(['-s', '--summary'], 'Criteria met');
  state.active = false; state.status = 'complete'; state.lastIterationAt = now();
  state.history.push({ iteration: state.iteration, timestamp: now(), summary, status: 'complete' });
  writeJson(LOOP_STATE_FILE, state);
  log(`\n${C.g}  [PASS] Loop Complete! Iterations: ${state.iteration}/${state.maxIterations}${C.n}\n`);
}

function loopCancel() {
  const state = readJson(LOOP_STATE_FILE);
  if (!state?.active) { log('No active loop.'); return; }
  state.active = false; state.status = 'cancelled'; state.lastIterationAt = now();
  state.history.push({ iteration: state.iteration, timestamp: now(), summary: 'Cancelled', status: 'cancelled' });
  writeJson(LOOP_STATE_FILE, state);
  log(`${C.y}  Loop cancelled at iteration ${state.iteration}.${C.n}`);
}

// ---------------------------------------------------------------------------
// VALIDATE: Pre-handoff validation
// ---------------------------------------------------------------------------

function cmdValidate() {
  const num = parseInt(subArgs[0] || '0');
  const role = subArgs[1] || '';
  if (!num || !role) { log('Usage: agentx validate <issue-number> <role>'); process.exit(1); }

  log(`\n${C.c}  Handoff Validation: #${num} [${role}]${C.n}`);
  log(`${C.d}  ---------------------------------------------${C.n}`);

  let pass = true;
  const check = (ok, msg) => { log(`  ${ok ? C.g + '[PASS]' : C.r + '[FAIL]'} ${msg}${C.n}`); if (!ok) pass = false; };

  switch (role) {
    case 'pm':
      check(existsSync(join(ROOT, `docs/prd/PRD-${num}.md`)), `PRD-${num}.md exists`);
      break;
    case 'ux':
      check(existsSync(join(ROOT, `docs/ux/UX-${num}.md`)), `UX-${num}.md exists`);
      break;
    case 'architect':
      check(existsSync(join(ROOT, `docs/adr/ADR-${num}.md`)), `ADR-${num}.md exists`);
      check(existsSync(join(ROOT, `docs/specs/SPEC-${num}.md`)), `SPEC-${num}.md exists`);
      break;
    case 'engineer':
      check(shell(`git log --oneline --grep="#${num}" -1`).length > 0, `Commits reference #${num}`);
      break;
    case 'reviewer':
      check(existsSync(join(ROOT, `docs/reviews/REVIEW-${num}.md`)), `REVIEW-${num}.md exists`);
      break;
    case 'devops':
      check(existsSync(join(ROOT, '.github/workflows')), 'Workflows directory exists');
      break;
    default:
      log(`  Unknown role: ${role}`);
      pass = false;
  }

  log(pass ? `\n${C.g}  VALIDATION PASSED${C.n}\n` : `\n${C.r}  VALIDATION FAILED${C.n}\n`);
  if (!pass) process.exit(1);
}

// ---------------------------------------------------------------------------
// HOOKS: Install git hooks
// ---------------------------------------------------------------------------

function cmdHooks() {
  const action = subArgs[0] || 'install';
  const gitHooksDir = join(ROOT, '.git', 'hooks');
  if (!existsSync(join(ROOT, '.git'))) { log('Not a git repo. Run git init first.'); return; }
  ensureDir(gitHooksDir);

  if (action === 'install') {
    for (const hook of ['pre-commit', 'commit-msg']) {
      const src = join(ROOT, '.github', 'hooks', hook);
      if (existsSync(src)) {
        copyFileSync(src, join(gitHooksDir, hook));
        log(`${C.g}  Installed: ${hook}${C.n}`);
      }
    }
    log(`${C.g}  Git hooks installed.${C.n}`);
  }
}

// ---------------------------------------------------------------------------
// VERSION
// ---------------------------------------------------------------------------

function cmdVersion() {
  const ver = readJson(VERSION_FILE);
  if (!ver) { log('AgentX version unknown.'); return; }
  if (jsonOutput) { log(JSON.stringify(ver, null, 2)); return; }
  log(`\n${C.c}  AgentX ${ver.version}${C.n}`);
  log(`${C.d}  Mode: ${ver.mode}  |  Installed: ${ver.installedAt?.substring(0, 10) || '?'}${C.n}\n`);
}

// ---------------------------------------------------------------------------
// HOOK: Agent lifecycle hooks (start/finish)
// ---------------------------------------------------------------------------

function cmdAgentHook() {
  const phase = getFlag(['-p', '--phase'], subArgs[0] || '');
  const agent = getFlag(['-a', '--agent'], subArgs[1] || '');
  const issue = parseInt(getFlag(['-i', '--issue'], subArgs[2] || '0'));

  if (!phase || !agent) { log('Usage: agentx hook <start|finish> <agent> [issue]'); return; }

  const data = readJson(STATE_FILE) || {};
  if (phase === 'start') {
    const status = agent === 'reviewer' ? 'reviewing' : 'working';
    data[agent] = { status, issue: issue || null, lastActivity: now() };
    writeJson(STATE_FILE, data);
    log(`${C.g}  [PASS] ${agent} -> ${status}${issue ? ` (issue #${issue})` : ''}${C.n}`);
  } else if (phase === 'finish') {
    data[agent] = { status: 'done', issue: issue || null, lastActivity: now() };
    writeJson(STATE_FILE, data);
    log(`${C.g}  [PASS] ${agent} -> done${C.n}`);
  }
}

// ---------------------------------------------------------------------------
// HELP
// ---------------------------------------------------------------------------

function cmdHelp() {
  log(`
${C.c}  AgentX CLI${C.n}
${C.d}  ---------------------------------------------${C.n}

${C.w}  Commands:${C.n}
  ready                            Show unblocked work, sorted by priority
  state [-a agent -s status]       Show/update agent states
  deps <issue>                     Check dependencies for an issue
  digest                           Generate weekly digest
  workflow [type]                   List/show workflow steps
  loop <start|status|iterate|complete|cancel>  Iterative refinement
  validate <issue> <role>          Pre-handoff validation
  hook <start|finish> <agent> [#]  Agent lifecycle hooks
  hooks install                    Install git hooks
  issue <create|list|get|update|close|comment>  Issue management
  version                          Show installed version
  help                             Show this help

${C.w}  Issue Commands:${C.n}
  issue create -t "Title" -l "type:story"
  issue list
  issue get -n 1
  issue update -n 1 -s "In Progress"
  issue close -n 1
  issue comment -n 1 -c "Started"

${C.w}  Flags:${C.n}
  --json / -j                      Output as JSON
`);
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

switch (command) {
  case 'ready':    cmdReady(); break;
  case 'state':    cmdState(); break;
  case 'deps':     cmdDeps(); break;
  case 'digest':   cmdDigest(); break;
  case 'workflow':  cmdWorkflow(); break;
  case 'loop':     cmdLoop(); break;
  case 'validate':  cmdValidate(); break;
  case 'hook':     cmdAgentHook(); break;
  case 'hooks':    cmdHooks(); break;
  case 'issue':    issueCmd(); break;
  case 'version':  cmdVersion(); break;
  case 'help':     cmdHelp(); break;
  default:
    log(`Unknown command: ${command}. Run 'agentx help' for usage.`);
    process.exit(1);
}
