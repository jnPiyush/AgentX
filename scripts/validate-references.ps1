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

$mdFiles = Get-ChildItem -Path $ScanDir -Filter '*.md' -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git[/\\]|vendor' }

foreach ($file in $mdFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding utf8
    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)]+)\)')
    $lineNum = 0
    $lines = $content -split "`n"

    foreach ($match in $links) {
        $total++
        $linkText = $match.Groups[1].Value
        $linkTarget = $match.Groups[2].Value

        # Skip external URLs, anchors, mailto, and scheme-based links
        if ($linkTarget -match '^(https?://|mailto:|#|data:|javascript:)') { continue }

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
