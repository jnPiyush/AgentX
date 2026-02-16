#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Validates test pyramid ratios (70% unit / 20% integration / 10% e2e).
.DESCRIPTION
 Counts test files by category based on directory naming conventions
 and reports whether the test distribution matches the recommended pyramid.
.PARAMETER TestPath
 Root path to the tests directory (default: ./tests or ./test)
.PARAMETER Tolerance
 Percentage tolerance for ratio deviation (default: 15)
.EXAMPLE
 ./check-test-pyramid.ps1
 ./check-test-pyramid.ps1 -TestPath ./src/tests -Tolerance 10
#>
param(
 [string]$TestPath = "",
 [int]$Tolerance = 15
)

$ErrorActionPreference = "Stop"

# Auto-detect test directory
if (-not $TestPath) {
 $candidates = @("tests", "test", "src/tests", "src/test", "__tests__")
 foreach ($c in $candidates) {
 if (Test-Path $c) { $TestPath = $c; break }
 }
 if (-not $TestPath) {
 Write-Host "No test directory found. Specify -TestPath." -ForegroundColor Red
 exit 1
 }
}

Write-Host "`n=== Test Pyramid Validation ===" -ForegroundColor Cyan
Write-Host " Test path: $TestPath" -ForegroundColor Gray

# Count test files by category
$unitPatterns = @("*unit*", "*Unit*")
$integrationPatterns = @("*integration*", "*Integration*", "*intg*", "*Intg*")
$e2ePatterns = @("*e2e*", "*E2E*", "*end-to-end*", "*EndToEnd*", "*acceptance*", "*Acceptance*")

$allTests = Get-ChildItem -Path $TestPath -Recurse -File | Where-Object {
 $_.Name -match '\.(test|spec|tests|Test|Tests)\.(cs|py|ts|tsx|js|jsx|go|rs)$' -or
 $_.Name -match '(Test|Tests|_test|_spec)\.(cs|py|ts|tsx|js|jsx|go|rs)$'
}

$unitCount = 0
$integrationCount = 0
$e2eCount = 0
$uncategorized = 0

foreach ($file in $allTests) {
 $path = $file.FullName
 $matched = $false

 foreach ($p in $e2ePatterns) {
 if ($path -like "*$p*") { $e2eCount++; $matched = $true; break }
 }
 if (-not $matched) {
 foreach ($p in $integrationPatterns) {
 if ($path -like "*$p*") { $integrationCount++; $matched = $true; break }
 }
 }
 if (-not $matched) {
 foreach ($p in $unitPatterns) {
 if ($path -like "*$p*") { $unitCount++; $matched = $true; break }
 }
 }
 if (-not $matched) {
 # Default: files not in integration/e2e dirs count as unit
 $unitCount++
 $uncategorized++
 }
}

$total = $unitCount + $integrationCount + $e2eCount

if ($total -eq 0) {
 Write-Host " No test files found." -ForegroundColor Yellow
 exit 1
}

$unitPct = [math]::Round(($unitCount / $total) * 100, 1)
$integrationPct = [math]::Round(($integrationCount / $total) * 100, 1)
$e2ePct = [math]::Round(($e2eCount / $total) * 100, 1)

Write-Host "`n Test Distribution ($total total files):" -ForegroundColor White
Write-Host " Unit: $unitCount ($unitPct%) [target: 70%]"
Write-Host " Integration: $integrationCount ($integrationPct%) [target: 20%]"
Write-Host " E2E: $e2eCount ($e2ePct%) [target: 10%]"
if ($uncategorized -gt 0) {
 Write-Host " (uncategorized -> unit: $uncategorized)" -ForegroundColor Gray
}

# Check ratios
$exitCode = 0
$targets = @(
 @{ Name = "Unit"; Actual = $unitPct; Target = 70 },
 @{ Name = "Integration"; Actual = $integrationPct; Target = 20 },
 @{ Name = "E2E"; Actual = $e2ePct; Target = 10 }
)

Write-Host "`n Pyramid Check (tolerance: $Tolerance%):" -ForegroundColor White
foreach ($t in $targets) {
 $diff = [math]::Abs($t.Actual - $t.Target)
 $ok = $diff -le $Tolerance
 $symbol = if ($ok) { "PASS" } else { "WARN" }
 $color = if ($ok) { "Green" } else { "Yellow" }
 Write-Host " $symbol $($t.Name): $($t.Actual)% (target $($t.Target)%, deviation $([math]::Round($diff, 1))%)" -ForegroundColor $color
 if (-not $ok) { $exitCode = 1 }
}

Write-Host ""
exit $exitCode
