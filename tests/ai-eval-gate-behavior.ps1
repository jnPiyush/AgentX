#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Behavior tests for the repo-local AI evaluation gate.
#>

#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$runner = Join-Path $repoRoot 'scripts/run-ai-eval-sample.ps1'
$manifest = Join-Path $repoRoot 'evaluation/agentx.eval.yaml'
$dataset = Join-Path $repoRoot 'evaluation/datasets/regression.jsonl'
$classifier = Join-Path $repoRoot 'scripts/classify-issue.js'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "agentx-eval-gate-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

$passed = 0
$failed = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if ($Condition) {
        Write-Host "[PASS] $Label"
        $script:passed++
    } else {
        Write-Host "[FAIL] $Label"
        $script:failed++
    }
}

function Invoke-Eval([string]$DatasetPath, [string]$ClassifierPath) {
    $pwsh = (Get-Command pwsh -ErrorAction Stop).Source
    $output = & $pwsh -NoProfile -File $runner `
        -DatasetPath $DatasetPath `
        -ClassifierPath $ClassifierPath `
        -ManifestPath $manifest 2>&1
    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Text = ($output -join "`n")
        Json = (($output -join "`n") | ConvertFrom-Json)
    }
}

try {
    Write-Host 'AgentX AI Evaluation Gate Behavior Tests'

    $githubOutput = & node $classifier --title '[feature] Add a review sidebar' --github-output
    Assert-True ($LASTEXITCODE -eq 0) 'production classifier CLI exits successfully'
    Assert-True (($githubOutput -join "`n") -match 'type=type:feature') 'production GitHub output contains the classified type'

    $clean = Invoke-Eval -DatasetPath $dataset -ClassifierPath $classifier
    $correctness = @($clean.Json.aggregateMetrics | Where-Object metric -eq 'correctness')[0]
    Assert-True ($clean.ExitCode -eq 0) 'default regression dataset satisfies blocking thresholds'
    Assert-True ($correctness.score -ge 0.8) 'default correctness is at least 0.80'
    Assert-True ($clean.Json.gateStatus -eq 'pass') 'default report status is pass'

    $failingDataset = Join-Path $tempRoot 'failing.jsonl'
    @(
        '{"id":"forced-failure-1","input":"Fix a bug","expected":"type:powerbi","tags":["negative"]}',
        '{"id":"forced-failure-2","input":"Fix another bug","expected":"type:powerbi","tags":["negative"]}'
    ) | Set-Content -LiteralPath $failingDataset -Encoding utf8

    $failedRun = Invoke-Eval -DatasetPath $failingDataset -ClassifierPath $classifier
    Assert-True ($failedRun.ExitCode -ne 0) 'below-threshold evaluation exits nonzero'
    Assert-True ($failedRun.Json.gateStatus -eq 'fail') 'below-threshold report status is fail'
    Assert-True (@($failedRun.Json.thresholdViolations).Count -gt 0) 'below-threshold report lists violations'

    $badClassifier = Join-Path $tempRoot 'bad-classifier.js'
    'process.stdout.write(JSON.stringify({type:"type:story"}));' | Set-Content -LiteralPath $badClassifier -Encoding utf8
    $classifierRun = Invoke-Eval -DatasetPath $dataset -ClassifierPath $badClassifier
    Assert-True ($classifierRun.ExitCode -ne 0) 'broken production classifier exits nonzero'
    Assert-True ($classifierRun.Json.gateStatus -eq 'fail') 'broken production classifier reports fail'
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
