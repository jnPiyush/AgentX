#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX in your project (PowerShell version)

.DESCRIPTION
    Downloads and installs AgentX - AI Agent Guidelines for Production Code
    into your current project directory.

.PARAMETER Full
    Install all optional files (agents, instructions, prompts)

.PARAMETER Force
    Overwrite existing files

.EXAMPLE
    .\install.ps1
    
.EXAMPLE
    .\install.ps1 -Full
    
.EXAMPLE
    irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param(
    [switch]$Full,
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
    @{ Src = "templates/.github/copilot-instructions.md"; Dest = ".github/copilot-instructions.md" },
    @{ Src = "templates/.github/autonomous-mode.yml"; Dest = ".github/autonomous-mode.yml" },
    @{ Src = "templates/.github/workflows/enforce-issue-workflow.yml"; Dest = ".github/workflows/enforce-issue-workflow.yml" },
    @{ Src = "templates/.vscode/settings.json"; Dest = ".vscode/settings.json" }
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
    @{ Src = "templates/.github/agents/architect.agent.md"; Dest = ".github/agents/architect.agent.md" },
    @{ Src = "templates/.github/agents/engineer.agent.md"; Dest = ".github/agents/engineer.agent.md" },
    @{ Src = "templates/.github/agents/reviewer.agent.md"; Dest = ".github/agents/reviewer.agent.md" },
    @{ Src = "templates/.github/agents/ux-designer.agent.md"; Dest = ".github/agents/ux-designer.agent.md" },
    @{ Src = "templates/.github/instructions/csharp.instructions.md"; Dest = ".github/instructions/csharp.instructions.md" },
    @{ Src = "templates/.github/instructions/python.instructions.md"; Dest = ".github/instructions/python.instructions.md" },
    @{ Src = "templates/.github/instructions/react.instructions.md"; Dest = ".github/instructions/react.instructions.md" },
    @{ Src = "templates/.github/instructions/api.instructions.md"; Dest = ".github/instructions/api.instructions.md" },
    @{ Src = "templates/.github/prompts/code-review.prompt.md"; Dest = ".github/prompts/code-review.prompt.md" },
    @{ Src = "templates/.github/prompts/refactor.prompt.md"; Dest = ".github/prompts/refactor.prompt.md" },
    @{ Src = "templates/.github/prompts/test-gen.prompt.md"; Dest = ".github/prompts/test-gen.prompt.md" }
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

# Download optional files if --Full
if ($Full) {
    Write-Info "Downloading optional files (--Full mode)..."
    foreach ($file in $optionalFiles) {
        Download-File $file.Src $file.Dest
    }
}

# VS Code Extension Installation
Write-Host ""
$vsCodeInstalled = $null -ne (Get-Command code -ErrorAction SilentlyContinue)

if ($vsCodeInstalled) {
    Write-Info "VS Code detected! Installing AgentX Workflow Enforcer extension..."
    
    # Download extension files
    $extensionDir = Join-Path $TARGET_DIR "vscode-extension"
    $extensionFiles = @(
        @{ Src = "vscode-extension/package.json"; Dest = "vscode-extension/package.json" },
        @{ Src = "vscode-extension/tsconfig.json"; Dest = "vscode-extension/tsconfig.json" },
        @{ Src = "vscode-extension/src/extension.ts"; Dest = "vscode-extension/src/extension.ts" },
        @{ Src = "vscode-extension/README.md"; Dest = "vscode-extension/README.md" }
    )
    
    foreach ($file in $extensionFiles) {
        Download-File $file.Src $file.Dest
    }
    
    # Check if Node.js is available
    $nodeInstalled = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
    $npmInstalled = $null -ne (Get-Command npm -ErrorAction SilentlyContinue)
    
    if ($nodeInstalled -and $npmInstalled) {
        Write-Info "Node.js detected. Building extension..."
        
        Push-Location $extensionDir
        try {
            # Install dependencies
            Write-Info "Installing dependencies..."
            npm install --silent 2>$null
            
            # Compile TypeScript
            Write-Info "Compiling extension..."
            npm run compile 2>$null
            
            # Check if vsce is available, install if not
            $vsceInstalled = $null -ne (Get-Command vsce -ErrorAction SilentlyContinue)
            if (-not $vsceInstalled) {
                Write-Info "Installing vsce..."
                npm install -g @vscode/vsce --silent 2>$null
            }
            
            # Package the extension
            Write-Info "Packaging extension..."
            vsce package --allow-missing-repository 2>$null
            
            # Find the vsix file
            $vsixFile = Get-ChildItem -Filter "*.vsix" | Select-Object -First 1
            
            if ($vsixFile) {
                Write-Info "Installing extension in VS Code..."
                code --install-extension $vsixFile.FullName 2>$null
                Write-Success "VS Code extension installed!"
            } else {
                Write-Warn "Could not package extension. Install manually from vscode-extension/"
            }
        }
        catch {
            Write-Warn "Extension build failed. Install manually:"
            Write-Host "   cd vscode-extension && npm install && npm run compile && npx vsce package" -ForegroundColor Yellow
        }
        finally {
            Pop-Location
        }
    } else {
        Write-Warn "Node.js not found. To install the extension manually:"
        Write-Host "   cd vscode-extension" -ForegroundColor Yellow
        Write-Host "   npm install && npm run compile && npx vsce package" -ForegroundColor Yellow
        Write-Host "   code --install-extension agentx-workflow-enforcer-1.0.0.vsix" -ForegroundColor Yellow
    }
} else {
    Write-Info "VS Code not detected. Extension files available in vscode-extension/"
    Write-Info "To install later: cd vscode-extension && npm install && npm run compile && npx vsce package"
}

Write-Host ""
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review and customize " -NoNewline
Write-Host ".github/autonomous-mode.yml" -ForegroundColor Cyan
Write-Host "2. Add your GitHub username to the allowed_actors list"
Write-Host "3. Create GitHub labels by running:"
Write-Host ""
Write-Host '   gh label create "type:task" --description "Atomic unit of work" --color "0E8A16"' -ForegroundColor Yellow
Write-Host '   gh label create "type:feature" --description "User-facing capability" --color "A2EEEF"' -ForegroundColor Yellow
Write-Host '   gh label create "status:ready" --description "No blockers, can start" --color "C2E0C6"' -ForegroundColor Yellow
Write-Host '   gh label create "status:in-progress" --description "Currently working" --color "FBCA04"' -ForegroundColor Yellow
Write-Host '   gh label create "status:done" --description "Completed" --color "0E8A16"' -ForegroundColor Yellow
Write-Host '   gh label create "priority:p1" --description "High - do next" --color "D93F0B"' -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Read " -NoNewline
Write-Host "AGENTS.md" -ForegroundColor Cyan -NoNewline
Write-Host " for workflow guidelines"
Write-Host "5. Check " -NoNewline
Write-Host "Skills.md" -ForegroundColor Cyan -NoNewline
Write-Host " for production standards"
Write-Host ""
Write-Success "AgentX installed successfully! 🚀"
Write-Host ""

