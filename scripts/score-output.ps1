#!/usr/bin/env pwsh
# Output Scorer - Quantitative scoring for agent deliverable quality
# Roles: engineer, architect, pm
# Tiers: High (90%+) | Medium-High (70-89%) | Medium (50-69%) | Low (25-49%) | Invalid (<25%)
#
# Usage:
#   .\scripts\score-output.ps1 -Role engineer -IssueNumber 42
#   .\scripts\score-output.ps1 -Role architect -IssueNumber 42
#   .\scripts\score-output.ps1 -Role pm -IssueNumber 42
#Requires -Version 7.0
param(
    [Parameter(Mandatory)]
    [ValidateSet('engineer','architect','pm')]
    [string]$Role,
    [int]$IssueNumber = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Test-FileExists([string]$pattern) {
    $found = Get-ChildItem -Path $ROOT -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $found
}

function Score-Engineer {
    $score = 0; $max = 45; $checks = @()

    # Tests pass (10 pts) - check if test command exits cleanly
    $testDir = Join-Path $ROOT 'vscode-extension'
    if (Test-Path (Join-Path $testDir 'package.json')) {
        try {
            Push-Location $testDir
            $null = npm test 2>&1
            if ($LASTEXITCODE -eq 0) { $score += 10; $checks += '[PASS] Tests pass (+10)' }
            else { $checks += '[FAIL] Tests failing (+0)' }
            Pop-Location
        } catch { $checks += '[FAIL] Test execution error (+0)'; Pop-Location }
    } else { $checks += '[SKIP] No test framework detected (+0)' }

    # Lint clean (5 pts)
    if (Test-Path (Join-Path $testDir 'package.json')) {
        try {
            Push-Location $testDir
            $null = npm run lint 2>&1
            if ($LASTEXITCODE -eq 0) { $score += 5; $checks += '[PASS] Lint clean (+5)' }
            else { $score += 2; $checks += '[WARN] Lint warnings present (+2)' }
            Pop-Location
        } catch { $checks += '[SKIP] Lint not configured (+0)'; Pop-Location }
    }

    # No hardcoded secrets (5 pts)
    $secretPatterns = @('password\s*=\s*["\x27]', 'api[_-]?key\s*=\s*["\x27]', 'secret\s*=\s*["\x27]')
    $secretFound = $false
    foreach ($p in $secretPatterns) {
        $matches = Get-ChildItem -Path (Join-Path $ROOT 'src'), (Join-Path $ROOT 'vscode-extension/src') -Filter '*.ts' -Recurse -File -ErrorAction SilentlyContinue |
            Select-String -Pattern $p -ErrorAction SilentlyContinue
        if ($matches) { $secretFound = $true; break }
    }
    if (-not $secretFound) { $score += 5; $checks += '[PASS] No hardcoded secrets (+5)' }
    else { $checks += '[FAIL] Hardcoded secrets detected (+0)' }

    # SQL parameterized (5 pts) - check for string concatenation in SQL
    $sqlConcat = Get-ChildItem -Path $ROOT -Include '*.ts','*.cs','*.py' -Recurse -File -ErrorAction SilentlyContinue |
        Select-String -Pattern '(\$"|f")[^"]*SELECT|INSERT|UPDATE|DELETE' -ErrorAction SilentlyContinue
    if (-not $sqlConcat -or $sqlConcat.Count -eq 0) { $score += 5; $checks += '[PASS] SQL parameterized (+5)' }
    else { $checks += '[FAIL] SQL string concatenation found (+0)' }

    # No TODO/FIXME (2 pts)
    $todos = Get-ChildItem -Path $ROOT -Include '*.ts','*.cs','*.py' -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch 'node_modules|\.git' } |
        Select-String -Pattern 'TODO|FIXME' -ErrorAction SilentlyContinue
    if (-not $todos -or $todos.Count -eq 0) { $score += 2; $checks += '[PASS] No TODO/FIXME markers (+2)' }
    else { $checks += "[WARN] $($todos.Count) TODO/FIXME markers found (+0)" }

    # Docs updated (3 pts) - check if README or docs were modified in recent commits
    try {
        $recentDocs = & git -C $ROOT diff --name-only HEAD~3 2>$null | Where-Object { $_ -match '\.md$' }
        if ($recentDocs) { $score += 3; $checks += '[PASS] Documentation updated (+3)' }
        else { $checks += '[WARN] No doc updates in recent commits (+0)' }
    } catch { $checks += '[SKIP] Git history check failed (+0)' }

    # Coverage check (10 pts) - approximate from test file count vs source file count
    $srcFiles = (Get-ChildItem -Path (Join-Path $ROOT 'vscode-extension/src') -Filter '*.ts' -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch 'test' }).Count
    $testFiles = (Get-ChildItem -Path (Join-Path $ROOT 'vscode-extension/src/test') -Filter '*.test.ts' -Recurse -File -ErrorAction SilentlyContinue).Count
    if ($srcFiles -gt 0) {
        $ratio = [math]::Round(($testFiles / $srcFiles) * 100, 0)
        if ($ratio -ge 50) { $score += 10; $checks += "[PASS] Test coverage proxy: $ratio% test-to-source ratio (+10)" }
        elseif ($ratio -ge 30) { $score += 5; $checks += "[WARN] Test coverage proxy: $ratio% test-to-source ratio (+5)" }
        else { $checks += "[FAIL] Test coverage proxy: $ratio% test-to-source ratio (+0)" }
    }

    return @{ Score = $score; Max = $max; Checks = $checks }
}

function Score-Architect {
    $score = 0; $max = 40; $checks = @()
    $id = if ($IssueNumber -gt 0) { $IssueNumber } else { '*' }

    # ADR exists (3 pts)
    $adrFiles = Get-ChildItem -Path (Join-Path $ROOT 'docs/adr') -Filter "ADR-$id*.md" -File -ErrorAction SilentlyContinue
    if ($adrFiles) {
        $score += 3; $checks += '[PASS] ADR exists (+3)'
        $adrContent = Get-Content $adrFiles[0].FullName -Raw -Encoding utf8

        # 3+ options (5 pts)
        $optCount = ([regex]::Matches($adrContent, '(?mi)^###?\s+Option')).Count
        if ($optCount -ge 3) { $score += 5; $checks += "[PASS] ADR has $optCount options (+5)" }
        elseif ($optCount -ge 1) { $score += 2; $checks += "[WARN] ADR has $optCount options, need 3+ (+2)" }
        else { $checks += '[FAIL] ADR has no Option sections (+0)' }

        # Mermaid diagrams (5 pts)
        if ($adrContent -match '```mermaid') { $score += 5; $checks += '[PASS] Mermaid diagrams present (+5)' }
        else { $checks += '[FAIL] No Mermaid diagrams found (+0)' }

        # Zero code (5 pts)
        $codeBlocks = [regex]::Matches($adrContent, '```(csharp|python|typescript|javascript|bash|shell|sql|json|yaml)')
        if ($codeBlocks.Count -eq 0) { $score += 5; $checks += '[PASS] Zero code in ADR (+5)' }
        else { $checks += "[FAIL] $($codeBlocks.Count) code block(s) found in ADR (+0)" }

        # Research sources (3 pts)
        $urls = [regex]::Matches($adrContent, 'https?://')
        if ($urls.Count -ge 2) { $score += 3; $checks += "[PASS] Research sources: $($urls.Count) URLs cited (+3)" }
        else { $checks += '[WARN] Few/no research sources cited (+0)' }

        # Confidence markers (3 pts)
        if ($adrContent -match '\[Confidence:') { $score += 3; $checks += '[PASS] Confidence markers present (+3)' }
        else { $checks += '[WARN] No [Confidence:] markers (+0)' }
    } else { $checks += '[FAIL] No ADR found (+0)' }

    # Spec exists with 13 sections (13 pts)
    $specFiles = Get-ChildItem -Path (Join-Path $ROOT 'docs/specs') -Filter "SPEC-$id*.md" -File -ErrorAction SilentlyContinue
    if ($specFiles) {
        $specContent = Get-Content $specFiles[0].FullName -Raw -Encoding utf8
        $reqSections = @('Overview','Goals','Architecture','Component','Data Model','API','Security','Performance','Error','Monitor','Test','Migration','Open Questions')
        $found = 0
        foreach ($s in $reqSections) {
            if ($specContent -match "(?i)##\s+.*$s") { $found++ }
        }
        $score += $found
        $checks += "[$(if ($found -ge 10) {'PASS'} else {'WARN'})] Spec sections: $found/13 (+$found)"

        # AI-first assessment (3 pts)
        if ($specContent -match '(?i)(AI.first|GenAI|Agentic AI).*assessment') { $score += 3; $checks += '[PASS] AI-first assessment present (+3)' }
        else { $checks += '[WARN] No AI-first assessment section (+0)' }
    } else { $checks += '[FAIL] No Tech Spec found (+0)' }

    return @{ Score = $score; Max = $max; Checks = $checks }
}

function Score-PM {
    $score = 0; $max = 33; $checks = @()
    $id = if ($IssueNumber -gt 0) { $IssueNumber } else { '*' }

    # PRD exists (3 pts)
    $prdFiles = Get-ChildItem -Path (Join-Path $ROOT 'docs/prd') -Filter "PRD-$id*.md" -File -ErrorAction SilentlyContinue
    if ($prdFiles) {
        $score += 3; $checks += '[PASS] PRD exists (+3)'
        $prdContent = Get-Content $prdFiles[0].FullName -Raw -Encoding utf8

        # 12 required sections (12 pts, 1 each)
        $reqSections = @('Problem Statement','Target Users','Goals','Requirements','User Stories','User Flows','Dependencies','Risks','Timeline','Out of Scope','Open Questions','Appendix')
        $found = 0
        foreach ($s in $reqSections) {
            if ($prdContent -match "(?i)##\s+.*$s") { $found++ }
        }
        $score += $found
        $checks += "[$(if ($found -ge 10) {'PASS'} else {'WARN'})] PRD sections: $found/12 (+$found)"

        # Research Summary with URLs (5 pts)
        if ($prdContent -match '(?i)Research Summary') {
            $urls = [regex]::Matches($prdContent, 'https?://')
            if ($urls.Count -ge 3) { $score += 5; $checks += "[PASS] Research Summary with $($urls.Count) sources (+5)" }
            elseif ($urls.Count -ge 1) { $score += 3; $checks += "[WARN] Research Summary with few sources (+3)" }
            else { $score += 1; $checks += '[WARN] Research Summary present but no URLs (+1)' }
        } else { $checks += '[FAIL] No Research Summary section (+0)' }

        # User stories with acceptance criteria (5 pts)
        $stories = [regex]::Matches($prdContent, '(?i)As a .+ I want .+ So that')
        $ac = [regex]::Matches($prdContent, '(?i)Acceptance Criteria|Given .+ When .+ Then')
        if ($stories.Count -ge 3 -and $ac.Count -ge 3) { $score += 5; $checks += "[PASS] $($stories.Count) user stories with AC (+5)" }
        elseif ($stories.Count -ge 1) { $score += 2; $checks += "[WARN] $($stories.Count) user stories found (+2)" }
        else { $checks += '[FAIL] No user stories found (+0)' }

        # GenAI section if needed (3 pts)
        if ($prdContent -match '(?i)GenAI|needs:ai') {
            if ($prdContent -match '(?i)GenAI Requirements|LLM selection|evaluation strategy') { $score += 3; $checks += '[PASS] GenAI requirements section present (+3)' }
            else { $checks += '[WARN] AI context detected but no GenAI Requirements section (+0)' }
        } else { $score += 3; $checks += '[PASS] No AI context needed (N/A, +3)' }

        # Issues created (5 pts) - check for GitHub issue references
        $issueRefs = [regex]::Matches($prdContent, '#\d+')
        if ($issueRefs.Count -ge 3) { $score += 5; $checks += "[PASS] $($issueRefs.Count) issue references found (+5)" }
        elseif ($issueRefs.Count -ge 1) { $score += 2; $checks += "[WARN] $($issueRefs.Count) issue references (+2)" }
        else { $checks += '[WARN] No issue references in PRD (+0)' }
    } else { $checks += '[FAIL] No PRD found (+0)' }

    return @{ Score = $score; Max = $max; Checks = $checks }
}

# Main execution
$result = switch ($Role) {
    'engineer'  { Score-Engineer }
    'architect' { Score-Architect }
    'pm'        { Score-PM }
}

$pct = [math]::Round(($result.Score / $result.Max) * 100, 0)
$tier = switch ($pct) {
    { $_ -ge 90 } { 'High' }
    { $_ -ge 70 } { 'Medium-High' }
    { $_ -ge 50 } { 'Medium' }
    { $_ -ge 25 } { 'Low' }
    default { 'Invalid' }
}

Write-Host "`n  Output Score: $Role"
Write-Host "  ============================================="
Write-Host "  Score: $($result.Score)/$($result.Max) ($pct%) - $tier"
Write-Host "  ---------------------------------------------"
foreach ($c in $result.Checks) { Write-Host "  $c" }
Write-Host "  =============================================`n"

if ($pct -lt 70) { exit 1 } else { exit 0 }
