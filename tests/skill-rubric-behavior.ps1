#!/usr/bin/env pwsh
# Behavioral tests for the deterministic 100-point skill-quality rubric.
#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$scorer = Join-Path $root 'scripts/score-skill.ps1'
$validator = Join-Path $root 'scripts/validate-skill.ps1'
$changedValidator = Join-Path $root 'scripts/validate-changed-skills.ps1'
$stocktake = Join-Path $root 'scripts/stocktake.ps1'
$parser = Join-Path $root 'scripts/parse-yaml.js'
$pass = 0
$fail = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { Write-Host "[PASS] $Message"; $script:pass++ }
    else { Write-Host "[FAIL] $Message"; $script:fail++ }
}

function New-SkillFixture([string]$Base, [string]$Name, [string]$Body, [string]$Category = 'architecture') {
    $directory = Join-Path (Join-Path $Base $Category) $Name
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    Set-Content -LiteralPath (Join-Path $directory 'SKILL.md') -Value $Body -Encoding ascii
    return $directory
}

function Score([string]$Path, [int]$Minimum = 70) {
    $json = & $scorer -SkillPath $Path -MinScore $Minimum -Json 2>$null | Out-String
    return $json | ConvertFrom-Json -Depth 20
}

function Score-Enforced([string]$Path, [int]$Minimum = 70) {
    $json = & $scorer -SkillPath $Path -MinScore $Minimum -Enforce -Json 2>$null | Out-String
    return $json | ConvertFrom-Json -Depth 20
}

function Parse-StandaloneYaml([string]$Content) {
    $parserRoot = Join-Path $temp 'standalone-parser'
    $parserPath = Join-Path $parserRoot 'parse-yaml.js'
    if (-not (Test-Path $parserPath)) {
        New-Item -ItemType Directory -Path $parserRoot -Force | Out-Null
        Copy-Item -LiteralPath $parser -Destination $parserPath
    }
    $output = $Content | & node $parserPath 2>&1 | Out-String
    return [PSCustomObject]@{ ExitCode = $LASTEXITCODE; Output = $output }
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ('agentx-skill-rubric-' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $temp | Out-Null
    $strong = New-SkillFixture $temp 'strong-skill' @'
---
name: strong-skill
description: 'Design reliable widgets. Use when creating, reviewing, or troubleshooting widget workflows and their operational guardrails.'
metadata:
  version: '1.0.0'
---
# Strong Skill
> WHEN: Designing or reviewing a widget implementation with operational constraints.
## When to Use
Use this skill for new widgets, widget reviews, and reliability changes that affect production behavior.
## Prerequisites
No external prerequisites are required beyond access to the current repository and its tests.
## Decision Tree
Choose review for an existing widget. Choose design for a new widget. Choose recovery when a failure already occurred.
## Core Rules
1. Validate input at the boundary and preserve internal invariants.
2. Use the smallest design that satisfies the acceptance criteria.
3. Record security assumptions and verify every externally observable claim.
## Workflow
Read the requirements, select a branch from the decision tree, implement the smallest change, run tests, then review the evidence.
## Error Handling
Stop on invalid input, preserve the original error context, and use a bounded retry only for documented transient failures.
## Checklist
- [ ] Requirements mapped to tests
- [ ] Error paths verified
- [ ] Evidence recorded
## Anti-Patterns
Do not hide missing evidence, invent unsupported APIs, or add speculative extension points.
'@
    $strongResult = Score $strong
    $strongSkill = @($strongResult.skills)[0]
    Assert-True ($strongSkill.score -ge 80) 'strong fixture scores at least Strong'
    Assert-True ($strongSkill.blockers.Count -eq 0) 'strong fixture has no blockers'
    Assert-True ($strongSkill.dimensions.Count -eq 7) 'rubric emits seven dimensions'

    $weak = New-SkillFixture $temp 'weak-skill' @'
---
name: weak-skill
description: 'Use when working with a weak but structurally valid demonstration skill that lacks actionable content.'
---
# Weak Skill
## When to Use
Use this for a demonstration only.
'@
    $weakResult = Score $weak
    $weakSkill = @($weakResult.skills)[0]
    Assert-True ($weakSkill.score -lt 70) 'weak fixture exposes score debt'
    Assert-True ($weakSkill.blockers.Count -eq 0) 'weak fixture is reportable without universal blockers'

    $mismatch = New-SkillFixture $temp 'mismatch-skill' @'
---
name: wrong-name
description: 'Use when validating that a frontmatter name mismatch is always a non-compensable rubric blocker.'
---
# Mismatch
## When to Use
Use this only as a blocking fixture for the rubric behavior suite.
'@
    $mismatchResult = Score $mismatch
    $mismatchSkill = @($mismatchResult.skills)[0]
    Assert-True ($mismatchSkill.blockers -contains 'name') 'name mismatch is blocking'

    $malformed = New-SkillFixture $temp 'malformed-yaml' @'
---
name: malformed-yaml
description: 'unterminated
---
# Malformed
## When to Use
Use this as invalid YAML fixture content for deterministic validation.
'@
    $malformedResult = Score $malformed
    Assert-True (@($malformedResult.skills)[0].blockers -contains 'frontmatter') 'malformed YAML is blocking'

    foreach ($invalidName in @('trailing-', 'double--hyphen')) {
        $invalid = New-SkillFixture $temp $invalidName @"
---
name: $invalidName
description: 'Use when validating that invalid Agent Skills names are rejected by the deterministic quality rubric.'
---
# Invalid Name
## When to Use
Use this only as an invalid-name fixture for deterministic validation.
"@
        $invalidResult = Score $invalid
        Assert-True (@($invalidResult.skills)[0].blockers -contains 'name') "invalid name '$invalidName' is blocking"
    }

    $nonString = New-SkillFixture $temp 'non-string-name' @'
---
name: true
description: 'Use when validating that non-string YAML metadata cannot satisfy the deterministic skill contract.'
---
# Non String
## When to Use
Use this only as a non-string metadata fixture.
'@
    $nonStringResult = Score $nonString
    Assert-True (@($nonStringResult.skills)[0].blockers -contains 'name') 'non-string YAML name is blocking'

    $standaloneValid = Parse-StandaloneYaml "name: sample-skill`ndescription: 'Use when validating standalone nested metadata parsing without installed YAML dependencies.'`nmetadata:`n version: '1.2.3'"
    Assert-True ($standaloneValid.ExitCode -eq 0 -and (($standaloneValid.Output | ConvertFrom-Json -Depth 10).metadata.version -eq '1.2.3')) 'standalone YAML parser accepts valid nested metadata'
    $standaloneMalformed = Parse-StandaloneYaml "name: sample-skill`nmetadata:`n  version: ["
    Assert-True ($standaloneMalformed.ExitCode -ne 0) 'standalone YAML parser rejects malformed nested flow syntax'
    $standaloneDuplicate = Parse-StandaloneYaml "name: sample-skill`nmetadata:`n  version: '1.0.0'`n  version: '2.0.0'"
    Assert-True ($standaloneDuplicate.ExitCode -ne 0) 'standalone YAML parser rejects duplicate nested keys'
    $standaloneSequence = Parse-StandaloneYaml "name: sample-skill`ncompatibility:`n  platforms:`n    - windows`n    - linux"
    $sequenceValue = $standaloneSequence.Output | ConvertFrom-Json -Depth 10
    Assert-True ($standaloneSequence.ExitCode -eq 0 -and @($sequenceValue.compatibility.platforms).Count -eq 2) 'standalone YAML parser accepts valid nested block sequences'

    $broken = New-SkillFixture $temp 'broken-link' @'
---
name: broken-link
description: 'Use when validating that unresolved local Markdown references fail the deterministic skill quality gate.'
---
# Broken Link
## When to Use
Use this only as a broken link fixture for rubric validation.
See [missing](references/missing.md).
'@
    $brokenResult = Score $broken
    $brokenSkill = @($brokenResult.skills)[0]
    Assert-True ($brokenSkill.blockers -contains 'local-links') 'broken local link is blocking'

    $encoded = New-SkillFixture $temp 'encoded-link' @'
---
name: encoded-link
description: 'Use when validating URL-encoded local Markdown references with spaces and fragment identifiers.'
---
# Encoded Link
## When to Use
Use this only as a URL-encoded local link fixture for rubric validation.
See [reference](references/My%20File.md#details).
'@
    New-Item -ItemType Directory -Path (Join-Path $encoded 'references') | Out-Null
    Set-Content -LiteralPath (Join-Path $encoded 'references/My File.md') -Value '# Details' -Encoding ascii
    $encodedResult = Score $encoded
    Assert-True (@($encodedResult.skills)[0].blockers -notcontains 'local-links') 'URL-encoded local link with fragment resolves correctly'

    $development = New-SkillFixture $temp 'development-skill' @'
---
name: development-skill
description: 'Use when validating that development skills surface missing rationalization guidance in rubric findings.'
---
# Development Skill
## When to Use
Use this fixture for deterministic development-category validation.
'@ 'development'
    $developmentResult = Score $development
    $developmentSkill = @($developmentResult.skills)[0]
    $rationalization = @($developmentSkill.findings | Where-Object id -eq 'rationalization')[0]
    Assert-True (-not $rationalization.pass) 'development skill reports missing rationalization table'
    $enforcedDevelopmentResult = Score-Enforced $development
    $enforcedDevelopment = @($enforcedDevelopmentResult.skills)[0]
    Assert-True ($enforcedDevelopment.blockers -contains 'rationalization') 'enforcement blocks missing development rationalization'

    $allJson = & $scorer -All -Json 2>$null | Out-String
    $all = $allJson | ConvertFrom-Json -Depth 20
    Assert-True ($all.total -eq 130) 'all-skills mode scores the complete 130-skill inventory'
    Assert-True ($all.blocked -eq 0) 'current inventory has no universal blockers'
    Assert-True ($all.belowMinimum -gt 0) 'current inventory debt remains visible'

    $stocktakeJson = & $stocktake -Threshold 0 -Json 2>$null | Out-String
    $stocktakeResult = $stocktakeJson | ConvertFrom-Json -Depth 20
    Assert-True ($stocktakeResult.total -eq 130) 'stocktake consumes all rubric results'
    Assert-True ($stocktakeResult.average -gt 0) 'stocktake reports real 100-point scores'
    Assert-True (@($stocktakeResult.ranked | Where-Object score -lt 0).Count -eq 0) 'stocktake has no legacy -1 scores'

    $validationOutput = & $validator -SkillPath $strong -MinScore 70 -EnforceScore -Json 2>&1 | Out-String
    Assert-True ($LASTEXITCODE -eq 0) 'validator consumes rubric score for strong skill'
    Assert-True ($validationOutput -match '"Score"\s*:\s*100') 'validator emits 100-point score in JSON'
    $failedValidationOutput = & $validator -SkillPath $mismatch -Json 2>&1 | Out-String
    $failedValidationExit = $LASTEXITCODE
    $failedValidation = $failedValidationOutput | ConvertFrom-Json -Depth 20
    Assert-True ($failedValidationExit -ne 0 -and $failedValidation.total -eq 1 -and $failedValidation.fail -eq 1 -and -not $failedValidation.success) 'validator failure JSON preserves the summary schema and nonzero exit'

    $newWeakPath = (Join-Path $weak 'SKILL.md').Replace('\', '/')
    Assert-True (-not $newWeakPath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) 'changed-skill fixtures stay isolated from repository paths'
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`nSkill rubric behavior: $pass passed, $fail failed"
if ($fail -gt 0) { exit 1 }
exit 0
