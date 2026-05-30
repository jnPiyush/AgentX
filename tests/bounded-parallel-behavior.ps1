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
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-bounded-parallel-test-{0}-{1}" -f $name, [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root 'docs\execution\plans') -Force | Out-Null
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx.ps1') (Join-Path $root '.agentx\agentx.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') (Join-Path $root '.agentx\agentx-cli.ps1') -Force
    '{"provider":"local","integration":"local","mode":"local","nextIssueNumber":1}' | Set-Content (Join-Path $root '.agentx\config.json') -Encoding utf8
    '# Demo plan' | Set-Content (Join-Path $root 'docs\execution\plans\PARALLEL.md') -Encoding utf8
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
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $root

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function New-UnitsBase64([object[]]$units) {
    return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(($units | ConvertTo-Json -Depth 6 -Compress)))
}

function Test-EligibilityGate {
    $root = New-TestWorkspace 'eligibility'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Parent issue', '--labels', 'type:story')
        $assess = Invoke-AgentX $root @('parallel', 'assess', '--issue', '1', '--scope-independence', 'coupled', '--dependency-coupling', 'high', '--artifact-overlap', 'high', '--review-complexity', 'high', '--recovery-complexity', 'high', '--json')
        $run = $assess.Output | ConvertFrom-Json
        Assert-True ($assess.ExitCode -eq 0) 'parallel assess records an ineligible assessment'
        Assert-True ($run.assessment.decision -eq 'ineligible') 'parallel assess fails closed on ineligible characteristics'

        $units = New-UnitsBase64 @(@{ title = 'Unit A'; scope_boundary = 'shared'; owner = 'engineer'; recovery_guidance = 'retry sequentially' })
        $start = Invoke-AgentX $root @('parallel', 'start', '--id', $run.parallel_id, '--units-base64', $units)
        Assert-True ($start.ExitCode -ne 0) 'parallel start refuses ineligible runs'
        Assert-True ($start.Output -match 'must remain sequential') 'parallel start explains the sequential fallback'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-ParentSummaryAndReconciliation {
    $root = New-TestWorkspace 'summary'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Parent issue', '--labels', 'type:story')
        $assess = Invoke-AgentX $root @('parallel', 'assess', '--issue', '1', '--scope-independence', 'independent', '--dependency-coupling', 'low', '--artifact-overlap', 'low', '--review-complexity', 'bounded', '--recovery-complexity', 'recoverable', '--json')
        $run = $assess.Output | ConvertFrom-Json

        $units = New-UnitsBase64 @(
            @{ title = 'Unit A'; scope_boundary = 'docs only'; owner = 'engineer'; recovery_guidance = 'retry sequentially'; merge_readiness = 'Ready For Reconciliation' },
            @{ title = 'Unit B'; scope_boundary = 'tests only'; owner = 'engineer'; recovery_guidance = 'retry sequentially'; merge_readiness = 'Do Not Merge'; summary_signal = 'blocked' }
        )
        $start = Invoke-AgentX $root @('parallel', 'start', '--id', $run.parallel_id, '--units-base64', $units, '--json')
        if ($start.ExitCode -ne 0) {
            Write-Host $start.Output
        }
        Assert-True ($start.ExitCode -eq 0) 'parallel start succeeds for eligible runs'
        if ($start.ExitCode -ne 0) { return }
        $started = $start.Output | ConvertFrom-Json
        Assert-True ($started.parent_summary.summary_state -eq 'blocked') 'parent summary reflects blocked unit signals'
        Assert-True ($started.parent_summary.closeout_ready -eq $false) 'closeout is blocked until reconciliation prerequisites pass'

        $reconcile = Invoke-AgentX $root @('parallel', 'reconcile', '--id', $run.parallel_id, '--overlap-review', 'pass', '--conflict-review', 'pass', '--acceptance-evidence', 'pass', '--owner-approval', 'approved', '--json')
        $reconciled = $reconcile.Output | ConvertFrom-Json
        Assert-True ($reconcile.ExitCode -eq 0) 'parallel reconcile runs even when units are not all ready'
        Assert-True ($reconciled.reconciliation.final_decision -eq 'blocked') 'reconciliation stays blocked when merge readiness is incomplete'
    } finally {
        Remove-TestWorkspace $root
    }
}

function Test-FollowUpRouting {
    $root = New-TestWorkspace 'follow-up'
    try {
        $null = Invoke-AgentX $root @('issue', 'create', '--title', '[Story] Parent issue', '--labels', 'type:story')
        $assess = Invoke-AgentX $root @('parallel', 'assess', '--issue', '1', '--scope-independence', 'independent', '--dependency-coupling', 'low', '--artifact-overlap', 'low', '--review-complexity', 'bounded', '--recovery-complexity', 'recoverable', '--json')
        $run = $assess.Output | ConvertFrom-Json

        $units = New-UnitsBase64 @(
            @{ title = 'Unit A'; scope_boundary = 'docs only'; owner = 'engineer'; recovery_guidance = 'retry sequentially'; merge_readiness = 'Do Not Merge'; summary_signal = 'blocked' }
        )
        $null = Invoke-AgentX $root @('parallel', 'start', '--id', $run.parallel_id, '--units-base64', $units, '--json')

        $reconcile = Invoke-AgentX $root @('parallel', 'reconcile', '--id', $run.parallel_id, '--overlap-review', 'fail', '--conflict-review', 'pass', '--acceptance-evidence', 'pass', '--owner-approval', 'approved', '--follow-up-target', 'story', '--follow-up-title', 'Resolve overlap', '--follow-up-summary', 'Create durable follow-up for overlap', '--json')
        $reconciled = $reconcile.Output | ConvertFrom-Json
        Assert-True ($reconcile.ExitCode -eq 0) 'parallel reconcile can capture a blocked follow-up'
        Assert-True ($reconciled.reconciliation.follow_up_disposition -eq 'captured') 'blocked reconciliation stores follow-up disposition'
        Assert-True (@($reconciled.reconciliation.follow_up_references).Count -eq 1) 'blocked reconciliation stores a follow-up reference'
        Assert-True ($reconciled.reconciliation.follow_up_references[0] -eq '#2') 'blocked reconciliation routes into the normal issue backlog'
    } finally {
        Remove-TestWorkspace $root
    }
}

Test-EligibilityGate
Test-ParentSummaryAndReconciliation
Test-FollowUpRouting

if ($script:fail -gt 0) {
    Write-Host "`nBounded parallel behavior tests failed: $($script:fail) failed, $($script:pass) passed." -ForegroundColor Red
    exit 1
}

Write-Host "`nBounded parallel behavior tests passed: $($script:pass) checks." -ForegroundColor Green