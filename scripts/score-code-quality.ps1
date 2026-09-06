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

$rubricVersion = '2.1.0'
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
$configurationExtensions = @('.json', '.yaml', '.yml', '.toml')
$documentationExtensions = @('.md', '.mdx', '.rst', '.txt')
$maxReviewedAtClockSkew = [TimeSpan]::FromMinutes(5)
$placeholderEvidenceValues = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$placeholderRationaleValues = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$lockArtifactNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$convertFromJsonSupportsDateKind = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')
$rootFull = [IO.Path]::GetFullPath($root).TrimEnd('\', '/')
foreach ($placeholderEvidenceValue in @('todo', 'tbd', 'untested', 'no evidence')) {
    [void]$placeholderEvidenceValues.Add($placeholderEvidenceValue)
}
foreach ($placeholderRationaleValue in @('todo', 'tbd', 'n/a', 'na', 'none', 'no impact', 'no-impact', 'reviewed', 'same', 'unchanged')) {
    [void]$placeholderRationaleValues.Add($placeholderRationaleValue)
}
foreach ($lockArtifactName in @(
    'package-lock.json', 'packages.lock.json', 'pnpm-lock.yaml', 'pnpm-lock.yml',
    'yarn.lock', 'bun.lock', 'bun.lockb', 'cargo.lock', 'composer.lock',
    'gemfile.lock', 'pipfile.lock', 'poetry.lock', 'uv.lock'
)) {
    [void]$lockArtifactNames.Add($lockArtifactName)
}

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
    if ($property) { return ,$property.Value }
    return $null
}

function Test-JsonArray($Value) {
    return $Value -is [System.Array]
}

function Test-NonEmptyString($Value) {
    return $Value -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$Value)
}

function Test-NonEmptyTimestampValue($Value) {
    return (Test-NonEmptyString $Value) -or $Value -is [datetime] -or $Value -is [datetimeoffset]
}

function Test-PlaceholderEvidence($Value) {
    if (-not (Test-NonEmptyString $Value)) { return $false }
    return $placeholderEvidenceValues.Contains(([string]$Value).Trim())
}

function Test-PlaceholderRationale($Value) {
    if (-not (Test-NonEmptyString $Value)) { return $false }
    return $placeholderRationaleValues.Contains(([string]$Value).Trim())
}

function ConvertFrom-JsonObject([string]$Content, [int]$Depth, [switch]$StopOnError) {
    if ($convertFromJsonSupportsDateKind) {
        if ($StopOnError) {
            return $Content | ConvertFrom-Json -Depth $Depth -NoEnumerate -DateKind String -ErrorAction Stop
        }
        return $Content | ConvertFrom-Json -Depth $Depth -NoEnumerate -DateKind String
    }
    if ($StopOnError) {
        return $Content | ConvertFrom-Json -Depth $Depth -NoEnumerate -ErrorAction Stop
    }
    return $Content | ConvertFrom-Json -Depth $Depth -NoEnumerate
}

function Get-NormalizedPath([string]$Path) {
    $normalized = $Path.Trim().Replace('\', '/')
    while ($normalized.StartsWith('./', [StringComparison]::Ordinal)) {
        $normalized = $normalized.Substring(2)
    }
    return $normalized.TrimStart('/')
}

function Get-UpperSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Test-WorkspaceContainment {
    param(
        [string]$ResolvedPath,
        [string]$WorkspaceRootFull
    )

    $relative = [IO.Path]::GetRelativePath($WorkspaceRootFull, $ResolvedPath)
    if ($relative -eq '..' -or
        $relative.StartsWith('..' + [IO.Path]::DirectorySeparatorChar) -or
        [IO.Path]::IsPathRooted($relative)) {
        return [PSCustomObject]@{ allowed = $false; reason = 'Path is outside the workspace root.' }
    }

    return [PSCustomObject]@{ allowed = $true; reason = '' }
}

function Test-WorkspaceLinkChain {
    param(
        [string]$ResolvedPath,
        [string]$WorkspaceRootFull
    )

    $relative = [IO.Path]::GetRelativePath($WorkspaceRootFull, $ResolvedPath)
    if ($relative -eq '.') {
        return [PSCustomObject]@{ allowed = $true; reason = '' }
    }

    $current = $WorkspaceRootFull
    $rebased = $false
    foreach ($segment in @(($relative -replace '\\', '/') -split '/' | Where-Object { $_ -and $_ -ne '.' })) {
        $parent = $current
        $current = Join-Path $parent $segment
        $item = $null
        try { $item = Get-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue } catch { $item = $null }
        if (-not $item) { continue }

        $target = $null
        try {
            $resolvedLink = $item.ResolveLinkTarget($true)
            if ($resolvedLink) { $target = $resolvedLink.FullName }
        } catch {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                return [PSCustomObject]@{ allowed = $false; reason = 'Documentation link target could not be verified.' }
            }
            $target = $null
        }
        if (-not $target) { continue }

        $targetFull = [IO.Path]::GetFullPath($target)
        $targetContainment = Test-WorkspaceContainment -ResolvedPath $targetFull -WorkspaceRootFull $WorkspaceRootFull
        if (-not $targetContainment.allowed) {
            return [PSCustomObject]@{ allowed = $false; reason = 'Path resolves through a link to outside the workspace root.' }
        }

        $current = $targetFull
        $rebased = $true
    }

    if ($rebased) {
        $rebasedContainment = Test-WorkspaceContainment -ResolvedPath $current -WorkspaceRootFull $WorkspaceRootFull
        if (-not $rebasedContainment.allowed) {
            return [PSCustomObject]@{ allowed = $false; reason = $rebasedContainment.reason }
        }
    }

    return [PSCustomObject]@{ allowed = $true; reason = '' }
}

function Resolve-WorkspaceRelativeLeafPath {
    param(
        [string]$Path,
        [string]$Kind,
        [switch]$RequireDocumentationFile
    )

    if (-not (Test-NonEmptyString $Path)) {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path must be a non-empty string."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    $candidate = [string]$Path
    if ($candidate -match '[*?]' -or $candidate -match '\[[^\]]*\]') {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path must not contain wildcard characters."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    $streamProbe = if ($candidate -match '^[A-Za-z]:') { $candidate.Substring(2) } else { $candidate }
    if ($streamProbe.Contains(':')) {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path must not use alternate data stream or colon syntax."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    if ([IO.Path]::IsPathRooted($candidate)) {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path must be workspace-relative."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    if ($candidate -match '(^|[\\/])\.\.([\\/]|$)') {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path must not contain traversal segments."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    $resolvedPath = $null
    try {
        $resolvedPath = [IO.Path]::GetFullPath((Join-Path $rootFull $candidate))
    } catch {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path could not be resolved."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    $containment = Test-WorkspaceContainment -ResolvedPath $resolvedPath -WorkspaceRootFull $rootFull
    if (-not $containment.allowed) {
        return [PSCustomObject]@{
            allowed = $false
            reason = $containment.reason
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    $linkCheck = Test-WorkspaceLinkChain -ResolvedPath $resolvedPath -WorkspaceRootFull $rootFull
    if (-not $linkCheck.allowed) {
        return [PSCustomObject]@{
            allowed = $false
            reason = $linkCheck.reason
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path does not exist."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    if ($RequireDocumentationFile -and [IO.Path]::GetExtension($resolvedPath).ToLowerInvariant() -notin $documentationExtensions) {
        return [PSCustomObject]@{
            allowed = $false
            reason = "$Kind path must reference an existing documentation file."
            normalizedPath = $null
            resolvedPath = $null
        }
    }

    $normalizedPath = Get-NormalizedPath ([IO.Path]::GetRelativePath($rootFull, $resolvedPath))
    return [PSCustomObject]@{
        allowed = $true
        reason = ''
        normalizedPath = $normalizedPath
        resolvedPath = $resolvedPath
    }
}

function Get-WorkspaceRelativePathIfContained([string]$Path) {
    if (-not (Test-NonEmptyString $Path)) { return $null }

    $absolutePath = $null
    try {
        $absolutePath = if ([IO.Path]::IsPathRooted($Path)) {
            [IO.Path]::GetFullPath($Path)
        } else {
            [IO.Path]::GetFullPath((Join-Path $rootFull $Path))
        }
    } catch {
        return $null
    }

    $containment = Test-WorkspaceContainment -ResolvedPath $absolutePath -WorkspaceRootFull $rootFull
    if (-not $containment.allowed) { return $null }

    return (Get-NormalizedPath ([IO.Path]::GetRelativePath($rootFull, $absolutePath)))
}

$selfExcludedPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($pathToExclude in @($BaselinePath, $ReportPath)) {
    $relativePath = Get-WorkspaceRelativePathIfContained $pathToExclude
    if ($relativePath) {
        [void]$selfExcludedPaths.Add($relativePath)
    }
}

function Test-ExcludedTraversalDirectory([string]$Path) {
    $normalized = Get-NormalizedPath $Path
    if (-not $normalized) { return $false }
    $lower = $normalized.ToLowerInvariant()
    return ($lower -match '(^|/)(\.git|build|coverage|dist|node_modules|out|test|tests|__tests__|vendor)(/|$)' -or
        $lower -match '(^|/)\.agentx/(state|sessions|issues|digests|memory|handoffs|logs)(/|$)' -or
        $lower -match '(^|/)docs/artifacts(/|$)' -or
        $lower -match '(^|/)docs/execution/(task-bundles|bounded-parallel)(/|$)' -or
        $lower -match '(^|/)vscode-extension/\.github(/|$)')
}

function Test-ImplementationPath([string]$Path) {
    $normalized = Get-NormalizedPath $Path
    if (-not $normalized) { return $false }
    if ($selfExcludedPaths.Contains($normalized)) { return $false }

    $lower = $normalized.ToLowerInvariant()
    if (Test-ExcludedTraversalDirectory $normalized) { return $false }
    if ($lower -eq '.agentx/install-manifest.json') { return $false }
    if ($lower -in @(
        '.agentx/plugins/registry.json',
        '.agentx/skills-registry.json',
        '.agentx/templates-registry.json',
        '.agentx/skills.registry.json',
        '.agentx/templates.registry.json',
        '.github/registries/skills.json',
        '.github/registries/templates.json'
    )) { return $false }
    if ($lower -match '(?i)(\.test|\.spec)\.[^.]+$') { return $false }

    $leaf = [IO.Path]::GetFileName($normalized)
    if ($lockArtifactNames.Contains($leaf)) { return $false }

    $extension = [IO.Path]::GetExtension($normalized).ToLowerInvariant()
    $isDockerfile = $leaf.Equals('Dockerfile', [StringComparison]::OrdinalIgnoreCase)
    return ($extension -in $implementationExtensions) -or ($extension -in $configurationExtensions) -or $isDockerfile
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
                if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                $childRelativePath = Get-NormalizedPath $child.FullName.Substring($root.Length)
                if (Test-ExcludedTraversalDirectory $childRelativePath) { continue }
                $pending.Push($child.FullName)
            }
        }
        return @($paths | Sort-Object -Unique | ForEach-Object {
            $relativePath = $_
            $fullPath = Join-Path $root $relativePath
            [PSCustomObject]@{
                path = $relativePath
                sha256 = Get-UpperSha256 $fullPath
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
            Get-UpperSha256 $fullPath
        } else {
            'DELETED'
        }
        [PSCustomObject]@{ path = $relativePath; sha256 = $hash }
    })
}

function Read-Baseline {
    if (-not (Test-Path -LiteralPath $BaselinePath -PathType Leaf)) { return $null }
    try { return ConvertFrom-JsonObject -Content (Get-Content -LiteralPath $BaselinePath -Raw -Encoding utf8) -Depth 20 }
    catch { return $null }
}

function Get-ActiveScope {
    $current = @(Get-ChangedImplementationFiles)
    $baseline = Read-Baseline
    if (-not $baseline) { return $current }

    $baselineByPath = @{}
    foreach ($file in @($baseline.files)) {
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

function Test-WorkspaceHasReviewableDocumentation {
    foreach ($rootDoc in @(Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '(?i)^readme(?:[.-].+)?\.md$'
    })) {
        return $true
    }

    $docsRoot = Join-Path $root 'docs'
    if (-not (Test-Path -LiteralPath $docsRoot -PathType Container)) { return $false }
    return @(Get-ChildItem -LiteralPath $docsRoot -File -Recurse -Filter '*.md' -ErrorAction SilentlyContinue | Where-Object {
        ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0
    }).Count -gt 0
}

function Get-DocumentationReviewValidationFailures($DocumentationReview) {
    $failures = [System.Collections.Generic.List[string]]::new()
    if ($DocumentationReview -isnot [pscustomobject]) {
        $failures.Add('documentationReview must be a JSON object.')
        return [PSCustomObject]@{ failures = @($failures); review = $null }
    }

    $rawStatus = Get-ObjectValue $DocumentationReview 'status'
    $status = [string]$rawStatus
    if (-not (Test-NonEmptyString $rawStatus) -or $status -notin @('updated', 'no-impact')) {
        $failures.Add("documentationReview.status must be 'updated' or 'no-impact'.")
    }

    $rationale = Get-ObjectValue $DocumentationReview 'rationale'
    if (-not (Test-NonEmptyString $rationale)) {
        $failures.Add('documentationReview.rationale must be a non-empty string.')
    } elseif (Test-PlaceholderRationale $rationale) {
        $failures.Add('documentationReview.rationale must be a substantive non-placeholder string.')
    }

    $documentsValue = $null
    if ($DocumentationReview.PSObject.Properties['documents']) { $documentsValue = $DocumentationReview.documents }
    if (-not (Test-JsonArray $documentsValue)) {
        $failures.Add('documentationReview.documents must be a JSON array.')
        return [PSCustomObject]@{ failures = @($failures); review = $DocumentationReview }
    }

    $documentPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($document in @($documentsValue)) {
        if (-not (Test-NonEmptyString (Get-ObjectValue $document 'path'))) {
            $failures.Add("Each documentationReview.documents entry requires 'path' as a non-empty string.")
            continue
        }

        $rawPath = [string](Get-ObjectValue $document 'path')
        $resolvedDocument = Resolve-WorkspaceRelativeLeafPath -Path $rawPath -Kind 'documentationReview.documents' -RequireDocumentationFile
        if (-not $resolvedDocument.allowed) {
            $failures.Add("documentationReview document '$rawPath' is invalid: $($resolvedDocument.reason)")
            continue
        }

        if (-not $documentPaths.Add($resolvedDocument.normalizedPath)) {
            $failures.Add("documentationReview documents must use unique contained paths: '$($resolvedDocument.normalizedPath)'.")
            continue
        }

        $documentHash = Get-ObjectValue $document 'sha256'
        if (-not (Test-NonEmptyString $documentHash)) {
            $failures.Add("documentationReview document '$($resolvedDocument.normalizedPath)' requires 'sha256' as a non-empty string.")
            continue
        }

        $actualDocumentHash = Get-UpperSha256 $resolvedDocument.resolvedPath
        if ([string]$documentHash -cne $actualDocumentHash) {
            $failures.Add("documentationReview document '$($resolvedDocument.normalizedPath)' SHA-256 does not match the current file.")
        }
    }

    if ($status -eq 'updated' -and $documentPaths.Count -lt 1) {
        $failures.Add("documentationReview.status 'updated' requires at least one reviewed document.")
    }
    if ($status -eq 'no-impact' -and $documentPaths.Count -lt 1 -and (Test-WorkspaceHasReviewableDocumentation)) {
        $failures.Add("documentationReview.status 'no-impact' requires reviewed documents when root README/docs Markdown exists.")
    }

    return [PSCustomObject]@{ failures = @($failures); review = $DocumentationReview }
}

function Invoke-DocumentationDriftChecker {
    $checkerPath = Join-Path $PSScriptRoot 'check-doc-drift.ps1'
    if (-not (Test-Path -LiteralPath $checkerPath -PathType Leaf)) {
        return [PSCustomObject]@{
            passed = $false
            message = 'Documentation drift checker is missing from the trusted evaluator directory.'
        }
    }

    $output = @(& pwsh -NoProfile -File $checkerPath -WorkspaceRoot $root -Json 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        try {
            $result = ConvertFrom-JsonObject -Content ($output -join "`n") -Depth 20 -StopOnError
            if ((Get-ObjectValue $result 'status') -ceq 'passed' -and
                (Get-ObjectValue $result 'semanticReviewRequired') -eq $true) {
                return [PSCustomObject]@{ passed = $true; message = '' }
            }
        } catch {
            return [PSCustomObject]@{ passed = $false; message = 'Documentation checker returned invalid JSON despite exit 0.' }
        }
        return [PSCustomObject]@{ passed = $false; message = 'Documentation checker did not confirm a complete structural check.' }
    }

    $message = @($output | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ' '
    if (-not $message) {
        $message = "Documentation drift checker failed with exit code $exitCode."
    }

    $parsed = $null
    foreach ($line in @($output)) {
        try {
            $candidate = ConvertFrom-JsonObject -Content ([string]$line) -Depth 20 -StopOnError
            if ($candidate -and $candidate.PSObject.Properties['message']) { $parsed = $candidate }
        } catch { continue }
    }
    if ($parsed -and (Test-NonEmptyString (Get-ObjectValue $parsed 'message'))) {
        $message = "Documentation drift checker failed: $([string](Get-ObjectValue $parsed 'message'))"
    }

    return [PSCustomObject]@{
        passed = $false
        message = $message
    }
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
    $snapshotHash = Get-UpperSha256 $BaselinePath
    Write-Result ([PSCustomObject]@{
        status = 'snapshotted'
        message = 'Code-quality baseline captured.'
        baselineSha256 = $snapshotHash
        files = @($snapshot.files)
    })
}

if ($BaselineSha256) {
    $actualBaselineHash = if (Test-Path -LiteralPath $BaselinePath -PathType Leaf) {
        Get-UpperSha256 $BaselinePath
    } else { '' }
    if ($actualBaselineHash -cne $BaselineSha256.ToUpperInvariant()) {
        Write-Result ([PSCustomObject]@{
            status = 'failed'
            message = 'Code-quality baseline SHA-256 does not match the trusted loop digest.'
            files = @()
        }) 1
    }
}

$scope = @(Get-ActiveScope)
if ($Mode -eq 'Scope') {
    Write-Result ([PSCustomObject]@{
        status = 'scoped'
        message = "Found $($scope.Count) changed implementation file(s)."
        files = $scope
    })
}

if ($scope.Count -eq 0) {
    Write-Result ([PSCustomObject]@{
        status = 'skipped'
        message = 'No implementation files changed after the quality-loop baseline.'
        score = $null
        files = @()
    })
}
if (-not $ReportPath -or -not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
    Write-Result ([PSCustomObject]@{
        status = 'failed'
        message = 'Changed implementation files require a code-quality rubric report.'
        files = $scope
    }) 1
}

try { $report = ConvertFrom-JsonObject -Content (Get-Content -LiteralPath $ReportPath -Raw -Encoding utf8) -Depth 30 -StopOnError }
catch { Write-Result ([PSCustomObject]@{ status = 'failed'; message = "Code-quality report is not valid JSON: $_"; files = $scope }) 1 }
if ($report -isnot [pscustomobject]) {
    Write-Result ([PSCustomObject]@{ status = 'failed'; message = 'Code-quality report must be a JSON object.'; files = $scope }) 1
}

$failures = [System.Collections.Generic.List[string]]::new()
if (-not (Test-NonEmptyString (Get-ObjectValue $report 'rubricVersion')) -or [string](Get-ObjectValue $report 'rubricVersion') -cne $rubricVersion) {
    $failures.Add("rubricVersion must be $rubricVersion.")
}
if (-not (Test-NonEmptyString (Get-ObjectValue $report 'reviewer'))) {
    $failures.Add('reviewer must be a non-empty string.')
}

$documentationReviewValidation = Get-DocumentationReviewValidationFailures (Get-ObjectValue $report 'documentationReview')
foreach ($documentationReviewFailure in @($documentationReviewValidation.failures)) {
    $failures.Add([string]$documentationReviewFailure)
}

$reviewedAt = [datetimeoffset]::MinValue
if (-not (Test-NonEmptyTimestampValue (Get-ObjectValue $report 'reviewedAt')) -or
    -not [datetimeoffset]::TryParse([string](Get-ObjectValue $report 'reviewedAt'), [ref]$reviewedAt)) {
    $failures.Add('reviewedAt must be a valid timestamp string.')
} elseif ($reviewedAt -gt [datetimeoffset]::UtcNow.Add($maxReviewedAtClockSkew)) {
    $failures.Add("reviewedAt cannot be more than $([int]$maxReviewedAtClockSkew.TotalMinutes) minutes in the future.")
}
$baseline = Read-Baseline
if ($baseline -and $reviewedAt -ne [datetimeoffset]::MinValue) {
    $capturedAt = [datetimeoffset]::MinValue
    if ([datetimeoffset]::TryParse([string](Get-ObjectValue $baseline 'capturedAt'), [ref]$capturedAt) -and $reviewedAt -lt $capturedAt) {
        $failures.Add('reviewedAt predates the quality-loop baseline.')
    }
}

$reportFiles = @()
$reportByPath = @{}
$reportFilesValue = $null
if ($report.PSObject.Properties['files']) { $reportFilesValue = $report.files }
if (-not (Test-JsonArray $reportFilesValue)) {
    $failures.Add('files must be a JSON array.')
} else {
    $reportFiles = @($reportFilesValue)
    foreach ($file in $reportFiles) {
        if (-not (Test-NonEmptyString (Get-ObjectValue $file 'path'))) {
            $failures.Add("Each report file entry requires 'path' as a non-empty string.")
            continue
        }
        $path = Get-NormalizedPath ([string](Get-ObjectValue $file 'path'))
        if (-not $path -or $reportByPath.ContainsKey($path)) {
            $failures.Add("Report file paths must be non-empty and unique: '$path'.")
            continue
        }
        if (-not (Test-NonEmptyString (Get-ObjectValue $file 'sha256'))) {
            $failures.Add("Report file '$path' requires 'sha256' as a non-empty string.")
            continue
        }
        $hash = [string](Get-ObjectValue $file 'sha256')
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
}

$reportedDimensions = @()
$reportedById = @{}
$weightedScore = 0.0
$blockingFailures = [System.Collections.Generic.List[string]]::new()
$reportedDimensionsValue = $null
if ($report.PSObject.Properties['dimensions']) { $reportedDimensionsValue = $report.dimensions }
if (-not (Test-JsonArray $reportedDimensionsValue)) {
    $failures.Add('dimensions must be a JSON array.')
} else {
    $reportedDimensions = @($reportedDimensionsValue)
    foreach ($reported in $reportedDimensions) {
        if (-not (Test-NonEmptyString (Get-ObjectValue $reported 'id'))) {
            $failures.Add("Dimension IDs must be non-empty strings and unique: ''.")
            continue
        }
        $id = [string](Get-ObjectValue $reported 'id')
        if ($reportedById.ContainsKey($id)) {
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
        if ($null -eq $rawScore -or $rawScore -is [string] -or $rawScore -is [array] -or
            -not [int]::TryParse([string]$rawScore, [ref]$score) -or $score -lt 0 -or $score -gt 4) {
            $failures.Add("Dimension '$($dimension.id)' score must be an integer from 0 to 4.")
            continue
        }
        if (-not (Test-NonEmptyString (Get-ObjectValue $entry 'evidence'))) {
            $failures.Add("Dimension '$($dimension.id)' requires evidence as a non-empty string.")
        } elseif (Test-PlaceholderEvidence (Get-ObjectValue $entry 'evidence')) {
            $failures.Add("Dimension '$($dimension.id)' evidence cannot be only TODO, TBD, untested, or no evidence.")
        }
        $findingsValue = $null
        if ($entry.PSObject.Properties['findings']) { $findingsValue = $entry.findings }
        if (-not (Test-JsonArray $findingsValue)) {
            $failures.Add("Dimension '$($dimension.id)' requires findings as a JSON array.")
        } else {
            foreach ($finding in @($findingsValue)) {
                if (-not (Test-NonEmptyString (Get-ObjectValue $finding 'severity'))) {
                    $failures.Add("Dimension '$($dimension.id)' finding severity must be high, medium, or low.")
                    continue
                }
                $severity = ([string](Get-ObjectValue $finding 'severity')).ToLowerInvariant()
                if ($severity -notin @('high', 'medium', 'low')) {
                    $failures.Add("Dimension '$($dimension.id)' finding severity must be high, medium, or low.")
                    continue
                }
                foreach ($field in @('file', 'issue', 'suggestedFix')) {
                    if (-not (Test-NonEmptyString (Get-ObjectValue $finding $field))) {
                        $failures.Add("Dimension '$($dimension.id)' finding requires '$field' as a non-empty string.")
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
}

$scoreResult = [int][Math]::Round($weightedScore, 0, [MidpointRounding]::AwayFromZero)
if ($blockingFailures.Count -gt 0) {
    foreach ($failure in $blockingFailures) { $failures.Add($failure) }
}
if ($scoreResult -lt $MinScore) {
    $failures.Add("Weighted score $scoreResult is below required minimum $MinScore.")
}

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

$documentationDriftCheck = Invoke-DocumentationDriftChecker
if (-not $documentationDriftCheck.passed) {
    Write-Result ([PSCustomObject]@{
        status = 'failed'
        message = $documentationDriftCheck.message
        score = $scoreResult
        minimum = $MinScore
        files = $scope
        failures = @($documentationDriftCheck.message)
    }) 1
}

Write-Result ([PSCustomObject]@{
    status = 'passed'
    message = "Code-quality rubric passed at $scoreResult/100."
    score = $scoreResult
    minimum = $MinScore
    files = $scope
    dimensions = $reportedDimensions
    documentationReview = $documentationReviewValidation.review
})
