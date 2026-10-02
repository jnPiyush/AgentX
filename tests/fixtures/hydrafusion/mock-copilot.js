'use strict';
// Offline CLI fixture; its adjacent JSON is owned by the test host, not the candidate.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const configPath = `${__filename}.json`;
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
const scenario = config.scenario || 'success';
const arg = name => args[args.indexOf(name) + 1];
if (args.includes('--version')) {
  console.log(`GitHub Copilot CLI ${config.version || '1.0.89'}.`);
  process.exit(0);
}
if (args.includes('--help')) {
  console.log('--available-tools --no-custom-instructions --disable-builtin-mcps --no-remote-export --usage-output-file --max-ai-credits --plugin-dir');
  process.exit(0);
}
const workspace = process.cwd();
const plugin = arg('--plugin-dir');
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'plugin.json'), 'utf8'));
const [namespace, agent] = arg('--agent').split(':');
if (namespace !== manifest.name || !fs.existsSync(path.join(plugin, 'agents', `${agent}.agent.md`))) {
  console.error('No such plugin agent');
  process.exit(1);
}
if (config.log) {
  fs.writeFileSync(config.log, JSON.stringify({
    pid: process.pid, args, workspace, plugin,
    home: process.env.COPILOT_HOME,
    inheritedAllowAll: process.env.COPILOT_ALLOW_ALL || '',
    agentText: fs.readFileSync(path.join(plugin, 'agents', `${agent}.agent.md`), 'utf8'),
  }));
}
const emit = (type, data) => console.log(JSON.stringify({ type, data }));
const fusion = { fusionId: 'fixture-fusion', syntheticModel: 'hydrafusion', pattern: 'single', policy: 'fixture', contractVersion: 1 };
const invokeHook = (toolName, toolArgs) => {
  const hooks = JSON.parse(fs.readFileSync(path.join(plugin, manifest.hooks), 'utf8'));
  const command = hooks.hooks.preToolUse[0];
  const executable = command.powershell ? 'pwsh' : '/bin/sh';
  const hookArgs = command.powershell
    ? ['-NoProfile', '-NonInteractive', '-Command', command.powershell]
    : ['-c', command.bash];
  const processResult = spawnSync(executable, hookArgs, {
    cwd: workspace, env: process.env, encoding: 'utf8',
    input: JSON.stringify({ toolName, toolArgs, cwd: workspace, sessionId: 'fixture-session' }),
  });
  if (processResult.error || processResult.status !== 0) throw new Error(`Hook failed: ${processResult.stderr}`);
  return JSON.parse(processResult.stdout).permissionDecision;
};
const usage = files => fs.writeFileSync(arg('--usage-output-file'), JSON.stringify({
  totalNanoAiu: config.nanoCredits ?? 1000000000,
  codeChanges: { filesModified: scenario === 'null-usage' ? null : files },
  modelMetrics: {},
}));

async function main() {
  if (scenario === 'completion-only') {
    emit('session.fusion_completed', { ...fusion, outcome: 'completed' });
    await new Promise(resolve => setTimeout(resolve, 20000));
    return;
  }
  emit('session.fusion_resolved', fusion);
  if (scenario === 'hang') {
    setInterval(() => fs.appendFileSync(path.join(workspace, 'heartbeat.txt'), 'tick\n'), 50);
    await new Promise(resolve => setTimeout(resolve, 20000));
    return;
  }
  if (scenario === 'output-limit') {
    process.stdout.write('x'.repeat(9 * 1024 * 1024));
    return;
  }
  emit('assistant.fusion_phase_started', { ...fusion, phaseId: 'phase-1', role: 'solver', model: 'fixture-model' });
  emit('model.call_start', { model: 'fixture-model' });
  if (scenario === 'call-limit') emit('model.call_start', { model: 'fixture-model' });
  const files = [];
  const readOnly = !args.includes('create');
  let toolRequests = [];
  if (scenario !== 'no-change') {
    const relative = scenario === 'policy-denial' ? '.frontier/state/loop-state.json'
      : scenario === 'latin1' ? 'src/cafe.txt' : 'src/generated.ps1';
    const toolName = readOnly ? 'view' : scenario === 'latin1' ? 'edit' : 'create';
    const toolPath = readOnly ? 'src/app.ps1' : relative;
    const decision = invokeHook(toolName, { path: toolPath });
    toolRequests = [{ name: toolName }];
    if (decision === 'allow' && !readOnly) {
      const file = path.join(workspace, ...relative.split('/'));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, scenario === 'latin1'
        ? Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x21, 0x0a])
        : config.content || 'function Get-Greeting { return "hello" }\n');
      files.push(file);
    }
  }
  if (scenario === 'unreported-protected') {
    fs.mkdirSync(path.join(workspace, '.frontier', 'state'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.frontier', 'state', 'loop-state.json'), '{"active":false}');
  }
  if (scenario === 'rename-source') {
    fs.renameSync(path.join(workspace, 'docs', 'protected.md'), path.join(workspace, 'src', 'moved.md'));
  }
  if (scenario === 'ignored-addition') {
    fs.mkdirSync(path.join(workspace, 'build'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'build', 'unexpected.txt'), 'must be audited');
  }
  emit('assistant.fusion_phase_completed', { fusionId: fusion.fusionId, phaseId: 'phase-1', role: 'solver', model: 'fixture-model', status: 'succeeded' });
  if (scenario !== 'incomplete') {
    emit('session.fusion_completed', {
      ...fusion, outcome: 'completed', degradedReason: null,
      finalSourceModel: 'fixture-model', followUpModel: 'fixture-model',
    });
  }
  emit('assistant.message', { content: config.response || 'An isolated candidate is available for review.', phase: 'final_answer', toolRequests });
  if (scenario !== 'missing-usage') usage(files);
  console.log(JSON.stringify({ type: 'result', sessionId: 'fixture-session', exitCode: scenario === 'failed-result' ? 1 : 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
