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
        $history += [PSCustomObject]$normalizedEntry
    }

    $normalizedState = [ordered]@{
        active = [bool]$State.active
        status = [string]$State.status
        prompt = [string]$State.prompt
        role = [string]$State.role
        taskClass = [string]$State.taskClass
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
        $iterateResult = Invoke-IsolatedAgentx -WorkspaceRoot $happyWorkspace -Arguments @(
            'loop', 'iterate', '-s', $iterationSummaries[$iterationIndex], '-e', $evidencePath, '--passing', '10', '-o', 'pass'
        )
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
            [ordered]@{ iteration = 5; summary = $iterationSummaries[4]; status = 'in-progress'; outcome = 'pass'; hasEvidence = $true; hasEvidenceOriginal = $true; passingTests = 10 }
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

    $startResult = Invoke-IsolatedAgentx -WorkspaceRoot $healthWorkspace -Arguments @(
        'loop', 'start', '-p', 'Implementing parity fresh start', '-i', '999', '-r', 'engineer'
    )
    Assert-Match $startResult.Output 'Auto-reset prior loop' 'loop start auto-resets stale prior loop'
    $state = Read-LoopState $healthWorkspace
    Assert-Equal ([int]$state.issueNumber) 999 'fresh start writes requested issue number after auto-reset'
} finally {
    Remove-Item -LiteralPath $healthWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host ' ------------------------------------------------' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
Write-Host ''
if ($script:fail -gt 0) { exit 1 }