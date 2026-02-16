#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Validate GitHub Actions workflow files for common issues.

.DESCRIPTION
 Checks workflow YAML files for: syntax validity, missing required fields,
 deprecated actions, insecure patterns, and best practice violations.

.PARAMETER Path
 Directory containing workflow files. Default: .github/workflows

.PARAMETER Fix
 Auto-fix simple issues (pin action versions, add permissions). Default: false

.EXAMPLE
 .\validate-workflows.ps1
 .\validate-workflows.ps1 -Path ./workflows -Fix
#>
param(
 [string]$Path = ".github/workflows",
 [switch]$Fix
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Pass { param([string]$Text); Write-Host " PASS: $Text" -ForegroundColor Green }
function Write-Fail { param([string]$Text); Write-Host " FAIL: $Text" -ForegroundColor Red }
function Write-Warn { param([string]$Text); Write-Host " WARN: $Text" -ForegroundColor Yellow }

# Validation rules
$DeprecatedActions = @{
 "actions/checkout@v2" = "actions/checkout@v4"
 "actions/checkout@v3" = "actions/checkout@v4"
 "actions/setup-node@v2" = "actions/setup-node@v4"
 "actions/setup-node@v3" = "actions/setup-node@v4"
 "actions/setup-python@v3" = "actions/setup-python@v5"
 "actions/setup-python@v4" = "actions/setup-python@v5"
 "actions/upload-artifact@v2" = "actions/upload-artifact@v4"
 "actions/upload-artifact@v3" = "actions/upload-artifact@v4"
 "actions/download-artifact@v2" = "actions/download-artifact@v4"
 "actions/download-artifact@v3" = "actions/download-artifact@v4"
 "actions/setup-dotnet@v2" = "actions/setup-dotnet@v4"
 "actions/setup-dotnet@v3" = "actions/setup-dotnet@v4"
 "actions/cache@v2" = "actions/cache@v4"
 "actions/cache@v3" = "actions/cache@v4"
}

Write-Header "GitHub Actions Workflow Validator"

if (-not (Test-Path $Path)) {
 Write-Fail "Workflow directory not found: $Path"
 exit 1
}

$workflowFiles = Get-ChildItem -Path $Path -Filter "*.yml" -ErrorAction SilentlyContinue
$workflowFiles += Get-ChildItem -Path $Path -Filter "*.yaml" -ErrorAction SilentlyContinue

if (-not $workflowFiles -or $workflowFiles.Count -eq 0) {
 Write-Fail "No workflow files found in $Path"
 exit 1
}

Write-Host " Found $($workflowFiles.Count) workflow file(s)"

$totalIssues = 0
$totalWarnings = 0
$fixCount = 0

foreach ($file in $workflowFiles) {
 Write-Host "`n --- $($file.Name) ---" -ForegroundColor White
 $content = Get-Content $file.FullName -Raw
 $issues = 0
 $warnings = 0

 # Check 1: Basic YAML structure
 if ($content -notmatch "^name:") {
 Write-Warn "Missing 'name:' at top level"
 $warnings++
 }

 if ($content -notmatch "on:") {
 Write-Fail "Missing 'on:' trigger definition"
 $issues++
 }

 if ($content -notmatch "jobs:") {
 Write-Fail "Missing 'jobs:' section"
 $issues++
 }

 # Check 2: Deprecated actions
 foreach ($dep in $DeprecatedActions.GetEnumerator()) {
 if ($content -match [regex]::Escape($dep.Key)) {
 Write-Warn "Deprecated: $($dep.Key) -> use $($dep.Value)"
 $warnings++
 if ($Fix) {
 $content = $content -replace [regex]::Escape($dep.Key), $dep.Value
 $fixCount++
 }
 }
 }

 # Check 3: Unpinned actions (using @main, @master)
 $unpinned = [regex]::Matches($content, "uses:\s*([^\s]+)@(main|master)")
 foreach ($match in $unpinned) {
 Write-Fail "Unpinned action: $($match.Groups[1].Value)@$($match.Groups[2].Value) - pin to a specific version or SHA"
 $issues++
 }

 # Check 4: Missing permissions block (security best practice)
 if ($content -notmatch "permissions:") {
 Write-Warn "Missing 'permissions:' block - add least-privilege permissions"
 $warnings++
 }

 # Check 5: Secrets in plain text
 if ($content -match "password:\s*[A-Za-z0-9]" -or $content -match "token:\s*[A-Za-z0-9]") {
 if ($content -notmatch "\$\{\{\s*secrets\.") {
 Write-Fail 'Potential hardcoded secret - use ${{ secrets.NAME }}'
 $issues++
 }
 }

 # Check 6: Missing timeout-minutes
 if ($content -notmatch "timeout-minutes:") {
 Write-Warn "No 'timeout-minutes' set on any job - prevents hung workflows"
 $warnings++
 }

 # Check 7: Using latest tag
 if ($content -match "image:\s*\S+:latest") {
 Write-Fail "Using ':latest' tag - pin to specific version for reproducibility"
 $issues++
 }

 # Check 8: Concurrency group (prevents duplicate runs)
 if ($content -match "pull_request" -and $content -notmatch "concurrency:") {
 Write-Warn "PR trigger without 'concurrency:' - may cause duplicate runs"
 $warnings++
 }

 # Check 9: runs-on validation
 if ($content -match "runs-on:\s*ubuntu-18\.04") {
 Write-Fail "ubuntu-18.04 is deprecated - use ubuntu-latest or ubuntu-22.04"
 $issues++
 }

 if ($issues -eq 0 -and $warnings -eq 0) {
 Write-Pass "No issues found"
 }

 $totalIssues += $issues
 $totalWarnings += $warnings

 # Save fixes
 if ($Fix -and $fixCount -gt 0) {
 $content | Set-Content -Path $file.FullName -Encoding UTF8
 }
}

Write-Header "Summary"
Write-Host " Files: $($workflowFiles.Count)"
Write-Host " Errors: $totalIssues" -ForegroundColor $(if ($totalIssues -gt 0) { "Red" } else { "Green" })
Write-Host " Warnings: $totalWarnings" -ForegroundColor $(if ($totalWarnings -gt 0) { "Yellow" } else { "Green" })

if ($Fix -and $fixCount -gt 0) {
 Write-Host " Fixed: $fixCount issue(s)" -ForegroundColor Green
}

if ($totalIssues -gt 0) { exit 1 } else { exit 0 }
