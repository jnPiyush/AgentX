#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Set up Git hooks for code quality enforcement.

.DESCRIPTION
 Installs Git hooks (pre-commit, commit-msg) that enforce:
 - Conventional commit message format
 - No secrets in staged files
 - Linting before commit
 Supports both native Git hooks and Husky/pre-commit framework.

.PARAMETER Mode
 Hook mode: 'native' (git hooks), 'husky' (Node.js), 'precommit' (Python). Default: native

.PARAMETER Path
 Repository root. Default: current directory.

.EXAMPLE
 .\setup-hooks.ps1
 .\setup-hooks.ps1 -Mode husky
#>
param(
 [ValidateSet("native", "husky", "precommit")]
 [string]$Mode = "native",
 [string]$Path = "."
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Info { param([string]$Text); Write-Host " INFO: $Text" -ForegroundColor Yellow }

function Get-PreCommitHook {
 @'
#!/bin/sh
# Pre-commit hook: lint staged files and check for secrets

echo "Running pre-commit checks..."

# Check for secrets in staged files
SECRETS_FOUND=0
for FILE in $(git diff --cached --name-only --diff-filter=ACM); do
 if grep -qE "(AKIA[0-9A-Z]{16}|-----BEGIN.*PRIVATE KEY-----|password\s*=\s*['\"][^'\"]+['\"])" "$FILE" 2>/dev/null; then
 echo " BLOCKED: Potential secret in $FILE"
 SECRETS_FOUND=1
 fi
done

if [ $SECRETS_FOUND -ne 0 ]; then
 echo " ERROR: Remove secrets before committing"
 exit 1
fi

# Run linter if available
if command -v ruff &> /dev/null; then
 echo " Running ruff..."
 ruff check --fix $(git diff --cached --name-only --diff-filter=ACM -- '*.py')
elif command -v npx &> /dev/null && [ -f "package.json" ]; then
 echo " Running eslint..."
 npx eslint $(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' '*.js' '*.jsx') --fix
fi

echo " Pre-commit checks passed"
'@
}

function Get-CommitMsgHook {
 @'
#!/bin/sh
# Commit-msg hook: enforce conventional commit format
# Format: type(scope): description (#issue)
# Types: feat, fix, docs, test, refactor, perf, chore, ci, build, style

MSG=$(cat "$1")
PATTERN="^(feat|fix|docs|test|refactor|perf|chore|ci|build|style)(\(.+\))?!?: .{3,}"

if ! echo "$MSG" | grep -qE "$PATTERN"; then
 echo ""
 echo " ERROR: Commit message does not follow conventional format"
 echo ""
 echo " Expected: type(scope): description"
 echo " Types: feat, fix, docs, test, refactor, perf, chore, ci, build, style"
 echo ""
 echo " Examples:"
 echo " feat(auth): add password reset (#123)"
 echo " fix: resolve null reference in user service"
 echo " docs: update API documentation"
 echo ""
 exit 1
fi
'@
}

Write-Header "Git Hook Setup ($Mode)"

if ($Mode -eq "native") {
 $hooksDir = Join-Path $Path ".git" "hooks"
 if (-not (Test-Path $hooksDir)) {
 Write-Host " ERROR: Not a git repository (no .git/hooks found)" -ForegroundColor Red
 exit 1
 }

 # Pre-commit hook
 $preCommitPath = Join-Path $hooksDir "pre-commit"
 (Get-PreCommitHook) | Set-Content -Path $preCommitPath -Encoding UTF8 -NoNewline
 if ($IsLinux -or $IsMacOS) { chmod +x $preCommitPath }
 Write-Host " Installed: pre-commit hook" -ForegroundColor Green

 # Commit-msg hook
 $commitMsgPath = Join-Path $hooksDir "commit-msg"
 (Get-CommitMsgHook) | Set-Content -Path $commitMsgPath -Encoding UTF8 -NoNewline
 if ($IsLinux -or $IsMacOS) { chmod +x $commitMsgPath }
 Write-Host " Installed: commit-msg hook" -ForegroundColor Green

} elseif ($Mode -eq "husky") {
 Push-Location $Path
 try {
 Write-Info "Installing Husky..."
 & npm install husky --save-dev 2>&1 | Out-Null
 & npx husky init 2>&1 | Out-Null
 
 (Get-PreCommitHook) | Set-Content -Path ".husky/pre-commit" -Encoding UTF8
 (Get-CommitMsgHook) | Set-Content -Path ".husky/commit-msg" -Encoding UTF8
 Write-Host " Installed: Husky hooks" -ForegroundColor Green
 } finally { Pop-Location }

} elseif ($Mode -eq "precommit") {
 $precommitConfig = @"
repos:
 - repo: https://github.com/pre-commit/pre-commit-hooks
 rev: v5.0.0
 hooks:
 - id: check-yaml
 - id: end-of-file-fixer
 - id: trailing-whitespace
 - id: check-added-large-files
 - id: detect-private-key

 - repo: https://github.com/astral-sh/ruff-pre-commit
 rev: v0.8.0
 hooks:
 - id: ruff
 args: [--fix]
 - id: ruff-format

 - repo: https://github.com/compilerla/conventional-pre-commit
 rev: v3.6.0
 hooks:
 - id: conventional-pre-commit
 stages: [commit-msg]
"@
 $precommitConfig | Set-Content -Path (Join-Path $Path ".pre-commit-config.yaml") -Encoding UTF8
 Write-Host " Created: .pre-commit-config.yaml" -ForegroundColor Green
 Write-Info "Run: pre-commit install"
}

Write-Host "`n Hooks enforce:" -ForegroundColor Cyan
Write-Host " - Conventional commit messages"
Write-Host " - No secrets in staged files"
Write-Host " - Linting before commit"
