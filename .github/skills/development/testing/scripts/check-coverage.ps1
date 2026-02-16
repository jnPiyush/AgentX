#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Checks test coverage meets the minimum threshold (default 80%).
.DESCRIPTION
 Cross-platform coverage checker that works with .NET (Coverlet), Python (coverage.py),
 and Node.js (Istanbul/nyc). Auto-detects project type and runs appropriate coverage tool.
.PARAMETER MinCoverage
 Minimum coverage percentage required (default: 80)
.PARAMETER ProjectPath
 Path to the project root (default: current directory)
.EXAMPLE
 ./check-coverage.ps1
 ./check-coverage.ps1 -MinCoverage 90 -ProjectPath ./src
#>
param(
 [int]$MinCoverage = 80,
 [string]$ProjectPath = "."
)

$ErrorActionPreference = "Stop"

function Write-Result($passed, $message) {
 if ($passed) {
 Write-Host " PASS: $message" -ForegroundColor Green
 } else {
 Write-Host " FAIL: $message" -ForegroundColor Red
 }
}

Write-Host "`n=== Coverage Check (minimum: $MinCoverage%) ===" -ForegroundColor Cyan

# Detect project type
$isDotNet = Test-Path (Join-Path $ProjectPath "*.sln") -or (Test-Path (Join-Path $ProjectPath "*.csproj"))
$isPython = Test-Path (Join-Path $ProjectPath "pyproject.toml") -or (Test-Path (Join-Path $ProjectPath "setup.py")) -or (Test-Path (Join-Path $ProjectPath "requirements.txt"))
$isNode = Test-Path (Join-Path $ProjectPath "package.json")

$exitCode = 0

if ($isDotNet) {
 Write-Host "`n[.NET] Running Coverlet coverage..." -ForegroundColor Yellow
 Push-Location $ProjectPath
 try {
 dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage 2>&1
 $coverageFile = Get-ChildItem -Path ./coverage -Filter "coverage.cobertura.xml" -Recurse | Select-Object -First 1
 if ($coverageFile) {
 [xml]$xml = Get-Content $coverageFile.FullName
 $lineRate = [math]::Round([double]$xml.coverage.'line-rate' * 100, 2)
 Write-Result ($lineRate -ge $MinCoverage) "Line coverage: $lineRate%"
 if ($lineRate -lt $MinCoverage) { $exitCode = 1 }
 } else {
 Write-Result $false "No coverage report generated. Install coverlet: dotnet add package coverlet.collector"
 $exitCode = 1
 }
 } finally { Pop-Location }
}

if ($isPython) {
 Write-Host "`n[Python] Running pytest-cov..." -ForegroundColor Yellow
 Push-Location $ProjectPath
 try {
 $output = python -m pytest --cov --cov-report=term --cov-fail-under=$MinCoverage 2>&1
 $output | ForEach-Object { Write-Host " $_" }
 if ($LASTEXITCODE -ne 0) {
 Write-Result $false "Coverage below $MinCoverage%"
 $exitCode = 1
 } else {
 Write-Result $true "Coverage meets threshold"
 }
 } finally { Pop-Location }
}

if ($isNode) {
 Write-Host "`n[Node.js] Running coverage..." -ForegroundColor Yellow
 Push-Location $ProjectPath
 try {
 $packageJson = Get-Content (Join-Path $ProjectPath "package.json") | ConvertFrom-Json
 $hasJest = $packageJson.devDependencies.PSObject.Properties.Name -contains "jest" -or $packageJson.dependencies.PSObject.Properties.Name -contains "jest"
 $hasVitest = $packageJson.devDependencies.PSObject.Properties.Name -contains "vitest"

 if ($hasVitest) {
 npx vitest run --coverage 2>&1
 } elseif ($hasJest) {
 npx jest --coverage --coverageThreshold="{`"global`": {`"lines`": $MinCoverage}}" 2>&1
 } else {
 npx nyc npm test 2>&1
 }
 if ($LASTEXITCODE -ne 0) {
 Write-Result $false "Coverage below $MinCoverage%"
 $exitCode = 1
 } else {
 Write-Result $true "Coverage meets threshold"
 }
 } finally { Pop-Location }
}

if (-not $isDotNet -and -not $isPython -and -not $isNode) {
 Write-Host " No recognized project type found at $ProjectPath" -ForegroundColor Yellow
 Write-Host " Supported: .NET (*.sln/*.csproj), Python (pyproject.toml), Node.js (package.json)"
 $exitCode = 1
}

Write-Host ""
exit $exitCode
