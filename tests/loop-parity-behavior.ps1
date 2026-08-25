#!/usr/bin/env pwsh
# AgentX Loop Parity Behavior Tests
# Phase 0 for SPEC-401: locks the current PowerShell writer behavior behind
# normalized golden fixtures before the TypeScript writer is introduced.
# Usage: pwsh tests/loop-parity-behavior.ps1

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent
$script:agentxCliPath = Join-Path $script:repoRoot '.agentx\agentx-cli.ps1'

function Assert-True($condition, [string]$message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function Assert-Equal($actual, $expected, [string]$message) {
    Assert-True ($actual -eq $expected) "$message (expected: '$expected', actual: '$actual')"
}

function Assert-Match($text, [string]$pattern, [string]$message) {
    Assert-True ($text -match $pattern) "$message (pattern: '$pattern' not found)"
}

function New-IsolatedWorkspace {
    $workspaceRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-loop-parity-{0}" -f [guid]::NewGuid())
    New-Item -ItemType Directory -Path (Join-Path $workspaceRoot '.agentx\state') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $workspaceRoot 'docs\execution') -Force | Out-Null
    return $workspaceRoot
}

function Invoke-IsolatedAgentx {
    param(
        [string]$WorkspaceRoot,
        [string[]]$Arguments
    )

    $pwshPath = (Get-Command pwsh -ErrorAction Stop).Source
    $processStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processStartInfo.FileName = $pwshPath
    $processStartInfo.WorkingDirectory = $WorkspaceRoot
    $processStartInfo.RedirectStandardOutput = $true
    $processStartInfo.RedirectStandardError = $true
    $processStartInfo.UseShellExecute = $false
    $processStartInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $WorkspaceRoot
    $processStartInfo.ArgumentList.Add('-NoProfile')
    $processStartInfo.ArgumentList.Add('-File')
    $processStartInfo.ArgumentList.Add($script:agentxCliPath)
    foreach ($argument in $Arguments) {
        $processStartInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::Start($processStartInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [PSCustomObject]@{
        ExitCode = $process.ExitCode
        Stdout   = $stdout
        Stderr   = $stderr
        Output   = ($stdout + $stderr)
    }
}

function New-EvidenceFile {
    param(
        [string]$WorkspaceRoot,
        [string]$Name,
        [string]$Content = 'evidence'
    )

    $evidenceDir = Join-Path $WorkspaceRoot '.agentx\state\parity-evidence'
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
    $evidencePath = Join-Path $evidenceDir $Name
    Set-Content -Path $evidencePath -Value $Content -Encoding utf8
    return $evidencePath
}

function Read-LoopState {
    param([string]$WorkspaceRoot)

    $statePath = Join-Path $WorkspaceRoot '.agentx\state\loop-state.json'
    return Get-Content -Path $statePath -Raw -Encoding utf8 | ConvertFrom-Json
}

function ConvertTo-NormalizedLoopStateJson {
    param($State)

    $history = @()
    foreach ($historyEntry in @($State.history)) {
        $normalizedEntry = [ordered]@{
            iteration = [int]$historyEntry.iteration
            summary = [string]$historyEntry.summary
            status = [string]$historyEntry.status
        }
        if ($historyEntry.PSObject.Properties.Name -contains 'outcome') {
            $normalizedEntry.outcome = [string]$historyEntry.outcome
        }
        if ($historyEntry.PSObject.Properties.Name -contains 'evidence') {
            $normalizedEntry.hasEvidence = [bool]$historyEntry.evidence
        }
        if ($historyEntry.PSObject.Properties.Name -contains 'evidenceOriginal') {
            $normalizedEntry.hasEvidenceOriginal = [bool]$historyEntry.evidenceOriginal
        }
        if ($historyEntry.PSObject.Properties.Name -contains 'passingTests') {
            $normalizedEntry.passingTests = [int]$historyEntry.passingTests
        }
        if ($historyEntry.PSObject.Properties.Name -contains 'review') {
            $normalizedEntry.reviewVerdict = [string]$historyEntry.review.verdict
            $normalizedEntry.reviewHigh = [int]$historyEntry.review.high
            $normalizedEntry.reviewMedium = [int]$historyEntry.review.medium
        }
        $history += [PSCustomObject]$normalizedEntry
    }

    $normalizedState = [ordered]@{
        active = [bool]$State.active
        status = [string]$State.status
        prompt = [string]$State.prompt
        role = [string]$State.role
        taskClass = [string]$State.taskClass
        reviewGate = if ($State.PSObject.Properties.Name -contains 'reviewGate') { [string]$State.reviewGate } else { $null }
        iteration = [int]$State.iteration
        minIterations = [int]$State.minIterations
        maxIterations = [int]$State.maxIterations
        completionCriteria = [string]$State.completionCriteria
        issueNumber = if ($null -eq $State.issueNumber) { $null } else { [int]$State.issueNumber }
        loopConsumed = if ($State.PSObject.Properties.Name -contains 'loopConsumed') { [bool]$State.loopConsumed } else { $null }
        history = $history
    }

    return ($normalizedState | ConvertTo-Json -Depth 10 -Compress)
}

function Start-ParityLoop {
    param(
        [string]$WorkspaceRoot,
        [string]$Prompt = 'Implementing parity happy path'
    )

    $startResult = Invoke-IsolatedAgentx -WorkspaceRoot $WorkspaceRoot -Arguments @(
        'loop', 'start', '-p', $Prompt, '-i', '401', '-r', 'engineer'
    )
    Assert-Equal $startResult.ExitCode 0 'loop start exits successfully'

    $baselineResult = Invoke-IsolatedAgentx -WorkspaceRoot $WorkspaceRoot -Arguments @(
        'loop', 'baseline', '-c', '10'
    )
    Assert-Equal $baselineResult.ExitCode 0 'loop baseline exits successfully'
}

Write-Host ''
Write-Host ' AgentX Loop Parity Behavior Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray
Write-Host ''

$happyWorkspace = New-IsolatedWorkspace
try {
    Write-Host ' 1. Golden happy path fixture' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $happyWorkspace

    $iterationSummaries = @(
        'Make it Work: parity fixture functional',
        'Make it Right: parity fixture normalized',
        'Make it Secure: parity fixture scanned',
        'Adversarial: parity fixture negative checks',
        'Subagent Review: parity reviewer approved'
    )

    for ($iterationIndex = 0; $iterationIndex -lt $iterationSummaries.Count; $iterationIndex++) {
        $iterationNumber = $iterationIndex + 1
        $evidencePath = New-EvidenceFile -WorkspaceRoot $happyWorkspace -Name "iter-$iterationNumber.txt" -Content "iteration $iterationNumber"
        $iterateArguments = @(
            'loop', 'iterate', '-s', $iterationSummaries[$iterationIndex], '-e', $evidencePath, '--passing', '10', '-o', 'pass'
        )
        if ($iterationNumber -eq $iterationSummaries.Count) {
            $iterateArguments += @('--verdict', 'approved', '--reviewer', 'parity-reviewer', '--high', '0', '--medium', '0')
        }
        $iterateResult = Invoke-IsolatedAgentx -WorkspaceRoot $happyWorkspace -Arguments $iterateArguments
        Assert-Equal $iterateResult.ExitCode 0 "loop iterate $iterationNumber exits successfully"
    }

    $finalEvidencePath = New-EvidenceFile -WorkspaceRoot $happyWorkspace -Name 'complete.txt' -Content 'complete'
    $completeResult = Invoke-IsolatedAgentx -WorkspaceRoot $happyWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Parity happy path complete', '-e', $finalEvidencePath, '--passing', '10'
    )
    Assert-Equal $completeResult.ExitCode 0 'loop complete exits successfully'

    $normalizedState = ConvertTo-NormalizedLoopStateJson (Read-LoopState $happyWorkspace)
    $expectedState = ([ordered]@{
        active = $false
        status = 'complete'
        prompt = 'Implementing parity happy path'
        role = 'engineer'
        taskClass = 'complex-delivery'
        reviewGate = 'structured'
        iteration = 5
        minIterations = 5
        maxIterations = 20
        completionCriteria = 'TASK_COMPLETE'
        issueNumber = 401
        loopConsumed = $false
        history = @(
            [ordered]@{ iteration = 0; summary = 'Loop started'; status = 'in-progress'; outcome = 'partial' }
            [ordered]@{ iteration = 1; summary = $iterationSummaries[0]; status = 'in-progress'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10 }
            [ordered]@{ iteration = 2; summary = $iterationSummaries[1]; status = 'in-progress'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10 }
            [ordered]@{ iteration = 3; summary = $iterationSummaries[2]; status = 'in-progress'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10 }
            [ordered]@{ iteration = 4; summary = $iterationSummaries[3]; status = 'in-progress'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10 }
            [ordered]@{ iteration = 5; summary = $iterationSummaries[4]; status = 'in-progress'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10; reviewVerdict = 'approved'; reviewHigh = 0; reviewMedium = 0 }
            [ordered]@{ iteration = 5; summary = 'Parity happy path complete'; status = 'complete'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10 }
        )
    } | ConvertTo-Json -Depth 10 -Compress)
    Assert-Equal $normalizedState $expectedState 'normalized happy path loop-state matches golden fixture'
} finally {
    Remove-Item -LiteralPath $happyWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$minimumWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 2. Minimum iteration gate fixture' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $minimumWorkspace -Prompt 'Implementing parity minimum gate'
    $finalEvidencePath = New-EvidenceFile -WorkspaceRoot $minimumWorkspace -Name 'too-early.txt' -Content 'too early'
    $completeResult = Invoke-IsolatedAgentx -WorkspaceRoot $minimumWorkspace -Arguments @(
        'loop', 'complete', '-s', 'too early', '-e', $finalEvidencePath, '--passing', '10'
    )
    Assert-Match $completeResult.Output 'Minimum review iterations not yet met' 'loop complete blocks before minimum iterations'
    Assert-True ($completeResult.ExitCode -ne 0) 'blocked loop complete exits non-zero for API callers'

    $missingEvidence = Invoke-IsolatedAgentx -WorkspaceRoot $minimumWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Missing evidence should fail', '--passing', '10'
    )
    Assert-Match $missingEvidence.Output 'requires --evidence' 'loop iterate explains the missing evidence requirement'
    Assert-True ($missingEvidence.ExitCode -ne 0) 'blocked loop iterate exits non-zero for API callers'
    $state = Read-LoopState $minimumWorkspace
    Assert-Equal ([string]$state.status) 'active' 'too-early complete keeps loop active'
    Assert-Equal ([int]$state.iteration) 0 'too-early complete keeps iteration counter unchanged'
} finally {
    Remove-Item -LiteralPath $minimumWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$reviewWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 3. Subagent review gate fixture' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $reviewWorkspace -Prompt 'Implementing parity review gate'
    foreach ($iterationNumber in 1..5) {
        $evidencePath = New-EvidenceFile -WorkspaceRoot $reviewWorkspace -Name "reviewless-$iterationNumber.txt" -Content "reviewless $iterationNumber"
        $iterateResult = Invoke-IsolatedAgentx -WorkspaceRoot $reviewWorkspace -Arguments @(
            'loop', 'iterate', '-s', "Iteration $iterationNumber without approval", '-e', $evidencePath, '--passing', '10', '-o', 'pass'
        )
        Assert-Equal $iterateResult.ExitCode 0 "reviewless loop iterate $iterationNumber exits successfully"
    }

    $finalEvidencePath = New-EvidenceFile -WorkspaceRoot $reviewWorkspace -Name 'reviewless-complete.txt' -Content 'reviewless complete'
    $completeResult = Invoke-IsolatedAgentx -WorkspaceRoot $reviewWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion attempt without approval', '-e', $finalEvidencePath, '--passing', '10'
    )
    Assert-Match $completeResult.Output 'subagent review iteration' 'loop complete blocks without subagent review iteration'
    Assert-True ($completeResult.ExitCode -ne 0) 'reviewless loop complete exits non-zero'
    $state = Read-LoopState $reviewWorkspace
    Assert-Equal ([string]$state.status) 'active' 'reviewless complete keeps loop active'
    Assert-Equal ([int]$state.iteration) 5 'reviewless complete preserves completed iteration count for rollback/fix'
} finally {
    Remove-Item -LiteralPath $reviewWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$healthWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 4. Stale and stuck health fixture' -ForegroundColor White
    $statePath = Join-Path $healthWorkspace '.agentx\state\loop-state.json'
    $oldState = [PSCustomObject]@{
        active=$true; status='active'
        prompt='health parity fixture'; role='engineer'; taskClass='complex-delivery'
        iteration=2; minIterations=5; maxIterations=20
        completionCriteria='TASK_COMPLETE'
        issueNumber=401; budgetMinutes=$null
        startedAt='2026-01-01T00:00:00Z'; lastIterationAt='2026-01-01T00:01:00Z'
        history=@()
    }
    $oldState | ConvertTo-Json -Depth 10 | Set-Content -Path $statePath -Encoding utf8

    $statusResult = Invoke-IsolatedAgentx -WorkspaceRoot $healthWorkspace -Arguments @('loop', 'status')
    Assert-Match $statusResult.Output 'Staleness:|Health: STUCK' 'loop status reports stale or stuck health fixture'

    $staleCompleted = $oldState.PSObject.Copy()
    $staleCompleted.active = $false
    $staleCompleted.status = 'complete'
    $staleCompleted.iteration = 5
    $staleCompleted.history = @([PSCustomObject]@{
        iteration = 5
        timestamp = '2026-01-01T00:01:00Z'
        summary = 'Subagent Review: approved'
        status = 'in-progress'
        outcome = 'pass'
        review = [PSCustomObject]@{ verdict = 'approved'; reviewer = 'stale-reviewer'; high = 0; medium = 0; low = 0 }
    })
    $staleCompleted | Add-Member -NotePropertyName loopConsumed -NotePropertyValue $false -Force
    $staleCompleted | ConvertTo-Json -Depth 10 | Set-Content -Path $statePath -Encoding utf8
    $staleGate = Invoke-IsolatedAgentx -WorkspaceRoot $healthWorkspace -Arguments @('loop', 'gate')
    Assert-True ($staleGate.ExitCode -ne 0) 'commit-time gate rejects stale completed loop state'
    Assert-Match $staleGate.Output 'quality loop is stale|quality loop is stuck' 'stale gate rejection reports loop health'

    $freshUtc = [datetime]::UtcNow.ToString('o', [cultureinfo]::InvariantCulture)
    $freshState = $oldState.PSObject.Copy()
    $freshState.startedAt = $freshUtc
    $freshState.lastIterationAt = $freshUtc
    $freshState | ConvertTo-Json -Depth 10 | Set-Content -Path $statePath -Encoding utf8
    $freshStatusResult = Invoke-IsolatedAgentx -WorkspaceRoot $healthWorkspace -Arguments @('loop', 'status')
    Assert-True ($freshStatusResult.Output -notmatch 'Staleness: loop last updated') 'fresh UTC timestamp is not reinterpreted as stale local time'

    $oldState | ConvertTo-Json -Depth 10 | Set-Content -Path $statePath -Encoding utf8

    $startResult = Invoke-IsolatedAgentx -WorkspaceRoot $healthWorkspace -Arguments @(
        'loop', 'start', '-p', 'Implementing parity fresh start', '-i', '999', '-r', 'engineer'
    )
    Assert-Match $startResult.Output 'Auto-reset prior loop' 'loop start auto-resets stale prior loop'
    $state = Read-LoopState $healthWorkspace
    Assert-Equal ([int]$state.issueNumber) 999 'fresh start writes requested issue number after auto-reset'
} finally {
    Remove-Item -LiteralPath $healthWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$verdictWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 5. Structured reviewer verdict fixture' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $verdictWorkspace -Prompt 'Implementing parity verdict gate'
    foreach ($iterationNumber in 1..4) {
        $evidencePath = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name "verdict-$iterationNumber.txt" -Content "verdict $iterationNumber"
        [void](Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
            'loop', 'iterate', '-s', "Iteration $iterationNumber", '-e', $evidencePath, '--passing', '10', '-o', 'pass'
        ))
    }

    $badVerdictEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-bad.txt' -Content 'bad verdict'
    $badVerdict = Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Reviewer pass', '-e', $badVerdictEvidence, '--passing', '10', '--verdict', 'looks-fine'
    )
    Assert-Match $badVerdict.Output "--verdict must be" 'loop iterate rejects an unknown verdict value'

    $negativeCountEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-negative.txt' -Content 'negative count'
    $negativeCount = Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Reviewer pass', '-e', $negativeCountEvidence, '--passing', '10', '--verdict', 'approved', '--high', '-2'
    )
    Assert-Match $negativeCount.Output '--high requires a non-negative integer' 'loop iterate rejects a negative finding count'

    $findingsEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-findings.txt' -Content 'open findings'
    $findingsIterate = Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review: findings raised', '-e', $findingsEvidence, '--passing', '10',
        '--verdict', 'changes-requested', '--reviewer', 'engineer-reviewer', '--high', '1', '--medium', '2'
    )
    Assert-Equal $findingsIterate.ExitCode 0 'loop iterate records a changes-requested review'

    $blockedEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-blocked.txt' -Content 'blocked complete'
    $blockedComplete = Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Attempt with open findings', '-e', $blockedEvidence, '--passing', '10'
    )
    Assert-Match $blockedComplete.Output 'Latest reviewer verdict is' 'loop complete blocks on a changes-requested verdict'
    Assert-Equal ([string](Read-LoopState $verdictWorkspace).status) 'active' 'blocked verdict keeps loop active'

    $reReviewEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-rereview.txt' -Content 're-review'
    [void](Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review: re-review', '-e', $reReviewEvidence, '--passing', '10',
        '--verdict', 'approved', '--reviewer', 'engineer-reviewer', '--high', '0', '--medium', '1'
    ))
    $mediumEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-medium.txt' -Content 'medium open'
    $mediumComplete = Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Attempt with a MEDIUM open', '-e', $mediumEvidence, '--passing', '10'
    )
    Assert-Match $mediumComplete.Output 'MEDIUM finding' 'loop complete blocks while a MEDIUM finding is open'

    $cleanEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-clean.txt' -Content 'clean review'
    [void](Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review: clean', '-e', $cleanEvidence, '--passing', '10',
        '--verdict', 'approved', '--reviewer', 'engineer-reviewer', '--high', '0', '--medium', '0', '--low', '3'
    ))
    $finalEvidence = New-EvidenceFile -WorkspaceRoot $verdictWorkspace -Name 'verdict-final.txt' -Content 'final'
    $finalComplete = Invoke-IsolatedAgentx -WorkspaceRoot $verdictWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Verdict gate complete', '-e', $finalEvidence, '--passing', '10'
    )
    Assert-Equal $finalComplete.ExitCode 0 'loop complete succeeds after an approved zero-HIGH zero-MEDIUM review'

    $verdictState = Read-LoopState $verdictWorkspace
    $recordedReviews = @(@($verdictState.history) | Where-Object { $_.PSObject.Properties.Name -contains 'review' })
    Assert-Equal $recordedReviews.Count 3 'each reviewer pass persists a structured review record'
    Assert-Equal ([string]$recordedReviews[-1].review.verdict) 'approved' 'final recorded verdict is approved'
    Assert-Equal ([int]$recordedReviews[-1].review.low) 3 'low finding count is preserved'
} finally {
    Remove-Item -LiteralPath $verdictWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$weakPhraseWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 6. Weak review phrasing fixture' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $weakPhraseWorkspace -Prompt 'Implementing parity weak phrasing gate'
    # "review" appearing as a noun is not a reviewer pass. The pre-hardening gate
    # accepted any summary containing the bare word.
    $weakSummaries = @(
        'Updated the review doc heading',
        'Renamed review.md for clarity',
        'Added a review section to the guide',
        'Linked the review template',
        'Polished review wording'
    )
    for ($weakIndex = 0; $weakIndex -lt $weakSummaries.Count; $weakIndex++) {
        $evidencePath = New-EvidenceFile -WorkspaceRoot $weakPhraseWorkspace -Name "weak-$($weakIndex + 1).txt" -Content "weak $($weakIndex + 1)"
        [void](Invoke-IsolatedAgentx -WorkspaceRoot $weakPhraseWorkspace -Arguments @(
            'loop', 'iterate', '-s', $weakSummaries[$weakIndex], '-e', $evidencePath, '--passing', '10', '-o', 'pass'
        ))
    }

    $weakEvidence = New-EvidenceFile -WorkspaceRoot $weakPhraseWorkspace -Name 'weak-complete.txt' -Content 'weak complete'
    $weakComplete = Invoke-IsolatedAgentx -WorkspaceRoot $weakPhraseWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Attempt on weak phrasing', '-e', $weakEvidence, '--passing', '10'
    )
    Assert-Match $weakComplete.Output 'subagent review iteration' 'bare mentions of the word review no longer satisfy the gate'

    # The free-text contract is gone: stripping the marker AND every review record
    # leaves nothing to downgrade to. This is the exact shape that defeated the
    # earlier marker-based design.
    $legacyStatePath = Join-Path $weakPhraseWorkspace '.agentx\state\loop-state.json'
    $legacyState = Get-Content -LiteralPath $legacyStatePath -Raw | ConvertFrom-Json
    $legacyState.PSObject.Properties.Remove('reviewGate')
    $legacyState.history = @($legacyState.history) + @([PSCustomObject]@{
        iteration = 5
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        summary   = 'Iteration 5 review of the diff'
        status    = 'in-progress'
        outcome   = 'pass'
    })
    $legacyState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $legacyStatePath -Encoding utf8

    $legacyComplete = Invoke-IsolatedAgentx -WorkspaceRoot $weakPhraseWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Legacy phrasing complete', '-e', (New-EvidenceFile -WorkspaceRoot $weakPhraseWorkspace -Name 'legacy-complete.txt' -Content 'legacy complete'), '--passing', '10'
    )
    Assert-Match $legacyComplete.Output 'subagent review iteration' 'removing the reviewGate marker does not restore a free-text contract'

    # A review record must live inside a history entry; a top-level property with
    # the same shape reviews nothing.
    $topLevelState = Get-Content -LiteralPath $legacyStatePath -Raw | ConvertFrom-Json
    $topLevelState | Add-Member -NotePropertyName review -NotePropertyValue ([PSCustomObject]@{
        verdict = 'approved'; reviewer = 'attacker'; high = 0; medium = 0; low = 0
    }) -Force
    $topLevelState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $legacyStatePath -Encoding utf8
    $topLevelComplete = Invoke-IsolatedAgentx -WorkspaceRoot $weakPhraseWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion on a top-level review', '-e', (New-EvidenceFile -WorkspaceRoot $weakPhraseWorkspace -Name 'toplevel-complete.txt' -Content 'toplevel complete'), '--passing', '10'
    )
    Assert-Match $topLevelComplete.Output 'subagent review iteration' 'a review record outside history does not satisfy the gate'
} finally {
    Remove-Item -LiteralPath $weakPhraseWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$structuredGateWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 7. Structured gate is mandatory for new loops' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $structuredGateWorkspace -Prompt 'Implementing parity structured gate'
    $gateState = Read-LoopState $structuredGateWorkspace
    Assert-Equal ([string]$gateState.reviewGate) 'structured' 'loop start stamps the structured review gate'

    # The exact string that satisfied the pre-hardening gate must no longer work.
    foreach ($iterationNumber in 1..5) {
        $evidencePath = New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name "claimed-$iterationNumber.txt" -Content "claimed $iterationNumber"
        [void](Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
            'loop', 'iterate', '-s', 'Subagent Review: no findings', '-e', $evidencePath, '--passing', '10', '-o', 'pass'
        ))
    }
    $claimedComplete = Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion on a claimed review', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'claimed-complete.txt' -Content 'claimed complete'), '--passing', '10'
    )
    Assert-Match $claimedComplete.Output 'subagent review iteration' 'a claimed review summary cannot satisfy a structured-gate loop'

    $missingCounts = Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'missing-counts.txt' -Content 'missing counts'), '--passing', '10', '--verdict', 'approved'
    )
    Assert-Match $missingCounts.Output '--high is required with --verdict' 'verdict without explicit finding counts is rejected'

    $missingReviewer = Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'missing-reviewer.txt' -Content 'missing reviewer'), '--passing', '10', '--verdict', 'approved', '--high', '0', '--medium', '0'
    )
    Assert-Match $missingReviewer.Output '--reviewer <id> is required' 'an anonymous verdict is rejected so the review stays attributable'

    # Zero is the value a clean review must record, so it must never be mistaken
    # for an omitted flag -- including when a launcher coerces it to a number.
    $zeroCounts = Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review: zero findings', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'zero-counts.txt' -Content 'zero counts'), '--passing', '10', '--verdict', 'approved', '--reviewer', 'zero-reviewer', '--high', 0, '--medium', 0
    )
    Assert-True ($zeroCounts.Output -notmatch '--high is required with --verdict') 'a numeric zero count is treated as supplied, not omitted'

    $emptyVerdict = Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'empty-verdict.txt' -Content 'empty verdict'), '--passing', '10', '--high', '0', '--medium', '0', '--verdict'
    )
    Assert-Match $emptyVerdict.Output '--verdict requires a value' 'a trailing --verdict with no value is rejected rather than silently dropped'

    [void](Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review: approved', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'approve.txt' -Content 'approve'), '--passing', '10', '--verdict', 'approved', '--reviewer', 'gate-reviewer', '--high', '0', '--medium', '0'
    ))
    # Stripping the gate marker must not downgrade a loop that already carries a
    # structured record: the state file is workspace-writable.
    $tamperPath = Join-Path $structuredGateWorkspace '.agentx\state\loop-state.json'
    $tamperState = Get-Content -LiteralPath $tamperPath -Raw | ConvertFrom-Json
    $tamperState.PSObject.Properties.Remove('reviewGate')
    $tamperState.history = @($tamperState.history) + @([PSCustomObject]@{
        iteration = ([int]$tamperState.iteration + 1)
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        summary   = 'Iteration review of the diff'
        status    = 'in-progress'
        outcome   = 'pass'
    })
    $tamperState.iteration = [int]$tamperState.iteration + 1
    $tamperState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tamperPath -Encoding utf8
    $tamperComplete = Invoke-IsolatedAgentx -WorkspaceRoot $structuredGateWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion after removing the gate marker', '-e', (New-EvidenceFile -WorkspaceRoot $structuredGateWorkspace -Name 'tamper-complete.txt' -Content 'tamper complete'), '--passing', '10'
    )
    Assert-Match $tamperComplete.Output 'Work was recorded after the approved review' 'removing reviewGate does not downgrade a loop that already recorded a verdict'
    Assert-True ($tamperComplete.ExitCode -ne 0 -or $tamperComplete.Output -match 'Work was recorded') 'an approval followed by further iterations is invalidated'
} finally {
    Remove-Item -LiteralPath $structuredGateWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$lowMaxWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 8. Maximum iterations cannot lower the mandatory floor' -ForegroundColor White
    $lowMaxStart = Invoke-IsolatedAgentx -WorkspaceRoot $lowMaxWorkspace -Arguments @(
        'loop', 'start', '-p', 'Attempt a one-iteration loop', '--max', '1'
    )
    Assert-True ($lowMaxStart.ExitCode -ne 0) 'loop start rejects --max below the mandatory five-iteration floor'
    Assert-Match $lowMaxStart.Output '--max must be at least 5' 'low --max rejection explains the five-iteration requirement'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $lowMaxWorkspace '.agentx\state\loop-state.json'))) 'rejected low-max loop writes no state file'

    $badBudget = Invoke-IsolatedAgentx -WorkspaceRoot $lowMaxWorkspace -Arguments @(
        'loop', 'start', '-p', 'Attempt invalid budget', '--budget', 'zero'
    )
    Assert-True ($badBudget.ExitCode -ne 0) 'invalid loop start budget exits non-zero'
    Assert-Match $badBudget.Output '--budget must be a positive integer' 'invalid budget rejection is actionable'
} finally {
    Remove-Item -LiteralPath $lowMaxWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$rollbackBypassWorkspace = New-IsolatedWorkspace
try {
    Write-Host ''
    Write-Host ' 9. Rollback cannot launder a stale approval' -ForegroundColor White
    Start-ParityLoop -WorkspaceRoot $rollbackBypassWorkspace -Prompt 'Implementing rollback bypass check'
    foreach ($iterationNumber in 1..4) {
        [void](Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
            'loop', 'iterate', '-s', "Progress $iterationNumber", '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name "rb-$iterationNumber.txt" -Content "rb $iterationNumber"), '--passing', '10', '-o', 'pass'
        ))
    }
    [void](Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Subagent Review: approved', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'rb-review.txt' -Content 'rb review'), '--passing', '10', '--verdict', 'approved', '--reviewer', 'rb-reviewer', '--high', '0', '--medium', '0'
    ))
    # Rollback deliberately re-uses iteration numbers, so an approval bound to the
    # NUMBER could be replayed against different work. Binding is by position.
    [void](Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Unreviewed follow-up work', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'rb-extra.txt' -Content 'rb extra'), '--passing', '10', '-o', 'pass'
    ))
    [void](Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'rollback', '-n', '5', '-r', 'Replaying the approval'
    ))
    [void](Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Different unreviewed work at the same iteration number', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'rb-replay.txt' -Content 'rb replay'), '--passing', '10', '-o', 'pass'
    ))
    $replay = Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion on a replayed approval', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'rb-complete.txt' -Content 'rb complete'), '--passing', '10'
    )
    Assert-Match $replay.Output 'Work was recorded after the approved review' 'rollback cannot replay a stale approval onto different work'

    # The CLI writer cannot emit a counts-present/reviewer-absent record, so the
    # completion-side guard is reachable only from externally written state.
    $anonPath = Join-Path $rollbackBypassWorkspace '.agentx\state\loop-state.json'
    $anonState = Get-Content -LiteralPath $anonPath -Raw | ConvertFrom-Json
    $anonState.history = @([PSCustomObject]@{
        iteration = 5
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        summary   = 'Subagent Review: approved'
        status    = 'iterated'
        outcome   = 'pass'
        review    = [PSCustomObject]@{ verdict = 'approved'; high = 0; medium = 0; low = 0 }
    })
    $anonState.iteration = 5
    $anonState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $anonPath -Encoding utf8
    $anonComplete = Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion on an unattributed approval', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'anon-complete.txt' -Content 'anon complete'), '--passing', '10'
    )
    Assert-Match $anonComplete.Output 'reviewer id' 'an approval with no reviewer id cannot complete the loop'

    # Counts must be real non-negative integers. A null would coerce to 0 and read
    # as a clean review the reviewer never asserted.
    $nullState = Get-Content -LiteralPath $anonPath -Raw | ConvertFrom-Json
    $nullState.history = @([PSCustomObject]@{
        iteration = 5
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        summary   = 'Subagent Review: approved'
        status    = 'iterated'
        outcome   = 'pass'
        review    = [PSCustomObject]@{ verdict = 'approved'; reviewer = 'null-reviewer'; high = $null; medium = $null; low = 0 }
    })
    $nullState.iteration = 5
    $nullState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $anonPath -Encoding utf8
    $nullComplete = Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'complete', '-s', 'Completion on null counts', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'null-complete.txt' -Content 'null complete'), '--passing', '10'
    )
    Assert-Match $nullComplete.Output 'missing HIGH/MEDIUM counts' 'null finding counts fail closed instead of coercing to zero'

    $currentTimestamp = (Get-Date).ToUniversalTime().ToString('o')
    $consumedState = [PSCustomObject]@{
        active = $false
        status = 'complete'
        loopConsumed = $true
        prompt = 'Consumed loop fixture'
        iteration = 5
        minIterations = 5
        maxIterations = 20
        completionCriteria = 'TASK_COMPLETE'
        startedAt = $currentTimestamp
        lastIterationAt = $currentTimestamp
        history = @([PSCustomObject]@{
            iteration = 5
            timestamp = $currentTimestamp
            summary = 'Subagent Review: approved'
            status = 'in-progress'
            outcome = 'pass'
            review = [PSCustomObject]@{ verdict = 'approved'; reviewer = 'consumed-reviewer'; high = 0; medium = 0; low = 0 }
        })
    }
    $consumedState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $anonPath -Encoding utf8
    $consumedHistoryCount = @($consumedState.history).Count
    $consumedIterate = Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @(
        'loop', 'iterate', '-s', 'Attempt to reuse consumed loop', '-e', (New-EvidenceFile -WorkspaceRoot $rollbackBypassWorkspace -Name 'consumed-iterate.txt' -Content 'consumed iterate'), '--passing', '10'
    )
    $afterConsumedAttempt = Get-Content -LiteralPath $anonPath -Raw | ConvertFrom-Json
    Assert-True ($consumedIterate.ExitCode -ne 0) 'consumed completed loop cannot be reactivated by loop iterate'
    Assert-Match $consumedIterate.Output 'consumed by a prior commit' 'consumed-loop rejection requires a fresh loop'
    Assert-Equal @($afterConsumedAttempt.history).Count $consumedHistoryCount 'rejected consumed-loop iterate does not append history'

    $consumedState.loopConsumed = $false
    $consumedState.history = @($consumedState.history) + @([PSCustomObject]@{
        iteration = 5
        timestamp = $currentTimestamp
        summary = 'Forged completion marker'
        status = 'complete'
        outcome = 'pass'
        kind = 'COMPLETION'
    })
    $consumedState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $anonPath -Encoding utf8
    $forgedCompletion = Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @('loop', 'gate')
    Assert-True ($forgedCompletion.ExitCode -ne 0) 'mixed-case completion marker does not bypass final-work binding'
    Assert-Match $forgedCompletion.Output 'work was recorded after the approved review' 'completion marker comparison is case-sensitive'

    $consumedState.history = @($consumedState.history | Select-Object -First 1)
    $consumedState.status = 'COMPLETE'
    $consumedState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $anonPath -Encoding utf8
    $forgedStatus = Invoke-IsolatedAgentx -WorkspaceRoot $rollbackBypassWorkspace -Arguments @('loop', 'gate')
    Assert-True ($forgedStatus.ExitCode -ne 0) 'mixed-case loop status fails closed'
    Assert-Match $forgedStatus.Output "status is 'COMPLETE', not 'complete'" 'PowerShell status comparison matches TypeScript casing'
} finally {
    Remove-Item -LiteralPath $rollbackBypassWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host ' ------------------------------------------------' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
Write-Host ''
if ($script:fail -gt 0) { exit 1 }