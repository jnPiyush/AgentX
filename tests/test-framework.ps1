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
Assert-FileContains "install.ps1" "docs/WORKFLOW\.md" "install.ps1 bundles WORKFLOW reference doc"
Assert-FileContains "install.ps1" "docs/GUIDE\.md" "install.ps1 bundles GUIDE reference doc"
Assert-FileContains "install.sh" "docs/WORKFLOW\.md" "install.sh bundles WORKFLOW reference doc"
Assert-FileContains "install.sh" "docs/GUIDE\.md" "install.sh bundles GUIDE reference doc"
Assert-FileContains "install.ps1" "runtimeStatePatterns" "install.ps1 excludes repo runtime state from fresh installs"
Assert-FileContains "install.sh" "\.agentx/config\.json|\.agentx/issues/\*|\.agentx/state/\*" "install.sh excludes repo runtime state from fresh installs"
Assert-FileContains "install.ps1" "templates/memories" "install.ps1 seeds starter memory templates"
Assert-FileContains "install.sh" "templates/memories" "install.sh seeds starter memory templates"
Assert-FileContains "packs/agentx-copilot-cli/install.ps1" "Get-PackInstallPlan" "Copilot CLI installer builds an install plan from the pack manifest"
Assert-FileContains "packs/agentx-copilot-cli/install.ps1" "Loaded install plan from manifest\.json" "Copilot CLI installer reports manifest-driven planning"
Assert-FileContains "packs/agentx-copilot-cli/manifest.json" '"schemas"' "Copilot CLI manifest declares schema artifacts"
Assert-FileExists ".agentx/templates/memories/conventions.md" "Starter memory: conventions"
Assert-FileExists ".agentx/templates/memories/pitfalls.md" "Starter memory: pitfalls"
Assert-FileExists ".agentx/templates/memories/decisions.md" "Starter memory: decisions"

# --- 2. Agent Definitions ---------------------------------------------------------------
Write-Host ""
Write-Host " 2. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "ux-designer", "devops", "reviewer-auto", "data-scientist", "tester", "consulting-research", "powerbi-analyst")
foreach ($agent in $agents) {
 Assert-FileExists ".github/agents/$agent.agent.md" "Agent: $agent"
}

# --- 3. Templates -----------------------------------------------------------------------
Write-Host ""
Write-Host " 3. Templates" -ForegroundColor White

$templates = @("PRD-TEMPLATE.md", "ADR-TEMPLATE.md", "SPEC-TEMPLATE.md", "UX-TEMPLATE.md", "REVIEW-TEMPLATE.md", "PROGRESS-TEMPLATE.md", "SECURITY-PLAN-TEMPLATE.md")
foreach ($tpl in $templates) {
 Assert-FileExists ".github/templates/$tpl" "Template: $tpl"
}

# AI-First template sections
Assert-FileContains ".github/templates/PRD-TEMPLATE.md" "AI/ML Requirements" "PRD has AI/ML Requirements section"
Assert-FileContains ".github/templates/ADR-TEMPLATE.md" "AI/ML Architecture" "ADR has AI/ML Architecture section"
Assert-FileContains ".github/templates/SPEC-TEMPLATE.md" "AI/ML Specification" "SPEC has AI/ML Specification section"

# --- 4. Agent Definitions ----------------------------------------------------------------
Write-Host ""
Write-Host " 4. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "reviewer-auto", "ux-designer", "devops", "data-scientist", "tester", "powerbi-analyst", "consulting-research")
foreach ($ag in $agents) {
 Assert-FileExists ".github/agents/$ag.agent.md" "Agent: $ag"
}

# Verify agent frontmatter structure
Assert-FileContains ".github/agents/engineer.agent.md" "description:" "engineer.agent.md has description"
Assert-FileContains ".github/agents/engineer.agent.md" "model:" "engineer.agent.md has model"

# --- 5. CLI -----------------------------------------------------------------------------
Write-Host ""
Write-Host " 5. CLI" -ForegroundColor White

Assert-FileExists ".agentx/agentx.ps1" "CLI launcher exists"
Assert-FileExists ".agentx/agentx-cli.ps1" "CLI implementation exists"
Assert-FileExists ".agentx/agentx.sh" "Bash CLI launcher exists"
Assert-FileExists ".agentx/agentic-runner.ps1" "CLI agentic loop runner exists"

# Test CLI commands exist in the implementation file
$cliCommands = @("ready", "state", "deps", "digest", "workflow", "hook", "version", "run", "loop", "validate", "config", "issue", "bundle", "parallel", "backlog-sync")
foreach ($cmd in $cliCommands) {
 Assert-FileContains ".agentx/agentx-cli.ps1" "'$cmd'" "CLI supports: $cmd"
}

# Agentic runner has tool definitions
Assert-FileContains ".agentx/agentic-runner.ps1" "Invoke-AgenticLoop" "Agentic runner has main loop function"
Assert-FileContains ".agentx/agentic-runner.ps1" "file_read" "Agentic runner has file_read tool"
Assert-FileContains ".agentx/agentic-runner.ps1" "terminal_exec" "Agentic runner has terminal_exec tool"
Assert-FileContains ".agentx/agentic-runner.ps1" "Copilot" "Agentic runner supports Copilot API"
Assert-FileExists "tests/provider-behavior.ps1" "Provider behavior test script"
Assert-FileExists "tests/task-bundle-behavior.ps1" "Task bundle behavior test script"
Assert-FileExists "tests/bounded-parallel-behavior.ps1" "Bounded parallel behavior test script"
Assert-FileExists "tests/harness-audit-behavior.ps1" "Harness audit behavior test script"
Assert-FileExists "tests/agentic-runner-behavior.ps1" "Agentic runner behavior test script"

$providerBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/provider-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $providerBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Provider CLI behavior tests pass"

$taskBundleBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/task-bundle-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $taskBundleBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Task bundle CLI behavior tests pass"

$boundedParallelBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/bounded-parallel-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $boundedParallelBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Bounded parallel CLI behavior tests pass"

$harnessAuditBehaviorResult = & pwsh -NoProfile -File (Join-Path $script:root "tests/harness-audit-behavior.ps1") 2>&1
if ($LASTEXITCODE -ne 0) {
 Write-Host $harnessAuditBehaviorResult
}
Assert-True ($LASTEXITCODE -eq 0) "Harness audit CLI behavior tests pass"

$agenticRunnerBehaviorTempFile = [System.IO.Path]::GetTempFileName()
& pwsh -NoProfile -File (Join-Path $script:root "tests/agentic-runner-behavior.ps1") *> $agenticRunnerBehaviorTempFile
$agenticRunnerBehaviorExitCode = $LASTEXITCODE
if ($agenticRunnerBehaviorExitCode -ne 0) {
    Get-Content $agenticRunnerBehaviorTempFile | Write-Host
}
Remove-Item $agenticRunnerBehaviorTempFile -ErrorAction SilentlyContinue
Assert-True ($agenticRunnerBehaviorExitCode -eq 0) "Agentic runner behavior tests pass"

# --- 6. Skills --------------------------------------------------------------------------
Write-Host ""
Write-Host " 6. Skills" -ForegroundColor White

$skillCount = (Get-ChildItem -Path (Join-Path $script:root ".github/skills") -Recurse -Filter "SKILL.md").Count
Assert-True ($skillCount -ge 35) "At least 35 skills exist (found: $skillCount)"

# Verify AI skill exists
Assert-FileExists ".github/skills/ai-systems/ai-agent-development/SKILL.md" "AI Agent Development skill"

# Verify Skills.md count matches
Assert-FileContains "Skills.md" "$skillCount skills across" "Skills.md skill count matches actual ($skillCount)"

# Verify new skills and instructions
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/SKILL.md" "Cognitive Architecture skill"
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py" "Cognitive scaffold script"
Assert-FileExists ".github/instructions/typescript.instructions.md" "TypeScript instruction file"
Assert-FileExists ".github/skills/infrastructure/terraform/SKILL.md" "Terraform skill"
Assert-FileExists ".github/skills/infrastructure/bicep/SKILL.md" "Bicep skill"

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
Assert-FileContains ".github/agents/agent-x.agent.md" "## Domain Detection" "Agent X has domain classification"
Assert-FileContains ".github/agents/agent-x.agent.md" "needs:ai" "Agent X detects AI domain"
Assert-FileContains ".github/agents/agent-x.agent.md" "## PRD Intent Validation" "Agent X validates PRD intent"

# PM has AI domain classification step
Assert-FileContains ".github/agents/product-manager.agent.md" "Classify Domain Intent" "PM has domain classification step"
Assert-FileContains ".github/agents/product-manager.agent.md" "ai-agent-development/SKILL.md" "PM references AI skill"

# Architect has AI-aware research
Assert-FileContains ".github/agents/architect.agent.md" "AI-first assessment" "Architect has AI-aware research step"
Assert-FileContains ".github/agents/architect.agent.md" "aitk_get_ai_model_guidance" "Architect uses AITK tools"

# Engineer has AI implementation setup
Assert-FileContains ".github/agents/engineer.agent.md" "For GenAI features" "Engineer has AI implementation step"
Assert-FileContains ".github/agents/engineer.agent.md" "Store all system prompts as separate files" "Engineer uses current GenAI implementation guidance"

# Reviewer has intent preservation check
Assert-FileContains ".github/agents/reviewer.agent.md" "Intent Preservation" "Reviewer has intent preservation check"
Assert-FileContains ".github/agents/reviewer.agent.md" "Reject path" "Reviewer rejects intent violations"

# --- 8. GitHub Actions ------------------------------------------------------------------
Write-Host ""
Write-Host " 8. GitHub Actions" -ForegroundColor White

Assert-FileExists ".github/workflows/agent-x.yml" "agent-x.yml workflow"
Assert-FileExists ".github/workflows/quality-gates.yml" "quality-gates.yml workflow"
Assert-FileExists "azure-pipelines.yml" "azure-pipelines.yml pipeline"

# --- 9. Hooks & Scripts -----------------------------------------------------------------
Write-Host ""
Write-Host " 9. Hooks & Scripts" -ForegroundColor White

Assert-FileExists ".github/hooks/pre-commit" "pre-commit hook"
Assert-FileExists ".github/hooks/commit-msg" "commit-msg hook"

# --- 10. Documentation Consistency ------------------------------------------------------
Write-Host ""
Write-Host " 10. Documentation Consistency" -ForegroundColor White

Assert-FileContains "AGENTS.md" "single source of truth|system of record|Map to all AgentX resources" "AGENTS.md declares single source"
Assert-FileContains "README.md" "$skillCount production skills" "README skill count heading matches ($skillCount)"
Assert-FileContains "README.md" "$skillCount skills" "README framework totals matches ($skillCount)"
Assert-FileExists "docs/GUIDE.md" "Consolidated Guide (quickstart + setup)"
Assert-FileContains "AGENTS.md" "GUIDE" "AGENTS.md links to Guide"
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
