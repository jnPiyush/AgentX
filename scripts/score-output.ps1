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

function Get-ItemCount($value) {
    if ($null -eq $value) { return 0 }
    return @($value).Count
}

function Get-NodeProjectRoot {
    $candidatePaths = @(
        $ROOT,
        (Join-Path $ROOT 'vscode-extension')
    )
    foreach ($candidate in $candidatePaths) {
        if (Test-Path (Join-Path $candidate 'package.json')) {
            return $candidate
        }
    }
    return $null
}

function Test-FileExists([string]$pattern) {
    $found = Get-ChildItem -Path $ROOT -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $found
}

function Get-ExistingPaths([string[]]$paths) {
    return @($paths | Where-Object { Test-Path $_ })
}

function Get-ChangedCodeFiles {
    try {
        $changedPaths = @(& git -C $ROOT status --short 2>$null |
            ForEach-Object { $_.Substring(3).Trim() } |
            Where-Object { $_ -match '\.(ts|cs|py|ps1)$' })

        return @($changedPaths |
            ForEach-Object { Join-Path $ROOT $_ } |
            Where-Object { Test-Path $_ } |
            Get-Item |
            Where-Object { $_.FullName -notmatch '[\/](node_modules|\.git|out|coverage|build)[\/]' })
    } catch {
        return @()
    }
}

function Get-AddedCodeLines {
    $codeExtensions = @('ts','cs','py','ps1')
    $records = @()

    try {
        $currentPath = $null
        $diffLines = @(& git -C $ROOT diff --unified=0 -- '*.ts' '*.cs' '*.py' '*.ps1' 2>$null)
        foreach ($diffLine in $diffLines) {
            if ($diffLine -match '^\+\+\+ b/(.+)$') {
                $currentPath = Join-Path $ROOT $Matches[1]
                continue
            }
            if (-not $currentPath -or -not $diffLine.StartsWith('+') -or $diffLine.StartsWith('+++')) { continue }
            $records += [PSCustomObject]@{ Path = $currentPath; Text = $diffLine.Substring(1) }
        }

        $untrackedPaths = @(& git -C $ROOT status --short 2>$null |
            Where-Object { $_.StartsWith('?? ') } |
            ForEach-Object { $_.Substring(3).Trim() } |
            Where-Object { $_ -match '\.(' + ($codeExtensions -join '|') + ')$' })

        foreach ($relativePath in $untrackedPaths) {
            $fullPath = Join-Path $ROOT $relativePath
            if (-not (Test-Path $fullPath)) { continue }
            foreach ($line in @(Get-Content -Path $fullPath -ErrorAction SilentlyContinue)) {
                $records += [PSCustomObject]@{ Path = $fullPath; Text = [string]$line }
            }
        }
    } catch {
        return @()
    }

    return @($records | Where-Object { $_.Path -notmatch '[\/](node_modules|\.git|out|coverage|build)[\/]' })
}

function Get-ScoredCodeFiles {
    $changedCodeFiles = Get-ChangedCodeFiles
    if ((Get-ItemCount $changedCodeFiles) -gt 0) { return $changedCodeFiles }

    $codeRoots = Get-ExistingPaths @(
        (Join-Path $ROOT '.agentx'),
        (Join-Path $ROOT 'scripts'),
        (Join-Path $ROOT 'tests'),
        (Join-Path $ROOT 'vscode-extension' 'src'),
        (Join-Path $ROOT 'companions' 'video-studio' 'src'),
        (Join-Path $ROOT 'companions' 'whatsapp' 'src'),
        (Join-Path $ROOT 'companions' 'whatsapp' 'test')
    )

    if ((Get-ItemCount $codeRoots) -eq 0) { return @() }

    return @(Get-ChildItem -Path $codeRoots -Include '*.ts','*.cs','*.py','*.ps1' -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/](node_modules|\.git|out|coverage|build)[\\/]' })
}

function Invoke-EngineerScore {
    $score = 0; $max = 45; $checks = @()
    $nodeProjectRoot = Get-NodeProjectRoot

    # Tests pass (10 pts) - check if test command exits cleanly
    if ($nodeProjectRoot) {
        try {
            Push-Location $nodeProjectRoot
            $null = npm test 2>&1
            if ($LASTEXITCODE -eq 0) { $score += 10; $checks += '[PASS] Tests pass (+10)' }
            else { $checks += '[FAIL] Tests failing (+0)' }
            Pop-Location
        } catch { $checks += '[FAIL] Test execution error (+0)'; Pop-Location }
    } else { $checks += '[SKIP] No test framework detected (+0)' }

    # Lint clean (5 pts)
    if ($nodeProjectRoot) {
        try {
            Push-Location $nodeProjectRoot
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
        $secretHits = Get-ChildItem -Path (Join-Path $ROOT 'src'), (Join-Path $ROOT 'vscode-extension/src') -Filter '*.ts' -Recurse -File -ErrorAction SilentlyContinue |
            Select-String -Pattern $p -ErrorAction SilentlyContinue
        if ((Get-ItemCount $secretHits) -gt 0) { $secretFound = $true; break }
    }
    if (-not $secretFound) { $score += 5; $checks += '[PASS] No hardcoded secrets (+5)' }
    else { $checks += '[FAIL] Hardcoded secrets detected (+0)' }

    # SQL parameterized (5 pts) - check for string concatenation in SQL
    $sqlPattern = '((?<![A-Za-z0-9_])f"[^"]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"]*|"[^"]*\$[A-Za-z_:][A-Za-z0-9_:]*[^"]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"]*"|"[^"]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"]*\$[A-Za-z_:][A-Za-z0-9_:]*[^"]*")'
    $addedCodeLines = Get-AddedCodeLines
    if ((Get-ItemCount $addedCodeLines) -gt 0) {
        $sqlConcat = @($addedCodeLines | Where-Object { $_.Path -ne $PSCommandPath -and $_.Text -match $sqlPattern })
    } else {
        $sqlConcat = Get-ScoredCodeFiles |
            Select-String -Pattern $sqlPattern -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -ne $PSCommandPath }
    }
    if ((Get-ItemCount $sqlConcat) -eq 0) { $score += 5; $checks += '[PASS] SQL parameterized (+5)' }
    else { $checks += '[FAIL] SQL string concatenation found (+0)' }

    # No TODO/FIXME (2 pts)
    if ((Get-ItemCount $addedCodeLines) -gt 0) {
        $todos = @($addedCodeLines | Where-Object { $_.Path -ne $PSCommandPath -and $_.Text -match 'TODO|FIXME' })
    } else {
        $todos = Get-ScoredCodeFiles |
            Select-String -Pattern 'TODO|FIXME' -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -ne $PSCommandPath }
    }
    $todoCount = Get-ItemCount $todos
    if ($todoCount -eq 0) { $score += 2; $checks += '[PASS] No TODO/FIXME markers (+2)' }
    else { $checks += "[WARN] $todoCount TODO/FIXME markers found (+0)" }

    # Docs updated (3 pts) - check if README or docs were modified in recent commits
    try {
        $recentDocs = @(& git -C $ROOT diff --name-only HEAD~3 2>$null | Where-Object { $_ -match '\.md$' })
        if ($recentDocs) { $score += 3; $checks += '[PASS] Documentation updated (+3)' }
        else { $checks += '[WARN] No doc updates in recent commits (+0)' }
    } catch { $checks += '[SKIP] Git history check failed (+0)' }

    # Coverage check (10 pts) - approximate from test file count vs source file count
    $srcRoots = @()
    if (Test-Path (Join-Path $ROOT 'src')) { $srcRoots += (Join-Path $ROOT 'src') }
    if (Test-Path (Join-Path $ROOT 'vscode-extension/src')) { $srcRoots += (Join-Path $ROOT 'vscode-extension/src') }
    $testRoots = @()
    if (Test-Path (Join-Path $ROOT 'tests')) { $testRoots += (Join-Path $ROOT 'tests') }
    if (Test-Path (Join-Path $ROOT 'vscode-extension/src/test')) { $testRoots += (Join-Path $ROOT 'vscode-extension/src/test') }
    $srcFiles = Get-ItemCount (Get-ChildItem -Path $srcRoots -Include '*.ts','*.ps1' -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch 'test|node_modules|\.git' })
    $testFiles = Get-ItemCount (Get-ChildItem -Path $testRoots -Include '*.test.ts','*.spec.ts','*.ps1' -Recurse -File -ErrorAction SilentlyContinue)
    if ($srcFiles -gt 0) {
        $ratio = [math]::Round(($testFiles / $srcFiles) * 100, 0)
        if ($ratio -ge 50) { $score += 10; $checks += "[PASS] Test coverage proxy: $ratio% test-to-source ratio (+10)" }
        elseif ($ratio -ge 30) { $score += 5; $checks += "[WARN] Test coverage proxy: $ratio% test-to-source ratio (+5)" }
        else { $checks += "[FAIL] Test coverage proxy: $ratio% test-to-source ratio (+0)" }
    }

    return @{ Score = $score; Max = $max; Checks = $checks }
}

function Invoke-ArchitectScore {
    $score = 0; $max = 40; $checks = @()
    $id = if ($IssueNumber -gt 0) { $IssueNumber } else { '*' }

    # ADR exists (3 pts)
    $adrFiles = @(Get-ChildItem -Path (Join-Path $ROOT 'docs/artifacts/adr') -Filter "ADR-$id*.md" -File -ErrorAction SilentlyContinue)
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
    $specFiles = @(Get-ChildItem -Path (Join-Path $ROOT 'docs/artifacts/specs') -Filter "SPEC-$id*.md" -File -ErrorAction SilentlyContinue)
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

function Invoke-PMScore {
    $score = 0; $max = 33; $checks = @()
    $id = if ($IssueNumber -gt 0) { $IssueNumber } else { '*' }

    # PRD exists (3 pts)
    $prdFiles = @(Get-ChildItem -Path (Join-Path $ROOT 'docs/artifacts/prd') -Filter "PRD-$id*.md" -File -ErrorAction SilentlyContinue)
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
    'engineer'  { Invoke-EngineerScore }
    'architect' { Invoke-ArchitectScore }
    'pm'        { Invoke-PMScore }
}

$pct = [math]::Round(($result.Score / $result.Max) * 100, 0)
$tier = if ($pct -ge 90) { 'High' }
    elseif ($pct -ge 70) { 'Medium-High' }
    elseif ($pct -ge 50) { 'Medium' }
    elseif ($pct -ge 25) { 'Low' }
    else { 'Invalid' }

Write-Host "`n  Output Score: $Role"
Write-Host "  ============================================="
Write-Host "  Score: $($result.Score)/$($result.Max) ($pct%) - $tier"
Write-Host "  ---------------------------------------------"
foreach ($c in $result.Checks) { Write-Host "  $c" }
Write-Host "  =============================================`n"

if ($pct -lt 70) { exit 1 } else { exit 0 }
