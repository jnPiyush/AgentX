#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Validate frontmatter in AgentX instruction, agent, and skill files against JSON schemas.

.DESCRIPTION
 Parses YAML frontmatter from .instructions.md, .agent.md, and SKILL.md files,
 then validates required fields, types, and constraints. Designed for CI/CD.

.PARAMETER Path
 Root directory to scan. Defaults to repository root.

.PARAMETER Fix
 When set, reports issues but does not exit with error (advisory mode).

.EXAMPLE
 pwsh scripts/validate-frontmatter.ps1
 pwsh scripts/validate-frontmatter.ps1 -Fix
#>

param(
 [string]$Path = (Split-Path $PSScriptRoot -Parent),
 [switch]$Fix
)

$ErrorActionPreference = "Continue"
$script:errors = 0
$script:warnings = 0
$script:passed = 0

function Write-Pass($msg) { Write-Host " [PASS] $msg" -ForegroundColor Green; $script:passed++ }
function Write-Fail($msg) { Write-Host " [FAIL] $msg" -ForegroundColor Red; $script:errors++ }
function Write-Warn($msg) { Write-Host " [WARN] $msg" -ForegroundColor Yellow; $script:warnings++ }

function Get-Frontmatter([string]$FilePath) {
 $content = Get-Content $FilePath -Raw
 if ($content -match '(?s)^---\s*\n(.*?)\n---') {
 $yaml = $Matches[1]
 $result = @{}
 foreach ($line in ($yaml -split "`n")) {
 $line = $line.Trim()
 if ($line -match '^(\w[\w-]*):\s*(.+)$') {
 $key = $Matches[1]
 $value = $Matches[2].Trim().Trim("'").Trim('"')
 $result[$key] = $value
 }
 }
 return $result
 }
 return $null
}

function Test-InstructionFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter (no --- delimiters)"
 return
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'"
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars, got $($fm['description'].Length))"
 } else {
 Write-Pass "$name : description OK ($($fm['description'].Length) chars)"
 }

 # Required: applyTo
 if (-not $fm["applyTo"]) {
 Write-Fail "$name : Missing required field 'applyTo'"
 } else {
 Write-Pass "$name : applyTo OK ($($fm['applyTo']))"
 }
}

function Test-AgentFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter"
 return
 }

 # Required: name
 if (-not $fm["name"]) {
 Write-Fail "$name : Missing required field 'name'"
 } else {
 Write-Pass "$name : name OK ($($fm['name']))"
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'"
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars)"
 } else {
 Write-Pass "$name : description OK"
 }

 # Recommended: maturity
 if (-not $fm["maturity"]) {
 Write-Warn "$name : Missing recommended field 'maturity'"
 } elseif ($fm["maturity"] -notin @("stable", "preview", "experimental", "deprecated")) {
 Write-Fail "$name : Invalid maturity '$($fm['maturity'])' (must be stable|preview|experimental|deprecated)"
 } else {
 Write-Pass "$name : maturity OK ($($fm['maturity']))"
 }
}

function Test-SkillFile([string]$FilePath) {
 $name = (Split-Path (Split-Path $FilePath -Parent) -Leaf)
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "skill/$name : Missing frontmatter"
 return
 }

 # Required: name
 if (-not $fm["name"]) {
 Write-Fail "skill/$name : Missing required field 'name'"
 } elseif ($fm["name"] -notmatch '^[a-z][a-z0-9-]*$') {
 Write-Fail "skill/$name : name '$($fm['name'])' must be kebab-case"
 } else {
 Write-Pass "skill/$name : name OK ($($fm['name']))"
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "skill/$name : Missing required field 'description'"
 } elseif ($fm["description"].Length -lt 50) {
 Write-Fail "skill/$name : description too short (min 50 chars, got $($fm['description'].Length))"
 } else {
 Write-Pass "skill/$name : description OK ($($fm['description'].Length) chars)"
 }
}

# -- Main ------------------------------------------------

Write-Host ""
Write-Host " AgentX Frontmatter Validation" -ForegroundColor Cyan
Write-Host " ============================================" -ForegroundColor DarkGray
Write-Host ""

# Instructions
Write-Host " Instructions:" -ForegroundColor White
$instructions = Get-ChildItem -Path "$Path/.github/instructions" -Filter "*.instructions.md" -ErrorAction SilentlyContinue
foreach ($f in $instructions) { Test-InstructionFile $f.FullName }

# Agents
Write-Host ""
Write-Host " Agents:" -ForegroundColor White
$agents = Get-ChildItem -Path "$Path/.github/agents" -Filter "*.agent.md" -ErrorAction SilentlyContinue
foreach ($f in $agents) { Test-AgentFile $f.FullName }

# Skills
Write-Host ""
Write-Host " Skills:" -ForegroundColor White
$skills = Get-ChildItem -Path "$Path/.github/skills" -Recurse -Filter "SKILL.md" -ErrorAction SilentlyContinue
foreach ($f in $skills) { Test-SkillFile $f.FullName }

# Summary
Write-Host ""
Write-Host " ============================================" -ForegroundColor DarkGray
$total = $script:passed + $script:errors + $script:warnings
Write-Host " Results: $($script:passed) passed, $($script:warnings) warnings, $($script:errors) errors (of $total checks)" -ForegroundColor $(if ($script:errors -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($script:errors -gt 0 -and -not $Fix) {
 exit 1
}
