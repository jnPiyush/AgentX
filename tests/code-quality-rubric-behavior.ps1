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
$docCheckerPath = Join-Path (Split-Path $evaluatorPath -Parent) 'check-doc-drift.ps1'
$script:docCheckerAvailable = Test-Path -LiteralPath $docCheckerPath -PathType Leaf
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

function Invoke-WorkspaceEvaluator([string]$WorkspaceRoot, [string[]]$Arguments) {
    $workspaceEvaluatorPath = Join-Path $WorkspaceRoot 'scripts/score-code-quality.ps1'
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.WorkingDirectory = $WorkspaceRoot
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add($workspaceEvaluatorPath)
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
    $parent = Split-Path $Path -Parent
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding utf8
}

function New-StateFilePath([string]$WorkspaceRoot, [string]$LeafName) {
    $stateDir = Join-Path $WorkspaceRoot '.agentx/state'
    if (-not (Test-Path -LiteralPath $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }
    return (Join-Path $stateDir $LeafName)
}

function Install-TrustedEvaluatorBundle([string]$WorkspaceRoot) {
    $scriptsDir = Join-Path $WorkspaceRoot 'scripts'
    New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
    Copy-Item -LiteralPath $evaluatorPath -Destination (Join-Path $scriptsDir 'score-code-quality.ps1') -Force
    Copy-Item -LiteralPath $docCheckerPath -Destination (Join-Path $scriptsDir 'check-doc-drift.ps1') -Force
    Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts/validate-references.ps1') -Destination (Join-Path $scriptsDir 'validate-references.ps1') -Force
}

function Get-FileSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Get-DefaultDocumentationPaths([string]$WorkspaceRoot) {
    $defaultPaths = [System.Collections.Generic.List[string]]::new()
    $readmePath = Join-Path $WorkspaceRoot 'README.md'
    if (Test-Path -LiteralPath $readmePath -PathType Leaf) {
        $defaultPaths.Add('README.md')
    } else {
        $docsRoot = Join-Path $WorkspaceRoot 'docs'
        if (Test-Path -LiteralPath $docsRoot -PathType Container) {
            $firstDoc = @(Get-ChildItem -LiteralPath $docsRoot -File -Recurse -Filter '*.md' -ErrorAction SilentlyContinue |
                Sort-Object FullName | Select-Object -First 1)
            if ($firstDoc.Count -gt 0) {
                $defaultPaths.Add(([IO.Path]::GetRelativePath($WorkspaceRoot, $firstDoc[0].FullName).Replace('\', '/')))
            }
        }
    }
    return @($defaultPaths)
}

function New-DocumentationReview(
    [string]$WorkspaceRoot,
    [ValidateSet('updated', 'no-impact')][string]$Status = 'no-impact',
    [string[]]$DocumentPaths = @(),
    [string]$Rationale = ''
) {
    if (-not $Rationale) {
        $Rationale = if ($Status -eq 'updated') {
            'Updated the reviewed documentation to match the implementation change.'
        } elseif (@($DocumentPaths).Count -gt 0) {
            'Reviewed the current documentation and confirmed no user-facing or operator guidance changes were required.'
        } else {
            'Workspace has no root README or docs markdown to review for this implementation change.'
        }
    }

    $documents = foreach ($documentPath in @($DocumentPaths)) {
        [ordered]@{
            path = $documentPath
            sha256 = (Get-FileSha256 (Join-Path $WorkspaceRoot $documentPath))
        }
    }

    return [ordered]@{
        status = $Status
        rationale = $Rationale
        documents = @($documents)
    }
}

function Write-Report(
    [string]$Path,
    [string]$WorkspaceRoot,
    $Scope,
    [hashtable]$Scores = @{},
    $DocumentationReview = $null
) {
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

    $documentationReviewValue = if ($null -ne $DocumentationReview) {
        $DocumentationReview
    } else {
        New-DocumentationReview -WorkspaceRoot $WorkspaceRoot -Status 'no-impact' -DocumentPaths (Get-DefaultDocumentationPaths $WorkspaceRoot)
    }

    Save-JsonFile $Path ([ordered]@{
        rubricVersion = '2.1.0'
        reviewer = 'code-quality-test-reviewer'
        reviewedAt = [datetimeoffset]::UtcNow.ToString('o')
        documentationReview = $documentationReviewValue
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
Assert-True ($rubricContent -match '"rubricVersion": "2\.1\.0"' -and $rubricContent -match '"documentationReview"') 'Rubric documents the 2.1.0 documentation review contract'
Assert-True ($rubricContent -match 'Config-only implementation changes' -and $rubricContent -match 'check-doc-drift\.ps1') 'Rubric documents config-only scope and the documentation drift checker'
if (-not $script:docCheckerAvailable) {
    Write-Host '[INFO] scripts/check-doc-drift.ps1 not present; checker-backed pass cases will fail closed or skip.'
}

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

    $baselinePath = New-StateFilePath $workspace 'code-quality-baseline.json'
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
    Assert-True ($scopeResult.ExitCode -eq 0 -and @($scopeFiles).Count -eq 1) 'Scope mode finds implementation changed after the baseline'
    Assert-True (@($scopeFiles).Count -eq 1 -and $scopeFiles[0].path -eq 'src/app.ts' -and $scopeFiles[0].sha256 -match '^[A-F0-9]{64}$') 'Scope binds the changed path to its SHA-256'

    $tamperedBaseline = Read-JsonFile $baselinePath
    $tamperedBaseline.files = @($scopeFiles)
    Save-JsonFile $baselinePath $tamperedBaseline
    $baselineBypass = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-BaselineSha256', $baselineHash, '-Json')
    Assert-True ($baselineBypass.ExitCode -ne 0 -and $baselineBypass.Output -match 'baseline.*SHA-256|digest') 'Baseline tampering cannot suppress required rubric scope'
    Set-Content -LiteralPath $baselinePath -Value $trustedBaselineBytes -NoNewline -Encoding utf8

    $missingReport = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-Json')
    Assert-True ($missingReport.ExitCode -ne 0 -and $missingReport.Output -match 'report') 'Implementation changes fail closed without a rubric report'

    $reportPath = New-StateFilePath $workspace 'code-quality-report.json'
    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $passing = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $passingResult = if ($passing.ExitCode -eq 0) { $passing.Output | ConvertFrom-Json } else { $null }
    if ($script:docCheckerAvailable) {
        Assert-True ($passing.ExitCode -eq 0 -and $passingResult.score -eq 100 -and $passingResult.status -eq 'passed') 'Valid no-impact documentationReview passes with a calculated 100 score'
    } else {
        Assert-True ($passing.ExitCode -ne 0 -and $passing.Output -match 'Documentation drift checker is missing') 'Validation fails closed when the documentation drift checker is unavailable'
    }

    $scopeAfterReportResult = Invoke-Evaluator $workspace @('-Mode', 'Scope', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $scopeAfterReport = if ($scopeAfterReportResult.ExitCode -eq 0) { $scopeAfterReportResult.Output | ConvertFrom-Json } else { $null }
    Assert-True ($scopeAfterReportResult.ExitCode -eq 0 -and @($scopeAfterReport.files).Count -eq 1 -and $scopeAfterReport.files[0].path -eq 'src/app.ts') 'BaselinePath and ReportPath do not count themselves in scope'

    foreach ($missingField in @('rubricVersion', 'reviewer', 'reviewedAt', 'documentationReview', 'files', 'dimensions')) {
        Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
        $incomplete = Read-JsonFile $reportPath
        $incomplete.PSObject.Properties.Remove($missingField)
        Save-JsonFile $reportPath $incomplete
        $invalid = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
        $invalidResult = $invalid.Output | ConvertFrom-Json
        Assert-True ($invalid.ExitCode -ne 0 -and $invalidResult.status -eq 'failed') "Missing $missingField produces structured failure, not an unhandled strict-mode error"
    }

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $incomplete = Read-JsonFile $reportPath
    $incomplete.dimensions[0].PSObject.Properties.Remove('findings')
    Save-JsonFile $reportPath $incomplete
    $invalid = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $invalidResult = $invalid.Output | ConvertFrom-Json
    Assert-True ($invalid.ExitCode -ne 0 -and $invalidResult.status -eq 'failed') 'Missing findings produces structured failure'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $reviewerObjectReport = Read-JsonFile $reportPath
    $reviewerObjectReport.reviewer = [PSCustomObject]@{ id = 'not-a-string' }
    Save-JsonFile $reportPath $reviewerObjectReport
    $reviewerObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($reviewerObject.ExitCode -ne 0 -and $reviewerObject.Output -match 'reviewer.*non-empty string') 'Reviewer must remain a real string field'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $filesObjectReport = Read-JsonFile $reportPath
    $filesObjectReport.files = [PSCustomObject]@{
        path = $scopeFiles[0].path
        sha256 = $scopeFiles[0].sha256
    }
    Save-JsonFile $reportPath $filesObjectReport
    $filesObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $filesObjectResult = if ($filesObject.Output.Trim()) { $filesObject.Output | ConvertFrom-Json } else { $null }
    Assert-True ($filesObject.ExitCode -ne 0 -and $filesObjectResult -and @($filesObjectResult.failures) -contains 'files must be a JSON array.') 'Report files must be a JSON array, not an object'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
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

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $nullFindingsReport = Read-JsonFile $reportPath
    $nullFindingsReport.dimensions[0].findings = $null
    Save-JsonFile $reportPath $nullFindingsReport
    $nullFindings = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($nullFindings.ExitCode -ne 0 -and $nullFindings.Output -match 'findings as a JSON array') 'Null findings cannot pass as review evidence'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
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

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $evidenceObjectReport = Read-JsonFile $reportPath
    $evidenceObjectReport.dimensions[0].evidence = [PSCustomObject]@{ note = 'Reviewed' }
    Save-JsonFile $reportPath $evidenceObjectReport
    $evidenceObject = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($evidenceObject.ExitCode -ne 0 -and $evidenceObject.Output -match 'evidence as a non-empty string') 'Evidence must remain a real string field'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $futureTimestampReport = Read-JsonFile $reportPath
    $futureTimestampReport.reviewedAt = [datetimeoffset]::UtcNow.AddMinutes(10).ToString('o')
    Save-JsonFile $reportPath $futureTimestampReport
    $futureTimestamp = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($futureTimestamp.ExitCode -ne 0 -and $futureTimestamp.Output -match 'future') 'Future review timestamps beyond clock skew fail closed'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $placeholderReport = Read-JsonFile $reportPath
    $placeholderReport.dimensions[0].evidence = 'TODO'
    Save-JsonFile $reportPath $placeholderReport
    $placeholderEvidence = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($placeholderEvidence.ExitCode -ne 0 -and $placeholderEvidence.Output -match 'TODO|placeholder|no evidence|untested') 'Exact placeholder evidence cannot pass validation'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles }) @{ 'security-privacy' = 2 }
    $blocking = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($blocking.ExitCode -ne 0 -and $blocking.Output -match 'security-privacy') 'Blocking dimension below its floor fails regardless of aggregate score'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
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

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $missingDocReviewReport = Read-JsonFile $reportPath
    $missingDocReviewReport.PSObject.Properties.Remove('documentationReview')
    Save-JsonFile $reportPath $missingDocReviewReport
    $missingDocReview = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($missingDocReview.ExitCode -ne 0 -and $missingDocReview.Output -match 'documentationReview must be a JSON object') 'Missing documentationReview blocks validation'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $reasonlessNoImpactReport = Read-JsonFile $reportPath
    $reasonlessNoImpactReport.documentationReview.rationale = ''
    Save-JsonFile $reportPath $reasonlessNoImpactReport
    $reasonlessNoImpact = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($reasonlessNoImpact.ExitCode -ne 0 -and $reasonlessNoImpact.Output -match 'documentationReview\.rationale') 'Reasonless no-impact documentation reviews fail'

    foreach ($field in @('status', 'rationale')) {
        Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
        $arrayFieldReport = Read-JsonFile $reportPath
        $arrayFieldReport.documentationReview.$field = @($arrayFieldReport.documentationReview.$field)
        Save-JsonFile $reportPath $arrayFieldReport
        $arrayField = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
        Assert-True ($arrayField.ExitCode -ne 0 -and $arrayField.Output -match "documentationReview\.$field") "Documentation $field must be a string, not a one-element array"
    }
    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $emptyDocumentsReport = Read-JsonFile $reportPath
    $emptyDocumentsReport.documentationReview.documents = @()
    Save-JsonFile $reportPath $emptyDocumentsReport
    $emptyDocuments = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($emptyDocuments.ExitCode -ne 0 -and $emptyDocuments.Output -match 'reviewed documents') 'No-impact documentation reviews require reviewed docs when README or docs content exists'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    $traversalReport = Read-JsonFile $reportPath
    $traversalReport.documentationReview.documents[0].path = '..\README.md'
    Save-JsonFile $reportPath $traversalReport
    $traversal = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($traversal.ExitCode -ne 0 -and $traversal.Output -match 'traversal|workspace-relative|outside the workspace') 'Documentation review rejects traversal paths'

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    Add-Content -LiteralPath (Join-Path $workspace 'README.md') -Value 'Stale hash change.' -Encoding utf8
    $staleDocumentationHash = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($staleDocumentationHash.ExitCode -ne 0 -and $staleDocumentationHash.Output -match 'documentationReview document .*SHA-256') 'Stale reviewed document hashes fail validation'
    & git -C $workspace restore README.md

    Add-Content -LiteralPath (Join-Path $workspace 'README.md') -Value 'Updated for the implementation change.' -Encoding utf8
    $updatedDocumentationReview = New-DocumentationReview -WorkspaceRoot $workspace -Status 'updated' -DocumentPaths @('README.md') -Rationale 'Updated README.md to match the implementation change.'
    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles }) @{} $updatedDocumentationReview
    $updatedPass = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    $updatedPassResult = if ($updatedPass.ExitCode -eq 0) { $updatedPass.Output | ConvertFrom-Json } else { $null }
    if ($script:docCheckerAvailable) {
        Assert-True ($updatedPass.ExitCode -eq 0 -and $updatedPassResult.status -eq 'passed') 'Valid updated documentationReview passes'
    } else {
        Assert-True ($updatedPass.ExitCode -ne 0 -and $updatedPass.Output -match 'Documentation drift checker is missing') 'Updated documentation review also fails closed without the checker'
    }
    & git -C $workspace restore README.md

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    Remove-Item -LiteralPath (Join-Path $workspace 'README.md') -Force
    $deletedDocumentation = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($deletedDocumentation.ExitCode -ne 0 -and $deletedDocumentation.Output -match 'does not exist') 'Deleted reviewed documents fail validation'
    & git -C $workspace restore README.md

    if ($script:docCheckerAvailable) {
        Set-Content -LiteralPath (Join-Path $workspace 'README.md') -Value "# Fixture`n`n[Broken](docs/missing.md)" -Encoding utf8
        $brokenLinkReview = New-DocumentationReview -WorkspaceRoot $workspace -Status 'updated' -DocumentPaths @('README.md') -Rationale 'Updated README.md while reviewing documentation impact.'
        Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles }) @{} $brokenLinkReview
        $brokenLink = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
        Assert-True ($brokenLink.ExitCode -ne 0 -and $brokenLink.Output -match 'Documentation drift checker failed|broken|reference|link|missing') 'Broken reviewed document links fail the documentation drift gate'
        & git -C $workspace restore README.md
    } else {
        Write-Host '[INFO] Broken reviewed document link case skipped; checker unavailable.'
    }

    Write-Report $reportPath $workspace ([PSCustomObject]@{ files = $scopeFiles })
    Add-Content -LiteralPath (Join-Path $workspace 'src/app.ts') -Value 'export const afterReview = true;' -Encoding utf8
    $stale = Invoke-Evaluator $workspace @('-Mode', 'Validate', '-WorkspaceRoot', $workspace, '-BaselinePath', $baselinePath, '-ReportPath', $reportPath, '-Json')
    Assert-True ($stale.ExitCode -ne 0 -and $stale.Output -match 'scope|SHA-256|hash') 'Code changes after review invalidate the rubric report'
} finally {
    Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}

$noDocsWorkspace = New-TestWorkspace 'no-docs'
New-Item -ItemType Directory -Path (Join-Path $noDocsWorkspace 'src') -Force | Out-Null
try {
    & git -C $noDocsWorkspace init --quiet
    & git -C $noDocsWorkspace config user.email 'agentx-tests@example.invalid'
    & git -C $noDocsWorkspace config user.name 'AgentX Tests'
    Set-Content -LiteralPath (Join-Path $noDocsWorkspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
    & git -C $noDocsWorkspace add .
    & git -C $noDocsWorkspace commit --quiet -m 'test: establish no-doc fixture'
    $noDocsBaseline = New-StateFilePath $noDocsWorkspace 'code-quality-baseline.json'
    $noDocsSnapshot = Invoke-Evaluator $noDocsWorkspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $noDocsWorkspace, '-BaselinePath', $noDocsBaseline, '-Json')
    Assert-True ($noDocsSnapshot.ExitCode -eq 0) 'No-doc workspace captures a baseline'
    Add-Content -LiteralPath (Join-Path $noDocsWorkspace 'src/app.ts') -Value 'export const changed = true;' -Encoding utf8
    $noDocsScopeResult = Invoke-Evaluator $noDocsWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $noDocsWorkspace, '-BaselinePath', $noDocsBaseline, '-Json')
    $noDocsScope = if ($noDocsScopeResult.ExitCode -eq 0) { $noDocsScopeResult.Output | ConvertFrom-Json } else { $null }
    $noDocsReport = New-StateFilePath $noDocsWorkspace 'code-quality-review.json'
    $noDocsReview = New-DocumentationReview -WorkspaceRoot $noDocsWorkspace -Status 'no-impact' -DocumentPaths @() -Rationale 'Workspace has no root README or docs markdown to review for this implementation change.'
    Write-Report $noDocsReport $noDocsWorkspace $noDocsScope @{} $noDocsReview
    $noDocsValidation = Invoke-Evaluator $noDocsWorkspace @('-Mode', 'Validate', '-WorkspaceRoot', $noDocsWorkspace, '-BaselinePath', $noDocsBaseline, '-ReportPath', $noDocsReport, '-Json')
    $noDocsValidationResult = if ($noDocsValidation.ExitCode -eq 0) { $noDocsValidation.Output | ConvertFrom-Json } else { $null }
    if ($script:docCheckerAvailable) {
        Assert-True ($noDocsValidation.ExitCode -eq 0 -and $noDocsValidationResult.status -eq 'passed') 'No-doc workspaces may use no-impact with an empty reviewed-doc list'
    } else {
        Assert-True ($noDocsValidation.ExitCode -ne 0 -and $noDocsValidation.Output -match 'Documentation drift checker is missing') 'No-doc workspaces still fail closed when the checker is missing'
    }
} finally {
    Remove-Item -LiteralPath $noDocsWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$localEvaluatorWorkspace = New-TestWorkspace 'local-evaluator'
New-Item -ItemType Directory -Path (Join-Path $localEvaluatorWorkspace 'src') -Force | Out-Null
try {
    & git -C $localEvaluatorWorkspace init --quiet
    & git -C $localEvaluatorWorkspace config user.email 'agentx-tests@example.invalid'
    & git -C $localEvaluatorWorkspace config user.name 'AgentX Tests'
    Set-Content -LiteralPath (Join-Path $localEvaluatorWorkspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $localEvaluatorWorkspace 'README.md') -Value '# Local Evaluator Fixture' -Encoding utf8
    & git -C $localEvaluatorWorkspace add .
    & git -C $localEvaluatorWorkspace commit --quiet -m 'test: establish local evaluator fixture'
    Add-Content -LiteralPath (Join-Path $localEvaluatorWorkspace 'src/app.ts') -Value 'export const changed = true;' -Encoding utf8

    if ($script:docCheckerAvailable) {
        Install-TrustedEvaluatorBundle $localEvaluatorWorkspace
        $localEvaluatorBaseline = New-StateFilePath $localEvaluatorWorkspace 'code-quality-baseline.json'
        $localEvaluatorSnapshot = Invoke-WorkspaceEvaluator $localEvaluatorWorkspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $localEvaluatorWorkspace, '-BaselinePath', $localEvaluatorBaseline, '-Json')
        Assert-True ($localEvaluatorSnapshot.ExitCode -eq 0) 'Trusted evaluator fixture snapshots successfully when helper scripts accompany it'
        Add-Content -LiteralPath (Join-Path $localEvaluatorWorkspace 'src/app.ts') -Value 'export const afterSnapshot = true;' -Encoding utf8
        $localEvaluatorScopeResult = Invoke-WorkspaceEvaluator $localEvaluatorWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $localEvaluatorWorkspace, '-BaselinePath', $localEvaluatorBaseline, '-Json')
        $localEvaluatorScope = if ($localEvaluatorScopeResult.ExitCode -eq 0) { $localEvaluatorScopeResult.Output | ConvertFrom-Json } else { $null }
        $localEvaluatorReport = New-StateFilePath $localEvaluatorWorkspace 'code-quality-review.json'
        Write-Report $localEvaluatorReport $localEvaluatorWorkspace $localEvaluatorScope
        $localEvaluatorValidate = Invoke-WorkspaceEvaluator $localEvaluatorWorkspace @('-Mode', 'Validate', '-WorkspaceRoot', $localEvaluatorWorkspace, '-BaselinePath', $localEvaluatorBaseline, '-ReportPath', $localEvaluatorReport, '-Json')
        $localEvaluatorValidateResult = if ($localEvaluatorValidate.ExitCode -eq 0) { $localEvaluatorValidate.Output | ConvertFrom-Json } else { $null }
        Assert-True ($localEvaluatorValidate.ExitCode -eq 0 -and $localEvaluatorValidateResult.status -eq 'passed') 'Trusted evaluator fixture validates successfully with copied checker helpers'
    } else {
        Write-Host '[INFO] Local trusted evaluator fixture skipped; checker unavailable.'
    }
} finally {
    Remove-Item -LiteralPath $localEvaluatorWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$configWorkspace = New-TestWorkspace 'config'
New-Item -ItemType Directory -Path (Join-Path $configWorkspace '.agentx/plugins') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $configWorkspace 'docs/artifacts/reviews') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $configWorkspace 'vscode-extension/.github/agentx') -Force | Out-Null
try {
    & git -C $configWorkspace init --quiet
    & git -C $configWorkspace config user.email 'agentx-tests@example.invalid'
    & git -C $configWorkspace config user.name 'AgentX Tests'
    Set-Content -LiteralPath (Join-Path $configWorkspace 'README.md') -Value '# Config Fixture' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $configWorkspace 'appsettings.json') -Value '{"enabled":false}' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $configWorkspace 'package-lock.json') -Value '{"lockfileVersion":3}' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $configWorkspace '.agentx/install-manifest.json') -Value '{"files":[]}' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $configWorkspace '.agentx/plugins/registry.json') -Value '{"plugins":[]}' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $configWorkspace 'docs/artifacts/reviews/evidence.json') -Value '{"result":"archived"}' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $configWorkspace 'vscode-extension/.github/agentx/mirror.json') -Value '{"generated":true}' -Encoding utf8
    & git -C $configWorkspace add .
    & git -C $configWorkspace commit --quiet -m 'test: establish config fixture'

    $configBaseline = New-StateFilePath $configWorkspace 'code-quality-baseline.json'
    $configSnapshot = Invoke-Evaluator $configWorkspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $configWorkspace, '-BaselinePath', $configBaseline, '-Json')
    Assert-True ($configSnapshot.ExitCode -eq 0) 'Config-only workspace captures a baseline'

    Set-Content -LiteralPath (Join-Path $configWorkspace 'appsettings.json') -Value '{"enabled":true}' -Encoding utf8
    Add-Content -LiteralPath (Join-Path $configWorkspace 'package-lock.json') -Value '{"ignored":true}' -Encoding utf8
    Add-Content -LiteralPath (Join-Path $configWorkspace '.agentx/install-manifest.json') -Value '{"ignored":true}' -Encoding utf8
    Add-Content -LiteralPath (Join-Path $configWorkspace '.agentx/plugins/registry.json') -Value '{"ignored":true}' -Encoding utf8
    Add-Content -LiteralPath (Join-Path $configWorkspace 'docs/artifacts/reviews/evidence.json') -Value '{"ignored":true}' -Encoding utf8
    Add-Content -LiteralPath (Join-Path $configWorkspace 'vscode-extension/.github/agentx/mirror.json') -Value '{"ignored":true}' -Encoding utf8
    foreach ($generated in @('.github/registries/skills.json', '.github/registries/templates.json',
            '.agentx/issues/issue-1.json', '.agentx/digests/digest.json',
            'docs/execution/task-bundles/runtime.json', 'docs/execution/bounded-parallel/runtime.json')) {
        $full = Join-Path $configWorkspace $generated
        New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
        Set-Content -LiteralPath $full -Value '{"runtime":true}'
    }

    $configScopeResult = Invoke-Evaluator $configWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $configWorkspace, '-BaselinePath', $configBaseline, '-Json')
    $configScope = if ($configScopeResult.ExitCode -eq 0) { $configScopeResult.Output | ConvertFrom-Json } else { $null }
    Assert-True ($configScopeResult.ExitCode -eq 0 -and @($configScope.files).Count -eq 1 -and $configScope.files[0].path -eq 'appsettings.json') 'Config-only implementation changes activate scope while generated and state JSON files stay excluded'

    $configMissingReport = Invoke-Evaluator $configWorkspace @('-Mode', 'Validate', '-WorkspaceRoot', $configWorkspace, '-BaselinePath', $configBaseline, '-Json')
    Assert-True ($configMissingReport.ExitCode -ne 0 -and $configMissingReport.Output -match 'report') 'Config-only implementation changes require a rubric report'
} finally {
    Remove-Item -LiteralPath $configWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$dockerWorkspace = New-TestWorkspace 'docker'
try {
    & git -C $dockerWorkspace init --quiet
    & git -C $dockerWorkspace config user.email 'agentx-tests@example.invalid'
    & git -C $dockerWorkspace config user.name 'AgentX Tests'
    Set-Content -LiteralPath (Join-Path $dockerWorkspace 'README.md') -Value '# Docker Fixture' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $dockerWorkspace 'Dockerfile') -Value "FROM scratch`nCMD []" -Encoding utf8
    & git -C $dockerWorkspace add .
    & git -C $dockerWorkspace commit --quiet -m 'test: establish docker fixture'
    $dockerBaseline = New-StateFilePath $dockerWorkspace 'code-quality-baseline.json'
    $dockerSnapshot = Invoke-Evaluator $dockerWorkspace @('-Mode', 'Snapshot', '-WorkspaceRoot', $dockerWorkspace, '-BaselinePath', $dockerBaseline, '-Json')
    Assert-True ($dockerSnapshot.ExitCode -eq 0) 'Dockerfile workspace captures a baseline'
    Add-Content -LiteralPath (Join-Path $dockerWorkspace 'Dockerfile') -Value 'LABEL version=1' -Encoding utf8
    $dockerScopeResult = Invoke-Evaluator $dockerWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $dockerWorkspace, '-BaselinePath', $dockerBaseline, '-Json')
    $dockerScope = if ($dockerScopeResult.ExitCode -eq 0) { $dockerScopeResult.Output | ConvertFrom-Json } else { $null }
    Assert-True ($dockerScopeResult.ExitCode -eq 0 -and @($dockerScope.files).Count -eq 1 -and $dockerScope.files[0].path -eq 'Dockerfile') 'Dockerfile changes count as implementation scope'
} finally {
    Remove-Item -LiteralPath $dockerWorkspace -Recurse -Force -ErrorAction SilentlyContinue
}

$cliContent = Get-Content -LiteralPath (Join-Path $repoRoot '.agentx/agentx-cli.ps1') -Raw -Encoding utf8
Assert-True ($cliContent -match 'score-code-quality\.ps1') 'Loop CLI dispatches the code-quality evaluator'
Assert-True ($cliContent -match '(?s)function Invoke-LoopComplete.+Invoke-CodeQualityEvaluator -Mode Validate') 'Loop completion explicitly enforces rubric validation'

$emptyWorkspace = New-TestWorkspace 'empty'
New-Item -ItemType Directory -Path $emptyWorkspace -Force | Out-Null
try {
    $emptyBaseline = New-StateFilePath $emptyWorkspace 'baseline.json'
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
    $localBaseline = New-StateFilePath $localWorkspace 'code-quality-baseline.json'
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
    try {
        Install-TrustedEvaluatorBundle $loopWorkspace
        & git -C $loopWorkspace init --quiet
        & git -C $loopWorkspace config user.email 'agentx-tests@example.invalid'
        & git -C $loopWorkspace config user.name 'AgentX Tests'
        Set-Content -LiteralPath (Join-Path $loopWorkspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
        Set-Content -LiteralPath (Join-Path $loopWorkspace 'README.md') -Value '# Loop Fixture' -Encoding utf8
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
        $reviewPath = New-StateFilePath $loopWorkspace 'code-quality-review.json'
        Write-Report $reviewPath $loopWorkspace $loopScope
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
        Write-Report $reviewPath $loopWorkspace $tamperedScope
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
        if ($script:docCheckerAvailable) {
            Assert-True ($complete.ExitCode -eq 0 -and $complete.Output -match 'Code-quality rubric passed at 100/100') 'Loop completion runs and passes the code-quality rubric automatically'
        } else {
            Assert-True ($complete.ExitCode -ne 0 -and $complete.Output -match 'Documentation drift checker is missing') 'Loop completion fails closed when the trusted documentation drift checker is absent'
        }
    } finally {
        Remove-Item -LiteralPath $loopWorkspace -Recurse -Force -ErrorAction SilentlyContinue
    }

    if ($script:docCheckerAvailable) {
        $loopBrokenDocWorkspace = New-TestWorkspace 'loop-broken-doc'
        New-Item -ItemType Directory -Path (Join-Path $loopBrokenDocWorkspace 'src') -Force | Out-Null
        try {
            & git -C $loopBrokenDocWorkspace init --quiet
            & git -C $loopBrokenDocWorkspace config user.email 'agentx-tests@example.invalid'
            & git -C $loopBrokenDocWorkspace config user.name 'AgentX Tests'
            Set-Content -LiteralPath (Join-Path $loopBrokenDocWorkspace 'src/app.ts') -Value 'export const value = 1;' -Encoding utf8
            Set-Content -LiteralPath (Join-Path $loopBrokenDocWorkspace 'README.md') -Value "# Broken Loop Fixture`n`n[Broken](docs/missing.md)" -Encoding utf8
            & git -C $loopBrokenDocWorkspace add .
            & git -C $loopBrokenDocWorkspace commit --quiet -m 'test: establish broken doc loop fixture'

            $brokenStart = Invoke-Agentx $loopBrokenDocWorkspace @('loop', 'start', '-p', 'Validate broken documentation drift', '-i', '421')
            Assert-True ($brokenStart.ExitCode -eq 0) 'Broken-doc loop fixture starts successfully'
            Add-Content -LiteralPath (Join-Path $loopBrokenDocWorkspace 'src/app.ts') -Value 'export const changed = true;' -Encoding utf8
            $brokenScopeResult = Invoke-Evaluator $loopBrokenDocWorkspace @('-Mode', 'Scope', '-WorkspaceRoot', $loopBrokenDocWorkspace, '-BaselinePath', (Join-Path $loopBrokenDocWorkspace '.agentx/state/code-quality-baseline.json'), '-Json')
            $brokenScope = $brokenScopeResult.Output | ConvertFrom-Json
            $brokenReviewPath = New-StateFilePath $loopBrokenDocWorkspace 'code-quality-review.json'
            $brokenDocReview = New-DocumentationReview -WorkspaceRoot $loopBrokenDocWorkspace -Status 'updated' -DocumentPaths @('README.md') -Rationale 'Updated README.md while reviewing documentation impact.'
            Write-Report $brokenReviewPath $loopBrokenDocWorkspace $brokenScope @{} $brokenDocReview
            $brokenIterate = Invoke-Agentx $loopBrokenDocWorkspace @(
                'loop', 'iterate', '-s', 'Subagent Review: documentation review recorded', '-e', $brokenReviewPath,
                '--verdict', 'approved', '--reviewer', 'code-quality-test-reviewer', '--high', '0', '--medium', '0'
            )
            Assert-True ($brokenIterate.ExitCode -eq 0) 'Broken-doc review evidence is accepted before final validation'
            $brokenFinalEvidence = Join-Path $loopBrokenDocWorkspace 'final-gate.txt'
            Set-Content -LiteralPath $brokenFinalEvidence -Value 'final gate evidence' -Encoding utf8
            $brokenComplete = Invoke-Agentx $loopBrokenDocWorkspace @('loop', 'complete', '-s', 'Broken doc links should fail', '-e', $brokenFinalEvidence)
            Assert-True ($brokenComplete.ExitCode -ne 0 -and $brokenComplete.Output -match 'Documentation drift checker failed|broken|reference|link|missing') 'Loop completion calls the documentation drift validator and rejects broken reviewed doc links'
        } finally {
            Remove-Item -LiteralPath $loopBrokenDocWorkspace -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host '[INFO] Broken-doc loop-complete validator case skipped; checker unavailable.'
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
