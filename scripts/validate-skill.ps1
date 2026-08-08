#!/usr/bin/env pwsh
# Skill Validation Pipeline - Unified skill quality check
# Chains: frontmatter -> token budget -> scoring -> reference validation
#
# Usage:
#   .\scripts\validate-skill.ps1                    # Validate all skills
#   .\scripts\validate-skill.ps1 -SkillPath .github/skills/architecture/api-design
#   .\scripts\validate-skill.ps1 -MinScore 20       # Set minimum passing score
#   .\scripts\validate-skill.ps1 -FailFast          # Stop on first failure
#Requires -Version 7.0
param(
    [string]$SkillPath = '',
    [ValidateRange(0, 100)][int]$MinScore = 70,
    [switch]$EnforceScore,
    [switch]$FailFast,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SKILLS_DIR = Join-Path $ROOT '.github' 'skills'

# Result accumulator
$results = @()

function Test-SkillFrontmatter([string]$skillFile) {
    $errors = @()
    $content = Get-Content $skillFile -Raw -Encoding utf8

    # Check for YAML frontmatter
    if ($content -notmatch '(?s)^---\r?\n(.+?)\r?\n---') {
        $errors += 'No YAML frontmatter found'
        return $errors
    }

    $fm = $Matches[1]

    # name field (kebab-case)
    if ($fm -notmatch 'name:\s*[''"]?([a-z][a-z0-9-]*)[''"]?') {
        $errors += 'Frontmatter: missing or invalid name field (must be kebab-case)'
    }

    # description field (50+ chars)
    $descMatch = $false
    if ($fm -match 'description:\s*[''"](.{50,})[''"]') {
        $descMatch = $true
    } elseif ($fm -match 'description:\s*>') {
        # Multiline description - check combined length
        $descLines = @()
        $inDesc = $false
        foreach ($line in ($fm -split '\r?\n')) {
            if ($line -match '^\s*description:\s*>') { $inDesc = $true; continue }
            if ($inDesc) {
                if ($line -match '^\s{2,}') { $descLines += $line.Trim() }
                else { break }
            }
        }
        $combined = $descLines -join ' '
        if ($combined.Length -ge 50) { $descMatch = $true }
        else { $errors += "Frontmatter: description too short ($($combined.Length) chars, need 50+)" }
    } elseif ($fm -match 'description:\s*(.{50,})') {
        $descMatch = $true
    }
    if (-not $descMatch -and $errors.Count -eq 0) {
        $errors += 'Frontmatter: description missing or under 50 characters'
    }

    return $errors
}

function Get-TokenCount([string]$filePath) {
    if (-not (Test-Path $filePath)) { return 0 }
    $chars = (Get-Content $filePath -Raw -Encoding utf8).Length
    return [math]::Ceiling($chars / 4)
}

function Test-SkillTokenBudget([string]$skillFile, [int]$limit = 5000) {
    $tokens = Get-TokenCount $skillFile
    if ($tokens -gt $limit) {
        return @("Token budget exceeded: $tokens tokens (limit: $limit)")
    }
    return @()
}

function Test-SkillStructure([string]$skillDir) {
    $errors = @()
    $skillFile = Join-Path $skillDir 'SKILL.md'
    if (-not (Test-Path $skillFile)) {
        $errors += 'SKILL.md not found'
        return $errors
    }

    # Check directory name is kebab-case
    $dirName = Split-Path $skillDir -Leaf
    if ($dirName -notmatch '^[a-z][a-z0-9-]{0,63}$') {
        $errors += "Directory name not kebab-case: $dirName"
    }

    # Check for unexpected files at root of skill dir
    $allowed = @('SKILL.md')
    $allowedDirs = @('scripts', 'references', 'assets')
    $items = Get-ChildItem $skillDir -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            if ($item.Name -notin $allowedDirs) {
                $errors += "Unexpected subdirectory: $($item.Name) (allowed: $($allowedDirs -join ', '))"
            }
        } else {
            if ($item.Name -notin $allowed) {
                $errors += "Unexpected file at skill root: $($item.Name)"
            }
        }
    }

    return $errors
}

function Test-SkillReferences([string]$skillFile) {
    $errors = @()
    $content = Get-Content $skillFile -Raw -Encoding utf8
    $dir = Split-Path $skillFile -Parent
    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)]+)\)')

    foreach ($link in $links) {
        $target = $link.Groups[2].Value
        # Skip external URLs and anchors
        if ($target -match '^https?://|^mailto:|^#') { continue }
        # Strip anchor from path
        $pathOnly = ($target -split '#')[0]
        if (-not $pathOnly) { continue }

        try { $decodedPath = [Uri]::UnescapeDataString($pathOnly) } catch { $decodedPath = $pathOnly }
        $resolved = Join-Path $dir $decodedPath
        if (-not (Test-Path $resolved)) {
            $errors += "Broken link: [$($link.Groups[1].Value)]($target)"
        }
    }

    return $errors
}

function Get-SkillScore([string]$skillDir) {
    $scoreScript = Join-Path $ROOT 'scripts' 'score-skill.ps1'
    if (Test-Path $scoreScript) {
        $scoreArgs = @{ SkillPath = $skillDir; MinScore = $MinScore; Json = $true }
        if ($EnforceScore) { $scoreArgs.Enforce = $true }
        $json = & $scoreScript @scoreArgs 2>$null | Out-String
        $result = $json | ConvertFrom-Json -Depth 20
        $skillResult = @($result.skills)[0]
        return [PSCustomObject]@{
            Score = [int]$skillResult.score
            Blockers = @($skillResult.blockers)
            Findings = @($skillResult.findings)
        }
    }
    return [PSCustomObject]@{ Score = -1; Blockers = @('scorer-unavailable'); Findings = @() }
}

function Test-SingleSkill([string]$skillDir) {
    $skillFile = Join-Path $skillDir 'SKILL.md'
    $name = Split-Path $skillDir -Leaf
    $category = Split-Path (Split-Path $skillDir -Parent) -Leaf

    $entry = @{
        Name     = $name
        Category = $category
        Path     = $skillDir -replace [regex]::Escape($ROOT), '' -replace '^[\\/]', ''
        Errors   = @()
        Warnings = @()
        Score    = 0
        Blockers = @()
        Tokens   = 0
        Pass     = $true
    }

    # 1. Structure check
    $structErrors = @(Test-SkillStructure $skillDir)
    if ($structErrors.Count -gt 0) {
        $entry.Errors += $structErrors
    }

    if (-not (Test-Path $skillFile)) {
        $entry.Pass = $false
        return $entry
    }

    # 2. Frontmatter validation
    $fmErrors = @(Test-SkillFrontmatter $skillFile)
    if ($fmErrors.Count -gt 0) {
        $entry.Errors += $fmErrors
    }

    # 3. Token budget
    $entry.Tokens = Get-TokenCount $skillFile
    $tokenErrors = @(Test-SkillTokenBudget $skillFile)
    if ($tokenErrors.Count -gt 0) {
        $entry.Errors += $tokenErrors
    }

    # 4. Reference validation
    $refErrors = @(Test-SkillReferences $skillFile)
    if ($refErrors.Count -gt 0) {
        $entry.Warnings += $refErrors  # Broken links are warnings, not blockers
    }

    # 5. Score
    $rubric = Get-SkillScore $skillDir
    $entry.Score = $rubric.Score
    $entry.Blockers = @($rubric.Blockers)
    if ($entry.Blockers.Count -gt 0) {
        $entry.Errors += "Rubric blockers: $($entry.Blockers -join ', ')"
    }
    if ($EnforceScore -and $entry.Score -ge 0 -and $entry.Score -lt $MinScore) {
        $entry.Errors += "Score $($entry.Score)/100 below minimum $MinScore"
    }

    $entry.Pass = ($entry.Errors.Count -eq 0)
    return $entry
}

# --- Main ---

if (-not $Json) {
    Write-Host "`n  Skill Validation Pipeline"
    Write-Host "  ========================`n"
}

$skillDirs = @()
if ($SkillPath) {
    $resolved = if ([System.IO.Path]::IsPathRooted($SkillPath)) { $SkillPath } else { Join-Path $ROOT $SkillPath }
    if (-not (Test-Path $resolved)) { Write-Host "[FAIL] Skill path not found: $SkillPath"; exit 1 }
    if (Test-Path $resolved -PathType Leaf) { $resolved = Split-Path $resolved -Parent }
    $skillDirs += $resolved
} else {
    # Find all skill directories
    $skillDirs = Get-ChildItem -Path $SKILLS_DIR -Filter 'SKILL.md' -Recurse -File |
        ForEach-Object { $_.Directory.FullName } |
        Sort-Object
}

$totalPass = 0
$totalFail = 0
$totalWarn = 0

foreach ($dir in $skillDirs) {
    $result = Test-SingleSkill $dir
    $results += $result

    $mark = if ($result.Pass) { '[PASS]' } else { '[FAIL]' }
    $scoreStr = if ($result.Score -ge 0) { "$($result.Score)/100" } else { 'n/a' }

    if (-not $result.Pass) {
        $totalFail++
        if (-not $Json) {
            Write-Host "  $mark $($result.Category)/$($result.Name) (score: $scoreStr, tokens: $($result.Tokens))"
            foreach ($e in $result.Errors) { Write-Host "        ERROR: $e" }
            foreach ($w in $result.Warnings) { Write-Host "        WARN:  $w" }
        }
        if ($FailFast) { if (-not $Json) { Write-Host "`n  [FAIL] Stopped on first failure." }; exit 1 }
    } else {
        if ($result.Warnings.Count -gt 0) {
            if (-not $Json) {
                Write-Host "  [WARN] $($result.Category)/$($result.Name) (score: $scoreStr, tokens: $($result.Tokens))"
                foreach ($w in $result.Warnings) { Write-Host "        WARN:  $w" }
            }
            $totalWarn++
        }
        $totalPass++
    }
}

# Summary
if (-not $Json) {
    Write-Host "`n  -----------------------------------------"
    Write-Host "  Total: $($results.Count) | Pass: $totalPass | Fail: $totalFail | Warnings: $totalWarn"
}

if ($totalFail -gt 0) {
    if (-not $Json) { Write-Host "  [FAIL] $totalFail skill(s) failed validation`n" }
    if ($Json) {
        @{ total = $results.Count; pass = $totalPass; fail = $totalFail; warnings = $totalWarn; success = $false; skills = $results } |
            ConvertTo-Json -Depth 8
    }
    exit 1
} else {
    if (-not $Json) { Write-Host "  [PASS] All skills passed validation`n" }
    if ($Json) {
        @{ total = $results.Count; pass = $totalPass; fail = $totalFail; warnings = $totalWarn; success = $true; skills = $results } |
            ConvertTo-Json -Depth 8
    }
    exit 0
}
