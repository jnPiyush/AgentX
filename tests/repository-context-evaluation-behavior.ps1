#Requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'scripts' 'repository-context-evaluation.ps1')
$datasetText = Get-Content -LiteralPath (Join-Path $root 'evaluation/repository-context/queries.json') -Raw
$passed = 0
function Assert-Evaluation([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}
function Assert-InvalidDataset($Dataset, [string]$Pattern) {
    $message = ''
    try { Assert-RepositoryEvaluationDataset $Dataset } catch { $message = $_.Exception.Message }
    Assert-Evaluation ($message -match $Pattern) "Invalid dataset rejected: $message"
}
$dataset = $datasetText | ConvertFrom-Json
Assert-RepositoryEvaluationDataset $dataset
$unknownRule = $datasetText | ConvertFrom-Json
$unknownRule.hardFailures += 'unimplemented_gate'
Assert-InvalidDataset $unknownRule 'Unknown.*criterion'
$unknownExpectation = $datasetText | ConvertFrom-Json
$unknownExpectation.queries[0] | Add-Member -NotePropertyName expectHiddenBehavior -NotePropertyValue $true
Assert-InvalidDataset $unknownExpectation 'unsupported expectation'
$badBoolean = $datasetText | ConvertFrom-Json
$badBoolean.queries[-1].expectNoExactMatch = 'true'
Assert-InvalidDataset $badBoolean 'must be boolean'

$case = $dataset.queries[-1]
$packet = [pscustomobject]@{ contextVersion = 2; coverage = [pscustomobject]@{ exactMatches = 1 } }
Assert-Evaluation (Get-RepositoryNoAnswerViolation $packet $case) 'no-answer case detects an unexpected exact match'
$packet.coverage.exactMatches = 0
Assert-Evaluation (-not (Get-RepositoryNoAnswerViolation $packet $case)) 'no-answer case accepts zero exact matches'
$nativePacket = [pscustomobject]@{ contextVersion = 2; coverage = [ordered]@{ exactMatches = 1 } }
Assert-Evaluation (Get-RepositoryNoAnswerViolation $nativePacket $case) 'native ordered coverage is graded without a JSON round trip'
$legacyPacket = [pscustomobject]@{ context = 'No specific match; orientation follows.' }
Assert-Evaluation ($null -eq (Get-RepositoryNoAnswerViolation $legacyPacket $case)) 'v1 no-answer metric stays unknown rather than fabricated'

$map = "Keep prefix.`n<!-- frontier:repo-context:begin -->generated<!-- frontier:repo-context:end -->`nKeep suffix."
$before = Get-RepositoryEvaluationCurationHash $map
Assert-Evaluation ($before -ceq (Get-RepositoryEvaluationCurationHash ($map.Replace('generated', 'new generated text')))) 'generated changes do not count as lost curation'
Assert-Evaluation ($before -cne (Get-RepositoryEvaluationCurationHash ($map.Replace('Keep suffix.', 'Changed suffix.')))) 'curated suffix changes are detected'
$metrics = @{
    overBudget = $false; blockedEvidence = 0; staleLabeledLive = 0; curationLost = $false
    requiredSourceMissing = $false; requiredSymbolMissing = $false; noAnswerViolation = $false
}
$record = @{ status = 'measured'; arm = 'v2'; metrics = $metrics }
Assert-Evaluation (-not (Test-RepositoryEvaluationRecordFailure $record $dataset.hardFailures)) 'valid measured packet passes declared gates'
foreach ($key in @('overBudget', 'blockedEvidence', 'staleLabeledLive', 'curationLost', 'noAnswerViolation')) {
    $metrics[$key] = $true
    Assert-Evaluation (Test-RepositoryEvaluationRecordFailure $record $dataset.hardFailures) "$key fails the result"
    $metrics[$key] = $false
}
Assert-Evaluation (Test-RepositoryEvaluationRecordFailure @{ status = 'failed' } $dataset.hardFailures) 'failed attempts cannot disappear from acceptance'
Write-Host "Repository evaluation contract: $passed passed."
