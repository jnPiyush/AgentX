# Setup Git hooks for AgentX workflow enforcement
# Run this script from the repository root after cloning
# Usage: .\.github\scripts\setup-hooks.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "-------------------------------------------------------" -ForegroundColor Cyan
Write-Host " AgentX Git Hooks Setup" -ForegroundColor Cyan
Write-Host "-------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
 Write-Host "[FAIL] Error: Not a git repository" -ForegroundColor Red
 Write-Host " Please run this script from the root of your git repository."
 exit 1
}

# Check if hook source files exist
$hooksDir = ".github\hooks"
if (-not (Test-Path $hooksDir)) {
 Write-Host "[FAIL] Error: Hooks directory not found" -ForegroundColor Red
 Write-Host " Expected: $hooksDir"
 Write-Host " Did you run the AgentX installer first?"
 exit 1
}

# Create .git/hooks directory if it doesn't exist
$gitHooksDir = ".git\hooks"
if (-not (Test-Path $gitHooksDir)) {
 New-Item -ItemType Directory -Path $gitHooksDir -Force | Out-Null
}

Write-Host "Installing Git hooks..." -ForegroundColor Cyan
Write-Host ""

# Install pre-commit hook (bash version)
$preCommitSrc = Join-Path $hooksDir "pre-commit"
$preCommitDst = Join-Path $gitHooksDir "pre-commit"
if (Test-Path $preCommitSrc) {
 Copy-Item $preCommitSrc $preCommitDst -Force
 Write-Host "[PASS] Installed: pre-commit hook" -ForegroundColor Green
} else {
 Write-Host "[WARN] Skipped: pre-commit hook (source not found)" -ForegroundColor Yellow
}

# Install pre-commit hook (PowerShell version for Windows)
$preCommitPs1Src = Join-Path $hooksDir "pre-commit.ps1"
$preCommitPs1Dst = Join-Path $gitHooksDir "pre-commit.ps1"
if (Test-Path $preCommitPs1Src) {
 Copy-Item $preCommitPs1Src $preCommitPs1Dst -Force
 Write-Host "[PASS] Installed: pre-commit.ps1 hook" -ForegroundColor Green
} else {
 Write-Host "[WARN] Skipped: pre-commit.ps1 hook (source not found)" -ForegroundColor Yellow
}

# Install commit-msg hook
$commitMsgSrc = Join-Path $hooksDir "commit-msg"
$commitMsgDst = Join-Path $gitHooksDir "commit-msg"
if (Test-Path $commitMsgSrc) {
 Copy-Item $commitMsgSrc $commitMsgDst -Force
 Write-Host "[PASS] Installed: commit-msg hook" -ForegroundColor Green
} else {
 Write-Host "[WARN] Skipped: commit-msg hook (source not found)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "-------------------------------------------------------" -ForegroundColor Green
Write-Host " Git hooks installed successfully!" -ForegroundColor Green
Write-Host "-------------------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Hooks enforce AgentX workflow compliance:"
Write-Host " - Issue number required in commit messages"
Write-Host " - No secrets in code"
Write-Host " - No destructive commands"
Write-Host " - Code formatting (if tools available)"
Write-Host ""
Write-Host "To bypass in emergencies, use: git commit -m 'message [skip-issue]'"
Write-Host ""
