#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX in your project (PowerShell version)

.DESCRIPTION
    Downloads and installs AgentX - AI Agent Guidelines for Production Code
    into your current project directory. Installs all files including agents,
    instructions, prompts, and VS Code extension.

.PARAMETER Force
    Overwrite existing files

.EXAMPLE
    .\install.ps1
    
.EXAMPLE
    .\install.ps1 -Force
    
.EXAMPLE
    irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Info($msg) { Write-Host "ℹ " -ForegroundColor Blue -NoNewline; Write-Host $msg }
function Write-Success($msg) { Write-Host "✓ " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Warn($msg) { Write-Host "⚠ " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err($msg) { Write-Host "✗ " -ForegroundColor Red -NoNewline; Write-Host $msg }

$REPO_URL = "https://raw.githubusercontent.com/jnPiyush/AgentX/master"
$TARGET_DIR = Get-Location

# Install git hooks
function Install-GitHooks {
    Write-Info "Installing git hooks..."
    
    if (-not (Test-Path ".git")) {
        Write-Warn "Not a git repository. Skipping hooks installation."
        return
    }
    
    $hooksDir = ".git/hooks"
    $sourceHooksDir = ".github/hooks"
    
    if (-not (Test-Path $sourceHooksDir)) {
        Write-Warn "Hooks directory not found. Skipping hooks installation."
        return
    }
    
    # Copy hooks
    $hooks = @("pre-commit", "commit-msg")
    foreach ($hook in $hooks) {
        $source = Join-Path $sourceHooksDir $hook
        $dest = Join-Path $hooksDir $hook
        
        if (Test-Path $source) {
            Copy-Item $source $dest -Force
            Write-Success "Installed $hook hook"
        }
    }
    
    Write-Success "Git hooks installed successfully"
}

# Banner
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                 ║" -ForegroundColor Cyan
Write-Host "║   " -ForegroundColor Cyan -NoNewline
Write-Host "AgentX" -ForegroundColor White -NoNewline
Write-Host " - AI Agent Guidelines for Production Code         ║" -ForegroundColor Cyan
Write-Host "║                                                                 ║" -ForegroundColor Cyan
Write-Host "║   Dynamic Multi-agent Workflow & Enterprise-grade Standards     ║" -ForegroundColor Cyan
Write-Host "║                                                                 ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Installing AgentX in your project..." -ForegroundColor Cyan
Write-Host ""

# Core files to download
$coreFiles = @(
    @{ Src = "README.md"; Dest = "README.md" },
    @{ Src = "LICENSE"; Dest = "LICENSE" },
    @{ Src = "AGENTS.md"; Dest = "AGENTS.md" },
    @{ Src = "Skills.md"; Dest = "Skills.md" },
    @{ Src = "CONTRIBUTING.md"; Dest = "CONTRIBUTING.md" },
    @{ Src = ".github/copilot-instructions.md"; Dest = ".github/copilot-instructions.md" },
    @{ Src = ".github/CODEOWNERS"; Dest = ".github/CODEOWNERS" },
    @{ Src = ".github/agentx-security.yml"; Dest = ".github/agentx-security.yml" },
    @{ Src = ".github/orchestration-config.yml"; Dest = ".github/orchestration-config.yml" },
    @{ Src = ".github/workflows/agent-orchestrator.yml"; Dest = ".github/workflows/agent-orchestrator.yml" },
    @{ Src = ".github/workflows/test-e2e.yml"; Dest = ".github/workflows/test-e2e.yml" },
    @{ Src = ".github/hooks/pre-commit"; Dest = ".github/hooks/pre-commit" },
    @{ Src = ".github/hooks/commit-msg"; Dest = ".github/hooks/commit-msg" },
    @{ Src = ".github/scripts/validate-handoff.ps1"; Dest = ".github/scripts/validate-handoff.ps1" },
    @{ Src = ".github/scripts/validate-handoff.sh"; Dest = ".github/scripts/validate-handoff.sh" },
    @{ Src = ".github/scripts/capture-context.ps1"; Dest = ".github/scripts/capture-context.ps1" },
    @{ Src = ".github/scripts/capture-context.sh"; Dest = ".github/scripts/capture-context.sh" },
    @{ Src = ".github/ISSUE_TEMPLATE/epic.yml"; Dest = ".github/ISSUE_TEMPLATE/epic.yml" },
    @{ Src = ".github/ISSUE_TEMPLATE/feature.yml"; Dest = ".github/ISSUE_TEMPLATE/feature.yml" },
    @{ Src = ".github/ISSUE_TEMPLATE/story.yml"; Dest = ".github/ISSUE_TEMPLATE/story.yml" },
    @{ Src = ".github/ISSUE_TEMPLATE/bug.yml"; Dest = ".github/ISSUE_TEMPLATE/bug.yml" },
    @{ Src = ".github/PULL_REQUEST_TEMPLATE.md"; Dest = ".github/PULL_REQUEST_TEMPLATE.md" },
    @{ Src = ".vscode/mcp.json"; Dest = ".vscode/mcp.json" },
    @{ Src = "docs/mcp-integration.md"; Dest = "docs/mcp-integration.md" },
    @{ Src = "docs/project-setup.md"; Dest = "docs/project-setup.md" },
    @{ Src = "docs/technical-specification.md"; Dest = "docs/technical-specification.md" },
    @{ Src = "docs/architecture-hybrid-orchestration.md"; Dest = "docs/architecture-hybrid-orchestration.md" },
    @{ Src = "docs/context-engineering.md"; Dest = "docs/context-engineering.md" }
)

# Skills files (new structure: .github/skills/<skill-name>/SKILL.md)
$skillsFiles = @(
    @{ Src = ".github/skills/core-principles/SKILL.md"; Dest = ".github/skills/core-principles/SKILL.md" },
    @{ Src = ".github/skills/testing/SKILL.md"; Dest = ".github/skills/testing/SKILL.md" },
    @{ Src = ".github/skills/error-handling/SKILL.md"; Dest = ".github/skills/error-handling/SKILL.md" },
    @{ Src = ".github/skills/security/SKILL.md"; Dest = ".github/skills/security/SKILL.md" },
    @{ Src = ".github/skills/performance/SKILL.md"; Dest = ".github/skills/performance/SKILL.md" },
    @{ Src = ".github/skills/database/SKILL.md"; Dest = ".github/skills/database/SKILL.md" },
    @{ Src = ".github/skills/scalability/SKILL.md"; Dest = ".github/skills/scalability/SKILL.md" },
    @{ Src = ".github/skills/code-organization/SKILL.md"; Dest = ".github/skills/code-organization/SKILL.md" },
    @{ Src = ".github/skills/api-design/SKILL.md"; Dest = ".github/skills/api-design/SKILL.md" },
    @{ Src = ".github/skills/configuration/SKILL.md"; Dest = ".github/skills/configuration/SKILL.md" },
    @{ Src = ".github/skills/documentation/SKILL.md"; Dest = ".github/skills/documentation/SKILL.md" },
    @{ Src = ".github/skills/version-control/SKILL.md"; Dest = ".github/skills/version-control/SKILL.md" },
    @{ Src = ".github/skills/type-safety/SKILL.md"; Dest = ".github/skills/type-safety/SKILL.md" },
    @{ Src = ".github/skills/dependency-management/SKILL.md"; Dest = ".github/skills/dependency-management/SKILL.md" },
    @{ Src = ".github/skills/logging-monitoring/SKILL.md"; Dest = ".github/skills/logging-monitoring/SKILL.md" },
    @{ Src = ".github/skills/remote-git-operations/SKILL.md"; Dest = ".github/skills/remote-git-operations/SKILL.md" },
    @{ Src = ".github/skills/ai-agent-development/SKILL.md"; Dest = ".github/skills/ai-agent-development/SKILL.md" },
    @{ Src = ".github/skills/code-review-and-audit/SKILL.md"; Dest = ".github/skills/code-review-and-audit/SKILL.md" }
)

# Optional files for --Full
$optionalFiles = @(
    @{ Src = ".github/agents/product-manager.agent.md"; Dest = ".github/agents/product-manager.agent.md" },
    @{ Src = ".github/agents/architect.agent.md"; Dest = ".github/agents/architect.agent.md" },
    @{ Src = ".github/agents/ux-designer.agent.md"; Dest = ".github/agents/ux-designer.agent.md" },
    @{ Src = ".github/agents/engineer.agent.md"; Dest = ".github/agents/engineer.agent.md" },
    @{ Src = ".github/agents/reviewer.agent.md"; Dest = ".github/agents/reviewer.agent.md" },
    @{ Src = ".github/agents/orchestrator.agent.md"; Dest = ".github/agents/orchestrator.agent.md" },
    @{ Src = ".github/templates/ADR-TEMPLATE.md"; Dest = ".github/templates/ADR-TEMPLATE.md" },
    @{ Src = ".github/templates/SPEC-TEMPLATE.md"; Dest = ".github/templates/SPEC-TEMPLATE.md" },
    @{ Src = ".github/templates/PRD-TEMPLATE.md"; Dest = ".github/templates/PRD-TEMPLATE.md" },
    @{ Src = ".github/templates/UX-TEMPLATE.md"; Dest = ".github/templates/UX-TEMPLATE.md" },
    @{ Src = ".github/templates/REVIEW-TEMPLATE.md"; Dest = ".github/templates/REVIEW-TEMPLATE.md" },
    @{ Src = ".github/templates/README.md"; Dest = ".github/templates/README.md" },
    @{ Src = ".github/instructions/csharp.instructions.md"; Dest = ".github/instructions/csharp.instructions.md" },
    @{ Src = ".github/instructions/python.instructions.md"; Dest = ".github/instructions/python.instructions.md" },
    @{ Src = ".github/instructions/react.instructions.md"; Dest = ".github/instructions/react.instructions.md" },
    @{ Src = ".github/instructions/api.instructions.md"; Dest = ".github/instructions/api.instructions.md" },
    @{ Src = ".github/prompts/code-review.prompt.md"; Dest = ".github/prompts/code-review.prompt.md" },
    @{ Src = ".github/prompts/refactor.prompt.md"; Dest = ".github/prompts/refactor.prompt.md" },
    @{ Src = ".github/prompts/test-gen.prompt.md"; Dest = ".github/prompts/test-gen.prompt.md" }
)

function Download-File($src, $dest) {
    $destPath = Join-Path $TARGET_DIR $dest
    $destDir = Split-Path $destPath -Parent
    
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    if ((Test-Path $destPath) -and -not $Force) {
        Write-Warn "Skipped (exists): $dest"
        return
    }
    
    try {
        $url = "$REPO_URL/$src"
        Invoke-WebRequest -Uri $url -OutFile $destPath -UseBasicParsing
        Write-Success "Downloaded: $dest"
    }
    catch {
        Write-Err "Failed to download: $dest"
    }
}

# Check for git
if (-not (Test-Path (Join-Path $TARGET_DIR ".git"))) {
    Write-Warn "Not a git repository. Some features may not work."
    Write-Info "Run 'git init' to initialize a git repository."
}

# Download core files
Write-Info "Downloading core files..."
foreach ($file in $coreFiles) {
    Download-File $file.Src $file.Dest
}

# Download skills
Write-Info "Downloading skills documentation..."
foreach ($file in $skillsFiles) {
    Download-File $file.Src $file.Dest
}

# Download additional files (agents, instructions, prompts)
Write-Info "Downloading agents, instructions, and prompts..."
foreach ($file in $optionalFiles) {
    Download-File $file.Src $file.Dest
}

# Install git hooks
Install-GitHooks

Write-Host ""
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review " -NoNewline
Write-Host "AGENTS.md" -ForegroundColor Cyan -NoNewline
Write-Host " for the complete workflow: PM → UX → Architect → Engineer → Reviewer"
Write-Host ""
Write-Host "2. Create GitHub labels by running:"
Write-Host ""
Write-Host '   # Type labels (required - determines agent role)' -ForegroundColor Yellow
Write-Host '   gh label create "type:epic" --description "Large initiative (multiple features)" --color "5319E7"' -ForegroundColor Yellow
Write-Host '   gh label create "type:feature" --description "User-facing capability" --color "A2EEEF"' -ForegroundColor Yellow
Write-Host '   gh label create "type:story" --description "Implementation task" --color "0E8A16"' -ForegroundColor Yellow
Write-Host '   gh label create "type:bug" --description "Something broken" --color "D73A4A"' -ForegroundColor Yellow
Write-Host '   gh label create "type:spike" --description "Research/investigation" --color "EDEDED"' -ForegroundColor Yellow
Write-Host '   gh label create "type:docs" --description "Documentation only" --color "0075CA"' -ForegroundColor Yellow
Write-Host ""
Write-Host '   # Orchestration labels (sequential handoffs: PM→UX→Architect→Engineer)' -ForegroundColor Yellow
Write-Host '   gh label create "orch:pm-done" --description "PM: PRD + Backlog complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host '   gh label create "orch:ux-done" --description "UX: Wireframes + Prototypes + Personas complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host '   gh label create "orch:architect-done" --description "Architect: ADR + Specs + Architecture complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host '   gh label create "orch:engineer-done" --description "Engineer: Code + Tests complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host ""
Write-Host '   # Priority labels' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p0" --description "Critical" --color "D93F0B"' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p1" --description "High - do next" --color "FBCA04"' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p2" --description "Medium" --color "FEF2C0"' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p3" --description "Low" --color "C5DEF5"' -ForegroundColor Yellow
Write-Host ""
Write-Host '   # Workflow labels' -ForegroundColor Yellow
Write-Host '   gh label create "needs:ux" --description "Requires UX design work" --color "C5DEF5"' -ForegroundColor Yellow
Write-Host '   gh label create "needs:help" --description "Blocked or needs assistance" --color "D93F0B"' -ForegroundColor Yellow
Write-Host '   gh label create "needs:changes" --description "Reviewer requested changes" --color "FBCA04"' -ForegroundColor Yellow
Write-Host '   gh label create "needs:fixes" --description "Tests failing, needs fixes" --color "D93F0B"' -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Set up GitHub Project v2 with Status field (see docs/project-setup.md)"
Write-Host "   Status values: Backlog, In Progress, In Review, Done, Ready (optional)"
Write-Host ""
Write-Host "4. Check " -NoNewline
Write-Host "Skills.md" -ForegroundColor Cyan -NoNewline
Write-Host " for 18 production code skills"
Write-Host "5. Review " -NoNewline
Write-Host ".github/orchestration-config.yml" -ForegroundColor Cyan -NoNewline
Write-Host " for multi-agent orchestration settings"
Write-Host "6. Read " -NoNewline
Write-Host "docs/mcp-integration.md" -ForegroundColor Cyan -NoNewline
Write-Host " for GitHub MCP Server setup (requires VS Code 1.101+ and GitHub Copilot)"
Write-Host "7. Review " -NoNewline
Write-Host "docs/architecture-hybrid-orchestration.md" -ForegroundColor Cyan -NoNewline
Write-Host " for 3-layer hybrid architecture"
Write-Host "8. Install agent definition files (optional):"
Write-Host "   .github/agents/{product-manager,ux-designer,architect,engineer,reviewer,orchestrator}.agent.md"
Write-Host ""
Write-Success "AgentX installed successfully! 🚀"
Write-Host ""
Write-Host "Workflow: PM creates PRD+Backlog → UX creates Wireframes+Prototypes+Personas →" -ForegroundColor Green
Write-Host "          Architect creates ADR+Specs+Architecture → Engineer creates Low-level Design+Code+Tests" -ForegroundColor Green
Write-Host ""

