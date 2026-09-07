#!/usr/bin/env pwsh
# AgentX pre-commit gate behavior tests
# The bash hook is the third implementation of the structured review gate. It is
# the one the docs call the mandatory hard gate, so it needs its own regression
# coverage rather than inheriting confidence from the CLI and runtime suites.
# Usage: pwsh tests/pre-commit-gate-behavior.ps1

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent
$script:hookPath = Join-Path $script:repoRoot '.github\hooks\pre-commit'
$script:postCommitHookPath = Join-Path $script:repoRoot '.github\hooks\post-commit'
$script:agentxLauncherPath = Join-Path $script:repoRoot '.agentx\agentx.ps1'
$script:agentxCliPath = Join-Path $script:repoRoot '.agentx\agentx-cli.ps1'
$script:scrubPath = Join-Path $script:repoRoot 'scripts\scrub.ps1'

<#
.SYNOPSIS
  Start a process, drain stdout and stderr concurrently, and bound both the
  exit wait and the stream drain so a hung child cannot stall this suite.

.DESCRIPTION
  Reading stdout to completion and then stderr (or vice versa) deadlocks
  once the stream read second fills its OS pipe buffer, so both reads start
  as async tasks before any blocking wait.

  WaitForExit returning true only proves the tracked process itself
  exited: a descendant that inherited the redirected handles (e.g. a child
  it spawned without redirecting) can keep the pipe open, so the drain is
  bounded by what remains of the same deadline rather than assumed instant.
#>
function Invoke-ProcessWithBoundedDrain {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = (Get-Location).Path,
        [System.Collections.IDictionary]$EnvironmentVariables,
        [int]$TimeoutSeconds = 30
    )

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FilePath
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    foreach ($argument in $ArgumentList) { $psi.ArgumentList.Add($argument) }
    if ($EnvironmentVariables) {
        foreach ($key in $EnvironmentVariables.Keys) { $psi.Environment[$key] = $EnvironmentVariables[$key] }
    }

    $deadline = [System.Diagnostics.Stopwatch]::StartNew()
    $process = [System.Diagnostics.Process]::Start($psi)
    try {
        # Kick off both drains as async tasks before any blocking wait so a full
        # pipe on either stream can never stall the child.
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $exited = $process.WaitForExit($TimeoutSeconds * 1000)
        if (-not $exited) {
            try { $process.Kill($true) } catch { Write-Warning "Failed to kill timed-out process '$FilePath': $_" }
            $partialOut = if ($stdoutTask.IsCompleted) { $stdoutTask.Result } else { '<stdout still draining>' }
            $partialErr = if ($stderrTask.IsCompleted) { $stderrTask.Result } else { '<stderr still draining>' }
            throw "Process '$FilePath $($ArgumentList -join ' ')' did not exit within $TimeoutSeconds seconds.`nStdOut: $partialOut`nStdErr: $partialErr"
        }

        # Bound the drain by whatever remains of the original deadline: a
        # descendant holding the inherited handle open must not be able to
        # block this call past the timeout it was given.
        $remainingMs = [Math]::Max(0, ($TimeoutSeconds * 1000) - $deadline.ElapsedMilliseconds)
        $drained = [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask), $remainingMs)
        if (-not $drained) {
            $partialOut = if ($stdoutTask.IsCompleted) { $stdoutTask.Result } else { '<stdout still draining: a descendant likely holds the inherited handle open>' }
            $partialErr = if ($stderrTask.IsCompleted) { $stderrTask.Result } else { '<stderr still draining: a descendant likely holds the inherited handle open>' }
            throw "Process '$FilePath $($ArgumentList -join ' ')' exited but a descendant kept its stdout/stderr handle open past the $TimeoutSeconds second bound.`nStdOut: $partialOut`nStdErr: $partialErr"
        }
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StdOut   = $stdoutTask.Result
            StdErr   = $stderrTask.Result
        }
    } finally {
        $process.Dispose()
    }
}

<#
.SYNOPSIS
  Drive the real CLI through a full structured loop and return the loop-state.json
  it produced.

.DESCRIPTION
  Hand-built fixtures can only prove the hook agrees with the test author. This
  produces the exact state shape 'agentx loop iterate --verdict ... && loop
  complete' writes, including the completion entry the CLI always appends after
  the reviewed iteration.
#>
function New-CliProducedLoopState {
    $workspace = Join-Path ([IO.Path]::GetTempPath()) ("agentx-hook-cli-{0}" -f [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path (Join-Path $workspace '.agentx\state') -Force | Out-Null
    try {
        $pwshPath = (Get-Command pwsh -ErrorAction Stop).Source
        $invoke = {
            param([string[]]$Arguments)

            $cliArguments = @('-NoProfile', '-File', $script:agentxCliPath) + $Arguments
            # The real CLI's own startup/module cost measured well over the
            # default bound in this environment, so this call site uses a
            # generous bound: wide enough to never mistake real (if slow) CLI
            # work for a hang, while still catching a genuine deadlock.
            $result = Invoke-ProcessWithBoundedDrain -FilePath $pwshPath -ArgumentList $cliArguments `
                -WorkingDirectory $workspace -EnvironmentVariables @{ AGENTX_WORKSPACE_ROOT = $workspace } `
                -TimeoutSeconds 120
            if ($result.ExitCode -ne 0) {
                throw "agentx-cli.ps1 $($Arguments -join ' ') exited $($result.ExitCode).`nStdErr: $($result.StdErr)`nStdOut: $($result.StdOut)"
            }
        }
        $newEvidence = {
            param([string]$Name)

            $path = Join-Path $workspace $Name
            Set-Content -LiteralPath $path -Value ("evidence {0}" -f [guid]::NewGuid()) -Encoding utf8
            return $path
        }

        & $invoke @('loop', 'start', '-p', 'Hook gate round trip')
        foreach ($iterationNumber in 1..4) {
            & $invoke @('loop', 'iterate', '-s', "Progress $iterationNumber", '-e', (& $newEvidence "evidence-$iterationNumber.txt"), '--passing', '10', '-o', 'pass')
        }
        & $invoke @('loop', 'iterate', '-s', 'Subagent Review: approved', '-e', (& $newEvidence 'review.txt'), '--passing', '10', '--verdict', 'approved', '--reviewer', 'hook-suite', '--high', '0', '--medium', '0', '--low', '1')
        & $invoke @('loop', 'complete', '-s', 'All gates passed', '-e', (& $newEvidence 'final.txt'), '--passing', '10')

        $statePath = Join-Path $workspace '.agentx\state\loop-state.json'
        if (-not (Test-Path -LiteralPath $statePath)) { return $null }
        return (Get-Content -LiteralPath $statePath -Raw)
    } finally {
        Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Assert-True($condition, [string]$message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function Get-BashCommand {
    # Git Bash first: git hooks run under it on Windows, and the WindowsApps
    # 'bash' shim resolves to WSL, where pwsh is not on PATH.
    foreach ($candidate in @("$env:ProgramFiles\Git\bin\bash.exe", "${env:ProgramFiles(x86)}\Git\bin\bash.exe")) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash) { return $bash.Source }
    return $null
}

<#
.SYNOPSIS
  Regression coverage for the stdout/stderr deadlock that used to hang
  New-CliProducedLoopState's process invocation.

.DESCRIPTION
  Spawns a real child process that writes far more to stderr than a single OS
  pipe buffer can hold while writing almost nothing to stdout -- the exact
  shape that deadlocks a sequential 'read stdout to end, then read stderr'
  implementation, because the child blocks filling stderr while the parent is
  still blocked waiting for stdout to close. Invoke-ProcessWithBoundedDrain
  must complete well within its bound and must return the full stderr text,
  proving the concurrent drain (not merely a timeout) is what unblocks it.
#>
function Test-BoundedDrainHandlesLargeStdErr {
    $pwshPath = (Get-Command pwsh -ErrorAction Stop).Source
    # ~1 MB of stderr output, comfortably larger than any OS pipe buffer.
    $stderrCommand = '$line = "x" * 500; for ($i = 0; $i -lt 2000; $i++) { [Console]::Error.WriteLine($line) }'
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $result = Invoke-ProcessWithBoundedDrain -FilePath $pwshPath `
            -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', $stderrCommand) `
            -TimeoutSeconds 20
        $sw.Stop()
        Assert-True ($sw.Elapsed.TotalSeconds -lt 20) 'large-stderr child process completes without hitting the bounded timeout'
        Assert-True ($result.ExitCode -eq 0) 'large-stderr child process exits zero'
        Assert-True ($result.StdErr.Length -ge 1000000) "large-stderr child stream is fully drained, not truncated (captured $($result.StdErr.Length) bytes)"
    } catch {
        $sw.Stop()
        Assert-True $false "large-stderr child process must not hang or be killed by the bounded timeout: $_"
    }
}

<#
.SYNOPSIS
  Regression coverage proving a descendant that inherits the redirected
  stdout/stderr handles cannot make this call hang past its own timeout.

.DESCRIPTION
  A spawner starts a grandchild without redirecting the grandchild's own
  streams, so the grandchild inherits the spawner's (tracked process's)
  stdout/stderr handles, then the spawner exits immediately. WaitForExit
  returns true almost instantly, but the pipes stay open until the sleeping
  grandchild also exits. This proves the call still throws its timeout
  diagnostic near the given bound instead of blocking for the grandchild's
  full sleep.
#>
function Test-BoundedDrainDetectsInheritedHandleHang {
    $pwshPath = (Get-Command pwsh -ErrorAction Stop).Source
    $fixtureDir = Join-Path ([IO.Path]::GetTempPath()) ("agentx hook drain handle {0}" -f [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
    $grandchildPidFile = Join-Path $fixtureDir 'grandchild.pid'
    $grandchildPid = $null
    try {
        $spawnerScript = Join-Path $fixtureDir 'spawner.ps1'
        # No redirection on the grandchild's own ProcessStartInfo: it inherits
        # the spawner's (tracked process's) stdout/stderr handles. The spawner
        # exits right after starting it -- no sleep of its own.
        Set-Content -LiteralPath $spawnerScript -Value @'
param([string]$PidFile)
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = (Get-Process -Id $PID).Path
$psi.ArgumentList.Add('-NoProfile')
$psi.ArgumentList.Add('-Command')
$psi.ArgumentList.Add("Set-Content -LiteralPath '$PidFile' -Value `$PID; Start-Sleep -Seconds 60")
$psi.UseShellExecute = $false
[void][System.Diagnostics.Process]::Start($psi)
'@ -Encoding utf8

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $threw = $false
        $errorMessage = $null
        try {
            Invoke-ProcessWithBoundedDrain -FilePath $pwshPath `
                -ArgumentList @('-NoProfile', '-File', $spawnerScript, $grandchildPidFile) `
                -TimeoutSeconds 8 | Out-Null
        } catch {
            $threw = $true
            $errorMessage = $_.Exception.Message
        }
        $sw.Stop()

        $deadline = (Get-Date).AddSeconds(10)
        while (-not $grandchildPid -and (Get-Date) -lt $deadline) {
            if (Test-Path -LiteralPath $grandchildPidFile) { $grandchildPid = (Get-Content -LiteralPath $grandchildPidFile -Raw).Trim() }
            else { Start-Sleep -Milliseconds 200 }
        }

        Assert-True ($sw.Elapsed.TotalSeconds -lt 20) "bounded drain does not block past its own timeout when a descendant inherits its stdout/stderr handles (elapsed $([Math]::Round($sw.Elapsed.TotalSeconds, 1))s, bound 8s)"
        Assert-True $threw "bounded drain throws a diagnostic instead of hanging when a live descendant still holds the inherited stream handles open"
        Assert-True ($threw -and $errorMessage -match 'descendant kept its stdout/stderr handle open') "bounded drain's timeout diagnostic explains the inherited-handle cause (got: $errorMessage)"
    } finally {
        if ($grandchildPid -and (Get-Process -Id ([int]$grandchildPid) -ErrorAction SilentlyContinue)) {
            Stop-Process -Id ([int]$grandchildPid) -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $fixtureDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

<#
.SYNOPSIS
  Run the hook in a throwaway git repo with one staged code file and the supplied
  loop state, and report whether the loop gate blocked the commit.
#>
function Invoke-HookGate {
    param(
        [string]$BashPath,
        $LoopState,
        [string]$RawState,
        [switch]$StageReviewDoc,
        [switch]$StageSecret,
        [switch]$StageSecretThenClean,
        [switch]$StageSecretThenDelete,
        [switch]$SkipDefaultCode,
        [switch]$StageTrackedDelete,
        [switch]$StageTrackedRename,
        [switch]$StageGateHookDelete,
        [switch]$StageUnstagedValidatorDrift,
        [switch]$RunPostCommit,
        [switch]$StagePrdFile,
        [string]$PrdFileName = 'PRD-9001.md',
        [string]$PrdContent
    )

    $repo = Join-Path ([IO.Path]::GetTempPath()) ("agentx-hook-gate-{0}" -f [guid]::NewGuid().ToString('N'))
    try {
        New-Item -ItemType Directory -Path (Join-Path $repo '.agentx\state') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $repo 'scripts') -Force | Out-Null
        Push-Location $repo
        try {
            git init --quiet 2>&1 | Out-Null
            git config user.email 'hook-test@example.com' 2>&1 | Out-Null
            git config user.name 'Hook Test' 2>&1 | Out-Null
            Copy-Item -LiteralPath $script:agentxLauncherPath -Destination (Join-Path $repo '.agentx\agentx.ps1') -Force
            Copy-Item -LiteralPath $script:agentxCliPath -Destination (Join-Path $repo '.agentx\agentx-cli.ps1') -Force
            Copy-Item -LiteralPath $script:scrubPath -Destination (Join-Path $repo 'scripts\scrub.ps1') -Force
            if ($StageUnstagedValidatorDrift) {
                git add .agentx/agentx.ps1 .agentx/agentx-cli.ps1 scripts/scrub.ps1 2>&1 | Out-Null
                git commit --quiet -m 'test: add validator baseline'
                Add-Content -LiteralPath (Join-Path $repo '.agentx\agentx-cli.ps1') -Value '# unstaged permissive validator drift'
            }
            if ($StageTrackedDelete -or $StageTrackedRename -or $StageGateHookDelete) {
                Set-Content -LiteralPath (Join-Path $repo 'tracked.ps1') -Value 'Write-Output "tracked code"' -Encoding utf8
                if ($StageGateHookDelete) {
                    New-Item -ItemType Directory -Path (Join-Path $repo '.github\hooks') -Force | Out-Null
                    Set-Content -LiteralPath (Join-Path $repo '.github\hooks\pre-commit') -Value '#!/usr/bin/env bash' -Encoding utf8
                }
                git add tracked.ps1 2>&1 | Out-Null
                if ($StageGateHookDelete) { git add .github/hooks/pre-commit 2>&1 | Out-Null }
                git commit --quiet -m 'test: add tracked source'
            }
            if (-not $SkipDefaultCode) {
                Set-Content -LiteralPath (Join-Path $repo 'change.ps1') -Value 'Write-Output "staged code"' -Encoding utf8
                git add change.ps1 2>&1 | Out-Null
            }
            if ($StageTrackedDelete) {
                Remove-Item -LiteralPath (Join-Path $repo 'tracked.ps1') -Force
                git add -u 2>&1 | Out-Null
            }
            if ($StageTrackedRename) {
                git mv tracked.ps1 tracked.txt 2>&1 | Out-Null
            }
            if ($StageGateHookDelete) {
                Remove-Item -LiteralPath (Join-Path $repo '.github\hooks\pre-commit') -Force
                git add -u 2>&1 | Out-Null
                git reset --quiet tracked.ps1
            }
            if ($StageReviewDoc) {
                New-Item -ItemType Directory -Path (Join-Path $repo 'docs\artifacts\reviews') -Force | Out-Null
                Set-Content -LiteralPath (Join-Path $repo 'docs\artifacts\reviews\REVIEW-1.md') -Value '# Review' -Encoding utf8
                git add docs/artifacts/reviews/REVIEW-1.md 2>&1 | Out-Null
            }
            if ($StagePrdFile) {
                New-Item -ItemType Directory -Path (Join-Path $repo 'docs\artifacts\prd') -Force | Out-Null
                Set-Content -LiteralPath (Join-Path $repo "docs\artifacts\prd\$PrdFileName") -Value $PrdContent -Encoding utf8
                git add "docs/artifacts/prd/$PrdFileName" 2>&1 | Out-Null
            }
            if ($StageSecret) {
                Set-Content -LiteralPath (Join-Path $repo 'secret.ps1') -Value (('api_' + 'key') + ' = "real-looking-secret-value"') -Encoding utf8
                git add secret.ps1 2>&1 | Out-Null
            }
            if ($StageSecretThenClean) {
                Set-Content -LiteralPath (Join-Path $repo 'split.ps1') -Value (('api_' + 'key') + ' = "staged-secret-value"') -Encoding utf8
                git add split.ps1 2>&1 | Out-Null
                Set-Content -LiteralPath (Join-Path $repo 'split.ps1') -Value 'Write-Output "clean worktree"' -Encoding utf8
            }
            if ($StageSecretThenDelete) {
                Set-Content -LiteralPath (Join-Path $repo 'deleted.ps1') -Value (('api_' + 'key') + ' = "staged-deleted-secret"') -Encoding utf8
                git add deleted.ps1 2>&1 | Out-Null
                Remove-Item -LiteralPath (Join-Path $repo 'deleted.ps1') -Force
            }
            $stateJson = if ($RawState) { $RawState } else { $LoopState | ConvertTo-Json -Depth 10 }
            $stateJson | Set-Content -LiteralPath (Join-Path $repo '.agentx\state\loop-state.json') -Encoding utf8
            Copy-Item -LiteralPath $script:hookPath -Destination (Join-Path $repo 'pre-commit') -Force
            Copy-Item -LiteralPath $script:postCommitHookPath -Destination (Join-Path $repo 'post-commit') -Force
            # The hook delegates through the launcher so the same path works in
            # a checkout and in the extension's zero-copy runtime.
            # The hook exits non-zero by design here, so redirect every stream to a
            # file rather than letting the failure interrupt the pipeline.
            $outFile = Join-Path $repo 'hook-output.txt'
            $exitCode = 0
            $previous = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                & $BashPath './pre-commit' *> $outFile
                $exitCode = $LASTEXITCODE
            } catch {
                $exitCode = -1
            } finally {
                $ErrorActionPreference = $previous
            }
            $postCommitExit = $null
            if ($RunPostCommit -and $exitCode -eq 0) {
                & $BashPath './post-commit' *>> $outFile
                $postCommitExit = $LASTEXITCODE
            }
            $output = if (Test-Path -LiteralPath $outFile) { (Get-Content -LiteralPath $outFile -Raw) } else { '' }
            $writtenState = Get-Content -LiteralPath (Join-Path $repo '.agentx\state\loop-state.json') -Raw | ConvertFrom-Json
            return [PSCustomObject]@{
                Output = [string]$output
                ExitCode = $exitCode
                PostCommitExitCode = $postCommitExit
                LoopConsumed = [bool]$writtenState.loopConsumed
            }
        } finally {
            Pop-Location
        }
    } finally {
        Remove-Item -LiteralPath $repo -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function New-HookLoopState {
    param(
        [array]$History,
        [string]$ReviewGate = 'structured',
        [int]$Iteration = 5
    )

    $timestamp = (Get-Date).ToUniversalTime().ToString('o')
    $state = [ordered]@{
        active        = $false
        status        = 'complete'
        loopConsumed  = $false
        iteration     = $Iteration
        minIterations = 5
        maxIterations = 20
        startedAt = $timestamp
        lastIterationAt = $timestamp
    }
    if ($ReviewGate) { $state['reviewGate'] = $ReviewGate }
    $state['history'] = $History
    return $state
}

function New-HookHistoryEntry {
    param(
        [int]$Iteration,
        [string]$Summary,
        $Review
    )

    # Property order mirrors the CLI writer: the review record is appended last,
    # which is what the hook's iteration-binding check relies on.
    $entry = [ordered]@{
        iteration = $Iteration
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        summary   = $Summary
        status    = 'iterated'
        outcome   = 'pass'
    }
    if ($Review) { $entry['review'] = $Review }
    return $entry
}

Write-Host ''
Write-Host ' Pre-commit structured review gate' -ForegroundColor White
Write-Host ' ================================================' -ForegroundColor DarkGray

Test-BoundedDrainHandlesLargeStdErr
Test-BoundedDrainDetectsInheritedHandleHang

$bashPath = Get-BashCommand
if (-not $bashPath) {
    Assert-True $true 'pre-commit gate tests skipped (bash not available on this host)'
} else {
    $approved = [ordered]@{ verdict = 'approved'; reviewer = 'hook-suite'; high = 0; medium = 0; low = 1 }
    # 'loop complete' always appends this entry after the reviewed iteration, so
    # every passing fixture must carry it or the suite tests a shape the CLI
    # cannot produce.
    $completionEntry = New-HookHistoryEntry -Iteration 5 -Summary 'All gates passed'
    $completionEntry['status'] = 'complete'
    $completionEntry['kind'] = 'completion'

    # The authoritative case: state written by the real CLI, not by this suite.
    $cliState = New-CliProducedLoopState
    if ($cliState) {
        $cliRun = Invoke-HookGate -BashPath $bashPath -RawState $cliState
        # Prove the hook actually ran before trusting any -notmatch assertion:
        # empty output would otherwise pass vacuously.
        Assert-True ($cliRun.Output -match 'Running pre-commit checks') 'the hook executed and produced output'
        Assert-True ($cliRun.Output -notmatch 'BLOCK:') 'a loop completed through the real CLI passes the hook gate'
        Assert-True ($cliRun.ExitCode -eq 0) 'real CLI-produced state passes the complete hook with exit zero'
    } else {
        Assert-True $false 'CLI round-trip fixture could not be produced'
    }

    $clean = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($clean.Output -notmatch 'BLOCK:') 'an approved review with zero findings passes the loop gate'
    Assert-True ($clean.ExitCode -eq 0) 'clean hook fixture exits zero'
    Assert-True (-not $clean.LoopConsumed) 'pre-commit leaves successful loop consumption to post-commit'

    $validatorDrift = Invoke-HookGate -BashPath $bashPath -StageUnstagedValidatorDrift -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($validatorDrift.ExitCode -ne 0) 'unstaged quality-gate validator changes block staged code'
    Assert-True ($validatorDrift.Output -match 'validators have unstaged changes') 'validator drift rejection is actionable'

    $committed = Invoke-HookGate -BashPath $bashPath -RunPostCommit -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($committed.ExitCode -eq 0) 'successful pre-commit path remains green before post-commit'
    Assert-True ($committed.PostCommitExitCode -eq 0) 'post-commit consumption hook exits zero'
    Assert-True $committed.LoopConsumed 'post-commit marks the completed loop consumed after commit creation'

    $rejected = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review' -Review ([ordered]@{ verdict = 'changes-requested'; reviewer = 'hook-suite'; high = 1; medium = 0; low = 0 }))
    ))
    Assert-True ($rejected.Output -match "latest reviewer verdict is 'changes-requested'") 'a changes-requested verdict blocks the commit'
    Assert-True ($rejected.ExitCode -ne 0) 'changes-requested hook fixture exits non-zero'

    $withFindings = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review' -Review ([ordered]@{ verdict = 'approved'; reviewer = 'hook-suite'; high = 0; medium = 3; low = 0 }))
    ))
    Assert-True ($withFindings.Output -match 'MEDIUM finding') 'an approved review carrying MEDIUM findings blocks the commit'

    # Counts must be read from the SAME object as the verdict: an earlier clean
    # record must not launder a later verdict.
    $mismatched = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 4 -Summary 'Subagent Review' -Review ([ordered]@{ verdict = 'approved'; reviewer = 'hook-suite'; high = 0; medium = 0; low = 0 })),
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review' -Review ([ordered]@{ verdict = 'approved'; reviewer = 'hook-suite'; high = 4; medium = 0; low = 0 }))
    ))
    Assert-True ($mismatched.Output -match 'HIGH') 'verdict and counts are bound to the same review record'

    $stale = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 4 -Summary 'Subagent Review: approved' -Review $approved),
        (New-HookHistoryEntry -Iteration 5 -Summary 'More unreviewed changes'),
        $completionEntry
    ))
    Assert-True ($stale.Output -match 'after the approved review') 'work recorded after the approval blocks the commit'

    # The agentic runner writes status='complete' for genuine work, so the
    # trailing-entry skip must key on the completion MARKER, not on status.
    $runnerEntry = New-HookHistoryEntry -Iteration 5 -Summary 'Agentic run completed successfully.'
    $runnerEntry['status'] = 'complete'
    $runnerWork = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 4 -Summary 'Subagent Review: approved' -Review $approved),
        $runnerEntry
    ))
    Assert-True ($runnerWork.Output -match 'after the approved review') 'a runner-written complete entry after the approval is not mistaken for the completion record'

    # A workspace-written state cannot lower the minimum inferred for its risk class.
    $lowMin = New-HookLoopState -Iteration 1 -History @(
        (New-HookHistoryEntry -Iteration 1 -Summary 'Subagent Review: approved' -Review $approved)
    )
    $lowMin['prompt'] = 'Deploy a production authentication migration'
    $lowMin['taskClass'] = 'standard'
    $lowMin['minIterations'] = 1
    $lowMin['maxIterations'] = 1
    $lowMinRun = Invoke-HookGate -BashPath $bashPath -LoopState $lowMin
    Assert-True ($lowMinRun.Output -match 'below minimum iterations') 'a state claiming a lower minimum cannot lower the high-risk floor'

    # One commit carrying both a code file and a review artifact must not fail on
    # its own consumption marker.
    $bothRun = Invoke-HookGate -BashPath $bashPath -StageReviewDoc -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($bothRun.Output -notmatch 'Review document staged but') 'a commit with both a code file and a review artifact passes both gates'
    Assert-True ($bothRun.ExitCode -eq 0) 'mixed code and review-artifact fixture exits zero'

    $secretRun = Invoke-HookGate -BashPath $bashPath -StageSecret -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($secretRun.ExitCode -ne 0) 'later secret check rejects the commit'
    Assert-True (-not $secretRun.LoopConsumed) 'failed commit does not consume the completed quality loop'

    $splitRun = Invoke-HookGate -BashPath $bashPath -StageSecretThenClean -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($splitRun.ExitCode -ne 0) 'staged/worktree substitution is rejected'
    Assert-True ($splitRun.Output -match 'Staged files differ from their worktree copies') 'hook reports staged/worktree byte divergence'
    Assert-True (-not $splitRun.LoopConsumed) 'staged/worktree rejection does not consume the loop'

    $deletedRun = Invoke-HookGate -BashPath $bashPath -StageSecretThenDelete -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($deletedRun.ExitCode -ne 0) 'staged file deleted from the worktree is rejected'
    Assert-True ($deletedRun.Output -match 'Staged files differ from their worktree copies') 'hook reports staged path missing from the worktree'
    Assert-True (-not $deletedRun.LoopConsumed) 'staged deletion rejection does not consume the loop'

    $sourceDeletionRun = Invoke-HookGate -BashPath $bashPath -SkipDefaultCode -StageTrackedDelete
    Assert-True ($sourceDeletionRun.ExitCode -ne 0) 'tracked source deletion requires a completed quality loop'
    Assert-True ($sourceDeletionRun.Output -match 'BLOCK: no quality loop found') 'source deletion reaches the delegated quality-loop gate'

    $sourceRenameRun = Invoke-HookGate -BashPath $bashPath -SkipDefaultCode -StageTrackedRename
    Assert-True ($sourceRenameRun.ExitCode -ne 0) 'source-to-text rename requires a completed quality loop'
    Assert-True ($sourceRenameRun.Output -match 'BLOCK: no quality loop found') 'source rename exposes the deleted source path to the quality-loop gate'

    $gateHookDeletionRun = Invoke-HookGate -BashPath $bashPath -SkipDefaultCode -StageGateHookDelete
    Assert-True ($gateHookDeletionRun.ExitCode -ne 0) 'deleting an extensionless gate hook requires a completed quality loop'
    Assert-True ($gateHookDeletionRun.Output -match 'BLOCK: no quality loop found') 'gate-hook deletion reaches the delegated quality-loop gate'

    $missingCounts = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review' -Review ([ordered]@{ verdict = 'approved'; reviewer = 'hook-suite'; low = 2 }))
    ))
    Assert-True ($missingCounts.Output -match 'missing HIGH/MEDIUM counts') 'a verdict without counts fails closed'

    $missingReviewer = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review' -Review ([ordered]@{ verdict = 'approved'; high = 0; medium = 0; low = 0 }))
    ))
    Assert-True ($missingReviewer.Output -match 'reviewer id') 'a verdict without a reviewer id fails closed'

    $claimed = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: no findings')
    ))
    Assert-True ($claimed.Output -match 'missing a subagent reviewer pass') 'a claimed review summary cannot satisfy a structured-gate loop'

    # The free-text contract is gone, so a marker-less loop with no review record
    # is blocked rather than downgraded.
    $legacy = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -ReviewGate '' -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Iteration 5 review of the diff')
    ))
    Assert-True ($legacy.Output -match 'missing a subagent reviewer pass') 'removing the reviewGate marker does not restore a free-text contract'

    # A review record must live inside a history entry. A top-level property with
    # the same shape is not a review of anything.
    $topLevelState = New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 4 -Summary 'Progress'),
        (New-HookHistoryEntry -Iteration 5 -Summary 'Unreviewed work')
    )
    $topLevelState['review'] = [ordered]@{ verdict = 'approved'; reviewer = 'attacker'; high = 0; medium = 0; low = 0 }
    $topLevel = Invoke-HookGate -BashPath $bashPath -LoopState $topLevelState
    Assert-True ($topLevel.Output -match 'missing a subagent reviewer pass') 'a review record outside history does not satisfy the gate'

    $clean2 = Invoke-HookGate -BashPath $bashPath -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($clean2.Output -match 'Running pre-commit checks') 'the hook executed and produced output for the clean fixture'
    Assert-True ($clean2.ExitCode -eq 0) 'second clean hook fixture exits zero'

    # Regression: the canonical PRD template (and every PRD it generates, e.g.
    # PRD-244) numbers its headings ("## 1. Problem Statement", "## 3. Goals &
    # Success Metrics"). Check 12's PRD structure grep used to require the
    # keyword immediately after "##", so a real, fully-structured PRD was
    # misreported as missing its required sections purely because of its
    # heading numbering -- not because any section was actually absent.
    $numberedPrd = Invoke-HookGate -BashPath $bashPath -StagePrdFile -PrdFileName 'PRD-9001.md' -PrdContent @'
# PRD-9001: Sample feature

## 1. Problem Statement

Why this matters.

## 2. Target Users

Everyone affected.

## 3. Goals & Success Metrics

Ship it.
'@ -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($numberedPrd.Output -match 'PRD structure valid') 'a PRD using canonical numbered headings (## 1. Problem Statement) is recognized as structurally valid'
    Assert-True ($numberedPrd.Output -notmatch 'PRD missing required sections') 'the numbered-heading regression no longer misreports a correctly-structured PRD as missing its sections'

    # Preserve original semantic acceptance: a PRD that genuinely omits every
    # required section (not merely numbered) must still warn. The numeric-
    # prefix fix must not weaken detection of real incompleteness.
    $incompletePrd = Invoke-HookGate -BashPath $bashPath -StagePrdFile -PrdFileName 'PRD-9002.md' -PrdContent @'
# PRD-9002: Underspecified feature

## Overview

This document never names any of the required sections.
'@ -LoopState (New-HookLoopState -History @(
        (New-HookHistoryEntry -Iteration 5 -Summary 'Subagent Review: approved' -Review $approved),
        $completionEntry
    ))
    Assert-True ($incompletePrd.Output -match 'PRD missing required sections') 'a PRD genuinely missing every required section still warns'
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
if ($script:fail -gt 0) {
    Write-Host " Failures: $($script:fail)" -ForegroundColor Red
    exit 1
}
