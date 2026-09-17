const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const yaml = require(require.resolve('yaml', { paths: [path.join(root, 'vscode-extension')] }));
const workflow = name => yaml.parse(fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8'));
const dependency = workflow('dependency-scanning.yml');

test('Role defaults, focused verification and UX auditor routing remain explicit', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const frontmatter = file => yaml.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(read(file))[1]);
  for (const role of ['architect', 'ux-designer']) {
    assert.equal(frontmatter(`.github/agents/${role}.agent.md`).model, 'GPT-6 Astra (copilot)');
  }
  const ux = frontmatter('.github/agents/ux-designer.agent.md');
  assert.ok(ux.agents.includes('Frontier Prototype Audit FDE'));
  const auditor = read('.github/agents/internal/prototype-auditor.agent.md');
  assert.match(auditor, /all ten passes/);
  assert.match(auditor, /Pass 0/);
  assert.match(auditor, /Anti-slop critique/);
  assert.match(auditor, /MUST NOT start, reset, iterate or complete the/);
  const engineer = read('.github/agents/engineer.agent.md');
  assert.match(engineer, /focused checks can be final evidence/);
  assert.match(engineer, /Complete the loop before an authorized commit/);
  assert.ok(!engineer.includes('git add -A && git commit'));
});

test('Impeccable status cannot replace actual UX evidence or be waived to PASS', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  for (const file of ['.github/skills/design/impeccable-integration/SKILL.md',
    '.github/skills/design/prototype-audit/SKILL.md']) {
    const source = read(file);
    assert.match(source, /SHA-256/);
    assert.match(source, /cannot be waived to PASS/);
    assert.ok(!source.includes('or all findings waived'));
    assert.ok(!source.includes('or every finding carries'));
    assert.ok(!source.includes('npm exec --offline -- impeccable detect'));
  }
  const template = read('.github/templates/UX-TEMPLATE.md');
  assert.match(template, /Actually ran: <checks with evidence links, or none>/);
  assert.ok(!/^Ran:.*axe/m.test(template));
});

test('Native loop CI includes macOS, literal shell tests, baseline gates and read-only permissions', () => {
  const job = workflow('quality-gates.yml').jobs['portable-loop'];
  assert.deepEqual(job.strategy.matrix.os, ['ubuntu-latest', 'macos-latest']);
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.ok(job['timeout-minutes'] > 0);
  assert.equal(job.steps[0].with['persist-credentials'], false);
  const commands = job.steps.map(step => step.run || '').join('\n');
  for (const required of ['test -x .agentx/frontier.sh', 'test -x .agentx/agentx.sh',
    'shell.test.js', 'loopStateChecker.test.js', 'loop-parity-behavior.ps1',
    'loop-rollback-behavior.ps1', 'code-quality-rubric-behavior.ps1']) {
    assert.ok(commands.includes(required), required);
  }
  assert.match(commands, /if \(\$LASTEXITCODE -ne 0\)/);
  assert.ok(!commands.includes('--SkipLoopIntegration'));
});

function scan(ecosystem, manifests, response, exit = 0, restoreExit = 0) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-scan-test-'));
  try {
    for (const [name, content] of Object.entries(manifests)) {
      const target = path.join(directory, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    const source = dependency.jobs[`${ecosystem}-scan`].steps.find(step => step.id === 'scan').run;
    const harness = `
import json, os, subprocess
from pathlib import Path
from unittest.mock import patch
calls = []
def fake_run(arguments, **kwargs):
    calls.append({'args': arguments, 'cwd': str(kwargs.get('cwd', '')), 'requirements': Path(arguments[2]).read_text() if arguments[0] == 'pip-audit' else ''})
    if 'restore' in arguments:
        return subprocess.CompletedProcess(arguments, ${restoreExit}, '', 'restore diagnostic')
    return subprocess.CompletedProcess(arguments, ${exit}, ${JSON.stringify(typeof response === 'string' ? response : JSON.stringify(response))}, 'scanner diagnostic')
with patch('subprocess.run', fake_run):
    try:
        exec(${JSON.stringify(source)})
    except SystemExit as result:
        print('TEST_RESULT=' + json.dumps({'exit': result.code, 'calls': calls}))
`;
    const result = spawnSync('python', ['-c', harness], {
      cwd: directory, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, GITHUB_OUTPUT: path.join(directory, 'output.txt') }
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    const marker = result.stdout.split('\n').find(line => line.startsWith('TEST_RESULT='));
    assert.ok(marker, result.stdout);
    const report = JSON.parse(fs.readFileSync(path.join(directory, `${ecosystem}-audit-reports/summary.json`), 'utf8'));
    return { ...JSON.parse(marker.slice('TEST_RESULT='.length)), ...report };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('Python scans every nested requirements file, not the size of JSON output', () => {
  const result = scan('python', { 'one/requirements.txt': 'sample==1', 'two space/requirements-dev.txt': 'sample==1' }, { dependencies: [{ name: 'sample', version: '1', vulns: [] }] });
  assert.equal(result.exit, 0);
  assert.equal(result.status, 'clean');
  assert.equal(result.calls.length, 2);
  assert.ok(result.calls.every(call => path.isAbsolute(call.args[2])));
});

test('Python findings, scanner failures, malformed reports, and skipped packages are distinct', () => {
  const manifests = { 'nested/requirements.txt': 'sample==1' };
  for (const [response, exit, status] of [
    [{ dependencies: [{ vulns: [{ id: 'TEST-1' }] }] }, 1, 'vulnerabilities'],
    [{ dependencies: [{ vulns: [] }] }, 2, 'scanner-error'],
    [{ dependencies: [{ vulns: [] }] }, 1, 'scanner-error'],
    ['not JSON', 0, 'scanner-error'],
    [{}, 0, 'scanner-error'],
    [{ dependencies: [{ skip_reason: 'unsupported source' }] }, 0, 'not-scanned']
  ]) {
    const result = scan('python', manifests, response, exit);
    assert.equal(result.exit, 1);
    assert.equal(result.status, status);
  }
});

test('Python static pyproject dependencies and extras are exported; unsupported formats are not clean', () => {
  const result = scan('python', { 'pkg/pyproject.toml': '[project]\ndependencies = ["sample==1"]\n[project.optional-dependencies]\ntest = ["extra==2"]\n' }, { dependencies: [{ vulns: [] }] });
  assert.equal(result.status, 'clean');
  assert.match(result.calls[0].requirements, /sample==1\nextra==2/);
  for (const content of ['[tool.poetry]\nname="sample"', '[project]\ndynamic=["dependencies"]', '[project]\ndependencies=[]\n[dependency-groups]\ndev=["extra"]']) {
    const unsupported = scan('python', { 'pkg/pyproject.toml': content }, {});
    assert.equal(unsupported.status, 'not-scanned');
    assert.equal(unsupported.exit, 1);
    assert.equal(unsupported.calls.length, 0);
  }
  assert.equal(scan('python', { 'pkg/Pipfile': '' }, {}).status, 'not-scanned');
  assert.equal(scan('python', { 'pkg/pyproject.toml': '[project]\ndependencies="bad"' }, {}).status, 'scanner-error');
});

const dotnetClean = { version: 1, projects: [{ frameworks: [{ framework: 'net8.0' }] }] };
test('Node audit validates report counts and scanner exit status before calling a scan clean', () => {
  const source = dependency.jobs['node-scan'].steps.find(step => step.id === 'audit').run;
  const parser = source.match(/<<'NODE'\n([\s\S]*?)\nNODE/);
  assert.ok(parser, 'audit JSON validation must be independently executable');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-node-audit-test-'));
  try {
    const reportPath = path.join(directory, 'audit.json');
    const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
    const report = values => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: values } });
    const run = (data, exit) => {
      fs.writeFileSync(reportPath, typeof data === 'string' ? data : JSON.stringify(data));
      return spawnSync(process.execPath, ['-', reportPath, String(exit)], { input: parser[1], encoding: 'utf8', timeout: 10000 });
    };
    for (const [data, exit] of [
      [report(counts), 0],
      [report({ ...counts, high: 1, total: 1 }), 1],
      [report({ ...counts, moderate: 2, total: 2 }), 1]
    ]) {
      const result = run(data, exit);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), data.metadata.vulnerabilities);
    }
    for (const [data, exit] of [
      [report(counts), 1], [report(counts), 2], [report({}), 0],
      [report({ ...counts, high: '0' }), 0], [report({ ...counts, high: -1 }), 0],
      [report({ ...counts, total: 0.5 }), 0], [report({ ...counts, total: 1 }), 0],
      [{ ...report(counts), error: { message: 'registry unavailable' } }, 0],
      [{ ...report(counts), auditReportVersion: 99 }, 0], ['broken JSON', 0]
    ]) assert.equal(run(data, exit).status, 1, JSON.stringify({ data, exit }));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('.NET restores and scans each discovered project including paths with spaces', () => {
  const result = scan('dotnet', { 'nested/one.csproj': '', 'space dir/two.fsproj': '' }, dotnetClean);
  assert.equal(result.status, 'clean');
  assert.equal(result.calls.length, 4);
  for (let index = 0; index < result.calls.length; index += 2) {
    assert.equal(result.calls[index].args[1], 'restore');
    assert.equal(result.calls[index].args[2], result.calls[index + 1].args[2]);
    assert.ok(result.calls[index + 1].args.includes('--include-transitive'));
  }
});

test('.NET findings and restore/scanner/report failures fail the gate', () => {
  const manifests = { 'nested/one.csproj': '' };
  const vulnerable = { version: 1, projects: [{ frameworks: [{ framework: 'net8.0', transitivePackages: [{ vulnerabilities: [{ severity: 'High' }] }] }] }] };
  assert.equal(scan('dotnet', manifests, vulnerable).status, 'vulnerabilities');
  for (const [response, exit, restoreExit] of [[dotnetClean, 2, 0], [dotnetClean, 0, 1], [{}, 0, 0], ['broken', 0, 0], [{ version: 1, projects: [] }, 0, 0], [{ version: 1, projects: [{ frameworks: [{}] }] }, 0, 0], [{ version: 1, projects: [{ ...dotnetClean.projects[0], problems: [{ text: 'feed unavailable' }] }] }, 0, 0]]) {
    const result = scan('dotnet', manifests, response, exit, restoreExit);
    assert.equal(result.status, 'scanner-error');
    assert.equal(result.exit, 1);
  }
});

test('Absent dependencies are not-applicable, and ignored dependency folders are not scanned', () => {
  for (const ecosystem of ['dotnet', 'python']) {
    const result = scan(ecosystem, { 'node_modules/requirements.txt': '', '.venv/one.csproj': '' }, {});
    assert.equal(result.status, 'not-applicable');
    assert.equal(result.calls.length, 0);
    assert.equal(result.exit, 0);
  }
});

test('Summary uses actual scan outputs and does not classify every failure as vulnerabilities', async () => {
  const source = dependency.jobs.summary.steps[0].with.script;
  for (const status of ['clean', 'vulnerabilities', 'scanner-error', 'not-scanned', 'not-applicable', 'cancelled', 'skipped', undefined]) {
    let body = '';
    let failed = false;
    const result = { result: status === 'cancelled' || status === 'skipped' ? status : 'success', outputs: { status } };
    const context = { eventName: 'push', payload: {}, repo: { owner: 'test', repo: 'test' } };
    const core = { setFailed: () => { failed = true; }, summary: { addRaw: text => { body = text; return { write: async () => {} }; } } };
    const run = new (Object.getPrototypeOf(async function () {}).constructor)('process', 'context', 'core', 'github', source);
    await run({ env: { SCAN_RESULTS: JSON.stringify({ 'dotnet-scan': result, 'python-scan': result, 'node-scan': result }) } }, context, core, {});
    assert.match(body, new RegExp(status || 'scanner-error'));
    assert.equal(failed, !['clean', 'not-applicable'].includes(status));
    assert.doesNotMatch(body, /\[PASS\].*No vulnerabilities/);
  }
});

async function routeIssue(command, status = '', labels = ['type:powerbi'], pullRequest = false) {
  const outputs = {};
  const source = workflow('frontier.yml').jobs.route.steps[0].with.script;
  const context = { eventName: 'issue_comment', repo: { owner: 'test', repo: 'repo' }, payload: { issue: { number: 12, ...(pullRequest ? { pull_request: {} } : {}) }, comment: { body: command } } };
  const github = {
    rest: {
      issues: { get: async () => ({ data: { labels: labels.map(name => ({ name })), title: 'Report', body: '', node_id: 'test' } }) },
      repos: { getContent: async ({ path: target }) => {
        if (target !== '.agentx/config.json') throw new Error('No architecture');
        return { data: { content: Buffer.from('{"project":1}').toString('base64'), encoding: 'base64' } };
      } }
    },
    graphql: async () => ({ node: { projectItems: { nodes: [{ project: { number: 1, owner: { login: 'test' } }, fieldValues: { nodes: [{ name: status, field: { name: 'Status' } }] } }] } } })
  };
  const run = new (Object.getPrototypeOf(async function () {}).constructor)('context', 'core', 'github', 'console', source);
  await run(context, { setOutput: (key, value) => { outputs[key] = value; } }, github, { log: () => {} });
  return outputs;
}

test('Canonical and legacy reroute commands support Power BI in fallback, Ready and In Progress', async () => {
  for (const command of ['/frontier route', '/agentx route']) {
    for (const status of ['', 'Backlog', 'Ready', 'In Progress']) {
      assert.equal((await routeIssue(command, status)).agent, 'powerbi-analyst');
    }
    assert.equal((await routeIssue(command, 'In Review')).agent, 'reviewer');
  }
  assert.equal((await routeIssue('/frontier route extra')).agent, '');
  assert.equal((await routeIssue('/frontier route', '', [], true)).agent, '');
  const job = workflow('frontier.yml').jobs['powerbi-analyst'];
  assert.ok(job);
  assert.match(job.if, /powerbi-analyst/);
});

test('Review scaffold starts unassessed throughout and retains review sections', () => {
  const template = fs.readFileSync(path.join(root, '.github/templates/REVIEW-TEMPLATE.md'), 'utf8');
  assert.doesNotMatch(template, /\[x\]/i);
  assert.doesNotMatch(template, /\|\s*`\[PASS\]`|^- .*\[PASS\]|^\*\*Status\*\*:.*APPROVED/m);
  assert.match(template, /Structural checks do not certify roles, skills/);
  for (let section = 1; section <= 17; section++) assert.match(template, new RegExp(`^## ${section}\\. `, 'm'));
  for (const heading of ['Security Checklist', 'Performance Checklist', 'Documentation Checklist', 'CI/CD Pipeline Results']) {
    const section = template.split(`### ${heading}`)[1].split(/\n---|\n##/)[0];
    const checks = section.split('\n').filter(line => line.startsWith('- ['));
    assert.ok(checks.length > 0, heading);
    assert.ok(checks.every(line => line.includes('[ ]') && line.includes('NOT ASSESSED')), heading);
  }
  const scaffold = workflow('frontier.yml').jobs.reviewer.steps.map(step => step.run || '').join('\n');
  assert.match(scaffold, /NOT ASSESSED/);
  assert.doesNotMatch(scaffold, /Done when approved/);
});

test('Evaluation triggers include customization changes but claim only classification coverage', () => {
  const evaluation = workflow('ai-evaluation.yml');
  for (const event of ['push', 'pull_request']) {
    for (const target of ['.github/agents/**', '.github/prompts/**', '.github/instructions/**', '.github/skills/**', 'prompts/**', 'evaluation/**']) {
      assert.ok(evaluation.on[event].paths.includes(target), `${event}: ${target}`);
    }
  }
  const steps = evaluation.jobs.evaluate.steps.map(step => step.run || '').join('\n');
  assert.match(steps, /-BaselinePath 'evaluation\/baseline.json'/);
  assert.match(steps, /not evaluated or certified/);
});