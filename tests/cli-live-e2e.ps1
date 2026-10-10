#!/usr/bin/env pwsh

$ErrorActionPreference = 'Continue'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent
$script:cliPath = Join-Path $script:repoRoot '.frontier\runtime\frontier.ps1'

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function Invoke-CliCapture {
    param(
        [string[]]$Arguments
    )

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        & pwsh -NoProfile -File $script:cliPath @Arguments *> $tmp
        $exitCode = $LASTEXITCODE
        $output = Get-Content $tmp -Raw
        return @{ ExitCode = $exitCode; Output = $output }
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host ' Frontier CLI Live E2E Smoke Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

$help = Invoke-CliCapture -Arguments @('help')
Assert-True ($help.ExitCode -eq 0) 'agentx help exits successfully'
Assert-True ($help.Output -match 'run <agent> <prompt>') 'agentx help lists the run command'

$workflow = Invoke-CliCapture -Arguments @('workflow', 'engineer')
Assert-True ($workflow.ExitCode -eq 0) 'agentx workflow engineer exits successfully'
Assert-True ($workflow.Output -match 'Frontier Reviewer') 'agentx workflow engineer reports the reviewer handoff'

$ghAuth = & gh auth status 2>&1 | Out-String
$ghReady = ($LASTEXITCODE -eq 0)
Assert-True $ghReady 'GitHub CLI authentication is available for live runner validation'

if ($ghReady) {
    $loopStatePath = Join-Path $script:repoRoot '.frontier\state\loop-state.json'
    $loopStateBefore = if (Test-Path -LiteralPath $loopStatePath) { (Get-FileHash -LiteralPath $loopStatePath).Hash } else { '' }
    $run = Invoke-CliCapture -Arguments @('run', 'engineer', 'Attempt to edit .github/skills/ai-systems/ai-agent-development/scripts/scaffold-agent.py by appending PASS.', '--max', '6', '--no-loop-sync')
    $loopStateAfter = if (Test-Path -LiteralPath $loopStatePath) { (Get-FileHash -LiteralPath $loopStatePath).Hash } else { '' }
    Assert-True ($loopStateBefore -eq $loopStateAfter) 'agentx run --no-loop-sync leaves the developer quality loop untouched'
    Assert-True ($run.Output -match 'Starting agentic loop') 'agentx run reaches the live runner entrypoint'
    Assert-True ($run.Output -match 'Agent: Frontier Engineer\b') 'agentx run resolves the Engineer agent definition'
    Assert-True (-not ($run.Output -match 'Copilot API error \(HTTP 403\)')) 'agentx run does not surface a Copilot API 403 during the smoke prompt'
    Assert-True ($run.Output -match 'Provider: Copilot API|Provider: GitHub Models') 'agentx run reports the active provider used for the live run'
    Assert-True ($run.Output -match 'Model fallback chain:') 'agentx run prints the configured model fallback chain'
    Assert-True ($run.Output -match '\[SELF-REVIEW\]|Tool: ') 'agentx run progresses into the live agent loop after the initial model call succeeds'
    Assert-True (($run.ExitCode -eq 0) -or ($run.Output -match 'blocked|failed|cancel')) 'agentx run ends in either a clean success or a controlled blocked/failed state'
    if ($run.ExitCode -ne 0) {
        Write-Host " Live run exit $($run.ExitCode); last output lines:"
        Write-Host ((($run.Output -split "`r?`n") | Select-Object -Last 15) -join "`n")
    }
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Yellow' })
if ($script:fail -gt 0) {
    Write-Host " Failures: $($script:fail)" -ForegroundColor Red
}
Write-Host ''

exit $script:fail