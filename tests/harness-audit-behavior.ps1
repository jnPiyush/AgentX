#!/usr/bin/env pwsh

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
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx' 'state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root 'scripts') -Force | Out-Null

    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx.ps1') (Join-Path $root '.agentx\agentx.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') (Join-Path $root '.agentx\agentx-cli.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot 'scripts\check-harness-compliance.ps1') (Join-Path $root 'scripts\check-harness-compliance.ps1') -Force

    @{ provider = 'local'; mode = 'local'; enforceIssues = $false } | ConvertTo-Json | Set-Content (Join-Path $root '.agentx\config.json') -Encoding utf8

    return $root
}

function Remove-TestWorkspace([string]$root) {
    if ($root -and (Test-Path $root)) {
        Remove-Item $root -Recurse -Force
    }
}

function Invoke-AgentX([string]$root, [string[]]$arguments) {
    return Invoke-AgentXLauncher -Root $root -LauncherPath (Join-Path $root '.agentx\agentx.ps1') -Arguments $arguments
}

function Invoke-AgentXLauncher([string]$Root, [string]$LauncherPath, [string[]]$Arguments) {
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
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $Root

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function Invoke-HarnessCompliance([string]$root) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $root
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root 'scripts\check-harness-compliance.ps1'))
    $startInfo.ArgumentList.Add('-ReportOnly')
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $root

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
    } | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root '.agentx\state\loop-state.json') -Encoding utf8

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
    } | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root '.agentx\state\harness-state.json') -Encoding utf8
}

Write-Host ''
Write-Host ' Harness Audit Behavior Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

$cliAst = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $script:repoRoot '.agentx/agentx-cli.ps1'), [ref]$null, [ref]$null)
foreach ($definition in $cliAst.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -in @('Invoke-HarnessAuditProcess', 'Get-HarnessLoopAuditResult', 'Invoke-HarnessComplianceReport')
}, $false)) {
    . ([scriptblock]::Create($definition.Extent.Text))
}

$workspace = New-TestWorkspace 'stream capture'
try {
    $script:ROOT = $workspace
    $script:INSTALL_AGENTX_DIR = Join-Path $workspace '.agentx'
    $checkPath = Join-Path $workspace 'scripts/check-harness-compliance.ps1'
    $streamFixture = @'
param([string]$BaseRef, [switch]$ReportOnly)
[Console]::Error.WriteLine(('e' * 131072))
[Console]::Out.WriteLine(('o' * 131072))
Write-Output "BaseRef=$BaseRef"
Write-Output '[PASS] Saturated stream fixture completed'
exit 0
'@
    Set-Content -LiteralPath $checkPath -Value $streamFixture -Encoding utf8
    Write-Host ' [RUNNING] Saturated production harness collector...'
    $capture = Invoke-HarnessComplianceReport -baseRef 'branch with spaces'
    Assert-True $capture.passed 'Harness collector drains large stderr and stdout without deadlock'
    Assert-True ($capture.lines -contains 'BaseRef=branch with spaces') 'Harness collector preserves spaced arguments'
    Assert-True (@($capture.lines | Where-Object { $_.Length -eq 131072 }).Count -eq 2) 'Harness collector preserves both complete streams'

    Set-Content -LiteralPath $checkPath -Value "Write-Output 'No failure marker'; exit 7" -Encoding utf8
    $failed = Invoke-HarnessComplianceReport
    Assert-True (-not $failed.passed -and $failed.failureCount -gt 0) 'Nonzero compliance exit fails even without a FAIL marker'
    Assert-True ($failed.summary -match 'exit.*7') 'Compliance failure reports the actual exit code'

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $workspace
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', $checkPath)) {
        $startInfo.ArgumentList.Add($argument)
    }
    Set-Content -LiteralPath $checkPath -Value 'Start-Sleep -Seconds 60' -Encoding utf8
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    $timeout = Invoke-HarnessAuditProcess -StartInfo $startInfo -TimeoutSeconds 3
    $watch.Stop()
    Assert-True $timeout.TimedOut 'Harness process collector reports its deadline'
    Assert-True ($watch.Elapsed.TotalSeconds -lt 10) 'Harness process collector returns within bounded headroom'
    Assert-True ($null -eq $timeout.ExitCode) 'Timed-out process does not invent a successful exit'

    Set-Content -LiteralPath (Join-Path $script:INSTALL_AGENTX_DIR 'agentx-cli.ps1') -Value $streamFixture -Encoding utf8
    $loopCapture = Get-HarnessLoopAuditResult -workspaceRoot $workspace
    Assert-True $loopCapture.passed 'Loop gate collector also drains saturated streams'
} finally {
    Remove-TestWorkspace $workspace
    Remove-Variable -Name ROOT, INSTALL_AGENTX_DIR -Scope Script
}

$workspace = New-TestWorkspace 'profiles'
try {
    Set-WorkspaceHarnessState $workspace

    $balanced = Invoke-AgentX $workspace @('audit', 'harness', '--json')
    $balancedJson = $balanced.Output | ConvertFrom-Json -Depth 20
    Assert-True ($balanced.ExitCode -eq 0) 'Balanced harness audit passes when only advisory planning checks fail'
    Assert-True ($balancedJson.profile -eq 'balanced') 'Balanced harness audit reports the default profile'
    Assert-True ($balancedJson.failedRequiredChecks.Count -eq 0) 'Balanced harness audit has no failed required checks'
    Assert-True (($balancedJson.checks | Where-Object { $_.id -eq 'execution-plan-present' }).Count -eq 1) 'Balanced harness audit still reports advisory planning checks'

    $reviewlessStatePath = Join-Path $workspace '.agentx\state\loop-state.json'
    $reviewlessState = Get-Content -LiteralPath $reviewlessStatePath -Raw | ConvertFrom-Json
    $reviewlessState.history = @($reviewlessState.history | Where-Object { -not $_.review })
    $reviewlessState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reviewlessStatePath -Encoding utf8
    $reviewless = Invoke-AgentX $workspace @('audit', 'harness', '--json')
    $reviewlessJson = $reviewless.Output | ConvertFrom-Json -Depth 20
    Assert-True ($reviewless.ExitCode -ne 0) 'Harness audit rejects completed state without structured reviewer approval'
    Assert-True ($reviewlessJson.failedRequiredChecks -contains 'loop-complete') 'Harness audit delegates loop completion to the structural gate'
    Set-WorkspaceHarnessState $workspace

    $strict = Invoke-AgentX $workspace @('audit', 'harness', '--profile', 'strict', '--json')
    $strictJson = $strict.Output | ConvertFrom-Json -Depth 20
    Assert-True ($strict.ExitCode -ne 0) 'Strict harness audit fails when planning checks are missing'
    Assert-True ($strictJson.failedRequiredChecks -contains 'execution-plan-present') 'Strict harness audit requires execution plan check'
    Assert-True ($strictJson.failedRequiredChecks -contains 'progress-log-present') 'Strict harness audit requires progress log check'

    @{ provider = 'local'; mode = 'local'; harnessEnforcementProfile = 'strict'; harnessDisabledChecks = 'execution-plan-present,progress-log-present' } | ConvertTo-Json | Set-Content (Join-Path $workspace '.agentx\config.json') -Encoding utf8
    $disabled = Invoke-AgentX $workspace @('audit', 'harness', '--json')
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
    $hookInstall = Invoke-AgentX $workspace @('hooks', 'install')
    Assert-True ($hookInstall.ExitCode -eq 0) 'Hook installer exits successfully'
    Assert-True (Test-Path -LiteralPath (Join-Path $workspace '.git\hooks\post-commit') -PathType Leaf) 'Hook installer includes post-commit lifecycle hook'
} finally {
    Remove-TestWorkspace $workspace
}

$missingHookWorkspace = New-TestWorkspace 'missing-hook-source'
try {
    Push-Location $missingHookWorkspace
    try { git init --quiet } finally { Pop-Location }
    $missingHookInstall = Invoke-AgentX $missingHookWorkspace @('hooks', 'install')
    Assert-True ($missingHookInstall.ExitCode -ne 0) 'Hook installer fails when required hook sources are unavailable'
    Assert-True ($missingHookInstall.Output -match 'Required hook source is missing') 'Missing hook source failure is actionable'
} finally {
    Remove-TestWorkspace $missingHookWorkspace
}

$zeroCopyWorkspace = New-TestWorkspace 'zero-copy-hooks'
$bundleFixture = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-hook-bundle-{0}\.github\agentx" -f [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $bundleFixture '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $bundleFixture '.github\hooks') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:repoRoot '.agentx\agentx.ps1') -Destination (Join-Path $bundleFixture '.agentx\agentx.ps1') -Force
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
    $zeroCopyInstall = Invoke-AgentXLauncher -Root $zeroCopyWorkspace -LauncherPath (Join-Path $bundleFixture '.agentx\agentx.ps1') -Arguments @('hooks', 'install')
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
        "`$env:AGENTX_WORKSPACE_ROOT = '$escapedWorkspace'"
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
    $samePathInstall = Invoke-AgentX $samePathWorkspace @('hooks', 'install')
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

        $scrubPath = Join-Path $untrackedWorkspace 'scripts/scrub.ps1'
        @'
param([string]$Path)
Add-Content -LiteralPath (Join-Path $PSScriptRoot 'scan-pids.txt') -Value "$PID|$Path"
Write-Host '[HIGH/comment-rot] fixture finding'
exit 1
'@ | Set-Content -LiteralPath $scrubPath -Encoding utf8
        $highText = Invoke-HarnessCompliance $untrackedWorkspace
        $scans = @(Get-Content -LiteralPath (Join-Path $untrackedWorkspace 'scripts/scan-pids.txt'))
        $scanProcesses = @($scans | ForEach-Object { ($_ -split '\|', 2)[0] } | Sort-Object -Unique)
        Assert-True ($scans.Count -gt 2 -and $scanProcesses.Count -eq 1) 'Changed-file scrub uses one host instead of one process per file'
        Assert-True ($highText -match 'Deslop scrub gate:.*HIGH-severity') 'In-process scrub captures Write-Host HIGH findings'

        Set-Content -LiteralPath $scrubPath -Value 'exit 7' -Encoding utf8
        $crashText = Invoke-HarnessCompliance $untrackedWorkspace
        Assert-True ($crashText -match 'could not be scanned' -and $crashText -match 'scrub exited 7') 'Scrub exit failures without findings still fail closed'

        Set-Content -LiteralPath $scrubPath -Value 'exit 0' -Encoding utf8
        $cleanText = Invoke-HarnessCompliance $untrackedWorkspace
        Assert-True ($cleanText -match '\[PASS\] Scrub gate:' -and $cleanText -notmatch 'could not be scanned') 'Successful scans do not inherit a previous failing exit code'

        @'
param([string]$Path)
Add-Content -LiteralPath (Join-Path $PSScriptRoot 'scan-exceptions.txt') -Value $Path
switch (Split-Path $Path -Leaf) {
    'module-1.ps1' { throw [System.InvalidOperationException]::new('fixture terminating failure') }
    'module-2.ps1' { Write-Error 'fixture stopping error' -ErrorAction Stop }
    'module-3.ps1' { Write-Host '[HIGH/comment-rot] later target finding'; exit 1 }
}
exit 0
'@ | Set-Content -LiteralPath $scrubPath -Encoding utf8
        $githubOutputPath = Join-Path $untrackedWorkspace '.agentx/state/compliance-output.txt'
        $scanStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
        $scanStartInfo.FileName = 'pwsh'
        $scanStartInfo.WorkingDirectory = $untrackedWorkspace
        $scanStartInfo.UseShellExecute = $false
        $scanStartInfo.RedirectStandardOutput = $true
        $scanStartInfo.RedirectStandardError = $true
        foreach ($argument in @('-NoProfile', '-NonInteractive', '-File', (Join-Path $untrackedWorkspace 'scripts/check-harness-compliance.ps1'))) {
            $scanStartInfo.ArgumentList.Add($argument)
        }
        $scanStartInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $untrackedWorkspace
        $scanStartInfo.Environment['GITHUB_OUTPUT'] = $githubOutputPath
        $exceptionResult = Invoke-HarnessAuditProcess -StartInfo $scanStartInfo -TimeoutSeconds 30
        $exceptionText = $exceptionResult.StdOut + $exceptionResult.StdErr
        $exceptionScans = @(Get-Content -LiteralPath (Join-Path $untrackedWorkspace 'scripts/scan-exceptions.txt'))
        Assert-True (-not $exceptionResult.TimedOut -and $exceptionResult.ExitCode -eq 1) 'Terminating scrub errors fail the actual non-advisory compliance command'
        Assert-True ($exceptionText -match 'module-1\.ps1 ->.*fixture terminating failure' -and
            $exceptionText -match 'module-2\.ps1 ->.*fixture stopping error') 'Thrown and stopping errors report each failed target and its cause'
        Assert-True ($exceptionScans -contains 'new-modules/module-3.ps1' -and
            $exceptionScans -contains 'new-modules/module-4.ps1') 'Later failing and successful targets are still scanned after terminating errors'
        Assert-True ($exceptionText -match 'later target finding' -and $exceptionText -match '\[FAIL\] Deslop scrub gate: 2 file\(s\) could not be scanned' -and
            $exceptionText -notmatch '\[PASS\] Scrub gate:') 'Batch reporting retains later HIGH findings and both scan errors without claiming success'
        $githubOutput = if (Test-Path -LiteralPath $githubOutputPath) { Get-Content -LiteralPath $githubOutputPath -Raw } else { '' }
        Assert-True ($githubOutput -match '(?m)^changed_files=\d+' -and $githubOutput -match '(?m)^failure_count=[1-9]\d*') 'Terminating scan failures preserve post-batch GitHub output metadata'
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