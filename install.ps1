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
    @{ Src = "AGENTS.md"; Dest = "AGENTS.md" },
    @{ Src = "Skills.md"; Dest = "Skills.md" },
    @{ Src = ".github/copilot-instructions.md"; Dest = ".github/copilot-instructions.md" },
    @{ Src = ".github/autonomous-mode.yml"; Dest = ".github/autonomous-mode.yml" },
    @{ Src = ".github/orchestration-config.yml"; Dest = ".github/orchestration-config.yml" },
    @{ Src = ".github/agentx-security.yml"; Dest = ".github/agentx-security.yml" },
    @{ Src = ".github/CODEOWNERS"; Dest = ".github/CODEOWNERS" },
    @{ Src = ".github/workflows/agent-orchestrator.yml"; Dest = ".github/workflows/agent-orchestrator.yml" },
    @{ Src = ".github/workflows/sync-status-to-labels.yml"; Dest = ".github/workflows/sync-status-to-labels.yml" },
    @{ Src = ".github/workflows/test-e2e.yml"; Dest = ".github/workflows/test-e2e.yml" },
    @{ Src = ".github/actions/assign-agent/action.yml"; Dest = ".github/actions/assign-agent/action.yml" },
    @{ Src = ".github/actions/update-labels/action.yml"; Dest = ".github/actions/update-labels/action.yml" },
    @{ Src = ".github/actions/post-comment/action.yml"; Dest = ".github/actions/post-comment/action.yml" },
    @{ Src = ".vscode/settings.json"; Dest = ".vscode/settings.json" },
    @{ Src = ".vscode/mcp.json"; Dest = ".vscode/mcp.json" },
    @{ Src = "docs/mcp-integration.md"; Dest = "docs/mcp-integration.md" },
    @{ Src = "docs/project-setup.md"; Dest = "docs/project-setup.md" },
    @{ Src = "docs/architecture-decision-hybrid-orchestration.md"; Dest = "docs/architecture-decision-hybrid-orchestration.md" },
    @{ Src = "docs/hybrid-implementation-summary.md"; Dest = "docs/hybrid-implementation-summary.md" },
    @{ Src = "docs/hybrid-architecture-visual.md"; Dest = "docs/hybrid-architecture-visual.md" }
)

# Skills files
$skillsFiles = @(
    "01-core-principles.md",
    "02-testing.md",
    "03-error-handling.md",
    "04-security.md",
    "05-performance.md",
    "06-database.md",
    "07-scalability.md",
    "08-code-organization.md",
    "09-api-design.md",
    "10-configuration.md",
    "11-documentation.md",
    "12-version-control.md",
    "13-type-safety.md",
    "14-dependency-management.md",
    "15-logging-monitoring.md",
    "16-remote-git-operations.md",
    "17-ai-agent-development.md",
    "18-code-review-and-audit.md"
)

# Optional files for --Full
$optionalFiles = @(
    @{ Src = ".github/agents/product-manager.agent.md"; Dest = ".github/agents/product-manager.agent.md" },
    @{ Src = ".github/agents/architect.agent.md"; Dest = ".github/agents/architect.agent.md" },
    @{ Src = ".github/agents/ux-designer.agent.md"; Dest = ".github/agents/ux-designer.agent.md" },
    @{ Src = ".github/agents/engineer.agent.md"; Dest = ".github/agents/engineer.agent.md" },
    @{ Src = ".github/agents/reviewer.agent.md"; Dest = ".github/agents/reviewer.agent.md" },
    @{ Src = ".github/agents/orchestrator.agent.md"; Dest = ".github/agents/orchestrator.agent.md" },
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
foreach ($skill in $skillsFiles) {
    Download-File "skills/$skill" "skills/$skill"
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
Write-Host "1. Review and customize " -NoNewline
Write-Host ".github/autonomous-mode.yml" -ForegroundColor Cyan
Write-Host "2. Add your GitHub username to the allowed_actors list"
Write-Host "3. Create GitHub labels by running:"
Write-Host ""
Write-Host '   # Type labels (required - determines agent role)' -ForegroundColor Yellow
Write-Host '   gh label create "type:epic" --description "Large initiative (multiple features)" --color "5319E7"' -ForegroundColor Yellow
Write-Host '   gh label create "type:feature" --description "User-facing capability" --color "A2EEEF"' -ForegroundColor Yellow
Write-Host '   gh label create "type:story" --description "Implementation task" --color "0E8A16"' -ForegroundColor Yellow
Write-Host '   gh label create "type:bug" --description "Something broken" --color "D73A4A"' -ForegroundColor Yellow
Write-Host '   gh label create "type:spike" --description "Research/investigation" --color "EDEDED"' -ForegroundColor Yellow
Write-Host '   gh label create "type:docs" --description "Documentation only" --color "0075CA"' -ForegroundColor Yellow
Write-Host ""
Write-Host '   # Orchestration labels (agent coordination)' -ForegroundColor Yellow
Write-Host '   gh label create "orch:pm-done" --description "Product Manager work complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host '   gh label create "orch:architect-done" --description "Architect work complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host '   gh label create "orch:ux-done" --description "UX Designer work complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host '   gh label create "orch:engineer-done" --description "Engineer work complete" --color "BFD4F2"' -ForegroundColor Yellow
Write-Host ""
Write-Host '   # Priority labels' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p0" --description "Critical" --color "D93F0B"' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p1" --description "High - do next" --color "FBCA04"' -ForegroundColor Yellow
Write-Host ""
Write-Host '   # Workflow labels' -ForegroundColor Yellow
Write-Host '   gh label create "needs:ux" --description "Requires UX design work" --color "C5DEF5"' -ForegroundColor Yellow
Write-Host '   gh label create "needs:help" --description "Blocked or needs assistance" --color "D93F0B"' -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Set up GitHub Project v2 with Status field (see docs/project-setup.md)"
Write-Host "   Status values: Backlog, In Progress, In Review, Done"
Write-Host ""
Write-Host "5. Read " -NoNewline
Write-Host "AGENTS.md" -ForegroundColor Cyan -NoNewline
Write-Host " for workflow guidelines"
Write-Host "6. Check " -NoNewline
Write-Host "Skills.md" -ForegroundColor Cyan -NoNewline
Write-Host " for production standards"
Write-Host "7. Review " -NoNewline
Write-Host ".github/orchestration-config.yml" -ForegroundColor Cyan -NoNewline
Write-Host " for multi-agent orchestration settings"
Write-Host "8. Review " -NoNewline
Write-Host "docs/architecture-decision-hybrid-orchestration.md" -ForegroundColor Cyan -NoNewline
Write-Host " for hybrid architecture details"
Write-Host "9. MCP Server is pre-configured (requires VS Code 1.101+ and GitHub Copilot)"
Write-Host "10. GraphQL actions provide 9x faster handoffs (2s vs 45s)"
Write-Host ""
Write-Success "AgentX installed successfully! 🚀"
Write-Host ""

