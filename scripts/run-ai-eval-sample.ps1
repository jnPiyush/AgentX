param(
    [string]$DatasetPath = "evaluation/datasets/regression.jsonl",
    [string]$ClassifierPath = "scripts/classify-issue.js",
    [string]$ManifestPath = "evaluation/frontier.eval.yaml",
    [string]$BaselinePath = "evaluation/baseline.json"
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
    $result = ($raw -join "`n") | ConvertFrom-Json -AsHashtable
    if ($result -isnot [System.Collections.IDictionary] -or $result.type -isnot [string] -or
        $result.type -cnotmatch '^type:[a-z][a-z-]*$') {
        throw "Issue classifier returned an invalid type for input: $Text"
    }
    return [string]$result.type
}

function Get-BlockingThresholds {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Evaluation manifest not found: $Path"
    }

    $parser = @'
const fs = require('node:fs');
const yaml = require(require.resolve('yaml', { paths: [process.argv[2]] }));
process.stdout.write(JSON.stringify(yaml.parse(fs.readFileSync(process.argv[1], 'utf8'))));
'@
    $raw = & node -e $parser $Path (Join-Path $PSScriptRoot '../vscode-extension') 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Evaluation manifest parsing failed (requires the repository yaml dependency): $($raw -join ' ')"
    }
    $manifest = ($raw -join "`n") | ConvertFrom-Json -AsHashtable
    if ($manifest -isnot [System.Collections.IDictionary] -or $manifest.version -ne 1 -or
        $manifest.runner.preferred -ne 'custom' -or
        $manifest.modelMatrix.primary.name -ne 'agentx-production-issue-classifier' -or
        $manifest.metrics -isnot [array] -or 'correctness' -notin $manifest.metrics -or
        $manifest.thresholds -isnot [array]) {
        throw 'Invalid classification evaluation manifest schema or classifier identity.'
    }
    $thresholds = @{}
    foreach ($threshold in $manifest.thresholds) {
        if ($threshold -isnot [System.Collections.IDictionary] -or
            $threshold.metric -isnot [string] -or $threshold.metric -notin $manifest.metrics -or
            $thresholds.ContainsKey($threshold.metric)) {
            throw 'Invalid or duplicate evaluation threshold metric.'
        }
        Assert-Score -Value $threshold.blocking -Label "Threshold $($threshold.metric).blocking"
        Assert-Score -Value $threshold.warning -Label "Threshold $($threshold.metric).warning"
        if ($threshold.warning -lt $threshold.blocking) {
            throw 'Evaluation warning threshold must not be below blocking threshold.'
        }
        $thresholds[$threshold.metric] = $threshold.blocking
    }
    if (-not $thresholds.ContainsKey('correctness')) {
        throw 'Evaluation manifest requires a correctness blocking threshold.'
    }
    return $thresholds
}

function Assert-Score {
    param($Value, [string]$Label)
    if (($Value -isnot [long] -and $Value -isnot [int] -and $Value -isnot [double] -and $Value -isnot [decimal]) -or
        -not [double]::IsFinite([double]$Value) -or $Value -lt 0 -or $Value -gt 1) {
        throw "$Label must be a finite number between 0 and 1."
    }
}

try {
    if (-not (Test-Path -LiteralPath $DatasetPath -PathType Leaf)) {
        throw "Dataset file not found: $DatasetPath"
    }
    if (-not (Test-Path -LiteralPath $ClassifierPath -PathType Leaf)) {
        throw "Issue classifier not found: $ClassifierPath"
    }
    $blockingThresholds = Get-BlockingThresholds -Path $ManifestPath
    $baseline = Get-Content -LiteralPath $BaselinePath -Raw | ConvertFrom-Json -AsHashtable
    if ($baseline -isnot [System.Collections.IDictionary] -or $baseline.version -ne 1 -or
        $baseline.acceptedRunId -isnot [string] -or [string]::IsNullOrWhiteSpace($baseline.acceptedRunId) -or
        $baseline.runner -ne 'custom' -or $baseline.model -ne 'agentx-production-issue-classifier' -or
        $baseline.aggregateScores -isnot [System.Collections.IDictionary] -or
        $baseline.thresholdSnapshot -isnot [System.Collections.IDictionary]) {
        throw 'Invalid accepted baseline schema or classifier identity.'
    }
    $acceptedScore = $baseline.aggregateScores.correctness
    Assert-Score -Value $acceptedScore -Label 'Baseline correctness'
    $snapshot = $baseline.thresholdSnapshot.correctness
    Assert-Score -Value $snapshot.blocking -Label 'Baseline blocking threshold'
    Assert-Score -Value $snapshot.warning -Label 'Baseline warning threshold'
    if ($snapshot.warning -lt $snapshot.blocking -or $acceptedScore -lt $snapshot.blocking) {
        throw 'Accepted baseline has inconsistent threshold configuration.'
    }

    $datasetRows = @(Get-Content -LiteralPath $DatasetPath |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { ConvertFrom-Json -InputObject $_ -AsHashtable })
    if ($datasetRows.Count -eq 0) {
        throw 'Classification dataset must contain at least one row.'
    }
    $rowIds = @{}
    foreach ($row in $datasetRows) {
        if ($row -isnot [System.Collections.IDictionary]) { throw 'Dataset row must be an object.' }
        foreach ($field in @('id', 'input', 'expected')) {
            if ($row[$field] -isnot [string] -or [string]::IsNullOrWhiteSpace($row[$field])) {
                throw "Dataset row requires a nonempty string $field."
            }
        }
        if ($rowIds.ContainsKey($row.id)) { throw "Duplicate dataset id: $($row.id)" }
        if ($row.expected -cnotmatch '^type:[a-z][a-z-]*$') { throw 'Dataset expected value must be an issue type label.' }
        $rowIds[$row.id] = $true
    }

    $failureSlices = @()
    $correctCount = 0

    foreach ($row in $datasetRows) {
        $predicted = Get-IssueTypePrediction -Text $row.input -Path $ClassifierPath
        $expected = $row.expected

        if ($predicted -ceq $expected) {
            $correctCount += 1
        } else {
            $failureSlices += [pscustomobject]@{
                label = $row.id
                severity = 'medium'
                summary = "Predicted $predicted but expected $expected."
                dataset = 'regression'
            }
        }
    }
    $score = $correctCount / $datasetRows.Count
    $thresholdViolations = @()
    if ($score -lt $blockingThresholds.correctness) {
        $thresholdViolations += @{ metric = 'correctness'; score = $score; blocking = $blockingThresholds.correctness }
    }
    $baselineRegressions = @()
    if ($score -lt $acceptedScore) {
        $baselineRegressions += @{ metric = 'correctness'; score = $score; accepted = $acceptedScore; delta = $score - $acceptedScore }
    }
    $gateStatus = if ($thresholdViolations.Count -gt 0 -or $baselineRegressions.Count -gt 0) { 'fail' } else { 'pass' }
    [pscustomobject]@{
        runId = "classification-$(Get-Date -Format 'yyyyMMddHHmmss')"
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        scope = 'issue-classification-only'
        models = @('agentx-production-issue-classifier')
        acceptedRunId = $baseline.acceptedRunId
        datasetCount = $datasetRows.Count
        gateStatus = $gateStatus
        aggregateMetrics = @(@{ metric = 'correctness'; label = 'Issue classification accuracy'; score = $score })
        thresholdViolations = @($thresholdViolations)
        baselineRegressions = @($baselineRegressions)
        failureSlices = @($failureSlices)
        reviewerNote = 'Classification only. Agent, prompt, instruction, role and skill quality, safety and task completion are not evaluated or certified by this check.'
    } | ConvertTo-Json -Depth 6
    exit $(if ($gateStatus -eq 'pass') { 0 } else { 1 })
} catch {
    @{ scope = 'issue-classification-only'; gateStatus = 'error'; aggregateMetrics = @(); error = $_.Exception.Message } |
        ConvertTo-Json -Depth 6
    exit 2
}