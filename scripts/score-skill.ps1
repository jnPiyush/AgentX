#!/usr/bin/env pwsh
# Skill Scorer - Evaluate skill quality against agentskills.io spec
# Scores: Invalid (0-9) | Low (10-19) | Medium (20-27) | Medium-High (28-35) | High (36-40)
#
# Usage:
#   .\scripts\score-skill.ps1 -SkillPath .github/skills/architecture/api-design
#   .\scripts\score-skill.ps1 -All
#Requires -Version 7.0
param(
    [string]$SkillPath = '',
    [switch]$All
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-SkillScore([string]$skillDir) {
    $skillFile = Join-Path $skillDir 'SKILL.md'
    if (-not (Test-Path $skillFile)) { return [PSCustomObject]@{ Name = (Split-Path $skillDir -Leaf); Score = 0; Tier = 'Invalid'; Details = 'SKILL.md not found' } }

    $content = Get-Content $skillFile -Raw -Encoding utf8
    $lines = (Get-Content $skillFile -Encoding utf8)
    $name = Split-Path $skillDir -Leaf
    $score = 0
    $details = @()

    # 1. Name validation (max 5 pts)
    if ($name -match '^[a-z][a-z0-9-]{0,63}$') { $score += 5; $details += '[PASS] Name: kebab-case valid' }
    else { $details += '[FAIL] Name: must be lowercase kebab-case, 1-64 chars' }

    # 2. Frontmatter present (max 5 pts)
    if ($content -match '(?s)^---\r?\n(.+?)\r?\n---') {
        $fm = $Matches[1]
        if ($fm -match 'name:\s*"?[a-z]') { $score += 2; $details += '[PASS] Frontmatter: name field present' }
        else { $details += '[FAIL] Frontmatter: missing name field' }
        if ($fm -match 'description:\s*') { $score += 3; $details += '[PASS] Frontmatter: description present' }
        else { $details += '[FAIL] Frontmatter: missing description' }
    } else { $details += '[FAIL] Frontmatter: no YAML frontmatter found' }

    # 3. Description quality (max 8 pts)
    $desc = $null
    if ($content -match 'description:\s*[''"](.+?)[''"]') {
        $desc = $Matches[1]
    } elseif ($content -match '(?m)description:\s*>-?\s*$') {
        # Multiline YAML: capture indented lines after description: >-
        $descLines = @()
        $inDesc = $false
        foreach ($l in $lines) {
            if ($l -match '^\s*description:\s*>') { $inDesc = $true; continue }
            if ($inDesc) {
                if ($l -match '^\s{2,}\S') { $descLines += $l.Trim() }
                else { break }
            }
        }
        if ($descLines.Count -gt 0) { $desc = $descLines -join ' ' }
    }
    if ($desc) {
        $words = ($desc -split '\s+').Count
        if ($words -ge 10 -and $words -le 60) { $score += 3; $details += "[PASS] Description: $words words (10-60 range)" }
        elseif ($words -gt 0) { $score += 1; $details += "[WARN] Description: $words words (target 10-60)" }
        if ($desc.Length -le 1024) { $score += 2; $details += '[PASS] Description: under 1024 chars' }
        else { $details += '[FAIL] Description: exceeds 1024 chars' }
        if ($desc -match '(WHEN|TRIGGER|Use when)') { $score += 3; $details += '[PASS] Description: has trigger phrases' }
        else { $details += '[WARN] Description: no WHEN/TRIGGER phrases found' }
    }

    # 4. Required sections (max 10 pts, 2 each)
    $sectionChecks = @(
        @{ Pattern = '##\s+(When to Use)|>\s*WHEN:'; Label = 'When to Use / WHEN trigger' }
        @{ Pattern = '##\s+(Quick Reference|Limits|Cheat Sheet)'; Label = 'Quick Reference' }
        @{ Pattern = '##\s+(Decision Tree|Decision|Selection|Model Selection)'; Label = 'Decision Tree' }
        @{ Pattern = '##\s+(Workflow|Steps|Execution|Lifecycle|Pipeline)'; Label = 'Workflow/Steps' }
        @{ Pattern = '##\s+(Anti-Pattern|Error|Pitfall|Common Mistake)'; Label = 'Anti-Pattern/Error' }
    )
    foreach ($chk in $sectionChecks) {
        if ($content -match $chk.Pattern) { $score += 2; $details += "[PASS] Section: '$($chk.Label)' present" }
        else { $details += "[WARN] Section: '$($chk.Label)' not found" }
    }

    # 5. Token budget (max 5 pts)
    $tokens = [math]::Ceiling($content.Length / 4)
    if ($tokens -le 1500) { $score += 5; $details += "[PASS] Tokens: $tokens (under 1500)" }
    elseif ($tokens -le 3000) { $score += 3; $details += "[WARN] Tokens: $tokens (target under 1500, max 5000)" }
    elseif ($tokens -le 5000) { $score += 1; $details += "[WARN] Tokens: $tokens (over budget, max 5000)" }
    else { $details += "[FAIL] Tokens: $tokens (exceeds hard limit 5000)" }

    # 6. Progressive disclosure (max 3 pts)
    if (Test-Path (Join-Path $skillDir 'references')) { $score += 1; $details += '[PASS] Structure: references/ directory present' }
    if (Test-Path (Join-Path $skillDir 'scripts')) { $score += 1; $details += '[PASS] Structure: scripts/ directory present' }
    # Baseline: skill exists in proper directory
    $score += 1; $details += '[PASS] Structure: skill in standard location'

    # 7. No keyword contamination (max 4 pts)
    if ($content -match 'description:.*DO NOT USE') { $details += '[WARN] Contamination: "DO NOT USE" in description causes false triggers on Claude' }
    else { $score += 4; $details += '[PASS] No keyword contamination in description' }

    $tier = switch ($score) {
        { $_ -ge 36 } { 'High'; break }
        { $_ -ge 28 } { 'Medium-High'; break }
        { $_ -ge 20 } { 'Medium'; break }
        { $_ -ge 10 } { 'Low'; break }
        default { 'Invalid' }
    }

    return [PSCustomObject]@{ Name = $name; Score = $score; Tier = $tier; Tokens = $tokens; Details = ($details -join "`n") }
}

if ($All) {
    $skillDirs = Get-ChildItem -Path (Join-Path $ROOT '.github/skills') -Directory -Recurse |
        Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') }
    $results = @()
    foreach ($d in $skillDirs) { $results += Get-SkillScore $d.FullName }

    Write-Host "`n  Skill Scoring Report"
    Write-Host "  ============================================="
    $sorted = $results | Sort-Object Score -Descending
    foreach ($r in $sorted) {
        $color = switch ($r.Tier) { 'High' { '32' } 'Medium-High' { '32' } 'Medium' { '33' } 'Low' { '33' } default { '31' } }
        Write-Host ("  `e[${color}m{0,-12}`e[0m {1,2}/40  {2}" -f $r.Tier, $r.Score, $r.Name)
    }
    $avg = [math]::Round(($results | Measure-Object -Property Score -Average).Average, 1)
    Write-Host "`n  Average: $avg/40 | Skills: $($results.Count) | High: $(@($results | Where-Object Tier -eq 'High').Count) | Medium-High: $(@($results | Where-Object Tier -eq 'Medium-High').Count)"
    Write-Host "  =============================================`n"

    $failing = @($results | Where-Object { $_.Score -lt 28 })
    if ($failing.Count -gt 0) { exit 1 } else { exit 0 }
} elseif ($SkillPath) {
    $resolved = Resolve-Path $SkillPath -ErrorAction SilentlyContinue
    if (-not $resolved) { Write-Host "Path not found: $SkillPath"; exit 1 }
    $target = $resolved.Path
    # If user passed a file, use its directory
    if (Test-Path $target -PathType Leaf) { $target = Split-Path $target -Parent }
    $result = Get-SkillScore $target
    Write-Host "`n  Skill: $($result.Name)"
    Write-Host "  Score: $($result.Score)/40 ($($result.Tier))"
    Write-Host "  Tokens: $($result.Tokens)"
    Write-Host "  ---------"
    Write-Host $result.Details
    Write-Host ''
    if ($result.Score -lt 28) { exit 1 } else { exit 0 }
} else {
    Write-Host "Usage: score-skill.ps1 -SkillPath <path> | -All"
}
