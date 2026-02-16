#!/usr/bin/env pwsh
# AgentX Framework Self-Tests
# Verifies CLI, templates, workflows, and project structure
# Usage: pwsh tests/test-framework.ps1

$ErrorActionPreference = "Continue"
$script:pass = 0
$script:fail = 0
$script:root = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
 if ($condition) {
 Write-Host " [PASS] $message" -ForegroundColor Green
 $script:pass++
 } else {
 Write-Host " [FAIL] $message" -ForegroundColor Red
 $script:fail++
 }
}

function Assert-FileExists($path, $label) {
 $fullPath = Join-Path $script:root $path
 Assert-True (Test-Path $fullPath) "$label exists ($path)"
}

function Assert-FileContains($path, $pattern, $label) {
 $fullPath = Join-Path $script:root $path
 if (Test-Path $fullPath) {
 $content = Get-Content $fullPath -Raw
 Assert-True ($content -match $pattern) "$label"
 } else {
 Assert-True $false "$label (file not found: $path)"
 }
}

Write-Host ""
Write-Host " AgentX Framework Self-Tests" -ForegroundColor Cyan
Write-Host " ================================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Core Files ----------------------------------------------------------------------
Write-Host " 1. Core Files" -ForegroundColor White

Assert-FileExists "AGENTS.md" "AGENTS.md"
Assert-FileExists "Skills.md" "Skills.md"
Assert-FileExists "README.md" "README.md"
Assert-FileExists "install.ps1" "install.ps1"
Assert-FileExists "install.sh" "install.sh"
Assert-FileExists "LICENSE" "LICENSE"

# --- 2. Agent Definitions ---------------------------------------------------------------
Write-Host ""
Write-Host " 2. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "ux-designer", "devops", "reviewer-auto")
foreach ($agent in $agents) {
 Assert-FileExists ".github/agents/$agent.agent.md" "Agent: $agent"
}

# --- 3. Templates -----------------------------------------------------------------------
Write-Host ""
Write-Host " 3. Templates" -ForegroundColor White

$templates = @("PRD-TEMPLATE.md", "ADR-TEMPLATE.md", "SPEC-TEMPLATE.md", "UX-TEMPLATE.md", "REVIEW-TEMPLATE.md", "PROGRESS-TEMPLATE.md")
foreach ($tpl in $templates) {
 Assert-FileExists ".github/templates/$tpl" "Template: $tpl"
}

# AI-First template sections
Assert-FileContains ".github/templates/PRD-TEMPLATE.md" "AI/ML Requirements" "PRD has AI/ML Requirements section"
Assert-FileContains ".github/templates/ADR-TEMPLATE.md" "AI/ML Architecture" "ADR has AI/ML Architecture section"
Assert-FileContains ".github/templates/SPEC-TEMPLATE.md" "AI/ML Specification" "SPEC has AI/ML Specification section"

# --- 4. TOML Workflows ------------------------------------------------------------------
Write-Host ""
Write-Host " 4. TOML Workflows" -ForegroundColor White

$workflows = @("feature", "epic", "story", "bug", "spike", "devops", "docs")
foreach ($wf in $workflows) {
 Assert-FileExists ".agentx/workflows/$wf.toml" "Workflow: $wf"
}

# Verify TOML structure
Assert-FileContains ".agentx/workflows/feature.toml" "\[\[steps\]\]" "feature.toml has steps"
Assert-FileContains ".agentx/workflows/feature.toml" "agent\s*=" "feature.toml has agent assignments"

# --- 5. CLI -----------------------------------------------------------------------------
Write-Host ""
Write-Host " 5. CLI (agentx.ps1)" -ForegroundColor White

Assert-FileExists ".agentx/agentx.ps1" "CLI script exists"
Assert-FileContains ".agentx/agentx.ps1" "ValidateSet" "CLI has command validation"

# Test CLI commands exist
$cliCommands = @("ready", "state", "deps", "digest", "workflow", "hook", "version", "upgrade", "run")
foreach ($cmd in $cliCommands) {
 Assert-FileContains ".agentx/agentx.ps1" "'$cmd'" "CLI supports: $cmd"
}

# --- 6. Skills --------------------------------------------------------------------------
Write-Host ""
Write-Host " 6. Skills" -ForegroundColor White

$skillCount = (Get-ChildItem -Path (Join-Path $script:root ".github/skills") -Recurse -Filter "SKILL.md").Count
Assert-True ($skillCount -ge 35) "At least 35 skills exist (found: $skillCount)"

# Verify AI skill exists
Assert-FileExists ".github/skills/ai-systems/ai-agent-development/SKILL.md" "AI Agent Development skill"

# Verify Skills.md count matches
Assert-FileContains "Skills.md" "Covers $skillCount skills" "Skills.md description count matches actual ($skillCount)"

# Verify new skills and instructions
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/SKILL.md" "Cognitive Architecture skill"
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py" "Cognitive scaffold script"
Assert-FileExists ".github/instructions/typescript.instructions.md" "TypeScript instruction file"
Assert-FileExists ".github/instructions/terraform.instructions.md" "Terraform instruction file"
Assert-FileExists ".github/instructions/bicep.instructions.md" "Bicep instruction file"
Assert-FileExists ".github/instructions/yaml.instructions.md" "YAML instruction file"

# Verify enterprise validation
Assert-FileExists "scripts/validate-frontmatter.ps1" "Frontmatter validation script"
Assert-FileExists ".github/schemas/instruction-frontmatter.schema.json" "Instruction schema"
Assert-FileExists ".github/schemas/agent-frontmatter.schema.json" "Agent schema"
Assert-FileExists ".github/schemas/skill-frontmatter.schema.json" "Skill schema"
Assert-FileExists ".github/workflows/scorecard.yml" "OpenSSF Scorecard workflow"

# --- 7. AI-First Intent Preservation ----------------------------------------------------
Write-Host ""
Write-Host " 7. AI-First Intent Preservation" -ForegroundColor White

# Agent X has domain classification
Assert-FileContains ".github/agents/agent-x.agent.md" "classifyDomain" "Agent X has domain classification"
Assert-FileContains ".github/agents/agent-x.agent.md" "needs:ai" "Agent X detects AI domain"
Assert-FileContains ".github/agents/agent-x.agent.md" "validatePRDIntent" "Agent X validates PRD intent"

# PM has AI domain classification step
Assert-FileContains ".github/agents/product-manager.agent.md" "Domain Classification" "PM has domain classification step"
Assert-FileContains ".github/agents/product-manager.agent.md" "ai-agent-development/SKILL.md" "PM references AI skill"

# Architect has AI-aware research
Assert-FileContains ".github/agents/architect.agent.md" "AI-Aware Research" "Architect has AI-aware research step"
Assert-FileContains ".github/agents/architect.agent.md" "aitk_get_ai_model_guidance" "Architect uses AITK tools"

# Engineer has AI implementation setup
Assert-FileContains ".github/agents/engineer.agent.md" "AI Implementation Setup" "Engineer has AI implementation step"
Assert-FileContains ".github/agents/engineer.agent.md" "aitk_get_agent_model_code_sample" "Engineer uses AITK code gen"

# Reviewer has intent preservation check
Assert-FileContains ".github/agents/reviewer.agent.md" "Intent Preservation" "Reviewer has intent preservation check"
Assert-FileContains ".github/agents/reviewer.agent.md" "intent preservation violation" "Reviewer rejects intent violations"

# --- 8. GitHub Actions ------------------------------------------------------------------
Write-Host ""
Write-Host " 8. GitHub Actions" -ForegroundColor White

Assert-FileExists ".github/workflows/agent-x.yml" "agent-x.yml workflow"
Assert-FileExists ".github/workflows/quality-gates.yml" "quality-gates.yml workflow"

# --- 9. Hooks & Scripts -----------------------------------------------------------------
Write-Host ""
Write-Host " 9. Hooks & Scripts" -ForegroundColor White

Assert-FileExists ".github/hooks/pre-commit" "pre-commit hook"
Assert-FileExists ".github/hooks/commit-msg" "commit-msg hook"
Assert-FileExists ".github/scripts/validate-handoff.sh" "validate-handoff.sh"

# --- 10. Documentation Consistency ------------------------------------------------------
Write-Host ""
Write-Host " 10. Documentation Consistency" -ForegroundColor White

Assert-FileContains "AGENTS.md" "Single source of truth" "AGENTS.md declares single source"
Assert-FileContains "README.md" "$skillCount production skills" "README skill count matches ($skillCount)"
Assert-FileExists "docs/QUICKSTART.md" "5-minute Quickstart guide"
Assert-FileExists ".github/templates/SPEC-TEMPLATE-LITE.md" "Spec Template Lite variant"
Assert-FileContains "AGENTS.md" "QUICKSTART" "AGENTS.md links to Quickstart"
Assert-FileContains ".github/copilot-instructions.md" "RFC 2119" "Router has RFC 2119 directive language"
Assert-FileContains "README.md" "OpenSSF" "README has OpenSSF Scorecard badge"

# --- Results ----------------------------------------------------------------------------
Write-Host ""
Write-Host " ================================================" -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Yellow" })
if ($script:fail -gt 0) {
 Write-Host " Failures: $($script:fail)" -ForegroundColor Red
}
Write-Host ""

exit $script:fail
