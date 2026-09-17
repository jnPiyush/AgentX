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
$manifest = Join-Path $repoRoot 'evaluation/frontier.eval.yaml'
$baseline = Join-Path $repoRoot 'evaluation/baseline.json'
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

function Invoke-Eval([string]$DatasetPath, [string]$ClassifierPath, [string]$ManifestPath = $manifest, [string]$BaselinePath = $baseline) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new((Get-Command pwsh -ErrorAction Stop).Source)
    $startInfo.WorkingDirectory = $repoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in @('-NoProfile', '-File', $runner, '-DatasetPath', $DatasetPath,
        '-ClassifierPath', $ClassifierPath, '-ManifestPath', $ManifestPath, '-BaselinePath', $BaselinePath)) {
        $startInfo.ArgumentList.Add($argument)
    }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(60000)) {
            $process.Kill($true)
            throw 'Offline evaluator timed out.'
        }
        $text = $stdout.GetAwaiter().GetResult()
        if ([string]::IsNullOrWhiteSpace($text)) { throw "Evaluator returned no JSON: $($stderr.GetAwaiter().GetResult())" }
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Text = $text
            Json = ($text | ConvertFrom-Json)
        }
    } finally {
        $process.Dispose()
    }
}

try {
    Write-Host 'Frontier AI Evaluation Gate Behavior Tests'

    $githubOutput = & node $classifier --title '[feature] Add a review sidebar' --github-output
    Assert-True ($LASTEXITCODE -eq 0) 'production classifier CLI exits successfully'
    Assert-True (($githubOutput -join "`n") -match 'type=type:feature') 'production GitHub output contains the classified type'

    $clean = Invoke-Eval -DatasetPath $dataset -ClassifierPath $classifier
    $correctness = @($clean.Json.aggregateMetrics | Where-Object metric -eq 'correctness')[0]
    Assert-True ($clean.ExitCode -eq 0) 'default regression dataset satisfies blocking thresholds'
    Assert-True ($correctness.score -ge 0.8) 'default correctness is at least 0.80'
    Assert-True ($clean.Json.gateStatus -eq 'pass') 'default report status is pass'
    Assert-True ($clean.Json.scope -eq 'issue-classification-only') 'report explicitly bounds classification scope'
    Assert-True (@($clean.Json.aggregateMetrics).Count -eq 1) 'classification score is not duplicated as task completion'

    $regressedDataset = Join-Path $tempRoot 'regressed.jsonl'
    @(1..10 | ForEach-Object {
        $expected = if ($_ -eq 10) { 'type:feature' } else { 'type:bug' }
        @{ id = "regression-$_"; input = '[bug] Fix a crash'; expected = $expected } | ConvertTo-Json -Compress
    }) | Set-Content -LiteralPath $regressedDataset -Encoding utf8
    $regressed = Invoke-Eval -DatasetPath $regressedDataset -ClassifierPath $classifier
    Assert-True ($regressed.ExitCode -ne 0) 'regression below accepted baseline fails even above blocking threshold'
    Assert-True ($regressed.Json.gateStatus -eq 'fail') 'baseline regression report status is fail'
    Assert-True (@($regressed.Json.thresholdViolations).Count -eq 0) 'baseline-only regression is above configured blocking threshold'
    Assert-True (@($regressed.Json.baselineRegressions).Count -eq 1) 'accepted baseline regression is reported distinctly'

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

    foreach ($content in @('', '{"id":"empty"}', '{"id":"a","input":"bug","expected":12}', '{invalid', '[]')) {
        $invalidDataset = Join-Path $tempRoot 'invalid.jsonl'
        Set-Content -LiteralPath $invalidDataset -Value $content
        $invalid = Invoke-Eval -DatasetPath $invalidDataset -ClassifierPath $classifier
        Assert-True ($invalid.ExitCode -eq 2 -and $invalid.Json.gateStatus -eq 'error') "invalid dataset is an error: $content"
    }
    foreach ($content in @('{}', '{invalid', '{"version":2}', ((Get-Content $baseline -Raw) -replace 'agentx-production-issue-classifier', 'stale-classifier'), ((Get-Content $baseline -Raw) -replace '"correctness": 1', '"correctness": 1.5'))) {
        $invalidBaseline = Join-Path $tempRoot 'invalid-baseline.json'
        Set-Content -LiteralPath $invalidBaseline -Value $content
        $invalid = Invoke-Eval -DatasetPath $dataset -ClassifierPath $classifier -BaselinePath $invalidBaseline
        Assert-True ($invalid.ExitCode -eq 2 -and $invalid.Json.gateStatus -eq 'error') 'invalid or incompatible baseline is an error'
    }
    $missingBaseline = Invoke-Eval -DatasetPath $dataset -ClassifierPath $classifier -BaselinePath (Join-Path $tempRoot 'absent.json')
    Assert-True ($missingBaseline.ExitCode -eq 2) 'missing baseline cannot bypass the gate'
    foreach ($content in @('version: [', ((Get-Content $manifest -Raw) -replace 'blocking: 0.8', 'blocking: -0.1'), ((Get-Content $manifest -Raw) -replace 'blocking: 0.8', 'blocking: 1.1'), ((Get-Content $manifest -Raw) -replace 'blocking: 0.8', 'blocking: "0.8"'), ((Get-Content $manifest -Raw) -replace 'metric: correctness', 'metric: unknown'), ((Get-Content $manifest -Raw) -replace 'warning: 0.9', 'warning: 0.7'))) {
        $invalidManifest = Join-Path $tempRoot 'invalid.yaml'
        Set-Content -LiteralPath $invalidManifest -Value $content
        $invalid = Invoke-Eval -DatasetPath $dataset -ClassifierPath $classifier -ManifestPath $invalidManifest
        Assert-True ($invalid.ExitCode -eq 2 -and $invalid.Json.gateStatus -eq 'error') 'invalid threshold configuration fails closed'
    }
    foreach ($content in @('process.exit(3);', 'process.stdout.write("not-json");', 'process.stdout.write("{}");', 'process.stdout.write(JSON.stringify({type:12}));', 'process.stdout.write(JSON.stringify({type:["type:bug"]}));')) {
        Set-Content -LiteralPath $badClassifier -Value $content
        $invalid = Invoke-Eval -DatasetPath $dataset -ClassifierPath $badClassifier
        Assert-True ($invalid.ExitCode -eq 2 -and $invalid.Json.gateStatus -eq 'error') 'classifier execution and output errors are not quality scores'
    }
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
