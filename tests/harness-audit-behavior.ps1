#!/usr/bin/env pwsh

param([switch]$SubprocessOnly)

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function New-TestWorkspace([string]$name) {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-harness-audit-{0}-{1}" -f $name, [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.frontier' 'state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root 'scripts') -Force | Out-Null

    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx.ps1') (Join-Path $root '.agentx\agentx.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\frontier.ps1') (Join-Path $root '.agentx\frontier.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') (Join-Path $root '.agentx\agentx-cli.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot 'scripts\check-harness-compliance.ps1') (Join-Path $root 'scripts\check-harness-compliance.ps1') -Force

    @{ provider = 'local'; mode = 'local'; enforceIssues = $false } | ConvertTo-Json | Set-Content (Join-Path $root '.frontier\config.json') -Encoding utf8

    return $root
}

function Remove-TestWorkspace([string]$root) {
    if ($root -and (Test-Path $root)) {
        Remove-Item $root -Recurse -Force
    }
}

function Invoke-Frontier([string]$root, [string[]]$arguments) {
    return Invoke-FrontierLauncher -Root $root -LauncherPath (Join-Path $root '.agentx\agentx.ps1') -Arguments $arguments
}

function Invoke-FrontierLauncher([string]$Root, [string]$LauncherPath, [string[]]$Arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $Root
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($LauncherPath)
    foreach ($argument in $Arguments) {
        $startInfo.ArgumentList.Add($argument)
    }
    $startInfo.Environment['FRONTIER_WORKSPACE_ROOT'] = $Root

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function Invoke-HarnessCompliance([string]$root, [string]$CallerDirectory = '') {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = if ($CallerDirectory) { $CallerDirectory } else { $root }
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root 'scripts\check-harness-compliance.ps1'))
    $startInfo.ArgumentList.Add('-ReportOnly')
    $startInfo.Environment['FRONTIER_WORKSPACE_ROOT'] = $root

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return ($stdout + $stderr)
}

function Set-WorkspaceHarnessState([string]$root) {
    $timestamp = (Get-Date).ToUniversalTime().ToString('o')
    @{
        active = $false
        status = 'complete'
        loopConsumed = $false
        prompt = 'Audit harness state'
        iteration = 5
        minIterations = 5
        maxIterations = 10
        completionCriteria = 'TASK_COMPLETE'
        startedAt = $timestamp
        lastIterationAt = $timestamp
        history = @(
            @{
                iteration = 5
                timestamp = $timestamp
                summary = 'Subagent Review: harness audit passed'
                status = 'in-progress'
                outcome = 'pass'
                review = @{
                    verdict = 'approved'
                    reviewer = 'harness-audit-suite'
                    high = 0
                    medium = 0
                    low = 0
                }
            }
            @{
                iteration = 5
                timestamp = $timestamp
                summary = 'Harness audit complete'
                status = 'complete'
                outcome = 'pass'
                kind = 'completion'
            }
        )
    } | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root '.frontier\state\loop-state.json') -Encoding utf8

    @{
        version = 1
        threads = @(
            @{
                id = 'thread-1'
                title = 'Harness audit'
                taskType = 'story'
                status = 'complete'
                startedAt = $timestamp
                updatedAt = $timestamp
            }
        )
        turns = @()
        items = @()
        evidence = @(
            @{
                id = 'evidence-1'
                threadId = 'thread-1'
                evidenceType = 'completion'
                summary = 'Captured evidence'
                createdAt = $timestamp
            }
        )
    } | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root '.frontier\state\harness-state.json') -Encoding utf8
}

Write-Host ''
Write-Host ' Harness Audit Behavior Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

if ($SubprocessOnly) {
    $workspace = New-TestWorkspace 'subprocess'
    try {
        $tokens = $null
        $errors = $null
        $source = [Management.Automation.Language.Parser]::ParseFile(
            (Join-Path $script:repoRoot '.agentx/agentx-cli.ps1'), [ref]$tokens, [ref]$errors)
        $definitions = @($source.FindAll({
            param($node)
            $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
            $node.Name -in @('Invoke-LoopCheckProcess', 'Get-HarnessLoopAuditResult', 'Invoke-HarnessComplianceReport')
        }, $false) | ForEach-Object { $_.Extent.Text }) -join "`n"
        $completion = $source.Find({
            param($node)
            $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-LoopComplete'
        }, $false).Extent.Text
        $guidance = $source.Find({
            param($node)
            $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-LoopIterationGuidance'
        }, $false).Extent.Text
        Assert-True ($guidance -match 'risk-scoped final evidence' -and $guidance -notmatch 'full-suite') 'Loop guidance selects final checks by risk, not a blanket full suite'
        $evaluator = $source.Find({
            param($node)
            $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-CodeQualityEvaluator'
        }, $false).Extent.Text
        Assert-True ($evaluator -match '-TimeoutMilliseconds 90000') 'Evaluator timeout reserves cleanup headroom under the extension deadline'
        $evaluatorOffset = $completion.IndexOf('$codeQualityGate = Invoke-CodeQualityEvaluator')
        Assert-True ($completion.IndexOf("Get-LoopPassingCount 'loop complete'") -lt $evaluatorOffset) 'Completion checks passing count before expensive evaluator'
        Assert-True ($completion.IndexOf('Evidence file not found:') -lt $evaluatorOffset) 'Completion rejects missing evidence before expensive evaluator'
        Assert-True ($completion.IndexOf("-ContextLabel 'loop complete'") -lt $evaluatorOffset) 'Completion checks final evidence freshness before expensive evaluator'
        foreach ($definition in $source.FindAll({
            param($node)
            $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
            $node.Name -in @('ConvertTo-LoopUtcOffset', 'Test-LoopEvidenceFreshness', 'Test-LoopPassingBaseline')
        }, $false)) { . ([scriptblock]::Create($definition.Extent.Text)) }
        function Write-CliOutput([string]$Text) { }
        $script:C = @{ r = ''; d = ''; y = ''; n = '' }
        $artifact = Join-Path $workspace 'fresh-check.txt'
        Set-Content -LiteralPath $artifact -Value 'Synthetic evidence boundary fixture'
        $writtenAt = [datetimeoffset]::new((Get-Item -LiteralPath $artifact).LastWriteTimeUtc)
        Assert-True (Test-LoopEvidenceFreshness $artifact ([PSCustomObject]@{ lastIterationAt = $writtenAt.AddSeconds(-1).ToString('o') })) 'Fresh evidence is accepted'
        Assert-True (-not (Test-LoopEvidenceFreshness $artifact ([PSCustomObject]@{ lastIterationAt = $writtenAt.AddSeconds(1).ToString('o') }))) 'Stale evidence is rejected without retimestamping'
        $offset = $writtenAt.AddSeconds(-1).ToOffset([timespan]::FromHours(5.5)).ToString('o')
        Assert-True (Test-LoopEvidenceFreshness $artifact ([PSCustomObject]@{ lastIterationAt = $offset })) 'Equivalent offset timestamp does not reject fresh evidence'
        $baseline = [PSCustomObject]@{ passing = 10 }
        Assert-True (-not (Test-LoopPassingBaseline $baseline $null 'fixture')) 'Missing passing count is rejected'
        Assert-True (-not (Test-LoopPassingBaseline $baseline 9 'fixture')) 'Lower passing count is rejected'
        Assert-True (Test-LoopPassingBaseline $baseline 10 'fixture') 'Matching selected-surface count is accepted'
        foreach ($scenario in @('noisy', 'exit-error', 'timeout', 'missing')) {
            $probe = Join-Path $workspace 'probe.ps1'
            if ($scenario -eq 'noisy') {
                Set-Content -LiteralPath (Join-Path $workspace '.agentx/agentx-cli.ps1') -Value '[Console]::Error.Write(("x" * 131072)); [Console]::Out.Write("ok"); exit 0'
                $call = 'Get-HarnessLoopAuditResult $Script:ROOT | ConvertTo-Json -Compress'
            } elseif ($scenario -eq 'exit-error') {
                Set-Content -LiteralPath (Join-Path $workspace 'scripts/check-harness-compliance.ps1') -Value 'param([switch]$ReportOnly); [Console]::Error.Write("checker crashed"); exit 7'
                $call = 'Invoke-HarnessComplianceReport | ConvertTo-Json -Compress'
            } else {
                $fileName = if ($scenario -eq 'missing') { 'frontier-checker-does-not-exist' } else { 'pwsh' }
                $call = '$info = [Diagnostics.ProcessStartInfo]::new(''' + $fileName + '''); ' +
                    '$info.ArgumentList.Add(''-NoProfile''); $info.ArgumentList.Add(''-Command''); ' +
                    '$info.ArgumentList.Add(''while ($true) { }''); ' +
                    'Invoke-LoopCheckProcess -StartInfo $info -TimeoutMilliseconds 250 | ConvertTo-Json -Compress'
            }
            $preamble = '$Script:ROOT = $PSScriptRoot; $Script:INSTALL_RUNTIME_DIR = Join-Path $PSScriptRoot ''.agentx'''
            Set-Content -LiteralPath $probe -Value ($preamble + "`n" + $definitions + "`n" + $call)
            $info = [Diagnostics.ProcessStartInfo]::new((Get-Command pwsh).Source)
            $info.UseShellExecute = $false
            $info.RedirectStandardOutput = $true
            $info.RedirectStandardError = $true
            foreach ($argument in @('-NoProfile', '-File', $probe)) { $info.ArgumentList.Add($argument) }
            $process = [Diagnostics.Process]::Start($info)
            try {
                $stdout = $process.StandardOutput.ReadToEndAsync()
                $stderr = $process.StandardError.ReadToEndAsync()
                $finished = $process.WaitForExit(10000)
                if (-not $finished) { $process.Kill($true); $process.WaitForExit(5000) | Out-Null }
                Assert-True $finished "$scenario checker completes without blocking output pipes"
                if ($finished) {
                    $result = $stdout.GetAwaiter().GetResult() | ConvertFrom-Json
                    if ($scenario -in @('timeout', 'missing')) {
                        Assert-True ($result.exitCode -ne 0) "$scenario checker fails explicitly"
                        $expected = if ($scenario -eq 'timeout') { 'timed out' } else { 'execution failed' }
                        Assert-True ($result.output -match $expected) "$scenario checker explains recovery"
                    } else {
                        Assert-True ($result.passed -eq ($scenario -eq 'noisy')) "$scenario checker respects process exit status"
                    }
                }
            } finally { $process.Dispose() }
        }
    } finally { Remove-TestWorkspace $workspace }
    Write-Host "Results: $script:pass passed, $script:fail failed"
    if ($script:fail) { exit 1 }
    exit 0
}

$workspace = New-TestWorkspace 'profiles'
try {
    Set-WorkspaceHarnessState $workspace

    $balanced = Invoke-Frontier $workspace @('audit', 'harness', '--json')
    $balancedJson = $balanced.Output | ConvertFrom-Json -Depth 20
    Assert-True ($balanced.ExitCode -eq 0) 'Balanced harness audit passes when only advisory planning checks fail'
    Assert-True ($balancedJson.profile -eq 'balanced') 'Balanced harness audit reports the default profile'
    Assert-True ($balancedJson.failedRequiredChecks.Count -eq 0) 'Balanced harness audit has no failed required checks'
    Assert-True (($balancedJson.checks | Where-Object { $_.id -eq 'execution-plan-present' }).Count -eq 1) 'Balanced harness audit still reports advisory planning checks'

    $reviewlessStatePath = Join-Path $workspace '.frontier\state\loop-state.json'
    $reviewlessState = Get-Content -LiteralPath $reviewlessStatePath -Raw | ConvertFrom-Json
    $reviewlessState.history = @($reviewlessState.history | Where-Object { -not $_.review })
    $reviewlessState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reviewlessStatePath -Encoding utf8
    $reviewless = Invoke-Frontier $workspace @('audit', 'harness', '--json')
    $reviewlessJson = $reviewless.Output | ConvertFrom-Json -Depth 20
    Assert-True ($reviewless.ExitCode -ne 0) 'Harness audit rejects completed state without structured reviewer approval'
    Assert-True ($reviewlessJson.failedRequiredChecks -contains 'loop-complete') 'Harness audit delegates loop completion to the structural gate'
    Set-WorkspaceHarnessState $workspace

    $strict = Invoke-Frontier $workspace @('audit', 'harness', '--profile', 'strict', '--json')
    $strictJson = $strict.Output | ConvertFrom-Json -Depth 20
    Assert-True ($strict.ExitCode -ne 0) 'Strict harness audit fails when planning checks are missing'
    Assert-True ($strictJson.failedRequiredChecks -contains 'execution-plan-present') 'Strict harness audit requires execution plan check'
    Assert-True ($strictJson.failedRequiredChecks -contains 'progress-log-present') 'Strict harness audit requires progress log check'

    @{ provider = 'local'; mode = 'local'; harnessEnforcementProfile = 'strict'; harnessDisabledChecks = 'execution-plan-present,progress-log-present' } | ConvertTo-Json | Set-Content (Join-Path $workspace '.frontier\config.json') -Encoding utf8
    $disabled = Invoke-Frontier $workspace @('audit', 'harness', '--json')
    $disabledJson = $disabled.Output | ConvertFrom-Json -Depth 20
    Assert-True ($disabled.ExitCode -eq 0) 'Strict harness audit passes when the missing planning checks are disabled'
    Assert-True ($disabledJson.disabledChecks.Count -eq 2) 'Harness audit reports disabled check list from config'
    Assert-True (($disabledJson.checks | Where-Object { $_.id -eq 'execution-plan-present' }).Count -eq 0) 'Disabled checks are removed from harness audit output'

    Push-Location $workspace
    try {
        git init --quiet
    } finally {
        Pop-Location
    }
    New-Item -ItemType Directory -Path (Join-Path $workspace '.github\hooks') -Force | Out-Null
    foreach ($hook in @('pre-commit', 'commit-msg', 'post-commit')) {
        Copy-Item -LiteralPath (Join-Path $script:repoRoot ".github\hooks\$hook") -Destination (Join-Path $workspace ".github\hooks\$hook") -Force
    }
    $hookInstall = Invoke-Frontier $workspace @('hooks', 'install')
    Assert-True ($hookInstall.ExitCode -eq 0) 'Hook installer exits successfully'
    Assert-True (Test-Path -LiteralPath (Join-Path $workspace '.git\hooks\post-commit') -PathType Leaf) 'Hook installer includes post-commit lifecycle hook'
} finally {
    Remove-TestWorkspace $workspace
}

$missingHookWorkspace = New-TestWorkspace 'missing-hook-source'
try {
    Push-Location $missingHookWorkspace
    try { git init --quiet } finally { Pop-Location }
    $missingHookInstall = Invoke-Frontier $missingHookWorkspace @('hooks', 'install')
    Assert-True ($missingHookInstall.ExitCode -ne 0) 'Hook installer fails when required hook sources are unavailable'
    Assert-True ($missingHookInstall.Output -match 'Required hook source is missing') 'Missing hook source failure is actionable'
} finally {
    Remove-TestWorkspace $missingHookWorkspace
}

$zeroCopyWorkspace = New-TestWorkspace 'zero-copy-hooks'
$bundleFixture = Join-Path ([System.IO.Path]::GetTempPath()) ("frontier-hook-bundle-{0}\.github\frontier" -f [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $bundleFixture '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $bundleFixture '.github\hooks') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:repoRoot '.agentx\agentx.ps1') -Destination (Join-Path $bundleFixture '.agentx\agentx.ps1') -Force
    Copy-Item -LiteralPath (Join-Path $script:repoRoot '.agentx\frontier.ps1') -Destination (Join-Path $bundleFixture '.agentx\frontier.ps1') -Force
    Copy-Item -LiteralPath (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') -Destination (Join-Path $bundleFixture '.agentx\agentx-cli.ps1') -Force
    New-Item -ItemType Directory -Path (Join-Path $bundleFixture 'scripts') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:repoRoot 'scripts\scrub.ps1') -Destination (Join-Path $bundleFixture 'scripts\scrub.ps1') -Force
    foreach ($hook in @('pre-commit', 'commit-msg', 'post-commit')) {
        Copy-Item -LiteralPath (Join-Path $script:repoRoot ".github\hooks\$hook") -Destination (Join-Path $bundleFixture ".github\hooks\$hook") -Force
    }
    Push-Location $zeroCopyWorkspace
    try {
        git init --quiet
        git config user.email 'zero-copy-hooks@example.com'
        git config user.name 'Zero Copy Hooks'
        git config core.hooksPath .custom-hooks
    } finally {
        Pop-Location
    }
    $zeroCopyInstall = Invoke-FrontierLauncher -Root $zeroCopyWorkspace -LauncherPath (Join-Path $bundleFixture '.agentx\agentx.ps1') -Arguments @('hooks', 'install')
    Assert-True ($zeroCopyInstall.ExitCode -eq 0) 'Zero-copy hook installer exits successfully from bundled sources'
    foreach ($hook in @('pre-commit', 'commit-msg', 'post-commit')) {
        $installedHook = Join-Path $zeroCopyWorkspace ".custom-hooks\$hook"
        Assert-True (Test-Path -LiteralPath $installedHook -PathType Leaf) "Zero-copy installer writes $hook to the active core.hooksPath"
        Assert-True ((Get-FileHash -LiteralPath $installedHook -Algorithm SHA256).Hash -ceq (Get-FileHash -LiteralPath (Join-Path $bundleFixture ".github\hooks\$hook") -Algorithm SHA256).Hash) "Zero-copy installer verifies $hook bytes"
    }
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $zeroCopyWorkspace '.git\hooks\pre-commit') -PathType Leaf)) 'Zero-copy installer does not write to inactive .git/hooks'

    $workspaceLauncher = Join-Path $zeroCopyWorkspace '.agentx\agentx.ps1'
    $bundleLauncher = Join-Path $bundleFixture '.agentx\agentx.ps1'
    $escapedWorkspace = $zeroCopyWorkspace.Replace("'", "''")
    $escapedBundleLauncher = $bundleLauncher.Replace("'", "''")
    @(
        '#!/usr/bin/env pwsh'
        "`$env:FRONTIER_WORKSPACE_ROOT = '$escapedWorkspace'"
        "& '$escapedBundleLauncher' @args"
        'exit $LASTEXITCODE'
    ) -join "`n" | Set-Content -LiteralPath $workspaceLauncher -Encoding utf8
    Remove-Item -LiteralPath (Join-Path $zeroCopyWorkspace '.agentx\agentx-cli.ps1') -Force
    Remove-Item -LiteralPath (Join-Path $zeroCopyWorkspace 'scripts') -Recurse -Force
    Set-WorkspaceHarnessState $zeroCopyWorkspace
    Set-Content -LiteralPath (Join-Path $zeroCopyWorkspace 'change.ps1') -Value 'Write-Output "zero-copy hook execution"' -Encoding utf8
    Push-Location $zeroCopyWorkspace
    try {
        git add change.ps1
        git commit --quiet -m 'test: execute zero-copy hooks'
        $zeroCopyCommitExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    Assert-True ($zeroCopyCommitExit -eq 0) 'Zero-copy installed hooks execute through the workspace launcher'
} finally {
    Remove-TestWorkspace $zeroCopyWorkspace
    $bundleParent = Split-Path (Split-Path $bundleFixture -Parent) -Parent
    Remove-Item -LiteralPath $bundleParent -Recurse -Force -ErrorAction SilentlyContinue
}

$samePathWorkspace = New-TestWorkspace 'same-path-hooks'
try {
    Push-Location $samePathWorkspace
    try {
        git init --quiet
        git config core.hooksPath .github/hooks
    } finally {
        Pop-Location
    }
    New-Item -ItemType Directory -Path (Join-Path $samePathWorkspace '.github\hooks') -Force | Out-Null
    foreach ($hook in @('pre-commit', 'commit-msg', 'post-commit')) {
        Copy-Item -LiteralPath (Join-Path $script:repoRoot ".github\hooks\$hook") -Destination (Join-Path $samePathWorkspace ".github\hooks\$hook") -Force
    }
    $samePathInstall = Invoke-Frontier $samePathWorkspace @('hooks', 'install')
    Assert-True ($samePathInstall.ExitCode -eq 0) 'Hook installer is idempotent when source equals active core.hooksPath'
    foreach ($hook in @('pre-commit', 'commit-msg', 'post-commit')) {
        $installedHook = Join-Path $samePathWorkspace ".github\hooks\$hook"
        Assert-True (Test-Path -LiteralPath $installedHook -PathType Leaf) "Same-path installer preserves $hook"
        if (-not $IsWindows) {
            $mode = [System.IO.File]::GetUnixFileMode($installedHook)
            $executeMask = [System.IO.UnixFileMode]::UserExecute -bor [System.IO.UnixFileMode]::GroupExecute -bor [System.IO.UnixFileMode]::OtherExecute
            Assert-True (($mode -band $executeMask) -eq $executeMask) "Same-path installer makes $hook executable"
        }
    }
} finally {
    Remove-TestWorkspace $samePathWorkspace
}

$dirtyWorkspace = New-TestWorkspace 'dirty-plan'
try {
    Push-Location $dirtyWorkspace
    try {
        git init --quiet
        git config user.email 'harness-test@example.com'
        git config user.name 'Harness Test'
        Set-Content README.md '# Harness fixture' -Encoding utf8
        git add .
        git commit --quiet -m 'test: initialize harness fixture'

        foreach ($index in 1..4) {
            Set-Content "module-$index.ps1" "Write-Output 'baseline $index'" -Encoding utf8
        }
        git add .
        git commit --quiet -m 'test: add prior code-only change'

        foreach ($index in 1..4) {
            Set-Content "module-$index.ps1" "Write-Output 'dirty $index'" -Encoding utf8
        }
        New-Item -ItemType Directory -Path 'docs/execution/plans' -Force | Out-Null
        @'
# Execution Plan: Dirty Worktree Fixture

## Purpose / Big Picture
Verify current changes take precedence over the prior commit.

## Progress
- [x] Dirty code and plan created

## Decision Log
- Decision: inspect the worktree first.

## Plan of Work
Validate the current dirty change set.

## Validation and Acceptance
- [PASS] Plan is visible to the compliance check.

## Artifacts and Notes
Evidence: current-worktree-first fixture.
'@ | Set-Content 'docs/execution/plans/EXEC-PLAN-dirty-fixture.md' -Encoding utf8
    } finally {
        Pop-Location
    }

    $dirtyText = Invoke-HarnessCompliance $dirtyWorkspace
    Assert-True ($dirtyText -match 'Requires execution plan: True') 'Dirty worktree fixture requires an execution plan'
    Assert-True ($dirtyText -notmatch 'no execution plan file was updated') 'Current dirty plan takes precedence over the prior commit diff'

    Push-Location $dirtyWorkspace
    try {
        git add module-1.ps1 module-2.ps1 module-3.ps1 module-4.ps1 docs/execution/plans/EXEC-PLAN-dirty-fixture.md
    } finally {
        Pop-Location
    }
    $stagedText = Invoke-HarnessCompliance $dirtyWorkspace
    Assert-True ($stagedText -match 'Requires execution plan: True') 'Staged worktree fixture requires an execution plan'
    Assert-True ($stagedText -notmatch 'no execution plan file was updated') 'Staged tracked plan is included in harness change detection'

    Push-Location $dirtyWorkspace
    try {
        New-Item -ItemType Directory -Path 'docs/artifacts/adr' -Force | Out-Null
        Set-Content 'docs/artifacts/adr/ADR-999.md' '# ADR without council' -Encoding utf8
        git add docs/artifacts/adr/ADR-999.md
    } finally {
        Pop-Location
    }
    $stagedAdrText = Invoke-HarnessCompliance $dirtyWorkspace
    Assert-True ($stagedAdrText -match 'Model Council gate') 'Staged ADR addition requires a matching Council artifact'
    $externalCallerText = Invoke-HarnessCompliance $dirtyWorkspace $script:repoRoot
    Assert-True ($externalCallerText -match 'Model Council gate') 'Council gate reads the target workspace when invoked from another directory'

    $councilPath = Join-Path $dirtyWorkspace 'docs/artifacts/adr/COUNCIL-999.md'
    Set-Content $councilPath "# Model Council`n## Synthesis`n[AGENT-TODO]"
    Assert-True ((Invoke-HarnessCompliance $dirtyWorkspace) -match 'Model Council gate') 'A heading-only council cannot satisfy execution'
    $members = @(
        @{ role='Analyst'; requestedModel='openai/gpt-5.6-sol'; selectedModel='openai/gpt-5.6-sol'; source='gh models'; status='ok' },
        @{ role='Strategist'; requestedModel='anthropic/claude-opus-5'; selectedModel='anthropic/claude-opus-5'; source='gh models'; status='ok' },
        @{ role='Skeptic'; requestedModel='google/gemini-3.8-flash'; selectedModel='google/gemini-3.8-flash'; source='gh models'; status='ok' }
    )
    foreach ($scenario in @('complete','not-executed','failed','duplicate','unfinished','future','invalid-date')) {
        $receipt = @{ schemaVersion=1; status='complete'; recordedAt=[datetime]::UtcNow.ToString('o'); members=$members } | ConvertTo-Json -Depth 5 | ConvertFrom-Json
        $synthesis = 'The independent responses agree on the bounded option; remaining uncertainty is recorded.'
        if ($scenario -eq 'not-executed') { $receipt.status = 'not-executed' }
        if ($scenario -eq 'failed') { $receipt.members[1].status = 'failed' }
        if ($scenario -eq 'duplicate') { $receipt.members[1].selectedModel = $receipt.members[0].selectedModel }
        if ($scenario -eq 'unfinished') { $synthesis = '[SYNTHESIS-TODO]' }
        if ($scenario -eq 'future') { $receipt.recordedAt = [datetime]::UtcNow.AddDays(1).ToString('o') }
        if ($scenario -eq 'invalid-date') { $receipt.recordedAt = 'not-a-date' }
        $content = @('# Model Council', '## Execution Evidence', '```json', ($receipt | ConvertTo-Json -Depth 5), '```', '## Synthesis', $synthesis) -join "`n"
        Set-Content $councilPath $content
        $gateOutput = Invoke-HarnessCompliance $dirtyWorkspace
        if ($scenario -eq 'complete') {
            Assert-True ($gateOutput -notmatch 'Model Council gate') 'A complete independent execution receipt and synthesis satisfy the council check'
        } else {
            Assert-True ($gateOutput -match 'Model Council gate') "$scenario council evidence is rejected"
        }
    }

    $untrackedWorkspace = New-TestWorkspace 'untracked-directory'
    try {
        Push-Location $untrackedWorkspace
        try {
            git init --quiet
            git config user.email 'harness-test@example.com'
            git config user.name 'Harness Test'
            Set-Content README.md '# Harness fixture' -Encoding utf8
            git add .
            git commit --quiet -m 'test: initialize untracked fixture'
            New-Item -ItemType Directory -Path 'new-modules' -Force | Out-Null
            foreach ($index in 1..4) {
                Set-Content "new-modules/module-$index.ps1" "Write-Output 'untracked $index'" -Encoding utf8
            }
        } finally {
            Pop-Location
        }
        $untrackedText = Invoke-HarnessCompliance $untrackedWorkspace
        Assert-True ($untrackedText -match 'Code-like files: 4') "Untracked directories are expanded to their individual code files: $untrackedText"
        Assert-True ($untrackedText -match 'Requires execution plan: True') 'Four files inside an untracked directory require an execution plan'
        Assert-True ($untrackedText -match 'no execution plan file was updated') "Missing plan is reported for untracked-directory code changes: $untrackedText"

        New-Item -ItemType Directory -Path (Join-Path $untrackedWorkspace 'docs\artifacts\adr') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $untrackedWorkspace 'docs\artifacts\adr\ADR-1000.md') -Value '# Untracked ADR' -Encoding utf8
        $untrackedAdrText = Invoke-HarnessCompliance $untrackedWorkspace
        Assert-True ($untrackedAdrText -match 'Model Council gate') 'ADR inside an untracked directory requires a matching Council artifact'

        New-Item -ItemType Directory -Path (Join-Path $untrackedWorkspace 'docs\execution\plans') -Force | Out-Null
        @'
# Execution Plan: Literal Bracket Fixture

## Purpose / Big Picture
Literal path validation.
## Progress
- [x] Done
## Decision Log
- Decision: literal paths.
## Plan of Work
Validate exact path.
## Validation and Acceptance
- [PASS] Literal path.
## Artifacts and Notes
Evidence: bracket fixture.
'@ | Set-Content -LiteralPath (Join-Path $untrackedWorkspace 'docs\execution\plans\EXEC-PLAN-[a].md') -Encoding utf8
        Set-Content -LiteralPath (Join-Path $untrackedWorkspace 'docs\execution\plans\EXEC-PLAN-a.md') -Value '# Wrong sibling' -Encoding utf8
        $literalPlanText = Invoke-HarnessCompliance $untrackedWorkspace
        Assert-True ($literalPlanText -notmatch "EXEC-PLAN-\[a\]\.md.*missing required section") 'Bracketed execution plan is read from its exact literal path'
    } finally {
        Remove-TestWorkspace $untrackedWorkspace
    }
} finally {
    Remove-TestWorkspace $dirtyWorkspace
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Yellow' })
if ($script:fail -gt 0) {
    exit 1
}