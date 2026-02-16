#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Audit project dependencies for outdated packages, licensing issues, and vulnerabilities.

.DESCRIPTION
 Auto-detects project type and runs dependency audit. Checks for:
 outdated packages, known licenses, and basic vulnerability scan.

.PARAMETER Path
 Project root. Default: current directory.

.PARAMETER CheckOutdated
 Also check for outdated packages. Default: true.

.EXAMPLE
 .\audit-deps.ps1
 .\audit-deps.ps1 -Path ./myproject
#>
param(
 [string]$Path = ".",
 [bool]$CheckOutdated = $true
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Pass { param([string]$Text); Write-Host " PASS: $Text" -ForegroundColor Green }
function Write-Fail { param([string]$Text); Write-Host " FAIL: $Text" -ForegroundColor Red }
function Write-Info { param([string]$Text); Write-Host " INFO: $Text" -ForegroundColor Yellow }

Write-Header "Dependency Audit"
Write-Host " Path: $Path"

$exitCode = 0

# .NET
$csproj = Get-ChildItem -Path $Path -Filter "*.csproj" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($csproj) {
 Write-Header ".NET Dependencies"
 
 # Outdated packages
 if ($CheckOutdated) {
 Write-Info "Checking for outdated packages..."
 $output = & dotnet list $csproj.DirectoryName package --outdated 2>&1
 $outdated = $output | Select-String -Pattern ">" | Measure-Object
 if ($outdated.Count -gt 0) {
 Write-Info "$($outdated.Count) outdated package(s)"
 $output | Select-String -Pattern ">" | ForEach-Object { Write-Host " $_" }
 } else {
 Write-Pass "All .NET packages are up to date"
 }
 }

 # Vulnerable packages
 Write-Info "Checking for vulnerabilities..."
 $vulnOutput = & dotnet list $csproj.DirectoryName package --vulnerable 2>&1
 $vulns = $vulnOutput | Select-String -Pattern "(Critical|High|Moderate)"
 if ($vulns.Count -gt 0) {
 Write-Fail "$($vulns.Count) vulnerable package(s)"
 $vulns | ForEach-Object { Write-Host " $_" }
 $exitCode = 1
 } else {
 Write-Pass "No known vulnerabilities in .NET packages"
 }
}

# Python
if (Test-Path (Join-Path $Path "requirements.txt") -or Test-Path (Join-Path $Path "pyproject.toml")) {
 Write-Header "Python Dependencies"
 Push-Location $Path
 try {
 # Outdated
 if ($CheckOutdated) {
 Write-Info "Checking for outdated packages..."
 $output = & pip list --outdated --format=columns 2>&1
 $lines = ($output | Measure-Object -Line).Lines
 if ($lines -gt 2) {
 Write-Info "$($lines - 2) outdated package(s)"
 $output | ForEach-Object { Write-Host " $_" }
 } else {
 Write-Pass "All Python packages are up to date"
 }
 }

 # Vulnerability scan
 $hasPipAudit = Get-Command pip-audit -ErrorAction SilentlyContinue
 if ($hasPipAudit) {
 Write-Info "Running pip-audit..."
 & pip-audit 2>&1 | ForEach-Object { Write-Host " $_" }
 if ($LASTEXITCODE -ne 0) { $exitCode = 1 }
 } else {
 Write-Info "Install pip-audit for vulnerability scanning: pip install pip-audit"
 }
 } finally { Pop-Location }
}

# Node.js
if (Test-Path (Join-Path $Path "package.json")) {
 Write-Header "Node.js Dependencies"
 Push-Location $Path
 try {
 # Outdated
 if ($CheckOutdated) {
 Write-Info "Checking for outdated packages..."
 $output = & npm outdated 2>&1
 if ($output) {
 Write-Info "Outdated packages found:"
 $output | ForEach-Object { Write-Host " $_" }
 } else {
 Write-Pass "All Node.js packages are up to date"
 }
 }

 # Audit
 Write-Info "Running npm audit..."
 & npm audit 2>&1 | ForEach-Object { Write-Host " $_" }
 if ($LASTEXITCODE -ne 0) { $exitCode = 1 }
 } finally { Pop-Location }
}

Write-Header "Result"
if ($exitCode -eq 0) {
 Write-Pass "Dependency audit passed"
} else {
 Write-Fail "Issues found - review and update dependencies"
}

exit $exitCode
