#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX in your project

.DESCRIPTION
    Downloads and installs all AgentX files including agents, skills,
    templates, workflows, and documentation.

.PARAMETER Force
    Overwrite existing files

.EXAMPLE
    .\install.ps1
    
.EXAMPLE
    irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param([switch]$Force)

$ErrorActionPreference = "Stop"
$REPO_URL = "https://raw.githubusercontent.com/jnPiyush/AgentX/master"

function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "⚠ $msg" -ForegroundColor Yellow }

function Download-File($src, $dest) {
    $destDir = Split-Path $dest -Parent
    if ($destDir -and -not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    if ((Test-Path $dest) -and -not $Force) {
        Write-Warn "Skipped (exists): $dest"
        return
    }
    
    try {
        Invoke-WebRequest -Uri "$REPO_URL/$src" -OutFile $dest -UseBasicParsing
        Write-Success "Downloaded: $dest"
    } catch {
        Write-Warn "Failed: $src"
    }
}

# Banner
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AgentX - AI Agent Guidelines for Production Code ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check for git
if (-not (Test-Path ".git")) {
    Write-Warn "Not a git repository. Run 'git init' first."
    exit 1
}

Write-Host "Installing AgentX files..." -ForegroundColor Yellow
Write-Host ""

# Core documentation
Write-Info "Core documentation..."
Download-File "AGENTS.md" "AGENTS.md"
Download-File "Skills.md" "Skills.md"
Download-File "CONTRIBUTING.md" "CONTRIBUTING.md"

# GitHub configuration
Write-Info "GitHub configuration..."
Download-File ".github/copilot-instructions.md" ".github/copilot-instructions.md"
Download-File ".github/CODEOWNERS" ".github/CODEOWNERS"
Download-File ".github/agentx-security.yml" ".github/agentx-security.yml"
Download-File ".github/orchestration-config.yml" ".github/orchestration-config.yml"
Download-File ".github/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"

# Workflows
Write-Info "GitHub Actions workflows..."
Download-File ".github/workflows/agent-orchestrator.yml" ".github/workflows/agent-orchestrator.yml"
Download-File ".github/workflows/quality-gates.yml" ".github/workflows/quality-gates.yml"

# Git hooks
Write-Info "Git hooks..."
Download-File ".github/hooks/pre-commit" ".github/hooks/pre-commit"
Download-File ".github/hooks/commit-msg" ".github/hooks/commit-msg"

# Scripts
Write-Info "Scripts..."
Download-File ".github/scripts/validate-handoff.ps1" ".github/scripts/validate-handoff.ps1"
Download-File ".github/scripts/validate-handoff.sh" ".github/scripts/validate-handoff.sh"
Download-File ".github/scripts/capture-context.ps1" ".github/scripts/capture-context.ps1"
Download-File ".github/scripts/capture-context.sh" ".github/scripts/capture-context.sh"

# Issue templates
Write-Info "Issue templates..."
Download-File ".github/ISSUE_TEMPLATE/config.yml" ".github/ISSUE_TEMPLATE/config.yml"
Download-File ".github/ISSUE_TEMPLATE/epic.yml" ".github/ISSUE_TEMPLATE/epic.yml"
Download-File ".github/ISSUE_TEMPLATE/feature.yml" ".github/ISSUE_TEMPLATE/feature.yml"
Download-File ".github/ISSUE_TEMPLATE/story.yml" ".github/ISSUE_TEMPLATE/story.yml"
Download-File ".github/ISSUE_TEMPLATE/bug.yml" ".github/ISSUE_TEMPLATE/bug.yml"
Download-File ".github/ISSUE_TEMPLATE/spike.yml" ".github/ISSUE_TEMPLATE/spike.yml"
Download-File ".github/ISSUE_TEMPLATE/docs.yml" ".github/ISSUE_TEMPLATE/docs.yml"

# Agent definitions
Write-Info "Agent definitions..."
Download-File ".github/agents/product-manager.agent.md" ".github/agents/product-manager.agent.md"
Download-File ".github/agents/architect.agent.md" ".github/agents/architect.agent.md"
Download-File ".github/agents/ux-designer.agent.md" ".github/agents/ux-designer.agent.md"
Download-File ".github/agents/engineer.agent.md" ".github/agents/engineer.agent.md"
Download-File ".github/agents/reviewer.agent.md" ".github/agents/reviewer.agent.md"
Download-File ".github/agents/orchestrator.agent.md" ".github/agents/orchestrator.agent.md"

# Document templates
Write-Info "Document templates..."
Download-File ".github/templates/PRD-TEMPLATE.md" ".github/templates/PRD-TEMPLATE.md"
Download-File ".github/templates/ADR-TEMPLATE.md" ".github/templates/ADR-TEMPLATE.md"
Download-File ".github/templates/SPEC-TEMPLATE.md" ".github/templates/SPEC-TEMPLATE.md"
Download-File ".github/templates/UX-TEMPLATE.md" ".github/templates/UX-TEMPLATE.md"
Download-File ".github/templates/REVIEW-TEMPLATE.md" ".github/templates/REVIEW-TEMPLATE.md"

# Instructions
Write-Info "Coding instructions..."
Download-File ".github/instructions/api.instructions.md" ".github/instructions/api.instructions.md"
Download-File ".github/instructions/csharp.instructions.md" ".github/instructions/csharp.instructions.md"
Download-File ".github/instructions/python.instructions.md" ".github/instructions/python.instructions.md"
Download-File ".github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"

# Prompts
Write-Info "Prompt templates..."
Download-File ".github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
Download-File ".github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
Download-File ".github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"

# Skills (18 production skills)
Write-Info "Production skills (18 skills)..."
$skills = @(
    "core-principles", "testing", "error-handling", "security",
    "performance", "database", "scalability", "code-organization",
    "api-design", "configuration", "documentation", "version-control",
    "type-safety", "dependency-management", "logging-monitoring",
    "remote-git-operations", "ai-agent-development", "code-review-and-audit"
)
foreach ($skill in $skills) {
    Download-File ".github/skills/$skill/SKILL.md" ".github/skills/$skill/SKILL.md"
}

# VS Code configuration
Write-Info "VS Code configuration..."
Download-File ".vscode/mcp.json" ".vscode/mcp.json"

# Documentation
Write-Info "Documentation..."
Download-File "docs/mcp-integration.md" "docs/mcp-integration.md"
Download-File "docs/project-setup.md" "docs/project-setup.md"

# Create output directories
Write-Info "Creating output directories..."
$dirs = @("docs/prd", "docs/adr", "docs/specs", "docs/ux", "docs/reviews")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Created: $dir/"
    }
}

# Install git hooks
Write-Host ""
Write-Info "Installing git hooks..."
if (Test-Path ".github/hooks") {
    $hooks = @("pre-commit", "commit-msg")
    foreach ($hook in $hooks) {
        $src = ".github/hooks/$hook"
        $dest = ".git/hooks/$hook"
        if (Test-Path $src) {
            Copy-Item $src $dest -Force
            Write-Success "Installed: $hook hook"
        }
    }
}

# Install Git hooks
Write-Host ""
Write-Host "Installing Git hooks..." -ForegroundColor Cyan
if (Test-Path ".git") {
    $hooksDir = ".git\hooks"
    
    # Copy pre-commit hook (bash version)
    if (Test-Path ".github\hooks\pre-commit") {
        Copy-Item ".github\hooks\pre-commit" "$hooksDir\pre-commit" -Force
        Write-Success "Installed: pre-commit hook (bash)"
    }
    
    # Copy pre-commit hook (PowerShell version for Windows)
    if (Test-Path ".github\hooks\pre-commit.ps1") {
        Copy-Item ".github\hooks\pre-commit.ps1" "$hooksDir\pre-commit.ps1" -Force
        Write-Success "Installed: pre-commit hook (PowerShell)"
    }
    
    # Copy commit-msg hook
    if (Test-Path ".github\hooks\commit-msg") {
        Copy-Item ".github\hooks\commit-msg" "$hooksDir\commit-msg" -Force
        Write-Success "Installed: commit-msg hook"
    }
    
    Write-Host ""
    Write-Host "  Git hooks enforce AgentX workflow compliance:" -ForegroundColor Yellow
    Write-Host "  • Issue number required in commit messages"
    Write-Host "  • PRD required before Epic implementation"
    Write-Host "  • ADR + Tech Spec required before Feature implementation"
    Write-Host "  • UX design required when needs:ux label present"
    Write-Host "  • No secrets in code"
    Write-Host "  • Code formatting"
} else {
    Write-Warn "Not a Git repository - skipping hook installation"
    Write-Host "  Run 'git init' first to enable workflow enforcement"
}

# Done
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  AgentX installed successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Read AGENTS.md for workflow guidelines"
Write-Host "  2. Read Skills.md for production code standards"
Write-Host "  3. Create GitHub labels:"
Write-Host ""
Write-Host '     # Type labels' -ForegroundColor Yellow
Write-Host '     gh label create "type:epic" --color "5319E7"'
Write-Host '     gh label create "type:feature" --color "A2EEEF"'
Write-Host '     gh label create "type:story" --color "0E8A16"'
Write-Host '     gh label create "type:bug" --color "D73A4A"'
Write-Host ""
Write-Host '     # Orchestration labels' -ForegroundColor Yellow
Write-Host '     gh label create "orch:pm-done" --color "BFD4F2"'
Write-Host '     gh label create "orch:architect-done" --color "BFD4F2"'
Write-Host '     gh label create "orch:engineer-done" --color "BFD4F2"'
Write-Host ""
Write-Host "  4. Set up GitHub Project with Status field (see docs/project-setup.md)"
Write-Host ""
Write-Host "  ⚠️  IMPORTANT: Git hooks are now active!" -ForegroundColor Yellow
Write-Host "  Your commits will be validated for workflow compliance."
Write-Host ""

