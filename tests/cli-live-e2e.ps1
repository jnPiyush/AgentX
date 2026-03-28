#!/usr/bin/env pwsh

$ErrorActionPreference = 'Continue'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent
$script:cliPath = Join-Path $script:repoRoot '.agentx\agentx.ps1'

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
Write-Host ' AgentX CLI Live E2E Smoke Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

$help = Invoke-CliCapture -Arguments @('help')
Assert-True ($help.ExitCode -eq 0) 'agentx help exits successfully'
Assert-True ($help.Output -match 'run <agent> <prompt>') 'agentx help lists the run command'

$workflow = Invoke-CliCapture -Arguments @('workflow', 'engineer')
Assert-True ($workflow.ExitCode -eq 0) 'agentx workflow engineer exits successfully'
Assert-True ($workflow.Output -match 'AgentX Reviewer') 'agentx workflow engineer reports the reviewer handoff'

$ghAuth = & gh auth status 2>&1 | Out-String
$ghReady = ($LASTEXITCODE -eq 0)
Assert-True $ghReady 'GitHub CLI authentication is available for live runner validation'

if ($ghReady) {
    $run = Invoke-CliCapture -Arguments @('run', 'engineer', 'Attempt to edit .github/skills/ai-systems/ai-agent-development/scripts/scaffold-agent.py by appending PASS.', '--max', '6')
    Assert-True ($run.Output -match 'Starting agentic loop') 'agentx run reaches the live runner entrypoint'
    Assert-True ($run.Output -match 'Agent: AgentX Engineer') 'agentx run resolves the Engineer agent definition'
    Assert-True (-not ($run.Output -match 'Copilot API error \(HTTP 403\)')) 'agentx run does not surface a Copilot API 403 during the smoke prompt'
    Assert-True ($run.Output -match '\[API FALLBACK\]|GitHub Models') 'agentx run can recover from Copilot access issues by switching API mode when needed'
    Assert-True ($run.Output -match '\[SELF-REVIEW\]|Tool: ') 'agentx run progresses into the live agent loop after the initial model call succeeds'
    Assert-True ($run.ExitCode -ne 0) 'agentx run returns a non-zero exit code when the live run ends in a blocked or failed state'
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