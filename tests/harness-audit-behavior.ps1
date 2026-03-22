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
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root '.agentx\agentx.ps1'))
    foreach ($argument in $arguments) {
        $startInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function Set-WorkspaceHarnessState([string]$root) {
    $timestamp = (Get-Date).ToUniversalTime().ToString('o')
    @{
        active = $false
        status = 'complete'
        prompt = 'Audit harness state'
        iteration = 5
        maxIterations = 10
        completionCriteria = 'TASK_COMPLETE'
        startedAt = $timestamp
        lastIterationAt = $timestamp
        history = @()
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

$workspace = New-TestWorkspace 'profiles'
try {
    Set-WorkspaceHarnessState $workspace

    $balanced = Invoke-AgentX $workspace @('audit', 'harness', '--json')
    $balancedJson = $balanced.Output | ConvertFrom-Json -Depth 20
    Assert-True ($balanced.ExitCode -eq 0) 'Balanced harness audit passes when only advisory planning checks fail'
    Assert-True ($balancedJson.profile -eq 'balanced') 'Balanced harness audit reports the default profile'
    Assert-True ($balancedJson.failedRequiredChecks.Count -eq 0) 'Balanced harness audit has no failed required checks'
    Assert-True (($balancedJson.checks | Where-Object { $_.id -eq 'execution-plan-present' }).Count -eq 1) 'Balanced harness audit still reports advisory planning checks'

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
} finally {
    Remove-TestWorkspace $workspace
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Yellow' })
if ($script:fail -gt 0) {
    exit 1
}