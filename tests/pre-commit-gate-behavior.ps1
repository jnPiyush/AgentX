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

            $psi = [System.Diagnostics.ProcessStartInfo]::new()
            $psi.FileName = $pwshPath
            $psi.WorkingDirectory = $workspace
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.UseShellExecute = $false
            $psi.Environment['AGENTX_WORKSPACE_ROOT'] = $workspace
            $psi.ArgumentList.Add('-NoProfile')
            $psi.ArgumentList.Add('-File')
            $psi.ArgumentList.Add($script:agentxCliPath)
            foreach ($argument in $Arguments) { $psi.ArgumentList.Add($argument) }
            $process = [System.Diagnostics.Process]::Start($psi)
            [void]$process.StandardOutput.ReadToEnd()
            [void]$process.StandardError.ReadToEnd()
            $process.WaitForExit()
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
        [switch]$RunPostCommit
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

    # The floor of 5 is absolute: a state file claiming a lower minimum (which
    # 'loop start --max 1' produces) must not lower the gate.
    $lowMin = New-HookLoopState -Iteration 1 -History @(
        (New-HookHistoryEntry -Iteration 1 -Summary 'Subagent Review: approved' -Review $approved)
    )
    $lowMin['minIterations'] = 1
    $lowMin['maxIterations'] = 1
    $lowMinRun = Invoke-HookGate -BashPath $bashPath -LoopState $lowMin
    Assert-True ($lowMinRun.Output -match 'below minimum iterations') 'a state claiming a lower minimum cannot lower the five-iteration floor'

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
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
if ($script:fail -gt 0) {
    Write-Host " Failures: $($script:fail)" -ForegroundColor Red
    exit 1
}
