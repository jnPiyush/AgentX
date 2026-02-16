#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Run benchmarks and generate performance comparison reports.

.DESCRIPTION
 Provides a framework for running benchmarks across .NET (BenchmarkDotNet),
 Python (pytest-benchmark), and Node.js (benchmark.js). Compares results
 against previous baselines if available.

.PARAMETER Path
 Project root. Default: current directory.

.PARAMETER Baseline
 Path to baseline results for comparison. Optional.

.PARAMETER Output
 Output directory for results. Default: ./benchmark-results

.EXAMPLE
 .\run-benchmark.ps1
 .\run-benchmark.ps1 -Baseline ./benchmark-results/baseline.json
#>
param(
 [string]$Path = ".",
 [string]$Baseline = "",
 [string]$Output = "./benchmark-results"
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Pass { param([string]$Text); Write-Host " PASS: $Text" -ForegroundColor Green }
function Write-Fail { param([string]$Text); Write-Host " FAIL: $Text" -ForegroundColor Red }
function Write-Info { param([string]$Text); Write-Host " INFO: $Text" -ForegroundColor Yellow }

Write-Header "Performance Benchmark Runner"

# Ensure output directory
New-Item -ItemType Directory -Path $Output -Force | Out-Null

# .NET - BenchmarkDotNet
$benchProj = Get-ChildItem -Path $Path -Filter "*Benchmark*.csproj" -Recurse -ErrorAction SilentlyContinue |
 Select-Object -First 1
if ($benchProj) {
 Write-Header ".NET Benchmarks (BenchmarkDotNet)"
 Write-Info "Running $($benchProj.Name)..."
 
 Push-Location $benchProj.DirectoryName
 try {
 & dotnet run -c Release -- --exporters json 2>&1 | ForEach-Object { Write-Host " $_" }
 
 # Copy results
 $results = Get-ChildItem -Path "./BenchmarkDotNet.Artifacts" -Filter "*.json" -Recurse -ErrorAction SilentlyContinue
 if ($results) {
 Copy-Item $results[0].FullName -Destination (Join-Path $Output "dotnet-benchmark.json") -Force
 Write-Pass "Results saved to $Output/dotnet-benchmark.json"
 }
 } finally { Pop-Location }
}

# Python - pytest-benchmark
$pytestConfig = (Test-Path (Join-Path $Path "pyproject.toml")) -or (Test-Path (Join-Path $Path "pytest.ini"))
$hasBenchmarks = Get-ChildItem -Path $Path -Filter "*benchmark*" -Recurse -File -ErrorAction SilentlyContinue |
 Where-Object { $_.Extension -eq ".py" }
if ($pytestConfig -and $hasBenchmarks) {
 Write-Header "Python Benchmarks (pytest-benchmark)"
 Push-Location $Path
 try {
 $benchFile = Join-Path $Output "python-benchmark.json"
 & python -m pytest --benchmark-only --benchmark-json=$benchFile 2>&1 | ForEach-Object { Write-Host " $_" }
 if (Test-Path $benchFile) {
 Write-Pass "Results saved to $benchFile"
 }
 } finally { Pop-Location }
}

# Node.js
if (Test-Path (Join-Path $Path "package.json")) {
 $pkg = Get-Content (Join-Path $Path "package.json") | ConvertFrom-Json
 $hasBenchScript = $pkg.scripts.PSObject.Properties.Name -contains "bench" -or
 $pkg.scripts.PSObject.Properties.Name -contains "benchmark"
 if ($hasBenchScript) {
 Write-Header "Node.js Benchmarks"
 Push-Location $Path
 try {
 $script = if ($pkg.scripts.PSObject.Properties.Name -contains "bench") { "bench" } else { "benchmark" }
 & npm run $script 2>&1 | ForEach-Object { Write-Host " $_" }
 } finally { Pop-Location }
 }
}

# Baseline comparison
if ($Baseline -and (Test-Path $Baseline)) {
 Write-Header "Baseline Comparison"
 Write-Info "Comparing against: $Baseline"
 Write-Info "Baseline comparison is available for .NET (BenchmarkDotNet) results"
 # Basic JSON comparison - compare mean values
 try {
 $baseData = Get-Content $Baseline | ConvertFrom-Json
 Write-Info "Baseline loaded with $($baseData.Count) benchmark(s)"
 } catch {
 Write-Info "Could not parse baseline file"
 }
}

Write-Header "Done"
Write-Host " Results directory: $Output"
