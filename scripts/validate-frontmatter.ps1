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
 $lines = @($yaml -split "`n")
 for ($i = 0; $i -lt $lines.Count; $i++) {
 $line = $lines[$i].TrimEnd("`r")
 $trimmed = $line.Trim()
 if ($trimmed -match '^(\w[\w-]*):\s*(.+)$') {
 $key = $Matches[1]
 $rawValue = $Matches[2].Trim()

 if ($rawValue -in @('>-', '|-', '>', '|')) {
 $parts = @()
 while (($i + 1) -lt $lines.Count) {
 $nextLine = $lines[$i + 1].TrimEnd("`r")
 if ($nextLine -match '^\S') { break }
 $i++
 $parts += $nextLine.Trim()
 }
 $result[$key] = (($parts -join ' ').Trim().Trim("'").Trim('"'))
 continue
 }

 $value = $rawValue.Trim("'").Trim('"')
 $result[$key] = $value
 }
 }
 return $result
 }
 return $null
}

function Get-FrontmatterText([string]$FilePath) {
 $content = Get-Content $FilePath -Raw
 if ($content -match '(?s)^---\s*\n(.*?)\n---') {
 return $Matches[1]
 }
 return $null
}

function Get-YamlListItems([string]$Yaml, [string]$Key) {
 $items = @()
 if (-not $Yaml) { return $items }

 $lines = @($Yaml -split "`n")
 for ($i = 0; $i -lt $lines.Count; $i++) {
 $line = $lines[$i].TrimEnd("`r")
 if ($line -match "^$([regex]::Escape($Key)):\s*(.*)$") {
 $inline = $Matches[1].Trim()
 if ($inline -eq '[]') { return $items }

 for ($j = $i + 1; $j -lt $lines.Count; $j++) {
 $next = $lines[$j].TrimEnd("`r")
 # Stop at the next key (a non-indented line that is not itself a list
 # item). Column-0 block sequences ('- item' at the margin) are still
 # part of this list and must not terminate it.
 if ($next -match '^\S' -and $next -notmatch '^-\s') { break }
 if ($next -match '^\s*-\s*(.+)$') { $items += $Matches[1].Trim().Trim("'").Trim('"') }
 }
 return $items
 }
 }

 return $items
}

function Test-InstructionFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter (no --- delimiters). FIX: Add YAML frontmatter at the top of the file between --- delimiters. Example: --- description: 'Your description here' applyTo: '**.py' --- See .github/instructions/python.instructions.md for a working example."
 return
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'. FIX: Add a 'description:' field to the YAML frontmatter block. This tells agents when to load this instruction. Example: description: 'Python coding instructions for production code.'"
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars, got $($fm['description'].Length)). FIX: Expand the description to explain when this instruction should be loaded. Example: description: 'Python specific coding instructions for production code.'"
 } else {
 Write-Pass "$name : description OK ($($fm['description'].Length) chars)"
 }

 # Required: applyTo
 if (-not $fm["applyTo"]) {
 Write-Fail "$name : Missing required field 'applyTo'. FIX: Add an 'applyTo:' field with a glob pattern specifying which files trigger this instruction. Example: applyTo: '**.py, **.pyx'"
 } else {
 Write-Pass "$name : applyTo OK ($($fm['applyTo']))"
 }
}

function Test-AgentFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter. FIX: Add YAML frontmatter at the top of the file between --- delimiters. Required fields: description, model. See .github/agents/engineer.agent.md for a working example."
 return
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'. FIX: Add a 'description:' field to the YAML frontmatter. This tells Agent X what this agent does. Example: description: 'Implements code with tests and documentation.'"
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars). FIX: Expand the description to summarize the agent's purpose. Example: description: 'Implements production code with 80% test coverage.'"
 } else {
 Write-Pass "$name : description OK"
 }

 # Recommended: model
 if (-not $fm["model"]) {
 Write-Warn "$name : Missing recommended field 'model'. FIX: Add a 'model:' field like 'model: gpt-4o' to specify the preferred LLM for this agent."
 } else {
 Write-Pass "$name : model OK ($($fm['model']))"
 }

 # Optional: name (display name for UI)
 if ($fm.ContainsKey("name") -and $fm["name"].Length -lt 2) {
 Write-Fail "$name : name too short (min 2 chars). FIX: Use a descriptive display name like 'name: Engineer' or remove the field entirely (filename is used by default)."
 } elseif ($fm.ContainsKey("name")) {
 Write-Pass "$name : name OK ($($fm['name']))"
 }
}

function Test-AgentWindowContract([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath
 $yaml = Get-FrontmatterText $FilePath

 if (-not $fm) { return }

 $isInternal = $FilePath -match '[\\/]internal[\\/]' -or $fm['visibility'] -eq 'internal'
 $isAutoFixReviewer = $name -eq 'reviewer-auto.agent.md'
 $userInvocable = $fm['user-invocable']
 $disableModelInvocation = $fm['disable-model-invocation']
 $tools = @(Get-YamlListItems -Yaml $yaml -Key 'tools')
 $agents = @(Get-YamlListItems -Yaml $yaml -Key 'agents')

 if (-not $fm['name']) {
 Write-Fail "$name : Missing required Agents Window field 'name'. FIX: Add a human-readable 'name:' field to the YAML frontmatter."
 }

 if (-not $userInvocable) {
 Write-Fail "$name : Missing required Agents Window field 'user-invocable'. FIX: Use 'true' for visible agents and 'false' for internal sub-agents."
 } elseif ($isInternal -and $userInvocable -ne 'false') {
 Write-Fail "$name : Internal agent must declare user-invocable: false."
 } elseif (-not $isInternal -and $userInvocable -ne 'true') {
 Write-Fail "$name : Visible agent must declare user-invocable: true."
 } else {
 Write-Pass "$name : user-invocable OK ($userInvocable)"
 }

 if (($isInternal -or $isAutoFixReviewer) -and $disableModelInvocation -ne 'true') {
 Write-Fail "$name : Must declare disable-model-invocation: true for internal agents and Auto-Fix Reviewer."
 } elseif ($isInternal -or $isAutoFixReviewer) {
 Write-Pass "$name : disable-model-invocation OK"
 }

 if ($agents.Count -gt 0 -and $tools -notcontains 'agent') {
 Write-Fail "$name : Agents Window coordinator with non-empty agents list must include 'agent' in tools."
 } elseif ($agents.Count -gt 0) {
 Write-Pass "$name : agent tool OK for $($agents.Count) delegated agent(s)"
 }
}

function Test-AgentProtocolContract([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $content = Get-Content $FilePath -Raw

 if ($content -notmatch 'AGENT-PROTOCOL\.md') {
 Write-Fail "$name : Missing AGENT-PROTOCOL.md reference. FIX: Keep only the front-loaded Pre-edit gate + Honesty rule stubs in the agent body and point to AGENT-PROTOCOL.md for shared loop, review, scrub, Model Council, and plugin rules."
 } else {
 Write-Pass "$name : AGENT-PROTOCOL.md reference OK"
 }

 if ($content -notmatch 'Pre-edit gate \(NON-SKIPPABLE\)') {
 Write-Fail "$name : Missing Pre-edit gate stub. FIX: Add the short Pre-edit gate stub and do not restate full loop mechanics."
 } else {
 Write-Pass "$name : Pre-edit gate stub OK"
 }

 if ($content -notmatch 'Honesty rule') {
 Write-Fail "$name : Missing Honesty rule stub. FIX: Add the short Honesty rule stub and point to AGENT-PROTOCOL.md."
 } else {
 Write-Pass "$name : Honesty rule stub OK"
 }

 if ($content -notmatch '(?m)^## (Role-Specific )?Done Criteria\s*$') {
 Write-Fail "$name : Missing local role-specific done criteria. FIX: Keep shared loop mechanics in AGENT-PROTOCOL.md, but preserve this agent's role-specific completion criteria in the agent body."
 } else {
 Write-Pass "$name : role-specific done criteria OK"
 }

 if ($content -notmatch '(?m)^## Delivery Report \(MANDATORY\)\s*$') {
 Write-Fail "$name : Missing local Delivery Report section. FIX: Keep the role-specific handoff/report fields in the agent body while centralizing shared loop mechanics."
 } else {
 Write-Pass "$name : role-specific delivery report OK"
 }

 $forbiddenSharedLoopMarkers = @(
 '### Loop Steps',
 '### Iteration Focus Table',
 'Minimum 5 iterations with a defined focus per iteration',
 'Baseline lock',
 'loop baseline -c <passing-tests>'
 )

 foreach ($marker in $forbiddenSharedLoopMarkers) {
 if ($content.Contains($marker)) {
 Write-Fail "$name : Duplicates shared loop prose ('$marker'). FIX: Remove the full loop procedure from the agent and rely on AGENT-PROTOCOL.md plus iterative-loop skill."
 }
 }

 if ($content -match '## Iterative Quality Loop\s*(\r?\n)' -and $content -notmatch '## Iterative Quality Loop \(MANDATORY\)') {
 Write-Fail "$name : Non-standard loop heading. FIX: Use '## Iterative Quality Loop (MANDATORY)' with only the two required stubs and protocol pointer."
 }

 if ($content -match '## Plugins Available' -or $content -match '(?s)## Plugins \(Optional Capabilities\).*?\| Plugin \|') {
 Write-Fail "$name : Duplicates shared plugin table. FIX: Replace plugin details with a pointer to AGENT-PROTOCOL.md#9-plugins-optional-capabilities."
 }
}

function Test-HookBundle([string]$RootPath) {
 $hooksDir = Join-Path $RootPath '.agentx/hooks'
 $events = @('session-start', 'pre-tool', 'post-tool', 'session-end')

 foreach ($event in $events) {
 $ps1 = Join-Path $hooksDir "$event.ps1"
 $sh = Join-Path $hooksDir "$event.sh"
 if (-not (Test-Path $ps1)) {
 Write-Fail "hooks/$event.ps1 : Missing required Agents Window hook pair file."
 } else {
 Write-Pass "hooks/$event.ps1 : present"
 }

 if (-not (Test-Path $sh)) {
 Write-Fail "hooks/$event.sh : Missing required Agents Window hook pair file."
 } else {
 Write-Pass "hooks/$event.sh : present"
 }
 }
}

function Test-PromptFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter. FIX: Add YAML frontmatter at the top of the prompt file between --- delimiters. Required fields: name, description. See .github/prompts/code-review.prompt.md for a working example."
 return
 }

 if (-not $fm["name"]) {
 Write-Fail "$name : Missing required field 'name'. FIX: Add a short display name such as name: 'Code Review'."
 } else {
 Write-Pass "$name : name OK ($($fm['name']))"
 }

 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'. FIX: Add a concise 'description:' field that explains when this prompt should be used."
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars). FIX: Expand the description so routing surfaces can distinguish this prompt from others."
 } else {
 Write-Pass "$name : description OK ($($fm['description'].Length) chars)"
 }
}

function Test-ClaudeCommandFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter. FIX: Add YAML frontmatter at the top of the Claude command file. Required field: description."
 return
 }

 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'. FIX: Add a 'description:' field explaining the command's routing purpose and expected outcome."
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars). FIX: Expand the description so slash-command routing has useful context."
 } else {
 Write-Pass "$name : description OK ($($fm['description'].Length) chars)"
 }
}

function Test-SkillFile([string]$FilePath) {
 $name = (Split-Path (Split-Path $FilePath -Parent) -Leaf)
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "skill/$name : Missing frontmatter. FIX: Add YAML frontmatter at the top of SKILL.md between --- delimiters. Required fields: name (kebab-case), description (50+ chars). See .github/skills/development/testing/SKILL.md for a working example."
 return
 }

 # Required: name
 if (-not $fm["name"]) {
 Write-Fail "skill/$name : Missing required field 'name'. FIX: Add 'name: $name' to the YAML frontmatter. The name must be lowercase with hyphens (kebab-case)."
 } elseif ($fm["name"] -notmatch '^[a-z][a-z0-9-]*$') {
 Write-Fail "skill/$name : name '$($fm['name'])' must be kebab-case. FIX: Change to lowercase letters and hyphens only. Example: 'name: $($fm['name'].ToLower() -replace '[^a-z0-9]','-')'"
 } else {
 Write-Pass "skill/$name : name OK ($($fm['name']))"
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "skill/$name : Missing required field 'description'. FIX: Add a 'description:' field (50+ chars) explaining when to use this skill. Start with a verb: 'Apply testing strategies including...'"
 } elseif ($fm["description"].Length -lt 50) {
 Write-Fail "skill/$name : description too short (min 50 chars, got $($fm['description'].Length)). FIX: Expand the description to at least 50 characters. Include trigger phrases for when agents should load this skill."
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
$instructions = Get-ChildItem -Path "$Path/.github/instructions" -Recurse -Filter "*.instructions.md" -ErrorAction SilentlyContinue
foreach ($f in $instructions) { Test-InstructionFile $f.FullName }
$copilotInstructions = Join-Path $Path '.github/copilot-instructions.md'
if (Test-Path $copilotInstructions) { Test-InstructionFile $copilotInstructions }

# Agents
Write-Host ""
Write-Host " Agents:" -ForegroundColor White
$agents = Get-ChildItem -Path "$Path/.github/agents" -Filter "*.agent.md" -ErrorAction SilentlyContinue
foreach ($f in $agents) { Test-AgentFile $f.FullName; Test-AgentWindowContract $f.FullName; Test-AgentProtocolContract $f.FullName }
$internalAgents = Get-ChildItem -Path "$Path/.github/agents/internal" -Filter "*.agent.md" -ErrorAction SilentlyContinue
foreach ($f in $internalAgents) { Test-AgentFile $f.FullName; Test-AgentWindowContract $f.FullName; Test-AgentProtocolContract $f.FullName }

# Agents Window hooks
Write-Host ""
Write-Host " Agents Window Hooks:" -ForegroundColor White
Test-HookBundle $Path

# Prompts
Write-Host ""
Write-Host " Prompts:" -ForegroundColor White
$prompts = Get-ChildItem -Path "$Path/.github/prompts" -Filter "*.prompt.md" -ErrorAction SilentlyContinue
foreach ($f in $prompts) { Test-PromptFile $f.FullName }

# Claude Commands
Write-Host ""
Write-Host " Claude Commands:" -ForegroundColor White
$claudeCommands = Get-ChildItem -Path "$Path/.claude/commands" -Filter "*.md" -ErrorAction SilentlyContinue
foreach ($f in $claudeCommands) { Test-ClaudeCommandFile $f.FullName }

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
