#!/usr/bin/env pwsh
# Reference Validator - Scan markdown links and report broken/orphaned references
# Resolves TD-003 (no automated link validation)
#
# Usage:
#   .\scripts\validate-references.ps1           # Check all .md files
#   .\scripts\validate-references.ps1 -Path docs/  # Check specific folder
#   .\scripts\validate-references.ps1 -Fix      # Report and suggest fixes
#Requires -Version 7.0
param(
    [string]$Path = '.',
    [switch]$Fix,
    [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ScanDir = Join-Path $ROOT $Path

$broken = @()
$total = 0
$checked = 0

function Get-FencedCodeRange {
    param(
        [string]$Content
    )

    $ranges = @()
    $codeBlocks = [regex]::Matches($Content, '(?ms)```.*?```')
    foreach ($block in $codeBlocks) {
        $ranges += [PSCustomObject]@{
            Start = $block.Index
            End   = $block.Index + $block.Length
        }
    }

    return $ranges
}

function Test-IsInsideFencedCode {
    param(
        [int]$Index,
        [object[]]$Ranges
    )

    foreach ($range in $Ranges) {
        if ($Index -ge $range.Start -and $Index -lt $range.End) {
            return $true
        }
    }

    return $false
}

$mdFiles = Get-ChildItem -Path $ScanDir -Filter '*.md' -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git[/\\]|vendor|[/\\]archive[/\\]|vscode-extension[/\\]\.github[/\\]' }

# Scope to git-tracked files when available so generated/untracked mirrors
# (e.g. vscode-extension/.github/agentx) do not produce false positives.
$trackedSet = $null
try {
    Push-Location $ROOT
    $trackedRaw = git ls-files '*.md' 2>$null
    Pop-Location
    if ($LASTEXITCODE -eq 0 -and $trackedRaw) {
        $trackedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($rel in $trackedRaw) {
            if ([string]::IsNullOrWhiteSpace($rel)) { continue }
            [void]$trackedSet.Add([System.IO.Path]::GetFullPath((Join-Path $ROOT $rel)))
        }
    }
} catch {
    $trackedSet = $null
}

if ($trackedSet -and $trackedSet.Count -gt 0) {
    $mdFiles = $mdFiles | Where-Object { $trackedSet.Contains($_.FullName) }
}

foreach ($file in $mdFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding utf8
    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)]+)\)')
    $fencedCodeRanges = Get-FencedCodeRange -Content $content
    $lines = $content -split "`n"

    foreach ($match in $links) {
        if (Test-IsInsideFencedCode -Index $match.Index -Ranges $fencedCodeRanges) { continue }

        $total++
        $linkText = $match.Groups[1].Value
        $linkTarget = $match.Groups[2].Value

        # Skip external URLs, anchors, mailto, and scheme-based links
        if ($linkTarget -match '^(https?://|mailto:|#|data:|javascript:)') { continue }

        # Skip placeholder or example-only link targets used in templates.
        if ($linkTarget -eq 'link' -or $linkTarget -match '[{}$]' -or $linkTarget -match '^path([/#].*)?$') { continue }

        # Skip fragment-only refs within same file
        if ($linkTarget.StartsWith('#')) { continue }

        $checked++

        # Strip fragment from path
        $targetPath = ($linkTarget -split '#')[0]

        # Resolve relative to the markdown file's directory
        $fileDir = $file.DirectoryName
        $resolved = Join-Path $fileDir $targetPath

        try {
            $resolvedClean = [System.IO.Path]::GetFullPath($resolved)
        } catch {
            $resolvedClean = $resolved
        }

        if (-not (Test-Path $resolvedClean)) {
            # Find line number
            $lineIdx = 0
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match [regex]::Escape($match.Value)) {
                    $lineIdx = $i + 1
                    break
                }
            }

            $relFile = $file.FullName.Replace($ROOT, '').TrimStart([IO.Path]::DirectorySeparatorChar) -replace '\\','/'
            $broken += [PSCustomObject]@{
                File       = $relFile
                Line       = $lineIdx
                LinkText   = $linkText
                LinkTarget = $linkTarget
                Resolved   = $resolvedClean.Replace($ROOT, '').TrimStart([IO.Path]::DirectorySeparatorChar) -replace '\\','/'
            }
        }
    }
}

# Report
if (-not $Quiet) {
    Write-Host "`n  Reference Validation Report"
    Write-Host "  ============================================="
    Write-Host "  Files scanned:  $($mdFiles.Count)"
    Write-Host "  Links found:    $total"
    Write-Host "  Local checked:  $checked"
    Write-Host "  Broken links:   $($broken.Count)"
    Write-Host "  =============================================`n"
}

if ($broken.Count -gt 0) {
    foreach ($b in $broken) {
        $severity = if ($b.File -match 'AGENTS\.md|WORKFLOW\.md|Skills\.md|README\.md') { '[HIGH]' } else { '[LOW] ' }
        Write-Host "  $severity $($b.File):$($b.Line)"
        Write-Host "         [$($b.LinkText)]($($b.LinkTarget))"
        Write-Host "         -> $($b.Resolved) NOT FOUND"
        Write-Host ""
    }

    if ($Fix) {
        Write-Host "`n  Suggested fixes:"
        foreach ($b in $broken) {
            # Try to find a file with similar name
            $targetName = [IO.Path]::GetFileName($b.LinkTarget)
            $similar = Get-ChildItem -Path $ROOT -Filter $targetName -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 3
            if ($similar) {
                Write-Host "  $($b.File):$($b.Line) -> Did you mean:"
                foreach ($s in $similar) {
                    $relPath = $s.FullName.Replace($ROOT, '').TrimStart([IO.Path]::DirectorySeparatorChar) -replace '\\','/'
                    Write-Host "    $relPath"
                }
            }
        }
    }

    if (-not $Quiet) { Write-Host "  [FAIL] $($broken.Count) broken reference(s) found.`n" }
    exit 1
} else {
    if (-not $Quiet) { Write-Host "  [PASS] All references valid.`n" }
    exit 0
}
