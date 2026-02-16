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
 Category folder: ai-systems, architecture, cloud, design, development, operations
.PARAMETER Description
 Short description (1-1024 chars) for the frontmatter
.PARAMETER WithScripts
 Create a scripts/ directory with a placeholder script
.PARAMETER WithReferences
 Create a references/ directory with a placeholder reference
.EXAMPLE
 ./init-skill.ps1 -Name "mcp-server-development" -Category "development" -Description "Build MCP servers"
 ./init-skill.ps1 -Name "docker-k8s" -Category "cloud" -Description "Container orchestration" -WithScripts -WithReferences -WithAssets
#>
param(
 [Parameter(Mandatory = $true)]
 [ValidatePattern('^[a-z][a-z0-9-]{0,63}$')]
 [string]$Name,

 [Parameter(Mandatory = $true)]
 [ValidateSet("ai-systems", "architecture", "cloud", "design", "development", "operations")]
 [string]$Category,

 [Parameter(Mandatory = $true)]
 [ValidateLength(1, 1024)]
 [string]$Description,

 [switch]$WithScripts,
 [switch]$WithReferences,
 [switch]$WithAssets
)

$ErrorActionPreference = "Stop"

# Resolve skill root
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = Get-Location }
$skillDir = Join-Path $repoRoot ".github" "skills" $Category $Name

Write-Host "`n=== Creating Skill: $Name ===" -ForegroundColor Cyan

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
name: "$Name"
description: "$Description"
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "$today"
 updated: "$today"
---

# $($Name.Replace('-', ' ').ToUpper().Substring(0,1) + $Name.Replace('-', ' ').Substring(1))

> $Description

## When to Use

<!-- Describe the scenarios where this skill applies -->

- [ ] TODO: Add trigger conditions

## Decision Tree

``````
Is this about [$Name]?
+- Yes -> Apply this skill
| +- Simple case? -> Follow Quick Start
| - Complex case? -> See references/
- No -> Check other skills
``````

## Quick Start

<!-- Most common patterns and commands -->

1. **Step 1**: TODO
2. **Step 2**: TODO
3. **Step 3**: TODO

## Core Rules

<!-- Non-negotiable standards for this skill domain -->

1. **Rule 1**: TODO
2. **Rule 2**: TODO
3. **Rule 3**: TODO

## Common Patterns

<!-- Frequently used patterns / templates -->

### Pattern 1

TODO: Add pattern details

## Anti-Patterns

<!-- What NOT to do -->

- [ ] TODO: Add anti-patterns

## References

<!-- For detailed guidance, see: -->

$(if ($WithReferences) {
"- [Reference Guide](references/reference-guide.md) - Detailed examples and patterns"
} else {
"- None yet. Add references/ directory for extended content."
})

## Assets

$(if ($WithAssets) {
"- ``assets/`` - Templates, starter code, and sample data"
} else {
"- None yet. Add assets/ directory for reusable templates and starter code."
})

## Scripts

$(if ($WithScripts) {
"- ``scripts/example.ps1`` - TODO: Describe script purpose"
} else {
"- None yet. Add scripts/ directory for executable tools."
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
Write-Host " 1. Edit SKILL.md to fill in content" -ForegroundColor Gray
Write-Host " 2. Add the skill to Skills.md master index" -ForegroundColor Gray
Write-Host " 3. Test: read_file on the SKILL.md in Copilot" -ForegroundColor Gray
Write-Host ""
