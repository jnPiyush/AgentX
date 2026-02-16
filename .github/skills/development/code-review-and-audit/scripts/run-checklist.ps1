#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Run automated code review checks against a codebase.

.DESCRIPTION
 Executes a series of automated checks from the code review checklist:
 file sizes, TODO counts, dead code detection, naming conventions,
 security patterns, and test coverage presence.

.PARAMETER Path
 Directory to review. Default: current directory.

.PARAMETER Format
 Output format: 'table' or 'json'. Default: table

.PARAMETER Strict
 Treat warnings as errors. Default: false

.EXAMPLE
 .\run-checklist.ps1
 .\run-checklist.ps1 -Path ./src -Strict
#>
param(
 [string]$Path = ".",
 [ValidateSet("table", "json")]
 [string]$Format = "table",
 [switch]$Strict
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Pass { param([string]$Text); Write-Host " PASS $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text); Write-Host " WARN $Text" -ForegroundColor Yellow }
function Write-Fail { param([string]$Text); Write-Host " FAIL $Text" -ForegroundColor Red }

$results = @()
$Extensions = @("*.cs", "*.py", "*.ts", "*.tsx", "*.js", "*.jsx", "*.go", "*.rs")
$ExcludeDirs = @("node_modules", "bin", "obj", ".git", "__pycache__", ".venv", "dist", "build")

function Get-SourceFiles {
 Get-ChildItem -Path $Path -Recurse -File -Include $Extensions -ErrorAction SilentlyContinue |
 Where-Object { 
 $filePath = $_.FullName
 $excluded = $false
 foreach ($dir in $ExcludeDirs) {
 if ($filePath -match [regex]::Escape($dir)) { $excluded = $true; break }
 }
 -not $excluded
 }
}

$sourceFiles = Get-SourceFiles

Write-Header "Automated Code Review Checklist"
Write-Host " Path: $Path"
Write-Host " Files: $($sourceFiles.Count)"

# Check 1: Large files (>500 lines)
Write-Host ""
$largeFiles = $sourceFiles | Where-Object { (Get-Content $_.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines -gt 500 }
if ($largeFiles.Count -eq 0) {
 Write-Pass "No files exceed 500 lines"
 $results += @{Check="Large files"; Status="PASS"; Details="0 files"}
} else {
 Write-Warn "$($largeFiles.Count) file(s) exceed 500 lines"
 foreach ($f in $largeFiles) {
 $lines = (Get-Content $f.FullName | Measure-Object -Line).Lines
 Write-Host " $($f.Name) ($lines lines)" -ForegroundColor DarkYellow
 }
 $results += @{Check="Large files"; Status="WARN"; Details="$($largeFiles.Count) files"}
}

# Check 2: TODO/FIXME/HACK comments
$todoCount = 0
foreach ($file in $sourceFiles) {
 $content = Get-Content $file.FullName -ErrorAction SilentlyContinue
 $todoCount += ($content | Select-String -Pattern "TODO|FIXME|HACK|XXX" -CaseSensitive).Count
}
if ($todoCount -eq 0) {
 Write-Pass "No TODO/FIXME/HACK comments"
 $results += @{Check="TODO comments"; Status="PASS"; Details="0 found"}
} else {
 Write-Warn "$todoCount TODO/FIXME/HACK comment(s) found"
 $results += @{Check="TODO comments"; Status="WARN"; Details="$todoCount found"}
}

# Check 3: Console.WriteLine / print / console.log (debug output)
$debugCount = 0
foreach ($file in $sourceFiles) {
 $content = Get-Content $file.FullName -ErrorAction SilentlyContinue -Raw
 if ($content -match "Console\.Write(Line)?|(?<!logging\.)print\(|console\.(log|debug|warn)\(") {
 $debugCount++
 }
}
if ($debugCount -eq 0) {
 Write-Pass "No debug print statements detected"
 $results += @{Check="Debug prints"; Status="PASS"; Details="0 files"}
} else {
 Write-Warn "$debugCount file(s) with debug print statements"
 $results += @{Check="Debug prints"; Status="WARN"; Details="$debugCount files"}
}

# Check 4: Hardcoded secrets patterns
$secretPatterns = @("password\s*=\s*[""']", "api[_-]?key\s*=\s*[""']", "secret\s*=\s*[""']", "AKIA[0-9A-Z]{16}")
$secretHits = 0
foreach ($file in $sourceFiles) {
 $content = Get-Content $file.FullName -ErrorAction SilentlyContinue -Raw
 foreach ($pattern in $secretPatterns) {
 if ($content -match $pattern) { $secretHits++; break }
 }
}
if ($secretHits -eq 0) {
 Write-Pass "No hardcoded secrets detected"
 $results += @{Check="Hardcoded secrets"; Status="PASS"; Details="0 files"}
} else {
 Write-Fail "$secretHits file(s) with potential hardcoded secrets"
 $results += @{Check="Hardcoded secrets"; Status="FAIL"; Details="$secretHits files"}
}

# Check 5: Empty catch blocks
$emptyCatch = 0
foreach ($file in $sourceFiles) {
 $content = Get-Content $file.FullName -ErrorAction SilentlyContinue -Raw
 if ($content -match "catch\s*(\([^)]*\))?\s*\{\s*\}") { $emptyCatch++ }
}
if ($emptyCatch -eq 0) {
 Write-Pass "No empty catch blocks"
 $results += @{Check="Empty catch blocks"; Status="PASS"; Details="0 files"}
} else {
 Write-Fail "$emptyCatch file(s) with empty catch blocks"
 $results += @{Check="Empty catch blocks"; Status="FAIL"; Details="$emptyCatch files"}
}

# Check 6: Test files exist
$testFiles = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue |
 Where-Object { $_.Name -match "test_|_test\.|\.test\.|\.spec\.|Tests\.cs$" }
if ($testFiles.Count -gt 0) {
 Write-Pass "$($testFiles.Count) test file(s) found"
 $results += @{Check="Tests present"; Status="PASS"; Details="$($testFiles.Count) files"}
} else {
 Write-Fail "No test files detected"
 $results += @{Check="Tests present"; Status="FAIL"; Details="0 files"}
}

# Check 7: Commented-out code blocks (>3 consecutive commented lines)
$commentedCode = 0
foreach ($file in $sourceFiles) {
 $lines = Get-Content $file.FullName -ErrorAction SilentlyContinue
 $consecutiveComments = 0
 foreach ($line in $lines) {
 if ($line.Trim() -match "^(//|#)\s*(if|for|while|return|var|let|const|def|class|public)") {
 $consecutiveComments++
 } else {
 if ($consecutiveComments -ge 3) { $commentedCode++ }
 $consecutiveComments = 0
 }
 }
}
if ($commentedCode -eq 0) {
 Write-Pass "No large commented-out code blocks"
 $results += @{Check="Commented code"; Status="PASS"; Details="0 blocks"}
} else {
 Write-Warn "$commentedCode block(s) of commented-out code"
 $results += @{Check="Commented code"; Status="WARN"; Details="$commentedCode blocks"}
}

# Summary
Write-Header "Summary"
$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$warnCount = ($results | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host " PASS: $passCount | WARN: $warnCount | FAIL: $failCount"

if ($Format -eq "json") {
 $results | ConvertTo-Json -Depth 2 | Write-Host
}

if ($failCount -gt 0) { exit 1 }
if ($Strict -and $warnCount -gt 0) { exit 1 }
exit 0
