#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX git hooks in your project

.EXAMPLE
    .\install.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "AgentX - AI Agent Guidelines for Production Code" -ForegroundColor Cyan
Write-Host ""

# Check for git
if (-not (Test-Path ".git")) {
    Write-Host "Error: Not a git repository. Run 'git init' first." -ForegroundColor Red
    exit 1
}

# Install git hooks
Write-Host "Installing git hooks..." -ForegroundColor Yellow

$hooksDir = ".git/hooks"
$sourceHooksDir = ".github/hooks"

if (Test-Path $sourceHooksDir) {
    $hooks = @("pre-commit", "commit-msg")
    foreach ($hook in $hooks) {
        $source = Join-Path $sourceHooksDir $hook
        $dest = Join-Path $hooksDir $hook
        
        if (Test-Path $source) {
            Copy-Item $source $dest -Force
            Write-Host "  Installed $hook hook" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Read AGENTS.md for workflow guidelines"
Write-Host "  2. Read Skills.md for production code standards"
Write-Host "  3. Create GitHub labels (see README.md)"
Write-Host ""

