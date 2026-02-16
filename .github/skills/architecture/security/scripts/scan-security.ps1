#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Scans codebase for common security vulnerabilities.
.DESCRIPTION
 Checks for hardcoded secrets, SQL injection patterns, missing input validation,
 and insecure configurations. Returns non-zero exit code if issues found.
.PARAMETER Path
 Path to scan (default: current directory)
.PARAMETER ExcludePatterns
 Directories to exclude (default: node_modules, .git, bin, obj, dist, __pycache__)
.EXAMPLE
 ./scan-security.ps1
 ./scan-security.ps1 -Path ./src
#>
param(
 [string]$Path = ".",
 [string[]]$ExcludePatterns = @("node_modules", ".git", "bin", "obj", "dist", "__pycache__", ".venv", "venv")
)

$ErrorActionPreference = "Stop"
$issueCount = 0

function Add-Issue($severity, $file, $line, $message) {
 $script:issueCount++
 $color = switch ($severity) {
 "HIGH" { "Red" }
 "MEDIUM" { "Yellow" }
 "LOW" { "Cyan" }
 }
 Write-Host " [$severity] $file`:$line - $message" -ForegroundColor $color
}

Write-Host "`n=== Security Scan ===" -ForegroundColor Cyan

# Build exclude regex
$excludeRegex = ($ExcludePatterns | ForEach-Object { [regex]::Escape($_) }) -join "|"

# Get source files
$extensions = @("*.cs", "*.py", "*.ts", "*.tsx", "*.js", "*.jsx", "*.go", "*.rs", "*.java", "*.yaml", "*.yml", "*.json", "*.env", "*.config")
$files = @()
foreach ($ext in $extensions) {
 $files += Get-ChildItem -Path $Path -Filter $ext -Recurse -ErrorAction SilentlyContinue | Where-Object {
 $_.FullName -notmatch $excludeRegex
 }
}

Write-Host " Scanning $($files.Count) files..." -ForegroundColor Gray

# --- Check 1: Hardcoded Secrets ---
Write-Host "`n [1/5] Checking for hardcoded secrets..." -ForegroundColor White
$secretPatterns = @(
 @{ Pattern = '(?i)(password|passwd|pwd)\s*[:=]\s*["\x27][^"\x27]{4,}["\x27]'; Msg = "Possible hardcoded password" },
 @{ Pattern = '(?i)(api[_-]?key|apikey)\s*[:=]\s*["\x27][a-zA-Z0-9]{16,}["\x27]'; Msg = "Possible hardcoded API key" },
 @{ Pattern = '(?i)(secret|token)\s*[:=]\s*["\x27][a-zA-Z0-9+/=]{16,}["\x27]'; Msg = "Possible hardcoded secret/token" },
 @{ Pattern = '(?i)connectionstring\s*[:=]\s*["\x27].*(Password|Pwd)='; Msg = "Connection string with embedded password" },
 @{ Pattern = 'sk_live_[a-zA-Z0-9]{20,}'; Msg = "Stripe live secret key" },
 @{ Pattern = 'ghp_[a-zA-Z0-9]{36}'; Msg = "GitHub personal access token" },
 @{ Pattern = 'AKIA[A-Z0-9]{16}'; Msg = "AWS access key ID" }
)

foreach ($file in $files) {
 if ($file.Name -match '\.(test|spec|Test|Tests)\.' -or $file.Name -eq "scan-security.ps1") { continue }
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 $lines = $content -split "`n"
 $lineNum = 0
 foreach ($line in $lines) {
 $lineNum++
 foreach ($sp in $secretPatterns) {
 if ($line -match $sp.Pattern) {
 Add-Issue "HIGH" $file.Name $lineNum $sp.Msg
 }
 }
 }
}

# --- Check 2: SQL Injection ---
Write-Host "`n [2/5] Checking for SQL injection patterns..." -ForegroundColor White
$sqlPatterns = @(
 @{ Pattern = '(?i)(SELECT|INSERT|UPDATE|DELETE|DROP).*\+\s*(user|request|param|input|args|query)'; Msg = "String concatenation in SQL query" },
 @{ Pattern = '(?i)string\.Format\s*\(\s*"(SELECT|INSERT|UPDATE|DELETE)'; Msg = "String.Format in SQL query (.NET)" },
 @{ Pattern = '(?i)f"(SELECT|INSERT|UPDATE|DELETE).*\{'; Msg = "f-string in SQL query (Python)" },
 @{ Pattern = '(?i)`(SELECT|INSERT|UPDATE|DELETE).*\$\{'; Msg = "Template literal in SQL query (JS)" }
)

foreach ($file in $files) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 $lines = $content -split "`n"
 $lineNum = 0
 foreach ($line in $lines) {
 $lineNum++
 foreach ($sp in $sqlPatterns) {
 if ($line -match $sp.Pattern) {
 Add-Issue "HIGH" $file.Name $lineNum $sp.Msg
 }
 }
 }
}

# --- Check 3: Insecure HTTP ---
Write-Host "`n [3/5] Checking for insecure HTTP usage..." -ForegroundColor White
foreach ($file in $files) {
 if ($file.Name -match '\.(json|config)$') { continue }
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 $lines = $content -split "`n"
 $lineNum = 0
 foreach ($line in $lines) {
 $lineNum++
 if ($line -match 'http://' -and $line -notmatch 'localhost' -and $line -notmatch '127\.0\.0\.1' -and $line -notmatch '//\s*http://' -and $line -notmatch '#') {
 Add-Issue "MEDIUM" $file.Name $lineNum "Non-HTTPS URL detected"
 }
 }
}

# --- Check 4: Missing Security Headers ---
Write-Host "`n [4/5] Checking for .env files in repo..." -ForegroundColor White
$envFiles = Get-ChildItem -Path $Path -Filter ".env" -Recurse -ErrorAction SilentlyContinue | Where-Object {
 $_.FullName -notmatch $excludeRegex -and $_.Name -ne ".env.example" -and $_.Name -ne ".env.template"
}
foreach ($envFile in $envFiles) {
 Add-Issue "HIGH" $envFile.Name 0 ".env file should not be committed to repository"
}

# --- Check 5: Dangerous Functions ---
Write-Host "`n [5/5] Checking for dangerous function usage..." -ForegroundColor White
$dangerousPatterns = @(
 @{ Pattern = '(?i)\beval\s*\('; Msg = "eval() usage - code injection risk" },
 @{ Pattern = '(?i)innerHTML\s*='; Msg = "innerHTML assignment - XSS risk" },
 @{ Pattern = '(?i)dangerouslySetInnerHTML'; Msg = "dangerouslySetInnerHTML - XSS risk" },
 @{ Pattern = '(?i)subprocess\.call\s*\(\s*["\x27]'; Msg = "subprocess with shell string - command injection risk" },
 @{ Pattern = '(?i)os\.system\s*\('; Msg = "os.system() - command injection risk" }
)

foreach ($file in $files) {
 $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
 if (-not $content) { continue }
 $lines = $content -split "`n"
 $lineNum = 0
 foreach ($line in $lines) {
 $lineNum++
 foreach ($sp in $dangerousPatterns) {
 if ($line -match $sp.Pattern) {
 Add-Issue "MEDIUM" $file.Name $lineNum $sp.Msg
 }
 }
 }
}

# --- Summary ---
Write-Host "`n=== Scan Complete ===" -ForegroundColor Cyan
if ($issueCount -eq 0) {
 Write-Host " No security issues found." -ForegroundColor Green
} else {
 Write-Host " $issueCount issue(s) found." -ForegroundColor Red
}
Write-Host ""
exit $(if ($issueCount -gt 0) { 1 } else { 0 })
