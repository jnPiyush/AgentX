param(
    [string]$DatasetPath = "evaluation/datasets/regression.jsonl",
    [string]$ClassifierPath = "scripts/classify-issue.js",
    [string]$ManifestPath = "evaluation/agentx.eval.yaml"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-IssueTypePrediction {
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][string]$Path
    )

    $raw = & node $Path --title $Text 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Issue classifier failed with exit code $LASTEXITCODE`: $($raw -join ' ')"
    }
    $result = ($raw -join "`n") | ConvertFrom-Json
    if (-not $result.type) {
        throw "Issue classifier returned no type for input: $Text"
    }
    return [string]$result.type
}

function Get-BlockingThresholds {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Evaluation manifest not found: $Path"
    }

    $thresholds = @{}
    $currentMetric = $null
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*-\s+metric:\s*([^\s#]+)') {
            $currentMetric = $Matches[1]
            continue
        }
        if ($currentMetric -and $line -match '^\s+blocking:\s*([0-9]+(?:\.[0-9]+)?)') {
            $thresholds[$currentMetric] = [double]::Parse(
                $Matches[1],
                [cultureinfo]::InvariantCulture)
            $currentMetric = $null
        }
    }

    if ($thresholds.Count -eq 0) {
        throw "Evaluation manifest declares no blocking thresholds: $Path"
    }
    return $thresholds
}

if (-not (Test-Path -LiteralPath $DatasetPath)) {
    throw "Dataset file not found: $DatasetPath"
}

if (-not (Test-Path -LiteralPath $ClassifierPath)) {
    throw "Issue classifier not found: $ClassifierPath"
}

$blockingThresholds = Get-BlockingThresholds -Path $ManifestPath

$datasetRows = @()
Get-Content -LiteralPath $DatasetPath |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ } |
    ForEach-Object {
        $datasetRows += ($_ | ConvertFrom-Json)
    }

$failureSlices = @()
$correctCount = 0

foreach ($row in $datasetRows) {
    $predicted = Get-IssueTypePrediction -Text ([string]$row.input) -Path $ClassifierPath
    $expected = [string]$row.expected

    if ($predicted -eq $expected) {
        $correctCount += 1
    } else {
        $failureSlices += [pscustomobject]@{
            label = [string]$row.id
            severity = 'medium'
            summary = "Predicted $predicted but expected $expected."
            dataset = 'regression'
        }
    }
}

$score = if ($datasetRows.Count -gt 0) {
    [Math]::Round(($correctCount / $datasetRows.Count), 2)
} else {
    0.0
}

$reviewerNote = if ($failureSlices.Count -gt 0) {
    'The issue classification baseline has mismatches. Review the failing rows or update the prompt and heuristic logic together.'
} else {
    'The issue classification baseline matched every regression row.'
}

$metrics = @(
    [pscustomobject]@{ metric = 'correctness'; score = $score },
    [pscustomobject]@{ metric = 'task-completion'; score = $score }
)
$thresholdViolations = @()
foreach ($metric in $metrics) {
    if ($blockingThresholds.ContainsKey($metric.metric) -and $metric.score -lt $blockingThresholds[$metric.metric]) {
        $thresholdViolations += [pscustomobject]@{
            metric = $metric.metric
            score = $metric.score
            blocking = $blockingThresholds[$metric.metric]
        }
    }
}

$gateStatus = if ($thresholdViolations.Count -gt 0) { 'fail' } else { 'pass' }

$output = [pscustomobject]@{
    runId = "sample-$(Get-Date -Format 'yyyyMMddHHmmss')"
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    models = @('agentx-production-issue-classifier')
    datasetCount = $datasetRows.Count
    gateStatus = $gateStatus
    aggregateMetrics = $metrics
    thresholdViolations = @($thresholdViolations)
    failureSlices = @($failureSlices)
    reviewerNote = $reviewerNote
}

$output | ConvertTo-Json -Depth 6
exit $(if ($gateStatus -eq 'pass') { 0 } else { 1 })