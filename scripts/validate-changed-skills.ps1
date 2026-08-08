#!/usr/bin/env pwsh
# Validate changed skills against the target revision without allowing regression.
#Requires -Version 7.0
[CmdletBinding()]
param(
    [string]$BaseRef = '',
    [string]$HeadRef = 'HEAD',
    [string[]]$ChangedPaths = @(),
    [ValidateRange(0, 100)][int]$MinScore = 70,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scorer = Join-Path $PSScriptRoot 'score-skill.ps1'

if ($ChangedPaths.Count -eq 0) {
    if (-not $BaseRef) { throw 'BaseRef is required when ChangedPaths is not supplied.' }
    $ChangedPaths = @(git -C $root diff --name-only "$BaseRef...$HeadRef" -- '.github/skills/**/SKILL.md')
    if ($LASTEXITCODE -ne 0) { throw "Could not compute changed skills for $BaseRef...$HeadRef." }
}

function Get-NormalizedPath([string]$Path) {
    $fullPath = if ([IO.Path]::IsPathRooted($Path)) { [IO.Path]::GetFullPath($Path) } else { [IO.Path]::GetFullPath((Join-Path $root $Path)) }
    if ($fullPath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        return $fullPath.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
    }
    throw "Changed skill path must be inside the repository: $Path"
}

function Get-Score([string]$SkillPath, [switch]$Enforce) {
    $arguments = @{ SkillPath = $SkillPath; MinScore = $MinScore; Json = $true }
    if ($Enforce) { $arguments.Enforce = $true }
    $scoreJson = & $scorer @arguments 2>$null | Out-String
    $scoreResult = $scoreJson | ConvertFrom-Json -Depth 20
    return @($scoreResult.skills)[0]
}

$baseRoot = $null
try {
    if ($BaseRef) {
        git -C $root rev-parse --verify "$BaseRef^{commit}" *> $null
        if ($LASTEXITCODE -ne 0) { throw "BaseRef is not a valid commit: $BaseRef" }
        $baseRoot = Join-Path ([IO.Path]::GetTempPath()) ('agentx-skill-base-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $baseRoot -Force | Out-Null
    }

    $results = @()
    foreach ($changedPath in @($ChangedPaths | Where-Object { $_ } | Sort-Object -Unique)) {
        $normalized = Get-NormalizedPath $changedPath
        $fullPath = Join-Path $root $normalized
        if (-not (Test-Path $fullPath -PathType Leaf)) {
            $results += [PSCustomObject]@{ path = $normalized; score = $null; baseScore = $null; blockers = @(); baseBlockers = @(); newBlockers = @(); pass = $true; policy = 'deleted' }
            continue
        }

        $current = Get-Score -SkillPath $fullPath -Enforce
        $base = $null
        if ($BaseRef) {
            $skillDirectory = (Split-Path $normalized -Parent).Replace('\', '/')
            $baseFiles = @(git -C $root ls-tree -r --name-only $BaseRef -- $skillDirectory 2>$null)
            if ($LASTEXITCODE -eq 0 -and $baseFiles -contains $normalized) {
                $baseSkillDirectory = Join-Path $baseRoot $skillDirectory
                foreach ($baseFile in $baseFiles) {
                    $destination = Join-Path $baseRoot $baseFile
                    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
                    if ($baseFile -eq $normalized) {
                        git -C $root show "${BaseRef}:$baseFile" | Set-Content -LiteralPath $destination -Encoding utf8
                    } else {
                        New-Item -ItemType File -Path $destination -Force | Out-Null
                    }
                }
                $base = Get-Score -SkillPath $baseSkillDirectory -Enforce
            }
        }

        $blockers = @($current.blockers)
        $baseBlockers = if ($base) { @($base.blockers) } else { @() }
        $newBlockers = @($blockers | Where-Object { $_ -notin $baseBlockers })
        if ($base) {
            $pass = [int]$current.score -ge [int]$base.score -and $newBlockers.Count -eq 0
            $policy = if ($pass) { 'base-no-regression' } else { 'base-regression' }
        } else {
            $pass = [int]$current.score -ge $MinScore -and $blockers.Count -eq 0
            $policy = if ($pass) { 'new-minimum' } else { 'new-minimum-not-met' }
        }

        $results += [PSCustomObject]@{
            path = $normalized
            score = [int]$current.score
            baseScore = if ($base) { [int]$base.score } else { $null }
            blockers = $blockers
            baseBlockers = $baseBlockers
            newBlockers = $newBlockers
            pass = $pass
            policy = $policy
        }
    }

    $failed = @($results | Where-Object { -not $_.pass })
    $summary = [PSCustomObject]@{
        minimumScore = $MinScore
        total = $results.Count
        pass = $results.Count - $failed.Count
        fail = $failed.Count
        success = $failed.Count -eq 0
        skills = $results
    }

    if ($Json) {
        $summary | ConvertTo-Json -Depth 10
    } else {
        foreach ($result in $results) {
            $mark = if ($result.pass) { '[PASS]' } else { '[FAIL]' }
            $baseText = if ($null -ne $result.baseScore) { "; baseScore=$($result.baseScore)" } else { '' }
            $blockerText = if ($result.blockers.Count) { "; blockers=$($result.blockers -join ',')" } else { '' }
            $newBlockerText = if ($result.newBlockers.Count) { "; newBlockers=$($result.newBlockers -join ',')" } else { '' }
            Write-Host "$mark $($result.path): score=$($result.score); policy=$($result.policy)$baseText$blockerText$newBlockerText"
        }
        Write-Host "Changed skills: total=$($summary.total), pass=$($summary.pass), fail=$($summary.fail)"
    }

    if (-not $summary.success) { exit 1 }
    exit 0
} finally {
    if ($baseRoot) { Remove-Item -LiteralPath $baseRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
