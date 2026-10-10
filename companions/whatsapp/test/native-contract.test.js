const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { runFrontierProcess } = require('../src/frontierRunner');
const { parseRuntimeResult, inspectArguments } = require('../src/guidedInteraction');
const { executePlan } = require('../src/commandRouter');

test('companion inspects the real native pending contract and never submits a stale approval', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-companion-native-'));
  const runtime = path.resolve(__dirname, '..', '..', '..', '.frontier', 'runtime');
  const prepared = path.join(root, 'prepare.ps1');
  const cli = path.join(root, '.frontier', 'runtime', 'frontier.ps1');
  const env = { ...process.env };
  for (const name of ['FRONTIER_STATE_ROOT', 'FRONTIER_STATE_WORKSPACE', 'FRONTIER_STATE_AUTHORITY']) delete env[name];
  try {
    fs.mkdirSync(path.dirname(cli), { recursive: true });
    fs.writeFileSync(path.join(root, '.frontier', 'config.json'), '{"provider":"local","repositoryContext":{"enabled":false}}');
    fs.writeFileSync(cli, `& '${path.join(runtime, 'frontier-cli.ps1').replace(/'/g, "''")}' @args\nexit $LASTEXITCODE\n`);
    fs.writeFileSync(prepared, [
      'param([string]$Root, [string]$Runtime)',
      "$ErrorActionPreference = 'Stop'",
      ". (Join-Path $Runtime 'guided-interaction.ps1')",
      "$state = New-RunnerInteraction 'engineer-fixture' $Root 'engineer' 'Fixture task' 'guided'",
      "$state.model = 'fixture-model'; $state.provider = 'fixture-provider'; $state.rolePolicy = '0' * 64",
      "Set-InteractionPlan $state @{ goal = 'Fixture goal'; scope = @('source'); nonGoals = @(); assumptions = @(); steps = @(@{ title = 'Inspect'; verification = 'Read source' }) }",
      "$directory = Join-Path $Root '.frontier' 'sessions'",
      '[void][IO.Directory]::CreateDirectory($directory)',
      "@{ meta = @{ sessionId = 'engineer-fixture'; agentName = 'engineer'; interaction = $state }; messages = @(@{ role = 'system'; content = 'Fixture' }, @{ role = 'user'; content = 'Fixture task' }) } | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $directory 'engineer-fixture.json') -Encoding utf8",
    ].join('\n'));
    const preparation = spawnSync('pwsh', ['-NoProfile', '-File', prepared, root, runtime], {
      env, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(preparation.status, 0, preparation.stderr);
    const config = { repoPath: root, cliRelativePath: '.frontier/runtime/frontier.ps1',
      maxOutputChars: 6000, maxRuntimeOutputChars: 256000, commandTimeoutMs: 30000 };
    const info = parseRuntimeResult(await runFrontierProcess(inspectArguments('engineer-fixture'), config),
      { sessionId: 'engineer-fixture', agent: 'engineer' });
    assert.equal(info.pendingInteraction.kind, 'plan');
    const calls = [];
    const result = await executePlan({
      ok: true, args: [], response: { sessionId: 'engineer-fixture', decision: 'approve', text: '' },
      pendingInteraction: { ...info.pendingInteraction, inputId: '0'.repeat(32) },
    }, { ...config, runner: { run: async args => {
      calls.push(args);
      return runFrontierProcess(args, config);
    } } });
    assert.equal(result.staleInput, true);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('--session-info'));
    assert.ok(!calls[0].includes('--resume-session'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
