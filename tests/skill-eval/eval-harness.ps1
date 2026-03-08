#!/usr/bin/env pwsh
# Skill Eval Harness - Evaluate AgentX skill quality based on Phil Schmid's framework
# Reference: https://www.philschmid.de/testing-skills
#
# Three evaluation levels:
#   1. Trigger Quality - Is the description specific enough to trigger correctly?
#   2. Instruction Quality - Are instructions directive, not informational?
#   3. Convention Compliance - Does the skill follow AgentX patterns?
#
# Usage:
#   .\tests\skill-eval\eval-harness.ps1                         # Evaluate all skills
#   .\tests\skill-eval\eval-harness.ps1 -SkillPath .github/skills/architecture/api-design
#   .\tests\skill-eval\eval-harness.ps1 -WithPrompts            # Include prompt-set checks
#   .\tests\skill-eval\eval-harness.ps1 -Json                   # JSON output
#Requires -Version 7.0
param(
    [string]$SkillPath = '',
    [switch]$WithPrompts,
    [switch]$Json,
    [switch]$Verbose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

# ============================================================================
# CHECK REGISTRY - Deterministic checks (regex-based, no LLM needed)
# Each check returns: @{ Id; Passed; Severity; Detail }
# ============================================================================

function New-CheckResult([string]$Id, [bool]$Passed, [string]$Severity, [string]$Detail) {
    [PSCustomObject]@{ Id = $Id; Passed = $Passed; Severity = $Severity; Detail = $Detail }
}

# --- Trigger Quality Checks (description is the trigger mechanism) ---

function Test-DescriptionExists([string]$content) {
    $has = $content -match "description:\s*[`"'](.+?)[`"']"
    if (-not $has) {
        # Check for multiline description
        $has = $content -match '(?m)description:\s*>-?\s*$'
    }
    New-CheckResult 'trigger_description_exists' $has 'HIGH' $(
        if ($has) { 'Frontmatter description present' }
        else { 'No description found - skill will never trigger' }
    )
}

function Test-DescriptionSpecificity([string]$description) {
    # Vague descriptions cause false triggers. Check for specificity signals.
    $wordCount = ($description -split '\s+').Count
    $specific = $wordCount -ge 10
    New-CheckResult 'trigger_description_specificity' $specific 'HIGH' $(
        if ($specific) { "Description has $wordCount words (>=10)" }
        else { "Description too short ($wordCount words) - will trigger unreliably" }
    )
}

function Test-DescriptionHasTriggerPhrase([string]$description) {
    # Phil Schmid: "The name and description are the trigger mechanism"
    $hasTrigger = $description -match '(?i)(Use when|Use for|Use this|WHEN:|TRIGGER:|Apply when|Invoke when|Load when)'
    New-CheckResult 'trigger_has_when_phrase' $hasTrigger 'MEDIUM' $(
        if ($hasTrigger) { 'Description contains trigger phrase (Use when/TRIGGER/etc.)' }
        else { 'No trigger phrase found - agent may not know when to activate this skill' }
    )
}

function Test-DescriptionHasNegation([string]$description) {
    # Phil Schmid: "DO NOT USE" in descriptions causes false triggers
    $hasNeg = $description -match '(?i)(DO NOT USE|NOT for|NEVER use|Don''t use)'
    New-CheckResult 'trigger_no_negative_keywords' (-not $hasNeg) 'MEDIUM' $(
        if (-not $hasNeg) { 'No negative keywords in description (good)' }
        else { 'Negative keywords found - these cause false triggers on some agents' }
    )
}

function Test-DescriptionOverlap([string]$description, [string]$skillName, [hashtable]$allDescriptions) {
    # Check if this description is too similar to other skills
    $myWords = [System.Collections.Generic.HashSet[string]]::new(
        [string[]]($description.ToLower() -split '\s+' | Where-Object { $_.Length -gt 4 })
    )
    $overlaps = @()
    foreach ($kv in $allDescriptions.GetEnumerator()) {
        if ($kv.Key -eq $skillName) { continue }
        $otherWords = [System.Collections.Generic.HashSet[string]]::new(
            [string[]]($kv.Value.ToLower() -split '\s+' | Where-Object { $_.Length -gt 4 })
        )
        $intersection = [System.Collections.Generic.HashSet[string]]::new($myWords)
        $intersection.IntersectWith($otherWords)
        $union = [System.Collections.Generic.HashSet[string]]::new($myWords)
        $union.UnionWith($otherWords)
        if ($union.Count -gt 0) {
            $jaccard = $intersection.Count / $union.Count
            if ($jaccard -gt 0.5) {
                $overlaps += "$($kv.Key) (Jaccard=$([math]::Round($jaccard, 2)))"
            }
        }
    }
    $passed = $overlaps.Count -eq 0
    New-CheckResult 'trigger_no_description_overlap' $passed 'LOW' $(
        if ($passed) { 'No high-overlap skills (Jaccard < 0.5)' }
        else { "High overlap with: $($overlaps -join ', ') - may cause wrong skill selection" }
    )
}

# --- Instruction Quality Checks ---

function Test-UsesDirectives([string]$content) {
    # Phil Schmid: "Use directives, not information. 'Always use X' works. 'X is recommended' doesn't."
    $directivePatterns = @(
        'MUST\s', 'MUST NOT\s', 'SHOULD\s', 'SHOULD NOT\s',
        'Always\s', 'Never\s', 'DO NOT\s', 'REQUIRED', 'MANDATORY'
    )
    $directiveCount = 0
    foreach ($p in $directivePatterns) {
        $directiveCount += @([regex]::Matches($content, $p)).Count
    }
    # Also count informational phrasing
    $infoPatterns = @(
        'is recommended', 'is preferred', 'it is suggested', 'consider using',
        'you may want to', 'you could', 'it''s a good idea'
    )
    $infoCount = 0
    foreach ($p in $infoPatterns) {
        $infoCount += @([regex]::Matches($content, "(?i)$p")).Count
    }
    $ratio = if (($directiveCount + $infoCount) -gt 0) { $directiveCount / ($directiveCount + $infoCount) } else { 0 }
    $passed = $ratio -ge 0.7
    New-CheckResult 'instruction_directive_ratio' $passed 'MEDIUM' $(
        if ($passed) { "Directive ratio: $([math]::Round($ratio, 2)) ($directiveCount directives, $infoCount informational)" }
        else { "Too informational: ratio $([math]::Round($ratio, 2)) ($directiveCount directives, $infoCount informational) - use directives instead" }
    )
}

function Test-HasActionableRules([string]$content) {
    # Skills should have concrete rules, not just explanations
    $ruleIndicators = @([regex]::Matches($content, '(?m)^[-*]\s+\*\*[A-Z]')).Count  # Bold bullet points
    $ruleIndicators += @([regex]::Matches($content, '(?m)^\d+\.\s+')).Count          # Numbered lists
    $ruleIndicators += @([regex]::Matches($content, '(?m)^[-|]\s+`[A-Za-z]')).Count  # Code in lists
    $passed = $ruleIndicators -ge 5
    New-CheckResult 'instruction_has_actionable_rules' $passed 'LOW' $(
        if ($passed) { "Found $ruleIndicators actionable rule indicators" }
        else { "Only $ruleIndicators rule indicators found - skill may lack concrete guidance" }
    )
}

function Test-HasCodeExamples([string]$content) {
    $codeBlocks = @([regex]::Matches($content, '```')).Count / 2
    $passed = $codeBlocks -ge 1
    New-CheckResult 'instruction_has_code_examples' $passed 'LOW' $(
        if ($passed) { "Found $([math]::Floor($codeBlocks)) code blocks" }
        else { 'No code examples found - skill may not give agent enough context' }
    )
}

function Test-HasAntiPatterns([string]$content) {
    $has = $content -match '(?i)(anti-?pattern|common mistake|pitfall|error handling|what not to do|avoid)'
    New-CheckResult 'instruction_has_anti_patterns' $has 'LOW' $(
        if ($has) { 'Has anti-pattern or error guidance' }
        else { 'No anti-pattern/error section - agent may make common mistakes' }
    )
}

# --- Convention Compliance Checks ---

function Test-TokenBudget([string]$content) {
    $tokens = [math]::Ceiling($content.Length / 4)
    $passed = $tokens -le 5000
    New-CheckResult 'convention_token_budget' $passed 'HIGH' $(
        if ($passed) { "Token estimate: $tokens / 5000" }
        else { "Token estimate: $tokens exceeds 5000 limit" }
    )
}

function Test-KebabCaseDir([string]$dirName) {
    $passed = $dirName -match '^[a-z][a-z0-9-]*$'
    New-CheckResult 'convention_kebab_case' $passed 'HIGH' $(
        if ($passed) { "Directory name '$dirName' is valid kebab-case" }
        else { "Directory name '$dirName' violates kebab-case convention" }
    )
}

function Test-StructureCompliance([string]$skillDir) {
    $allowed = @('SKILL.md', 'scripts', 'references', 'assets')
    $items = Get-ChildItem $skillDir -Name
    $violations = @($items | Where-Object {
        $name = $_
        -not ($allowed | Where-Object { $name -eq $_ -or $name -match "^$_[/\\]" })
    })
    $passed = $violations.Count -eq 0
    New-CheckResult 'convention_structure' $passed 'MEDIUM' $(
        if ($passed) { 'Only allowed items at skill root (SKILL.md, scripts/, references/, assets/)' }
        else { "Unexpected items at root: $($violations -join ', ')" }
    )
}

function Test-FrontmatterName([string]$content, [string]$dirName) {
    # Match quoted or unquoted name values in YAML frontmatter
    $has = $content -match 'name:\s*[''"]?([a-z][a-z0-9-]*)[''"]?'
    $nameMatch = $has -and ($Matches[1] -eq $dirName)
    New-CheckResult 'convention_name_matches_dir' $nameMatch 'MEDIUM' $(
        if ($nameMatch) { "Frontmatter name matches directory: '$dirName'" }
        elseif ($has) { "Frontmatter name '$($Matches[1])' does not match directory '$dirName'" }
        else { "No frontmatter name field found" }
    )
}

function Test-HasWhenToUseSection([string]$content) {
    # Match ## When to Use, ## WHEN, or > WHEN: patterns
    $has = $content -match '(?m)(##\s+(When to Use|WHEN)|>\s*\*?\*?WHEN\*?\*?:)'
    New-CheckResult 'convention_when_section' $has 'MEDIUM' $(
        if ($has) { 'Has "When to Use" section' }
        else { 'Missing "When to Use" section - required by AgentX spec' }
    )
}

function Test-AsciiOnly([string]$content) {
    $nonAscii = [regex]::Matches($content, '[^\x00-\x7F]')
    $passed = $nonAscii.Count -eq 0
    New-CheckResult 'convention_ascii_only' $passed 'MEDIUM' $(
        if ($passed) { 'Content is ASCII-only' }
        else { "Found $($nonAscii.Count) non-ASCII characters (violates AgentX ASCII rule)" }
    )
}

# ============================================================================
# PROMPT SET EVALUATION (optional, for trigger accuracy testing)
# ============================================================================

function Get-PromptSetPath([string]$skillDir) {
    $name = Split-Path $skillDir -Leaf
    $promptFile = Join-Path $PSScriptRoot "prompts\$name.json"
    if (Test-Path $promptFile) { return $promptFile }
    return $null
}

function Test-PromptSet([string]$skillDir, [string]$description) {
    $promptFile = Get-PromptSetPath $skillDir
    if (-not $promptFile) { return @() }

    $prompts = Get-Content $promptFile -Raw | ConvertFrom-Json
    $results = @()
    $descLower = $description.ToLower()

    foreach ($testCase in $prompts) {
        # Simple keyword-matching trigger simulation:
        # Extract significant words from the prompt and check if they appear in the description
        $promptWords = @($testCase.prompt.ToLower() -split '\s+' | Where-Object { $_.Length -gt 3 })
        $descWords = @($descLower -split '\s+' | Where-Object { $_.Length -gt 3 })
        $matchCount = @($promptWords | Where-Object { $_ -in $descWords }).Count
        $wouldTrigger = ($matchCount / [math]::Max($promptWords.Count, 1)) -gt 0.15

        if ($testCase.should_trigger -eq $true) {
            $passed = $wouldTrigger
            $results += New-CheckResult "prompt_$($testCase.id)" $passed 'MEDIUM' $(
                if ($passed) { "POSITIVE: '$($testCase.id)' triggered correctly ($matchCount keyword matches)" }
                else { "POSITIVE: '$($testCase.id)' did NOT trigger (expected to trigger, $matchCount matches)" }
            )
        } else {
            $passed = -not $wouldTrigger
            $results += New-CheckResult "prompt_$($testCase.id)" $passed 'MEDIUM' $(
                if ($passed) { "NEGATIVE: '$($testCase.id)' correctly did NOT trigger" }
                else { "NEGATIVE: '$($testCase.id)' triggered falsely ($matchCount keyword matches)" }
            )
        }
    }
    return $results
}

# ============================================================================
# MAIN EVALUATOR
# ============================================================================

function Get-SkillDescription([string]$content) {
    if ($content -match "description:\s*[`"'](.+?)[`"']") { return $Matches[1] }
    # Multiline
    $lines = $content -split "`n"
    $descLines = @()
    $inDesc = $false
    foreach ($l in $lines) {
        if ($l -match '^\s*description:\s*>') { $inDesc = $true; continue }
        if ($inDesc) {
            if ($l -match '^\s{2,}\S') { $descLines += $l.Trim() }
            else { break }
        }
    }
    if ($descLines.Count -gt 0) { return ($descLines -join ' ') }
    return ''
}

function Invoke-SkillEval([string]$skillDir, [hashtable]$allDescriptions) {
    $skillFile = Join-Path $skillDir 'SKILL.md'
    if (-not (Test-Path $skillFile)) {
        return [PSCustomObject]@{
            Name = (Split-Path $skillDir -Leaf)
            Checks = @(New-CheckResult 'skill_exists' $false 'HIGH' 'SKILL.md not found')
            Score = 0; MaxScore = 0; PassRate = 0; Tier = 'FAIL'
        }
    }

    $content = Get-Content $skillFile -Raw -Encoding utf8
    $dirName = Split-Path $skillDir -Leaf
    $description = Get-SkillDescription $content
    $checks = @()

    # --- Trigger Quality ---
    $checks += Test-DescriptionExists $content
    if ($description) {
        $checks += Test-DescriptionSpecificity $description
        $checks += Test-DescriptionHasTriggerPhrase $description
        $checks += Test-DescriptionHasNegation $description
        $checks += Test-DescriptionOverlap $description $dirName $allDescriptions
    }

    # --- Instruction Quality ---
    $checks += Test-UsesDirectives $content
    $checks += Test-HasActionableRules $content
    $checks += Test-HasCodeExamples $content
    $checks += Test-HasAntiPatterns $content

    # --- Convention Compliance ---
    $checks += Test-TokenBudget $content
    $checks += Test-KebabCaseDir $dirName
    $checks += Test-StructureCompliance $skillDir
    $checks += Test-FrontmatterName $content $dirName
    $checks += Test-HasWhenToUseSection $content
    $checks += Test-AsciiOnly $content

    # --- Prompt Set (optional) ---
    if ($WithPrompts) {
        $promptResults = @(Test-PromptSet $skillDir $description)
        if ($promptResults.Count -gt 0) { $checks += $promptResults }
    }

    # --- Score ---
    $weights = @{ 'HIGH' = 3; 'MEDIUM' = 2; 'LOW' = 1 }
    $maxScore = 0; $earnedScore = 0
    foreach ($c in $checks) {
        $w = $weights[$c.Severity]
        $maxScore += $w
        if ($c.Passed) { $earnedScore += $w }
    }
    $passRate = if ($checks.Count -gt 0) { [math]::Round(($checks | Where-Object Passed).Count / $checks.Count * 100, 1) } else { 0 }
    $pct = if ($maxScore -gt 0) { [math]::Round($earnedScore / $maxScore * 100) } else { 0 }
    $tier = switch ($pct) {
        { $_ -ge 90 } { 'Excellent'; break }
        { $_ -ge 75 } { 'Good'; break }
        { $_ -ge 60 } { 'Fair'; break }
        { $_ -ge 40 } { 'Needs Work'; break }
        default { 'Poor' }
    }

    return [PSCustomObject]@{
        Name = $dirName; Checks = $checks
        Score = $earnedScore; MaxScore = $maxScore; Percentage = $pct
        PassRate = $passRate; Tier = $tier
    }
}

# ============================================================================
# DISCOVERY & EXECUTION
# ============================================================================

# Collect all skill directories
$skillDirs = @()
if ($SkillPath) {
    $resolved = if ([System.IO.Path]::IsPathRooted($SkillPath)) { $SkillPath } else { Join-Path $ROOT $SkillPath }
    if (Test-Path $resolved) { $skillDirs += $resolved }
    else { Write-Error "Skill path not found: $resolved"; exit 1 }
} else {
    $skillDirs = @(Get-ChildItem -Path (Join-Path $ROOT '.github/skills') -Directory -Recurse |
        Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } |
        ForEach-Object { $_.FullName })
}

# Pre-collect all descriptions for overlap detection
$allDescriptions = @{}
foreach ($d in $skillDirs) {
    $sf = Join-Path $d 'SKILL.md'
    if (Test-Path $sf) {
        $c = Get-Content $sf -Raw -Encoding utf8
        $desc = Get-SkillDescription $c
        if ($desc) { $allDescriptions[(Split-Path $d -Leaf)] = $desc }
    }
}

# Run evaluations
$results = @()
foreach ($d in $skillDirs) {
    $results += Invoke-SkillEval $d $allDescriptions
}

# ============================================================================
# OUTPUT
# ============================================================================

if ($Json) {
    $jsonResults = $results | ForEach-Object {
        @{
            name = $_.Name; score = $_.Score; maxScore = $_.MaxScore
            percentage = $_.Percentage; passRate = $_.PassRate; tier = $_.Tier
            checks = @($_.Checks | ForEach-Object {
                @{ id = $_.Id; passed = $_.Passed; severity = $_.Severity; detail = $_.Detail }
            })
        }
    }
    $jsonResults | ConvertTo-Json -Depth 5
    exit 0
}

# Human-readable report
Write-Host ""
Write-Host "  Skill Evaluation Report (Phil Schmid Framework)"
Write-Host "  ================================================"
Write-Host "  Checks: Trigger Quality | Instruction Quality | Convention Compliance"
Write-Host ""

$sorted = $results | Sort-Object Percentage -Descending
foreach ($r in $sorted) {
    $color = switch ($r.Tier) { 'Excellent' { '32' } 'Good' { '32' } 'Fair' { '33' } 'Needs Work' { '33' } default { '31' } }
    $pctStr = "$($r.Percentage)%".PadLeft(4)
    Write-Host ("  `e[${color}m{0,-12}`e[0m {1} ({2}/{3})  {4}" -f $r.Tier, $pctStr, $r.Score, $r.MaxScore, $r.Name)
    if ($Verbose) {
        foreach ($c in $r.Checks) {
            $mark = if ($c.Passed) { '[PASS]' } else { '[FAIL]' }
            $sev = "[$($c.Severity)]"
            Write-Host "    $mark $sev $($c.Detail)"
        }
        Write-Host ""
    }
}

# Summary
$totalChecks = ($results | ForEach-Object { $_.Checks.Count } | Measure-Object -Sum).Sum
$totalPassed = ($results | ForEach-Object { @($_.Checks | Where-Object Passed).Count } | Measure-Object -Sum).Sum
$avgPct = [math]::Round(($results | Measure-Object -Property Percentage -Average).Average, 1)
$excellent = @($results | Where-Object Tier -eq 'Excellent').Count
$good = @($results | Where-Object Tier -eq 'Good').Count
$fair = @($results | Where-Object Tier -eq 'Fair').Count
$needsWork = @($results | Where-Object { $_.Tier -eq 'Needs Work' -or $_.Tier -eq 'Poor' }).Count

Write-Host ""
Write-Host "  Summary"
Write-Host "  -------"
Write-Host "  Skills evaluated: $($results.Count)"
Write-Host "  Total checks: $totalChecks ($totalPassed passed, $($totalChecks - $totalPassed) failed)"
Write-Host "  Average score: $avgPct%"
Write-Host "  Excellent: $excellent | Good: $good | Fair: $fair | Needs Work: $needsWork"

# Prompt-set stats
if ($WithPrompts) {
    $promptSkills = @($results | Where-Object { $_.Checks | Where-Object { $_.Id -match '^prompt_' } })
    $promptTotal = $promptSkills.Count
    Write-Host "  Skills with prompt sets: $promptTotal / $($results.Count)"
}

# Top issues
$failures = @()
foreach ($r in $results) {
    foreach ($c in $r.Checks) {
        if (-not $c.Passed -and $c.Severity -eq 'HIGH') {
            $failures += [PSCustomObject]@{ Skill = $r.Name; Check = $c.Id; Detail = $c.Detail }
        }
    }
}
if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "  HIGH-Severity Failures"
    Write-Host "  ----------------------"
    foreach ($f in $failures) {
        Write-Host "  [FAIL] $($f.Skill): $($f.Detail)"
    }
}

Write-Host ""
Write-Host "  Reference: https://www.philschmid.de/testing-skills"
Write-Host ""

# Exit with error if any HIGH failures
if ($failures.Count -gt 0) { exit 1 }
exit 0
