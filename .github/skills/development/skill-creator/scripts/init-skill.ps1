#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Scaffolds a new skill directory following the AgentX skill specification.
.DESCRIPTION
 Creates a SKILL.md with proper frontmatter, references/, scripts/, and assets/ directories,
 and optional starter files. Validates name against the agentskills.io spec.
.PARAMETER Name
 Skill name (lowercase, hyphens only, 1-64 chars). E.g., "mcp-server-development"
.PARAMETER Category
 Category folder. Must be one of: ai-systems, architecture, data, design, development, diagrams, domain, infrastructure, languages, operations, product, testing
.PARAMETER Description
 Short description (1-1024 chars) for the frontmatter
.PARAMETER WithScripts
 Create a scripts/ directory with a placeholder script
.PARAMETER WithReferences
 Create a references/ directory with a placeholder reference
.EXAMPLE
 ./init-skill.ps1 -Name "mcp-server-development" -Category "development" -Description "Build MCP servers"
 ./init-skill.ps1 -Name "my-skill" -Category "infrastructure" -Description "..." -WithScripts -WithReferences -WithAssets
#>
param(
 [Parameter(Mandatory = $true)]
 [string]$Name,

 [Parameter(Mandatory = $true)]
 [ValidateSet("ai-systems", "architecture", "data", "design", "development", "diagrams", "domain", "infrastructure", "languages", "operations", "product", "testing")]
 [string]$Category,

 [Parameter(Mandatory = $true)]
 [ValidateLength(1, 1024)]
 [string]$Description,

 [switch]$WithScripts,
 [switch]$WithReferences,
 [switch]$WithAssets
)

$ErrorActionPreference = "Stop"

# Convert display name to a valid kebab-case slug for directory/frontmatter name.
# e.g. "C/C++" -> "c-cpp", "My Skill!" -> "my-skill"
$Slug = $Name.ToLower() `
  -replace '[+]+', 'plus' `
  -replace '[#]+', 'sharp' `
  -replace '[^a-z0-9]+', '-' `
  -replace '-{2,}', '-' `
  -replace '^-|-$', ''
if ($Slug -notmatch '^[a-z][a-z0-9-]{0,63}$') {
  Write-Host " [FAIL] Could not generate a valid skill slug from name '$Name'. Got: '$Slug'" -ForegroundColor Red
  Write-Host "        Slug must match ^[a-z][a-z0-9-]{0,63}$. Please use a simpler name." -ForegroundColor Red
  exit 1
}

# Resolve skill root
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = Get-Location }
$skillDir = Join-Path $repoRoot ".github" "skills" $Category $Slug

Write-Host "`n=== Creating Skill: $Name (slug: $Slug) ===" -ForegroundColor Cyan

if (Test-Path $skillDir) {
 Write-Host " Skill directory already exists: $skillDir" -ForegroundColor Red
 exit 1
}

# Create main directory
New-Item -Path $skillDir -ItemType Directory -Force | Out-Null
Write-Host " Created: $skillDir" -ForegroundColor Green

# Generate SKILL.md
$today = Get-Date -Format "yyyy-MM-dd"
$skillContent = @"
---
name: "$Slug"
description: "$Description"
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "$today"
 updated: "$today"
---

# $Name

> $Description

## When to Use

- Use this skill when a task needs repeatable guidance for $Description.
- Apply it when the work falls under the $Category category and needs consistent decisions.
- Reach for it when reusable patterns are better than one-off instructions.

## Decision Tree

Is the task primarily about $Name?
+- Yes -> Apply this skill.
| +- Need a fast path? -> Start with Quick Start.
| - Need edge-case handling? -> Review Common Patterns and Anti-Patterns.
- No -> Pick a skill whose scope matches the main task more closely.

## Quick Start

1. Confirm the goal, inputs, and constraints for the requested work.
2. Apply the patterns and rules in this skill before editing or generating outputs.
3. Validate the result against the user request and repository conventions.

## Core Rules

1. Keep outputs tightly aligned to $Description instead of drifting into adjacent scope.
2. Prefer explicit, reusable patterns over improvised instructions.
3. Make tradeoffs and assumptions visible when requirements are ambiguous.
4. Remove placeholders and filler before treating the skill as ready.

## Common Patterns

### Discovery Pattern

- Clarify the expected outcome and success criteria.
- Identify the minimum context required before acting.
- Keep terminology consistent across prompts, docs, and artifacts.

### Execution Pattern

- Start with the smallest useful implementation or recommendation.
- Structure the output so the highest-value guidance appears first.
- Use examples that directly reflect the requested domain.

### Validation Pattern

- Check whether the output matches the requested format and scope.
- Remove duplicated guidance, vague filler, and unresolved placeholders.
- Ensure another engineer can reuse the result without extra explanation.

## Anti-Patterns

- Do not leave TODO markers or empty sections in the final skill.
- Do not broaden the skill into unrelated domains unless the description requires it.
- Do not hide assumptions that materially change the recommended approach.
- Do not provide examples that contradict the purpose of $Name.

## References

$(if ($WithReferences) {
"- [Reference Guide](references/reference-guide.md) - Extended examples and detailed patterns"
} else {
"- Add references/ when this skill needs deeper examples or domain notes."
})

## Assets

$(if ($WithAssets) {
"- `assets/` - Reusable templates, sample inputs, and starter artifacts"
} else {
"- Add assets/ for reusable templates, sample inputs, or starter artifacts."
})

## Scripts

$(if ($WithScripts) {
"- `scripts/example.ps1` - Starter helper for repeated workflow steps"
} else {
"- Add scripts/ for deterministic helpers that support this skill."
})
"@

Set-Content -Path (Join-Path $skillDir "SKILL.md") -Value $skillContent
Write-Host " Created: SKILL.md" -ForegroundColor Green

# Create optional directories
if ($WithScripts) {
 $scriptsDir = Join-Path $skillDir "scripts"
 New-Item -Path $scriptsDir -ItemType Directory -Force | Out-Null
 $scriptContent = @"
#!/usr/bin/env pwsh
<#
.SYNOPSIS
 [TODO] Describe what this script does.
.DESCRIPTION
 Part of the $Name skill. Created $today.
.EXAMPLE
 ./example.ps1
#>
Write-Host "TODO: Implement $Name script" -ForegroundColor Yellow
"@
 Set-Content -Path (Join-Path $scriptsDir "example.ps1") -Value $scriptContent
 Write-Host " Created: scripts/example.ps1" -ForegroundColor Green
}

if ($WithReferences) {
 $refsDir = Join-Path $skillDir "references"
 New-Item -Path $refsDir -ItemType Directory -Force | Out-Null
 $refContent = @"
# Reference Guide: $($Name.Replace('-', ' '))

> Extended examples and detailed patterns for the $Name skill.

## Detailed Examples

<!-- TODO: Add comprehensive examples here -->

## Edge Cases

<!-- TODO: Document edge cases and how to handle them -->

## Further Reading

<!-- TODO: Add links to external resources -->
"@
 Set-Content -Path (Join-Path $refsDir "reference-guide.md") -Value $refContent
 Write-Host " Created: references/reference-guide.md" -ForegroundColor Green
}

if ($WithAssets) {
 $assetsDir = Join-Path $skillDir "assets"
 New-Item -Path $assetsDir -ItemType Directory -Force | Out-Null
 Set-Content -Path (Join-Path $assetsDir ".gitkeep") -Value ""
 Write-Host " Created: assets/ (add templates, starter code, sample data)" -ForegroundColor Green
}

# Summary
Write-Host "`n=== Skill Created ===" -ForegroundColor Cyan
Write-Host " Location: $skillDir" -ForegroundColor White
Write-Host " Files:" -ForegroundColor White
Write-Host " - SKILL.md (frontmatter + template)" -ForegroundColor Gray
if ($WithScripts) { Write-Host " - scripts/example.ps1 (starter)" -ForegroundColor Gray }
if ($WithReferences) { Write-Host " - references/reference-guide.md (starter)" -ForegroundColor Gray }
if ($WithAssets) { Write-Host " - assets/ (templates, starter code)" -ForegroundColor Gray }
Write-Host "`n Next steps:" -ForegroundColor Yellow
Write-Host " 1. Review SKILL.md and tailor the generated guidance to your exact workflow" -ForegroundColor Gray
Write-Host " 2. Add the skill to Skills.md master index" -ForegroundColor Gray
Write-Host " 3. Test: read_file on the SKILL.md in Copilot" -ForegroundColor Gray
Write-Host ""
