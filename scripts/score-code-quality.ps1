#!/usr/bin/env pwsh
#Requires -Version 7.0

[CmdletBinding()]
param(
    [ValidateSet('Snapshot', 'Scope', 'Validate')]
    [string]$Mode = 'Validate',
    [string]$WorkspaceRoot = '',
    [string]$BaselinePath = '',
    [string]$BaselineSha256 = '',
    [string]$ReportPath = '',
    [ValidateRange(0, 100)]
    [int]$MinScore = 80,
    [switch]$IncludeExistingChanges,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = if ($WorkspaceRoot) {
    (Resolve-Path -LiteralPath $WorkspaceRoot -ErrorAction Stop).Path
} else {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
if (-not $BaselinePath) {
    $BaselinePath = Join-Path $root '.agentx/state/code-quality-baseline.json'
}

$rubricVersion = '2.0.0'
$dimensions = @(
    [PSCustomObject]@{ id = 'requirements-fit'; weight = 15; blocking = $true; floor = 3 },
    [PSCustomObject]@{ id = 'design-conformance'; weight = 10; blocking = $true; floor = 3 },
    [PSCustomObject]@{ id = 'logic-correctness'; weight = 15; blocking = $true; floor = 3 },
    [PSCustomObject]@{ id = 'verification-tests'; weight = 15; blocking = $true; floor = 3 },
    [PSCustomObject]@{ id = 'security-privacy'; weight = 10; blocking = $true; floor = 3 },
    [PSCustomObject]@{ id = 'reliability-errors'; weight = 10; blocking = $true; floor = 3 },
    [PSCustomObject]@{ id = 'maintainability-readability'; weight = 10; blocking = $false; floor = 2 },
    [PSCustomObject]@{ id = 'simplicity-scope'; weight = 5; blocking = $false; floor = 2 },
    [PSCustomObject]@{ id = 'performance-resources'; weight = 5; blocking = $false; floor = 2 },
    [PSCustomObject]@{ id = 'documentation-operability'; weight = 5; blocking = $false; floor = 2 }
)
$implementationExtensions = @(
    '.c', '.cpp', '.cs', '.go', '.h', '.java', '.js', '.jsx', '.kt', '.m',
    '.ps1', '.psm1', '.py', '.rb', '.rs', '.sh', '.sql', '.swift', '.tf',
    '.ts', '.tsx', '.bicep'
)

function Write-Result($Result, [int]$ExitCode = 0) {
    if ($Json) {
        [Console]::Out.WriteLine(($Result | ConvertTo-Json -Depth 12 -Compress))
    } else {
        $marker = if ($ExitCode -eq 0) { '[PASS]' } else { '[FAIL]' }
        Write-Host "$marker $($Result.message)"
        if ($Result.PSObject.Properties.Name -contains 'score' -and $null -ne $Result.score) {
            Write-Host "Score: $($Result.score)/100"
        }
    }
    exit $ExitCode
}

function Get-ObjectValue($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

function Get-NormalizedPath([string]$Path) {
    $normalized = $Path.Trim().Replace('\', '/')
    while ($normalized.StartsWith('./', [StringComparison]::Ordinal)) {
        $normalized = $normalized.Substring(2)
    }
    return $normalized.TrimStart('/')
}

function Test-ImplementationPath([string]$Path) {
    $normalized = Get-NormalizedPath $Path
    if ([IO.Path]::GetExtension($normalized).ToLowerInvariant() -notin $implementationExtensions) { return $false }
    if ($normalized -match '(^|/)(\.git|build|coverage|dist|node_modules|out|tests?|__tests__|vendor)(/|$)') { return $false }
    if ($normalized -match '(^|/)vscode-extension/\.github/agentx(/|$)') { return $false }
    if ($normalized -match '(?i)(\.test|\.spec)\.[^.]+$') { return $false }
    return $true
}

function Test-GitWorkspaceRoot {
    $inside = @(& git -C $root rev-parse --is-inside-work-tree 2>$null)
    if ($LASTEXITCODE -ne 0 -or $inside.Count -eq 0 -or [string]$inside[0] -ne 'true') { return $false }
    $topLevel = @(& git -C $root rev-parse --show-toplevel 2>$null)
    if ($topLevel.Count -eq 0) { return $false }
    return ([IO.Path]::GetFullPath([string]$topLevel[0]).TrimEnd('\', '/')).Equals(
        [IO.Path]::GetFullPath($root).TrimEnd('\', '/'),
        [StringComparison]::OrdinalIgnoreCase)
}

function Get-ChangedImplementationFiles {
    $isGitWorkspace = Test-GitWorkspaceRoot
    if (-not $isGitWorkspace) {
        $excludedDirectories = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($name in @('.git', 'build', 'coverage', 'dist', 'node_modules', 'out', 'test', 'tests', '__tests__', 'vendor')) {
            [void]$excludedDirectories.Add($name)
        }
        $pending = [Collections.Generic.Stack[string]]::new()
        $pending.Push($root)
        $paths = [Collections.Generic.List[string]]::new()
        while ($pending.Count -gt 0) {
            $directory = $pending.Pop()
            foreach ($file in @(Get-ChildItem -LiteralPath $directory -File -ErrorAction SilentlyContinue)) {
                $relativePath = Get-NormalizedPath $file.FullName.Substring($root.Length)
                if (Test-ImplementationPath $relativePath) { $paths.Add($relativePath) }
            }
            foreach ($child in @(Get-ChildItem -LiteralPath $directory -Directory -ErrorAction SilentlyContinue)) {
                if ($excludedDirectories.Contains($child.Name)) { continue }
                if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                $pending.Push($child.FullName)
            }
        }
        return @($paths | Sort-Object -Unique | ForEach-Object {
            $relativePath = $_
            $fullPath = Join-Path $root $relativePath
            [PSCustomObject]@{
                path = $relativePath
                sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToUpperInvariant()
            }
        })
    }

    $paths = @(
        & git -C $root diff --name-only 2>$null
        & git -C $root diff --cached --name-only 2>$null
        & git -C $root ls-files --others --exclude-standard 2>$null
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { Get-NormalizedPath ([string]$_) } |
        Where-Object { Test-ImplementationPath $_ } |
        Sort-Object -Unique

    return @($paths | ForEach-Object {
        $relativePath = $_
        $fullPath = Join-Path $root $relativePath
        $hash = if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToUpperInvariant()
        } else {
            'DELETED'
        }
        [PSCustomObject]@{ path = $relativePath; sha256 = $hash }
    })
}

function Read-Baseline {
    if (-not (Test-Path -LiteralPath $BaselinePath -PathType Leaf)) { return $null }
    try { return Get-Content -LiteralPath $BaselinePath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20 }
    catch { return $null }
}

function Get-ActiveScope {
    $current = @(Get-ChangedImplementationFiles)
    $baseline = Read-Baseline
    if (-not $baseline) { return $current }

    $baselineByPath = @{}
    foreach ($file in @(Get-ObjectValue $baseline 'files')) {
        $path = [string](Get-ObjectValue $file 'path')
        if ($path) { $baselineByPath[(Get-NormalizedPath $path)] = [string](Get-ObjectValue $file 'sha256') }
    }
    $changed = @($current | Where-Object {
        -not $baselineByPath.ContainsKey($_.path) -or $baselineByPath[$_.path] -cne $_.sha256
    })
    if ([string](Get-ObjectValue $baseline 'tracking') -eq 'workspace') {
        $currentPaths = @($current | ForEach-Object { $_.path })
        $deleted = @($baselineByPath.Keys | Where-Object { $_ -notin $currentPaths } | ForEach-Object {
            [PSCustomObject]@{ path = $_; sha256 = 'DELETED' }
        })
        $changed = @($changed + $deleted | Sort-Object path -Unique)
    }
    return $changed
}

if ($Mode -eq 'Snapshot') {
    $parent = Split-Path $BaselinePath -Parent
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $snapshot = [ordered]@{
        version = 1
        capturedAt = [datetimeoffset]::UtcNow.ToString('o')
        tracking = if (Test-GitWorkspaceRoot) { 'git' } else { 'workspace' }
        files = if ($IncludeExistingChanges) { @() } else { @(Get-ChangedImplementationFiles) }
    }
    $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $BaselinePath -Encoding utf8
    $snapshotHash = (Get-FileHash -LiteralPath $BaselinePath -Algorithm SHA256).Hash.ToUpperInvariant()
    Write-Result ([PSCustomObject]@{ status = 'snapshotted'; message = 'Code-quality baseline captured.'; baselineSha256 = $snapshotHash; files = @($snapshot.files) })
}

if ($BaselineSha256) {
    $actualBaselineHash = if (Test-Path -LiteralPath $BaselinePath -PathType Leaf) {
        (Get-FileHash -LiteralPath $BaselinePath -Algorithm SHA256).Hash.ToUpperInvariant()
    } else { '' }
    if ($actualBaselineHash -cne $BaselineSha256.ToUpperInvariant()) {
        Write-Result ([PSCustomObject]@{ status = 'failed'; message = 'Code-quality baseline SHA-256 does not match the trusted loop digest.'; files = @() }) 1
    }
}

$scope = @(Get-ActiveScope)
if ($Mode -eq 'Scope') {
    Write-Result ([PSCustomObject]@{ status = 'scoped'; message = "Found $($scope.Count) changed implementation file(s)."; files = $scope })
}

if ($scope.Count -eq 0) {
    Write-Result ([PSCustomObject]@{ status = 'skipped'; message = 'No implementation code changed after the quality-loop baseline.'; score = $null; files = @() })
}
if (-not $ReportPath -or -not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
    Write-Result ([PSCustomObject]@{ status = 'failed'; message = 'Changed implementation code requires a code-quality rubric report.'; files = $scope }) 1
}

try { $report = Get-Content -LiteralPath $ReportPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 30 -ErrorAction Stop }
catch { Write-Result ([PSCustomObject]@{ status = 'failed'; message = "Code-quality report is not valid JSON: $_"; files = $scope }) 1 }

$failures = [System.Collections.Generic.List[string]]::new()
if ([string](Get-ObjectValue $report 'rubricVersion') -cne $rubricVersion) {
    $failures.Add("rubricVersion must be $rubricVersion.")
}
if ([string]::IsNullOrWhiteSpace([string](Get-ObjectValue $report 'reviewer'))) {
    $failures.Add('reviewer is required.')
}

$reviewedAt = [datetimeoffset]::MinValue
if (-not [datetimeoffset]::TryParse([string](Get-ObjectValue $report 'reviewedAt'), [ref]$reviewedAt)) {
    $failures.Add('reviewedAt must be a valid timestamp.')
}
$baseline = Read-Baseline
if ($baseline) {
    $capturedAt = [datetimeoffset]::MinValue
    if ([datetimeoffset]::TryParse([string](Get-ObjectValue $baseline 'capturedAt'), [ref]$capturedAt) -and $reviewedAt -lt $capturedAt) {
        $failures.Add('reviewedAt predates the quality-loop baseline.')
    }
}

$reportFiles = @((Get-ObjectValue $report 'files'))
$reportByPath = @{}
foreach ($file in $reportFiles) {
    $path = Get-NormalizedPath ([string](Get-ObjectValue $file 'path'))
    $hash = [string](Get-ObjectValue $file 'sha256')
    if (-not $path -or $reportByPath.ContainsKey($path)) {
        $failures.Add("Report file paths must be non-empty and unique: '$path'.")
        continue
    }
    $reportByPath[$path] = $hash
}
if ($reportByPath.Count -ne $scope.Count) {
    $failures.Add("Report scope contains $($reportByPath.Count) file(s); current scope contains $($scope.Count).")
}
foreach ($file in $scope) {
    if (-not $reportByPath.ContainsKey($file.path)) {
        $failures.Add("Report scope is missing '$($file.path)'.")
    } elseif ($reportByPath[$file.path] -cne $file.sha256) {
        $failures.Add("SHA-256 hash for '$($file.path)' does not match the current implementation.")
    }
}

$reportedDimensions = @((Get-ObjectValue $report 'dimensions'))
$reportedById = @{}
$weightedScore = 0.0
$blockingFailures = [System.Collections.Generic.List[string]]::new()
foreach ($reported in $reportedDimensions) {
    $id = [string](Get-ObjectValue $reported 'id')
    if (-not $id -or $reportedById.ContainsKey($id)) {
        $failures.Add("Dimension IDs must be non-empty and unique: '$id'.")
        continue
    }
    $reportedById[$id] = $reported
}
foreach ($dimension in $dimensions) {
    if (-not $reportedById.ContainsKey($dimension.id)) {
        $failures.Add("Missing dimension '$($dimension.id)'.")
        continue
    }
    $entry = $reportedById[$dimension.id]
    $rawScore = Get-ObjectValue $entry 'score'
    $score = 0
    if ($null -eq $rawScore -or $rawScore -is [string] -or
        -not [int]::TryParse([string]$rawScore, [ref]$score) -or $score -lt 0 -or $score -gt 4) {
        $failures.Add("Dimension '$($dimension.id)' score must be an integer from 0 to 4.")
        continue
    }
    if ([string]::IsNullOrWhiteSpace([string](Get-ObjectValue $entry 'evidence'))) {
        $failures.Add("Dimension '$($dimension.id)' requires evidence.")
    }
    if ($entry.PSObject.Properties.Name -notcontains 'findings') {
        $failures.Add("Dimension '$($dimension.id)' requires a findings array.")
    } else {
        foreach ($finding in @($entry.findings)) {
            $severity = ([string](Get-ObjectValue $finding 'severity')).ToLowerInvariant()
            if ($severity -notin @('high', 'medium', 'low')) {
                $failures.Add("Dimension '$($dimension.id)' finding severity must be high, medium, or low.")
                continue
            }
            foreach ($field in @('file', 'issue', 'suggestedFix')) {
                if ([string]::IsNullOrWhiteSpace([string](Get-ObjectValue $finding $field))) {
                    $failures.Add("Dimension '$($dimension.id)' finding requires '$field'.")
                }
            }
            if ($severity -in @('high', 'medium')) {
                $blockingFailures.Add("$($severity.ToUpperInvariant()) finding remains in $($dimension.id)")
            }
        }
    }
    if ($dimension.blocking -and $score -lt $dimension.floor) {
        $blockingFailures.Add("$($dimension.id) scored $score below blocking floor $($dimension.floor)")
    }
    $weightedScore += $dimension.weight * ($score / 4.0)
}
foreach ($reportedId in $reportedById.Keys) {
    if ($reportedId -notin @($dimensions.id)) { $failures.Add("Unknown dimension '$reportedId'.") }
}

$scoreResult = [int][Math]::Round($weightedScore, 0, [MidpointRounding]::AwayFromZero)
if ($blockingFailures.Count -gt 0) { foreach ($failure in $blockingFailures) { $failures.Add($failure) } }
if ($scoreResult -lt $MinScore) { $failures.Add("Weighted score $scoreResult is below required minimum $MinScore.") }

if ($failures.Count -gt 0) {
    Write-Result ([PSCustomObject]@{
        status = 'failed'
        message = ($failures -join ' ')
        score = $scoreResult
        minimum = $MinScore
        files = $scope
        failures = @($failures)
    }) 1
}

Write-Result ([PSCustomObject]@{
    status = 'passed'
    message = "Code-quality rubric passed at $scoreResult/100."
    score = $scoreResult
    minimum = $MinScore
    files = $scope
    dimensions = $reportedDimensions
})