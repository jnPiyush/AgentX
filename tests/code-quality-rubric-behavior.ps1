#!/usr/bin/env pwsh
#Requires -Version 7.0

[CmdletBinding()]
param(
    [switch]$SkipLoopIntegration
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$evaluatorPath = Join-Path $repoRoot 'scripts/score-code-quality.ps1'
$rubricPath = Join-Path $repoRoot 'evaluation/rubrics/code-quality.md'
$cliPath = Join-Path $repoRoot '.agentx/agentx-cli.ps1'
$script:passed = 0
$script:failed = 0
$script:convertFromJsonSupportsDateKind = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')
$script:runRoot = Join-Path (Join-Path $repoRoot 'tests') (Join-Path '.scratch' "code-quality-rubric-$([guid]::NewGuid().ToString('N'))")
New-Item -ItemType Directory -Path $script:runRoot -Force | Out-Null

trap {
    if (Test-Path -LiteralPath $script:runRoot) {
        Remove-Item -LiteralPath $script:runRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
}

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Invoke-Evaluator([string]$WorkspaceRoot, [string[]]$Arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $WorkspaceRoot
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($evaluatorPath)
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $output }
}

function Invoke-Agentx([string]$WorkspaceRoot, [string[]]$Arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $WorkspaceRoot
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.Environment['AGENTX_WORKSPACE_ROOT'] = $WorkspaceRoot
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($cliPath)
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $output }
}

function New-TestWorkspace([string]$Name) {
    $path = Join-Path $script:runRoot $Name
    if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    return $path
}

function Read-JsonFile([string]$Path) {
    $content = Get-Content -LiteralPath $Path -Raw -Encoding utf8
    if ($script:convertFromJsonSupportsDateKind) {
        return $content | ConvertFrom-Json -Depth 20 -NoEnumerate -DateKind String
    }
    return $content | ConvertFrom-Json -Depth 20 -NoEnumerate
}

function Save-JsonFile([string]$Path, $Value) {
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding utf8
}

function Write-Report([string]$Path, $Scope, [hashtable]$Scores = @{}) {
    $dimensionIds = @(
        'requirements-fit',
        'design-conformance',
        'logic-correctness',
        'verification-tests',
        'security-privacy',
        'reliability-errors',
        'maintainability-readability',
        'simplicity-scope',
        'performance-resources',
        'documentation-operability'
    )
    $dimensions = foreach ($dimensionId in $dimensionIds) {
        $score = if ($Scores.ContainsKey($dimensionId)) { [int]$Scores[$dimensionId] } else { 4 }
        [ordered]@{
            id = $dimensionId
            score = $score
            evidence = "Reviewed $dimensionId against the changed implementation and tests."
            findings = @()
        }
    }
    Save-JsonFile $Path ([ordered]@{
        rubricVersion = '2.0.0'
        reviewer = 'code-quality-test-reviewer'
        reviewedAt = [datetimeoffset]::UtcNow.ToString('o')
        files = @($Scope.files)
        dimensions = @($dimensions)
    })
}

Write-Host 'AgentX Code Quality Rubric Tests'
Assert-True (Test-Path -LiteralPath $rubricPath -PathType Leaf) 'Code-quality rubric exists under evaluation/rubrics'
Assert-True (Test-Path -LiteralPath $evaluatorPath -PathType Leaf) 'Code-quality evaluator exists'
$rubricContent = Get-Content -LiteralPath $rubricPath -Raw -Encoding utf8
$weightMatches = [regex]::Matches($rubricContent, '(?m)^\| `[^`]+` \| (\d+) \|')
$weightTotal = ($weightMatches | ForEach-Object { [int]$_.Groups[1].Value } | Measure-Object -Sum).Sum
Assert-True ($weightMatches.Count -eq 10 -and $weightTotal -eq 100) 'Rubric defines ten dimensions totaling exactly 100 points'
Assert-True ($rubricContent -match '`requirements-fit`.+yes.+\| 3 \|' -and $rubricContent -match '`design-conformance`.+yes.+\| 3 \|') 'Requirements and design are explicit blocking rubric dimensions'

$workspace = New-TestWorkspace 'main'
New-Item -ItemType Directory -Path (Join-Path $workspace 'src') -Force | Out-Null
try {
    & git -C $workspace init --quiet
    & git -C $workspace config user.email 'agentx-tests@example.invalid'
    & git -C $workspace config user.name 'AgentX Tests'
    Set-Content -LiteralPath (Join-Path $workspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $workspace 'README.md') -Value '# Fixture' -Encoding utf8
    & git -C $workspace add .
    & git -C $workspace commit --quiet -m 'test: establish fixture'

    $baselinePath = Join-Path $workspace 'code-quality-baseline.json'
    $snapshot = Invoke-Evaluator $workspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    $snapshotResult = if ($snapshot.ExitCode -eq 0) { $snapshot.Output | ConvertFrom-Json } else { $null }
    $baselineHash = if ($snapshotResult -and $snapshotResult.PSObject.Properties.Name -contains 'baselineSha256') { [string]$snapshotResult.baselineSha256 } else { '' }
    Assert-True ($snapshot.ExitCode -eq 0 -and (Test-Path -LiteralPath $baselinePath) -and $baselineHash -match '^[A-F0-9]{64}$') 'Snapshot mode records and hashes the initial implementation state'

    Add-Content -LiteralPath (Join-Path $workspace 'README.md') -Value 'Docs only.' -Encoding utf8
    $docsOnly = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    $docsOnlyResult = if ($docsOnly.ExitCode -eq 0) { $docsOnly.Output | ConvertFrom-Json } else { $null }
    Assert-True ($docsOnly.ExitCode -eq 0 -and $docsOnlyResult.status -eq 'skipped') 'Docs-only changes skip the code-quality report gate'
    & git -C $workspace restore README.md

    Add-Content -LiteralPath (Join-Path $workspace 'src/app.ts') -Value 'export const existingDirty = true;' -Encoding utf8
    $dirtySnapshot = Invoke-Evaluator $workspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    Assert-True ($dirtySnapshot.ExitCode -eq 0) 'Snapshot mode accepts a pre-existing dirty implementation file'
    $dirtySnapshotResult = if ($dirtySnapshot.ExitCode -eq 0) { $dirtySnapshot.Output | ConvertFrom-Json } else { $null }
    $baselineHash = if ($dirtySnapshotResult -and $dirtySnapshotResult.PSObject.Properties.Name -contains 'baselineSha256') { [string]$dirtySnapshotResult.baselineSha256 } else { '' }
    $trustedBaselineBytes = Get-Content -LiteralPath $baselinePath -Raw -Encoding utf8
    $unchangedDirty = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    $unchangedDirtyResult = if ($unchangedDirty.ExitCode -eq 0) { $unchangedDirty.Output | ConvertFrom-Json } else { $null }
    Assert-True ($unchangedDirty.ExitCode -eq 0 -and $unchangedDirtyResult.status -eq 'skipped') 'Unchanged pre-existing dirty code is outside the active loop scope'

    Add-Content -LiteralPath (Join-Path $workspace 'src/app.ts') -Value 'export const implemented = true;' -Encoding utf8
    $scopeResult = Invoke-Evaluator $workspace @('-Mode', 'Scope', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    $scope = if ($scopeResult.ExitCode -eq 0) { $scopeResult.Output | ConvertFrom-Json } else { $null }
    [object[]]$scopeFiles = @()
    if ($scope -and $scope.PSObject.Properties.Name -contains 'files') { $scopeFiles = @($scope.files) }
    Assert-True ($scopeResult.ExitCode -eq 0 -and @($scopeFiles).Count -eq 1) 'Scope mode finds code changed after the baseline'
    Assert-True (@($scopeFiles).Count -eq 1 -and $scopeFiles[0].path -eq 'src/app.ts' -and $scopeFiles[0].sha256 -match '^[A-F0-9]{64}$') 'Scope binds the changed path to its SHA-256'

    $tamperedBaseline = Read-JsonFile $baselinePath
    $tamperedBaseline.files = @($scopeFiles)
    Save-JsonFile $baselinePath $tamperedBaseline
    $baselineBypass = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-BaselineSha256', $baselineHash, '-Json')
    Assert-True ($baselineBypass.ExitCode -ne 0 -and $baselineBypass.Output -match 'baseline.*SHA-256|digest') 'Baseline tampering cannot suppress required rubric scope'
    Set-Content -LiteralPath $baselinePath -Value $trustedBaselineBytes -NoNewline -Encoding utf8

    $missingReport = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    Assert-True ($missingReport.ExitCode -ne 0 -and $missingReport.Output -match 'report') 'Implementation changes fail closed without a rubric report'

    $reportPath = Join-Path $workspace 'code-quality-report.json'
    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $passing = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $passingResult = if ($passing.ExitCode -eq 0) { $passing.Output | ConvertFrom-Json } else { $null }
    Assert-True ($passing.ExitCode -eq 0 -and $passingResult.score -eq 100 -and $passingResult.status -eq 'passed') 'Complete rubric report passes with a calculated 100 score'

    foreach ($missingField in @('rubricVersion', 'reviewer', 'reviewedAt', 'files', 'dimensions')) {
        Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
        $incomplete = Read-JsonFile $reportPath
        $incomplete.PSObject.Properties.Remove($missingField)
        Save-JsonFile $reportPath $incomplete
        $invalid = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
        $invalidResult = $invalid.Output | ConvertFrom-Json
        Assert-True ($invalid.ExitCode -ne 0 -and $invalidResult.status -eq 'failed') "Missing $missingField produces structured failure, not an unhandled strict-mode error"
    }
    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $incomplete = Read-JsonFile $reportPath
    $incomplete.dimensions[0].PSObject.Properties.Remove('findings')
    Save-JsonFile $reportPath $incomplete
    $invalid = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $invalidResult = $invalid.Output | ConvertFrom-Json
    Assert-True ($invalid.ExitCode -ne 0 -and $invalidResult.status -eq 'failed') 'Missing findings produces structured failure'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $reviewerObjectReport = Read-JsonFile $reportPath
    $reviewerObjectReport.reviewer = [PSCustomObject]@{ id = 'not-a-string' }
    Save-JsonFile $reportPath $reviewerObjectReport
    $reviewerObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($reviewerObject.ExitCode -ne 0 -and $reviewerObject.Output -match 'reviewer.*non-empty string') 'Reviewer must remain a real string field'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $filesObjectReport = Read-JsonFile $reportPath
    $filesObjectReport.files = [PSCustomObject]@{
        path = $scopeFiles[0].path
        sha256 = $scopeFiles[0].sha256
    }
    Save-JsonFile $reportPath $filesObjectReport
    $filesObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $filesObjectResult = if ($filesObject.Output.Trim()) { $filesObject.Output | ConvertFrom-Json } else { $null }
    Assert-True ($filesObject.ExitCode -ne 0 -and $filesObjectResult -and @($filesObjectResult.failures) -contains 'files must be a JSON array.') 'Report files must be a JSON array, not an object'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $dimensionsObjectReport = Read-JsonFile $reportPath
    $dimensionsObjectReport.dimensions = [PSCustomObject]@{
        id = 'requirements-fit'
        score = 4
        evidence = 'Reviewed requirements-fit against the changed implementation and tests.'
        findings = @()
    }
    Save-JsonFile $reportPath $dimensionsObjectReport
    $dimensionsObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($dimensionsObject.ExitCode -ne 0 -and $dimensionsObject.Output -match 'dimensions must be a JSON array') 'Report dimensions must be a JSON array, not an object'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $nullFindingsReport = Read-JsonFile $reportPath
    $nullFindingsReport.dimensions[0].findings = $null
    Save-JsonFile $reportPath $nullFindingsReport
    $nullFindings = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($nullFindings.ExitCode -ne 0 -and $nullFindings.Output -match 'findings as a JSON array') 'Null findings cannot pass as review evidence'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $findingsObjectReport = Read-JsonFile $reportPath
    $findingsObjectReport.dimensions[0].findings = [PSCustomObject]@{
        severity = 'low'
        file = 'src/app.ts'
        issue = 'Findings must remain arrays.'
        suggestedFix = 'Wrap the finding in an array.'
    }
    Save-JsonFile $reportPath $findingsObjectReport
    $findingsObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($findingsObject.ExitCode -ne 0 -and $findingsObject.Output -match 'findings as a JSON array') 'Findings must be a JSON array, not an object'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $evidenceObjectReport = Read-JsonFile $reportPath
    $evidenceObjectReport.dimensions[0].evidence = [PSCustomObject]@{ note = 'Reviewed' }
    Save-JsonFile $reportPath $evidenceObjectReport
    $evidenceObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($evidenceObject.ExitCode -ne 0 -and $evidenceObject.Output -match 'evidence as a non-empty string') 'Evidence must remain a real string field'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $futureTimestampReport = Read-JsonFile $reportPath
    $futureTimestampReport.reviewedAt = [datetimeoffset]::UtcNow.AddMinutes(10).ToString('o')
    Save-JsonFile $reportPath $futureTimestampReport
    $futureTimestamp = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($futureTimestamp.ExitCode -ne 0 -and $futureTimestamp.Output -match 'future') 'Future review timestamps beyond clock skew fail closed'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $placeholderReport = Read-JsonFile $reportPath
    $placeholderReport.dimensions[0].evidence = 'TODO'
    Save-JsonFile $reportPath $placeholderReport
    $placeholderEvidence = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($placeholderEvidence.ExitCode -ne 0 -and $placeholderEvidence.Output -match 'TODO|placeholder|no evidence|untested') 'Exact placeholder evidence cannot pass validation'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles }) @{ 'security-privacy' = 2 }
    $blocking = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($blocking.ExitCode -ne 0 -and $blocking.Output -match 'security-privacy') 'Blocking dimension below its floor fails regardless of aggregate score'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    $findingReport = Read-JsonFile $reportPath
    $findingReport.dimensions[0].findings = @([PSCustomObject]@{
        severity = 'medium'
        file = 'src/app.ts'
        issue = 'Contract behavior is not fully verified.'
        suggestedFix = 'Add the missing boundary assertion.'
    })
    Save-JsonFile $reportPath $findingReport
    $openFinding = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($openFinding.ExitCode -ne 0 -and $openFinding.Output -match 'MEDIUM|medium') 'Unresolved MEDIUM findings block the rubric report'

    Write-Report $reportPath ([PSCustomObject]@{ files = $scopeFiles })
    Add-Content -LiteralPath (Join-Path $workspace 'src/app.ts') -Value 'export const afterReview = true;' -Encoding utf8
    $stale = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($stale.ExitCode -ne 0 -and $stale.Output -match 'scope|SHA-256|hash') 'Code changes after review invalidate the rubric report'
} finally {
    Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}

$cliContent = Get-Content -LiteralPath (Join-Path $repoRoot '.agentx/agentx-cli.ps1') -Raw -Encoding utf8
Assert-True ($cliContent -match 'score-code-quality\.ps1') 'Loop CLI dispatches the code-quality evaluator'
Assert-True ($cliContent -match '(?s)function Invoke-LoopComplete.+Invoke-CodeQualityEvaluator -Mode Validate') 'Loop completion explicitly enforces rubric validation'

$emptyWorkspace = New-TestWorkspace 'empty'
New-Item -ItemType Directory -Path $emptyWorkspace -Force | Out-Null
try {
    $emptyBaseline = Join-Path $emptyWorkspace 'baseline.json'
    $emptySnapshot = Invoke-Evaluator $emptyWorkspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $emptyWorkspace, '-BaselinePath', $emptyBaseline, '-Json')
    $emptyValidation = Invoke-Evaluator $emptyWorkspace @('-Mode', 'Validate', '-WorkspaceRoot', $emptyWorkspace, '-BaselinePath', $emptyBaseline, '-Json')
    $emptyResult = if ($emptyValidation.ExitCode -eq 0) { $emptyValidation.Output | ConvertFrom-Json } else { $null }
    Assert-True ($emptySnapshot.ExitCode -eq 0 -and $emptyValidation.ExitCode -eq 0 -and $emptyResult.status -eq 'skipped') 'Zero-code workspace skips rubric validation without strict-mode errors'
} finally {
    Remove-Item -LiteralPath $emptyWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$dotPathWorkspace = New-TestWorkspace 'dot-path'
New-Item -ItemType Directory -Path (Join-Path $dotPathWorkspace '.agentx') -Force | Out-Null
try {
    & git -C $dotPathWorkspace init --quiet
    & git -C $dotPathWorkspace config user.email 'agentx-tests@example.invalid'
    & git -C $dotPathWorkspace config user.name 'AgentX Tests'
    Set-Content -LiteralPath (Join-Path $dotPathWorkspace '.agentx/runtime.ps1') -Value 'Write-Output baseline' -Encoding utf8
    & git -C $dotPathWorkspace add .
    & git -C $dotPathWorkspace commit --quiet -m 'test: establish dot-path fixture'
    Add-Content -LiteralPath (Join-Path $dotPathWorkspace '.agentx/runtime.ps1') -Value 'Write-Output changed' -Encoding utf8
    $dotPathScopeResult = Invoke-Evaluator $dotPathWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $dotPathWorkspace, '-Json')
    $dotPathScope = $dotPathScopeResult.Output | ConvertFrom-Json
    Assert-True ($dotPathScopeResult.ExitCode -eq 0 -and $dotPathScope.files[0].path -eq '.agentx/runtime.ps1') 'Scope preserves leading-dot implementation directories'
} finally {
    Remove-Item -LiteralPath $dotPathWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$localWorkspace = New-TestWorkspace 'local'
New-Item -ItemType Directory -Path (Join-Path $localWorkspace 'src') -Force | Out-Null
try {
    Set-Content -LiteralPath (Join-Path $localWorkspace 'src/app.py') -Value 'VALUE = 1' -Encoding utf8
    New-Item -ItemType Directory -Path (Join-Path $localWorkspace 'node_modules/dependency') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $localWorkspace 'node_modules/dependency/ignored.py') -Value 'IGNORED = True' -Encoding utf8
    $localBaseline = Join-Path $localWorkspace 'code-quality-baseline.json'
    $localSnapshot = Invoke-Evaluator $localWorkspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $localWorkspace, '-BaselinePath', $localBaseline, '-Json')
    Assert-True ($localSnapshot.ExitCode -eq 0) 'Non-Git workspace captures an implementation baseline'
    $localUnchanged = Invoke-Evaluator $localWorkspace @('-Mode', 'Validate', '-WorkspaceRoot', $localWorkspace, '-BaselinePath', $localBaseline, '-Json')
    $localUnchangedResult = if ($localUnchanged.ExitCode -eq 0) { $localUnchanged.Output | ConvertFrom-Json } else { $null }
    Assert-True ($localUnchanged.ExitCode -eq 0 -and $localUnchangedResult.status -eq 'skipped') 'Unchanged non-Git implementation skips the report gate'
    Add-Content -LiteralPath (Join-Path $localWorkspace 'src/app.py') -Value 'CHANGED = True' -Encoding utf8
    $localScopeResult = Invoke-Evaluator $localWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $localWorkspace, '-BaselinePath', $localBaseline, '-Json')
    $localScope = if ($localScopeResult.ExitCode -eq 0) { $localScopeResult.Output | ConvertFrom-Json } else { $null }
    Assert-True ($localScopeResult.ExitCode -eq 0 -and @($localScope.files).Count -eq 1 -and $localScope.files[0].path -eq 'src/app.py') 'Non-Git implementation changes activate the rubric scope'
    Assert-True (@($localScope.files | Where-Object { $_.path -match 'node_modules' }).Count -eq 0) 'Non-Git scope prunes excluded dependency trees'
} finally {
    Remove-Item -LiteralPath $localWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not $SkipLoopIntegration) {
    $zeroCopyWorkspace = New-TestWorkspace 'zero-copy'
    New-Item -ItemType Directory -Path (Join-Path $zeroCopyWorkspace 'src') -Force | Out-Null
    try {
        Set-Content -LiteralPath (Join-Path $zeroCopyWorkspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
        New-Item -ItemType Directory -Path (Join-Path $zeroCopyWorkspace 'scripts') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $zeroCopyWorkspace 'scripts/score-code-quality.ps1') -Value 'param(); exit 0' -Encoding utf8
        $zeroCopyStart = Invoke-Agentx $zeroCopyWorkspace @('loop', 'start', '-p', 'Review zero-copy implementation', '-i', '420')
        Assert-True ($zeroCopyStart.ExitCode -eq 0 -and (Test-Path -LiteralPath (Join-Path $zeroCopyWorkspace '.agentx/state/code-quality-baseline.json'))) 'Zero-copy loop start ignores a workspace-shadow scorer and resolves the installed evaluator'
    } finally {
        Remove-Item -LiteralPath $zeroCopyWorkspace -Recurse -Force -ErrorAction SilentlyContinue
    }

    $loopWorkspace = New-TestWorkspace 'loop'
    New-Item -ItemType Directory -Path (Join-Path $loopWorkspace 'src') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $loopWorkspace 'scripts') -Force | Out-Null
    try {
        Copy-Item -LiteralPath $evaluatorPath -Destination (Join-Path $loopWorkspace 'scripts/score-code-quality.ps1')
        & git -C $loopWorkspace init --quiet
        & git -C $loopWorkspace config user.email 'agentx-tests@example.invalid'
        & git -C $loopWorkspace config user.name 'AgentX Tests'
        Set-Content -LiteralPath (Join-Path $loopWorkspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
        & git -C $loopWorkspace add .
        & git -C $loopWorkspace commit --quiet -m 'test: establish loop fixture'

        $start = Invoke-Agentx $loopWorkspace @('loop', 'start', '-p', 'Correct utility defect', '-i', '420')
        Assert-True ($start.ExitCode -eq 0 -and (Test-Path -LiteralPath (Join-Path $loopWorkspace '.agentx/state/code-quality-baseline.json'))) 'Loop start captures the code-quality baseline automatically'

        $preReviewEvidence = Join-Path $loopWorkspace 'focused.txt'
        Set-Content -LiteralPath $preReviewEvidence -Value 'focused checks passed' -Encoding utf8
        $preReview = Invoke-Agentx $loopWorkspace @('loop', 'iterate', '-s', 'Focused checks', '-e', $preReviewEvidence)
        Assert-True ($preReview.ExitCode -eq 0) 'Loop records pre-review evidence with its own digest'
        Add-Content -LiteralPath (Join-Path $loopWorkspace 'src/app.ts') -Value 'export const corrected = true;' -Encoding utf8
        $loopScopeResult = Invoke-Evaluator $loopWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $loopWorkspace, '-BaselinePath', (Join-Path $loopWorkspace '.agentx/state/code-quality-baseline.json'), '-Json')
        $loopScope = $loopScopeResult.Output | ConvertFrom-Json
        $reviewPath = Join-Path $loopWorkspace 'code-quality-review.json'
        Write-Report $reviewPath $loopScope
        $iterate = Invoke-Agentx $loopWorkspace @(
            'loop', 'iterate', '-s', 'Subagent Review: code quality approved', '-e', $reviewPath,
            '--verdict', 'approved', '--reviewer', 'code-quality-test-reviewer', '--high', '0', '--medium', '0'
        )
        Assert-True ($iterate.ExitCode -eq 0) 'Final review iteration accepts the rubric report as evidence'

        $reviewedState = Get-Content -LiteralPath (Join-Path $loopWorkspace '.agentx/state/loop-state.json') -Raw -Encoding utf8 | ConvertFrom-Json -Depth 30
        $earlyArchive = [string]$reviewedState.history[1].evidence
        Add-Content -LiteralPath $earlyArchive -Value 'rewritten after approval' -Encoding utf8
        $earlyTamperEvidence = Join-Path $loopWorkspace 'early-tamper-final.txt'
        Set-Content -LiteralPath $earlyTamperEvidence -Value 'early archive tamper attempt' -Encoding utf8
        $earlyTamperComplete = Invoke-Agentx $loopWorkspace @('loop', 'complete', '-s', 'Attempt with rewritten early evidence', '-e', $earlyTamperEvidence)
        Assert-True ($earlyTamperComplete.ExitCode -ne 0 -and $earlyTamperComplete.Output -match 'SHA-256|digest') 'Loop completion rejects rewritten non-review history evidence'
        Copy-Item -LiteralPath $preReviewEvidence -Destination $earlyArchive -Force

        Add-Content -LiteralPath (Join-Path $loopWorkspace 'src/app.ts') -Value 'export const afterApproval = true;' -Encoding utf8
        $tamperedScopeResult = Invoke-Evaluator $loopWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $loopWorkspace, '-BaselinePath', (Join-Path $loopWorkspace '.agentx/state/code-quality-baseline.json'), '-Json')
        $tamperedScope = $tamperedScopeResult.Output | ConvertFrom-Json
        Write-Report $reviewPath $tamperedScope
        $approvedState = Get-Content -LiteralPath (Join-Path $loopWorkspace '.agentx/state/loop-state.json') -Raw -Encoding utf8 | ConvertFrom-Json -Depth 30
        $archivedReviewPath = [string]$approvedState.history[-1].evidence
        $trustedReviewBytes = Get-Content -LiteralPath $archivedReviewPath -Raw -Encoding utf8
        Copy-Item -LiteralPath $reviewPath -Destination $archivedReviewPath -Force
        $finalEvidence = Join-Path $loopWorkspace 'final-gate.txt'
        Set-Content -LiteralPath $finalEvidence -Value 'tampered archived review attempt' -Encoding utf8
        $tamperedComplete = Invoke-Agentx $loopWorkspace @('loop', 'complete', '-s', 'Attempt with rewritten review', '-e', $finalEvidence)
        Assert-True ($tamperedComplete.ExitCode -ne 0 -and $tamperedComplete.Output -match 'SHA-256|hash|digest') 'Loop completion rejects a rewritten archived review'
        Set-Content -LiteralPath $archivedReviewPath -Value $trustedReviewBytes -NoNewline -Encoding utf8

        $reReview = Invoke-Agentx $loopWorkspace @(
            'loop', 'iterate', '-s', 'Subagent Review: changed code re-approved', '-e', $reviewPath,
            '--verdict', 'approved', '--reviewer', 'code-quality-test-reviewer', '--high', '0', '--medium', '0'
        )
        Assert-True ($reReview.ExitCode -eq 0) 'Changed code can complete after a fresh rubric review'
        Set-Content -LiteralPath $finalEvidence -Value 'focused tests passed after re-review' -Encoding utf8
        $complete = Invoke-Agentx $loopWorkspace @('loop', 'complete', '-s', 'Code-quality fixture complete', '-e', $finalEvidence)
        Assert-True ($complete.ExitCode -eq 0 -and $complete.Output -match 'Code-quality rubric passed at 100/100') 'Loop completion runs and passes the code-quality rubric automatically'
    } finally {
        Remove-Item -LiteralPath $loopWorkspace -Recurse -Force -ErrorAction SilentlyContinue
    }

    $resumeWorkspace = New-TestWorkspace 'resume'
    New-Item -ItemType Directory -Path (Join-Path $resumeWorkspace 'src') -Force | Out-Null
    try {
        & git -C $resumeWorkspace init --quiet
        & git -C $resumeWorkspace config user.email 'agentx-tests@example.invalid'
        & git -C $resumeWorkspace config user.name 'AgentX Tests'
        Set-Content -LiteralPath (Join-Path $resumeWorkspace 'src/app.ts') -Value 'export const initial = true;' -Encoding utf8
        & git -C $resumeWorkspace add .
        & git -C $resumeWorkspace commit --quiet -m 'test: establish resume fixture'
        Add-Content -LiteralPath (Join-Path $resumeWorkspace 'src/app.ts') -Value 'export const existingTaskChange = true;' -Encoding utf8
        $resumeStart = Invoke-Agentx $resumeWorkspace @('loop', 'start', '-p', 'Resume implementation review', '--include-existing-changes')
        $resumeScope = Invoke-Evaluator $resumeWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $resumeWorkspace, '-BaselinePath', (Join-Path $resumeWorkspace '.agentx/state/code-quality-baseline.json'), '-Json')
        $resumeResult = if ($resumeScope.ExitCode -eq 0) { $resumeScope.Output | ConvertFrom-Json } else { $null }
        Assert-True ($resumeStart.ExitCode -eq 0 -and @($resumeResult.files).Count -eq 1) 'Explicit resumed loop includes existing dirty implementation in review scope'
    } finally {
        Remove-Item -LiteralPath $resumeWorkspace -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host '[INFO] Loop-backed integration cases skipped by request.'
}

if (Test-Path -LiteralPath $script:runRoot) {
    Remove-Item -LiteralPath $script:runRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $passed passed, $failed failed"
exit $(if ($failed -eq 0) { 0 } else { 1 })
