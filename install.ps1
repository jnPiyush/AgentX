#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX v3.0.0 in your project

.DESCRIPTION
    Downloads and installs all AgentX files including agents, skills,
    templates, workflows, and documentation.
    
    New in v3.0: Agent analytics, auto-fix reviewer, prompt engineering,
    cross-repo orchestration, CLI spec, agent memory, visualization.
    Includes all v2.1 features: maturity levels, constraint-based design,
    handoff buttons, input variables, context clearing, and adaptive mode.

.PARAMETER Force
    Overwrite existing files

.PARAMETER NoGit
    Skip Git initialization and continue without Git (non-interactive)

.PARAMETER Repo
    GitHub repository (owner/repo or full URL) to configure as origin (non-interactive)

.EXAMPLE
    .\install.ps1
    
.EXAMPLE
    .\install.ps1 -NoGit
    
.EXAMPLE
    .\install.ps1 -Repo "owner/repo"
    
.EXAMPLE
    irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param(
    [switch]$Force,
    [switch]$NoGit,
    [string]$Repo
)

$ErrorActionPreference = "Stop"
$REPO_URL = "https://raw.githubusercontent.com/jnPiyush/AgentX/master"
$skipGitChecks = $false
$detectedRepo = $null  # Store detected/provided repo to avoid asking twice

function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Get-GitHubRepo {
    # Try to detect from existing git remote
    if (Test-Path ".git") {
        try {
            $remoteUrl = git remote get-url origin 2>&1
            if ($LASTEXITCODE -eq 0 -and $remoteUrl) {
                # Extract owner/repo from various URL formats
                if ($remoteUrl -match "github\.com[:/]([^/]+)/([^/\.]+)") {
                    return "$($matches[1])/$($matches[2])"
                }
            }
        } catch {
            # Ignore errors, will prompt user
        }
    }
    return $null
}

function Get-FileDownload($src, $dest) {
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
Write-Host "║  AgentX v3.0.0 - Multi-Agent Orchestration       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "New: Analytics, auto-fix reviewer, prompt engineering, adaptive mode" -ForegroundColor Green
Write-Host ""
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Pre-installation validation
Write-Host "Running pre-installation checks..." -ForegroundColor Yellow
Write-Host ""

# Auto-detect or get repository once
if ($Repo) {
    $detectedRepo = $Repo
    Write-Success "Using provided repository: $detectedRepo"
} else {
    $detectedRepo = Get-GitHubRepo
    if ($detectedRepo) {
        Write-Success "Detected GitHub repository: $detectedRepo"
    }
}

# Check 1: Git repository
if (-not (Test-Path ".git")) {
    if ($NoGit) {
        $skipGitChecks = $true
        Write-Warn "Proceeding without Git (non-interactive mode)"
    } else {
        Write-Host "[ERROR] Not a git repository" -ForegroundColor Red
        Write-Host ""
        Write-Host "AgentX works best in a Git repository for hooks and workflows." -ForegroundColor Yellow
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  [1] Initialize Git repository now" -ForegroundColor Cyan
        Write-Host "  [2] Continue without Git (limited features)" -ForegroundColor Cyan
        Write-Host "  [3] Cancel installation" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Choose (1/2/3): " -NoNewline -ForegroundColor Yellow
        $resp = Read-Host

        if ($resp -eq "1") {
        try {
            git init 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0 -and (Test-Path ".git")) {
                Write-Success "Initialized Git repository"

                # Ask for repo only if not already detected/provided
                if (-not $detectedRepo) {
                    Write-Host "Enter GitHub repository (URL or owner/repo). Press Enter to skip: " -NoNewline
                    $repoInput = Read-Host
                    if ($repoInput) {
                        $detectedRepo = $repoInput
                    }
                }

                if ($detectedRepo) {
                    $repoUrl = $null
                    if ($detectedRepo -match "^(https?://|git@)") {
                        $repoUrl = $detectedRepo
                    } elseif ($detectedRepo -match "^[^/]+/[^/]+$") {
                        $repoUrl = "https://github.com/$detectedRepo.git"
                    }

                    if ($repoUrl) {
                        try {
                            git remote add origin $repoUrl 2>&1 | Out-Null
                            Write-Success "GitHub remote configured: $repoUrl"
                        } catch {
                            Write-Warn "Failed to add remote. You can set it manually later (git remote add origin <url>)."
                        }
                    } else {
                        Write-Warn "Unrecognized repository format. Skipping remote setup."
                    }
                }
            } else {
                throw "git init failed"
            }
        } catch {
            Write-Warn "Could not initialize a Git repository. Continuing without Git."
            $skipGitChecks = $true
        }
        } elseif ($resp -eq "2") {
            $skipGitChecks = $true
            Write-Warn "Proceeding without Git; some features will be skipped."
        } else {
            Write-Host "Installation cancelled." -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Success "Git repository detected"
}

# Check 2: GitHub remote
$useLocalMode = $false
if (-not $skipGitChecks -and (Test-Path ".git")) {
    try {
        $remotes = git remote -v 2>&1
        if ($LASTEXITCODE -ne 0 -or -not ($remotes -match "github\.com")) {
            Write-Host "⚠️  No GitHub remote configured" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "AgentX can work in two modes:" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Options:" -ForegroundColor Yellow
            Write-Host "  [1] Set up GitHub remote (GitHub Mode - full features)" -ForegroundColor Cyan
            Write-Host "  [2] Use Local Mode (filesystem-based issue tracking)" -ForegroundColor Cyan
            Write-Host "  [3] Cancel installation" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Choose (1/2/3): " -NoNewline -ForegroundColor Yellow
            $response = Read-Host
            
            if ($response -eq "1") {
                # Ask for repo only if not already detected/provided
                if (-not $detectedRepo) {
                    Write-Host "Enter GitHub repository (URL or owner/repo): " -NoNewline
                    $repoInput2 = Read-Host
                    if ($repoInput2) {
                        $detectedRepo = $repoInput2
                    }
                }

                if ($detectedRepo) {
                    $repoUrl2 = $null
                    if ($detectedRepo -match "^(https?://|git@)") {
                        $repoUrl2 = $detectedRepo
                    } elseif ($detectedRepo -match "^[^/]+/[^/]+$") {
                        $repoUrl2 = "https://github.com/$detectedRepo.git"
                    }
                    if ($repoUrl2) {
                        try {
                            git remote add origin $repoUrl2 2>&1 | Out-Null
                            Write-Success "GitHub remote configured: $repoUrl2"
                        } catch {
                            Write-Warn "Failed to add remote. You can do it manually later."
                        }
                    } else {
                        Write-Warn "Unrecognized repository format. Skipping remote setup."
                    }
                }
            } elseif ($response -eq "2") {
                $useLocalMode = $true
                Write-Success "Local Mode enabled - using filesystem-based issue tracking"
            } else {
                Write-Host "Installation cancelled." -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Success "GitHub remote configured"
        }
    } catch {
        Write-Warn "Could not check Git remotes"
    }
} elseif ($skipGitChecks) {
    Write-Warn "Skipping GitHub remote setup because Git was not initialized."
    $useLocalMode = $true
    Write-Success "Local Mode enabled - using filesystem-based issue tracking"
}

# Check 3: GitHub CLI (recommended) - Skip in Local Mode
if (-not $useLocalMode) {
    try {
        $null = gh --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "GitHub CLI (gh) detected"
        } else {
            throw
        }
    } catch {
        Write-Host "⚠️  GitHub CLI (gh) not found" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "GitHub CLI is recommended for the Issue-First Workflow." -ForegroundColor Gray
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  [1] Install GitHub CLI now (requires winget)" -ForegroundColor Cyan
        Write-Host "  [2] Continue and install later" -ForegroundColor Cyan
        Write-Host "  [3] Cancel installation" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Choose (1/2/3): " -NoNewline -ForegroundColor Yellow
        $response = Read-Host
        
        if ($response -eq "1") {
            Write-Host "Installing GitHub CLI via winget..." -ForegroundColor Yellow
            try {
                if (Get-Command winget -ErrorAction SilentlyContinue) {
                    winget install --id GitHub.cli --silent --accept-package-agreements --accept-source-agreements
                    Write-Success "GitHub CLI installed! Restart your terminal after installation completes."
                } else {
                    Write-Warn "winget not found. Install GitHub CLI manually from: https://cli.github.com/"
                }
            } catch {
                Write-Warn "Installation failed. Install manually from: https://cli.github.com/"
            }
        } elseif ($response -ne "2") {
            Write-Host "Installation cancelled." -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Success "Local Mode - GitHub CLI not required"
}

# Check 4: GitHub Projects V2 (informational only) - Skip in Local Mode
if (-not $useLocalMode) {
    Write-Host ""
    Write-Host "ℹ️  GitHub Projects V2 - Setup Required" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "AgentX requires a GitHub Project (V2) with Status field values:" -ForegroundColor Gray
    Write-Host "  • Backlog, In Progress, In Review, Ready, Done" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  [1] Create GitHub Project V2 now (requires gh CLI + auth)" -ForegroundColor Cyan
    Write-Host "  [2] Set up manually later" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Choose (1/2): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host

    if ($response -eq "1") {
        try {
            $null = gh --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                # Use detected repo or ask
                $repo = $detectedRepo
                if (-not $repo) {
                    Write-Host "Enter repository (format: owner/repo): " -NoNewline
                    $repo = Read-Host
                } else {
                    Write-Host "Using repository: $repo" -ForegroundColor Cyan
                }

                if ($repo) {
                    Write-Host "Creating GitHub Project V2..." -ForegroundColor Yellow
                    
                    # Create project
                    $projectName = "AgentX Workflow"
                    $ownerNodeId = (gh api /repos/$repo | ConvertFrom-Json).owner.node_id
                    $query = "mutation { createProjectV2(input: {ownerId: `"$ownerNodeId`", title: `"$projectName`"}) { projectV2 { id number } } }"
                    $result = gh api graphql -f query=$query | ConvertFrom-Json
                    
                    if ($result.data.createProjectV2.projectV2.number) {
                        $projectNumber = $result.data.createProjectV2.projectV2.number
                        Write-Success "Project created! Number: #$projectNumber"
                        Write-Host "Visit: https://github.com/$repo/projects/$projectNumber" -ForegroundColor Cyan
                        Write-Host ""
                        Write-Host "⚠️  Manual step required: Add Status field with these values:" -ForegroundColor Yellow
                        Write-Host "     Backlog, In Progress, In Review, Ready, Done" -ForegroundColor Cyan
                    } else {
                        throw "Failed to create project"
                    }
                }
            } else {
                Write-Warn "GitHub CLI not available. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects"
            }
        } catch {
            Write-Warn "Auto-creation failed. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects"
        }
    } else {
        Write-Host "Guide: https://docs.github.com/en/issues/planning-and-tracking-with-projects" -ForegroundColor DarkGray
    }
} else {
    Write-Success "Local Mode - Status tracking via filesystem"
}
Write-Host ""

Write-Host "Installing AgentX files..." -ForegroundColor Yellow
Write-Host ""

# Core documentation
Write-Info "Core documentation..."
Get-FileDownload "AGENTS.md" "AGENTS.md"
Get-FileDownload "Skills.md" "Skills.md"
Get-FileDownload "CONTRIBUTING.md" "CONTRIBUTING.md"
Get-FileDownload "CHANGELOG.md" "CHANGELOG.md"
Get-FileDownload "README.md" "README.md"
Get-FileDownload ".gitignore" ".gitignore"

# GitHub configuration
Write-Info "GitHub configuration..."
Get-FileDownload ".github/copilot-instructions.md" ".github/copilot-instructions.md"
Get-FileDownload ".github/CODEOWNERS" ".github/CODEOWNERS"
Get-FileDownload ".github/agentx-security.yml" ".github/agentx-security.yml"
Get-FileDownload ".github/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"
Get-FileDownload ".github/security/allowed-commands.json" ".github/security/allowed-commands.json"

# Workflows
Write-Info "GitHub Actions workflows..."
Get-FileDownload ".github/workflows/agent-x.yml" ".github/workflows/agent-x.yml"
Get-FileDownload ".github/workflows/quality-gates.yml" ".github/workflows/quality-gates.yml"
Get-FileDownload ".github/workflows/dependency-scanning.yml" ".github/workflows/dependency-scanning.yml"

# Git hooks
Write-Info "Git hooks..."
Get-FileDownload ".github/hooks/pre-commit" ".github/hooks/pre-commit"
Get-FileDownload ".github/hooks/pre-commit.ps1" ".github/hooks/pre-commit.ps1"
Get-FileDownload ".github/hooks/commit-msg" ".github/hooks/commit-msg"

# Issue templates
Write-Info "Issue templates..."
Get-FileDownload ".github/ISSUE_TEMPLATE/config.yml" ".github/ISSUE_TEMPLATE/config.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/epic.yml" ".github/ISSUE_TEMPLATE/epic.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/feature.yml" ".github/ISSUE_TEMPLATE/feature.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/story.yml" ".github/ISSUE_TEMPLATE/story.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/bug.yml" ".github/ISSUE_TEMPLATE/bug.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/spike.yml" ".github/ISSUE_TEMPLATE/spike.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/docs.yml" ".github/ISSUE_TEMPLATE/docs.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/devops.yml" ".github/ISSUE_TEMPLATE/devops.yml"
Get-FileDownload ".github/ISSUE_TEMPLATE/feature-local-mode.md" ".github/ISSUE_TEMPLATE/feature-local-mode.md"

# Agent definitions
Write-Info "Agent definitions..."
Get-FileDownload ".github/agents/product-manager.agent.md" ".github/agents/product-manager.agent.md"
Get-FileDownload ".github/agents/architect.agent.md" ".github/agents/architect.agent.md"
Get-FileDownload ".github/agents/ux-designer.agent.md" ".github/agents/ux-designer.agent.md"
Get-FileDownload ".github/agents/engineer.agent.md" ".github/agents/engineer.agent.md"
Get-FileDownload ".github/agents/reviewer.agent.md" ".github/agents/reviewer.agent.md"
Get-FileDownload ".github/agents/devops.agent.md" ".github/agents/devops.agent.md"
Get-FileDownload ".github/agents/agent-x.agent.md" ".github/agents/agent-x.agent.md"
Get-FileDownload ".github/agents/reviewer-auto.agent.md" ".github/agents/reviewer-auto.agent.md"

# Document templates
Write-Info "Document templates..."
Get-FileDownload ".github/templates/PRD-TEMPLATE.md" ".github/templates/PRD-TEMPLATE.md"
Get-FileDownload ".github/templates/ADR-TEMPLATE.md" ".github/templates/ADR-TEMPLATE.md"
Get-FileDownload ".github/templates/SPEC-TEMPLATE.md" ".github/templates/SPEC-TEMPLATE.md"
Get-FileDownload ".github/templates/UX-TEMPLATE.md" ".github/templates/UX-TEMPLATE.md"
Get-FileDownload ".github/templates/REVIEW-TEMPLATE.md" ".github/templates/REVIEW-TEMPLATE.md"
Get-FileDownload ".github/templates/PROGRESS-TEMPLATE.md" ".github/templates/PROGRESS-TEMPLATE.md"
Get-FileDownload ".github/templates/README.md" ".github/templates/README.md"

# Instructions
Write-Info "Coding instructions..."
Get-FileDownload ".github/instructions/api.instructions.md" ".github/instructions/api.instructions.md"
Get-FileDownload ".github/instructions/csharp.instructions.md" ".github/instructions/csharp.instructions.md"
Get-FileDownload ".github/instructions/python.instructions.md" ".github/instructions/python.instructions.md"
Get-FileDownload ".github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"
Get-FileDownload ".github/instructions/blazor.instructions.md" ".github/instructions/blazor.instructions.md"
Get-FileDownload ".github/instructions/sql.instructions.md" ".github/instructions/sql.instructions.md"
Get-FileDownload ".github/instructions/devops.instructions.md" ".github/instructions/devops.instructions.md"

# Prompts
Write-Info "Prompt templates..."
Get-FileDownload ".github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
Get-FileDownload ".github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
Get-FileDownload ".github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"
Get-FileDownload ".github/prompts/prd-gen.prompt.md" ".github/prompts/prd-gen.prompt.md"
Get-FileDownload ".github/prompts/ux-design.prompt.md" ".github/prompts/ux-design.prompt.md"
Get-FileDownload ".github/prompts/architecture.prompt.md" ".github/prompts/architecture.prompt.md"
Get-FileDownload ".github/prompts/devops.prompt.md" ".github/prompts/devops.prompt.md"
Get-FileDownload ".github/prompts/security-review.prompt.md" ".github/prompts/security-review.prompt.md"
Get-FileDownload ".github/prompts/bug-triage.prompt.md" ".github/prompts/bug-triage.prompt.md"

# Skills (36 production skills organized by category)
Write-Info "Production skills (36 skills)..."
$skills = @{
    "architecture" = @("core-principles", "security", "performance", "database", "scalability", "code-organization", "api-design")
    "development" = @("testing", "error-handling", "configuration", "documentation", "version-control", "type-safety", "dependency-management", "logging-monitoring", "code-review-and-audit", "csharp", "python", "frontend-ui", "react", "blazor", "postgresql", "sql-server", "go", "rust", "mcp-server-development", "data-analysis")
    "operations" = @("remote-git-operations", "github-actions-workflows", "yaml-pipelines", "release-management")
    "cloud" = @("azure", "containerization")
    "ai-systems" = @("ai-agent-development", "prompt-engineering", "skill-creator")
    "design" = @("ux-ui-design")
}
foreach ($category in $skills.Keys) {
    foreach ($skill in $skills[$category]) {
        Get-FileDownload ".github/skills/$category/$skill/SKILL.md" ".github/skills/$category/$skill/SKILL.md"
    }
}

# Skill reference files (progressive disclosure)
Write-Info "Skill references and scripts..."

# ai-agent-development references
Get-FileDownload ".github/skills/ai-systems/ai-agent-development/LICENSE.txt" ".github/skills/ai-systems/ai-agent-development/LICENSE.txt"
Get-FileDownload ".github/skills/ai-systems/ai-agent-development/references/evaluation-guide.md" ".github/skills/ai-systems/ai-agent-development/references/evaluation-guide.md"
Get-FileDownload ".github/skills/ai-systems/ai-agent-development/references/orchestration-patterns.md" ".github/skills/ai-systems/ai-agent-development/references/orchestration-patterns.md"

# skill-creator scripts
Get-FileDownload ".github/skills/ai-systems/skill-creator/scripts/init-skill.ps1" ".github/skills/ai-systems/skill-creator/scripts/init-skill.ps1"

# security scripts
Get-FileDownload ".github/skills/architecture/security/scripts/scan-security.ps1" ".github/skills/architecture/security/scripts/scan-security.ps1"
Get-FileDownload ".github/skills/architecture/security/scripts/scan-secrets.ps1" ".github/skills/architecture/security/scripts/scan-secrets.ps1"

# ux-ui-design references
$uxRefs = @("accessibility-patterns", "html-prototype-code", "research-templates", "responsive-patterns", "usability-testing-template")
foreach ($ref in $uxRefs) {
    Get-FileDownload ".github/skills/design/ux-ui-design/references/$ref.md" ".github/skills/design/ux-ui-design/references/$ref.md"
}

# testing scripts
Get-FileDownload ".github/skills/development/testing/scripts/check-coverage.ps1" ".github/skills/development/testing/scripts/check-coverage.ps1"
Get-FileDownload ".github/skills/development/testing/scripts/check-test-pyramid.ps1" ".github/skills/development/testing/scripts/check-test-pyramid.ps1"

# github-actions-workflows references
$gaRefs = @("workflow-syntax-reference", "jobs-and-steps-patterns", "actions-marketplace-examples", "secrets-variables-matrix", "reusable-workflows-and-actions")
foreach ($ref in $gaRefs) {
    Get-FileDownload ".github/skills/operations/github-actions-workflows/references/$ref.md" ".github/skills/operations/github-actions-workflows/references/$ref.md"
}

# release-management references and scripts
$rmRefs = @("release-pipeline-examples", "deployment-strategy-examples", "rollback-scripts", "release-automation-workflows", "release-runbook-template")
foreach ($ref in $rmRefs) {
    Get-FileDownload ".github/skills/operations/release-management/references/$ref.md" ".github/skills/operations/release-management/references/$ref.md"
}
Get-FileDownload ".github/skills/operations/release-management/scripts/version-bump.ps1" ".github/skills/operations/release-management/scripts/version-bump.ps1"

# yaml-pipelines references
$ypRefs = @("azure-pipelines-examples", "gitlab-ci-examples", "pipeline-design-patterns", "multi-stage-pipelines", "templates-variables-caching")
foreach ($ref in $ypRefs) {
    Get-FileDownload ".github/skills/operations/yaml-pipelines/references/$ref.md" ".github/skills/operations/yaml-pipelines/references/$ref.md"
}

# VS Code configuration
Write-Info "VS Code configuration..."
Get-FileDownload ".vscode/mcp.json" ".vscode/mcp.json"
Get-FileDownload ".vscode/settings.json" ".vscode/settings.json"

# Documentation
Write-Info "Documentation..."
Get-FileDownload "docs/mcp-integration.md" "docs/mcp-integration.md"
Get-FileDownload "docs/project-setup.md" "docs/project-setup.md"
Get-FileDownload "docs/troubleshooting.md" "docs/troubleshooting.md"
Get-FileDownload "docs/markdown-to-doc-conversion.md" "docs/markdown-to-doc-conversion.md"
Get-FileDownload "docs/NEW-FEATURES-v2.1.md" "docs/NEW-FEATURES-v2.1.md"
Get-FileDownload "docs/assets/agentx-logo.svg" "docs/assets/agentx-logo.svg"

# v3.0 Documentation
Write-Info "v3.0 feature documentation..."
Get-FileDownload "docs/analytics/METRICS.md" "docs/analytics/METRICS.md"
Get-FileDownload "docs/multi-repo.md" "docs/multi-repo.md"
Get-FileDownload "docs/cli-specification.md" "docs/cli-specification.md"
Get-FileDownload "docs/agent-memory.md" "docs/agent-memory.md"
Get-FileDownload "docs/visualization.md" "docs/visualization.md"
Get-FileDownload "docs/local-mode.md" "docs/local-mode.md"
Get-FileDownload "docs/template-input-variables.md" "docs/template-input-variables.md"
Get-FileDownload "docs/session-persistence.md" "docs/session-persistence.md"
Get-FileDownload "LICENSE" "LICENSE"

# Create output directories
Write-Info "Creating output directories..."
$dirs = @("docs/prd", "docs/adr", "docs/specs", "docs/ux", "docs/reviews", "docs/progress")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Created: $dir/"
    }
}

# Example documents (help users understand output formats)
Write-Info "Example documents..."
Get-FileDownload "docs/prd/PRD-EXAMPLE.md" "docs/prd/PRD-EXAMPLE.md"
Get-FileDownload "docs/adr/ADR-EXAMPLE.md" "docs/adr/ADR-EXAMPLE.md"
Get-FileDownload "docs/specs/SPEC-EXAMPLE.md" "docs/specs/SPEC-EXAMPLE.md"
Get-FileDownload "docs/reviews/REVIEW-EXAMPLE.md" "docs/reviews/REVIEW-EXAMPLE.md"
Get-FileDownload "docs/ux/UX-EXAMPLE.md" "docs/ux/UX-EXAMPLE.md"

# Initialize Local Mode if enabled
if ($useLocalMode) {
    Write-Info "Initializing Local Mode..."
    $agentxDir = ".agentx"
    if (-not (Test-Path $agentxDir)) {
        New-Item -ItemType Directory -Path $agentxDir -Force | Out-Null
        New-Item -ItemType Directory -Path "$agentxDir/issues" -Force | Out-Null
        Write-Success "Created: $agentxDir/"
    }
    
    # Create config file
    $config = @{
        mode = "local"
        nextIssueNumber = 1
        created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    }
    $configFile = "$agentxDir/config.json"
    $config | ConvertTo-Json -Depth 10 | Set-Content $configFile
    Write-Success "Local Mode configured"
    
    # Download issue manager scripts
    Get-FileDownload ".agentx/local-issue-manager.ps1" ".agentx/local-issue-manager.ps1"
    Get-FileDownload ".agentx/local-issue-manager.sh" ".agentx/local-issue-manager.sh"
    Write-Success "Local issue manager ready"
}

# Validation scripts
Write-Info "Validation scripts..."
Get-FileDownload ".github/scripts/validate-handoff.sh" ".github/scripts/validate-handoff.sh"
Get-FileDownload ".github/scripts/capture-context.sh" ".github/scripts/capture-context.sh"
Get-FileDownload ".github/scripts/capture-context.ps1" ".github/scripts/capture-context.ps1"
Get-FileDownload ".github/scripts/setup-hooks.sh" ".github/scripts/setup-hooks.sh"
Get-FileDownload ".github/scripts/setup-hooks.ps1" ".github/scripts/setup-hooks.ps1"
Get-FileDownload ".github/scripts/collect-metrics.ps1" ".github/scripts/collect-metrics.ps1"

# Utility scripts
Write-Info "Utility scripts..."
Get-FileDownload "scripts/convert-docs.ps1" "scripts/convert-docs.ps1"
Get-FileDownload "scripts/convert-docs.sh" "scripts/convert-docs.sh"

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

if ($useLocalMode) {
    Write-Host "🔧 LOCAL MODE ENABLED" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "AgentX is configured to work without GitHub." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Issue Management Commands:" -ForegroundColor Cyan
    Write-Host "  Create issue:  .\.agentx\local-issue-manager.ps1 -Action create -Title '[Type] Description' -Labels 'type:story'"
    Write-Host "  List issues:   .\.agentx\local-issue-manager.ps1 -Action list"
    Write-Host "  Update status: .\.agentx\local-issue-manager.ps1 -Action update -IssueNumber <N> -Status 'In Progress'"
    Write-Host "  Close issue:   .\.agentx\local-issue-manager.ps1 -Action close -IssueNumber <N>"
    Write-Host ""
    Write-Host "Aliases (add to your PowerShell profile):" -ForegroundColor Cyan
    Write-Host '  function issue { .\.agentx\local-issue-manager.ps1 @args }'
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Read AGENTS.md for workflow guidelines"
    Write-Host "  2. Read Skills.md for production code standards"
    Write-Host "  3. Create your first issue:"
    Write-Host '     .\.agentx\local-issue-manager.ps1 -Action create -Title "[Story] My first task" -Labels "type:story"'
    Write-Host ""
    Write-Host "  ⚠️  Local Mode Limitations:" -ForegroundColor Yellow
    Write-Host "  • No GitHub Actions workflows"
    Write-Host "  • No pull request reviews"
    Write-Host "  • Manual agent coordination"
    Write-Host "  • To enable GitHub features, run: git remote add origin <repo-url>"
    Write-Host ""
} else {
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
    Write-Host '     gh label create "type:spike" --color "FBCA04"'
    Write-Host '     gh label create "type:docs" --color "0075CA"'
    Write-Host '     gh label create "type:devops" --color "8B4789"'
    Write-Host ""
    Write-Host '     # Workflow labels' -ForegroundColor Yellow
    Write-Host '     gh label create "needs:ux" --color "D4C5F9"'
    Write-Host '     gh label create "needs:changes" --color "FBCA04"'
    Write-Host '     gh label create "needs:help" --color "D73A4A"'
    Write-Host ""
    Write-Host "  4. Set up GitHub Project with Status field (see docs/project-setup.md)"
    Write-Host ""
    Write-Host "  ⚠️  IMPORTANT: Git hooks are now active!" -ForegroundColor Yellow
    Write-Host "  Your commits will be validated for workflow compliance."
    Write-Host ""
}

