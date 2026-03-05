#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Run test coverage analysis and check coverage thresholds
.DESCRIPTION
    Runs test suite with line-level coverage analysis using nyc/istanbul.
    Based on lessons learned from AgentX v7.6.0 - addresses need for line-level coverage metrics.
.EXAMPLE
    ./scripts/check-coverage.ps1
    ./scripts/check-coverage.ps1 -Html  # Generate HTML report 
    ./scripts/check-coverage.ps1 -CI   # CI mode with strict coverage gates
#>

[CmdletBinding()]
param(
    [string]$TargetDir = "vscode-extension",
    [switch]$Html,
    [switch]$CI,
    [int]$MinLines = 80,
    [int]$MinStatements = 80,
    [int]$MinFunctions = 80,
    [int]$MinBranches = 80
)

Write-Host "=== AgentX Coverage Analysis ===" -ForegroundColor Cyan
Write-Host ""

# Check if target directory exists
$fullTargetPath = Join-Path $PWD $TargetDir
if (!(Test-Path $fullTargetPath)) {
    Write-Error "Target directory not found: $fullTargetPath"
    exit 1
}

Push-Location $fullTargetPath

try {
    Write-Host "Running coverage analysis in: $fullTargetPath" -ForegroundColor Green
    Write-Host "Coverage thresholds: Lines=$MinLines%, Statements=$MinStatements%, Functions=$MinFunctions%, Branches=$MinBranches%" -ForegroundColor Yellow
    Write-Host ""

    # Ensure npm dependencies are installed
    if (!(Test-Path "node_modules")) {
        Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install dependencies"
            exit 1
        }
    }

    # Compile TypeScript
    Write-Host "Compiling TypeScript..." -ForegroundColor Yellow
    npm run compile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "TypeScript compilation failed"
        exit 1
    }

    # Run tests with coverage
    Write-Host "Running test suite with coverage..." -ForegroundColor Yellow
    if ($Html) {
        npm run coverage:html
    } else {
        npm run test:coverage
    }
    
    $testExitCode = $LASTEXITCODE
    Write-Host ""

    # Parse coverage results (nyc outputs to stderr)
    if ($testExitCode -eq 0) {
        Write-Host "[PASS] Test suite passed with coverage analysis!" -ForegroundColor Green
        
        if ($Html -and (Test-Path "coverage/index.html")) {
            $htmlPath = Resolve-Path "coverage/index.html"
            Write-Host "HTML coverage report: $htmlPath" -ForegroundColor Cyan
            if (!$CI) {
                Start-Process $htmlPath
            }
        }
        
        if (Test-Path ".nyc_output") {
            Write-Host "Coverage data available in .nyc_output/" -ForegroundColor Gray
        }
        
    } else {
        Write-Host "[FAIL] Coverage analysis failed!" -ForegroundColor Red
        
        # Check if it's a coverage threshold failure vs test failure
        if ($testExitCode -eq 1) {
            Write-Host "This may be due to:" -ForegroundColor Yellow
            Write-Host "  1. Test failures - check test output above" -ForegroundColor Gray
            Write-Host "  2. Coverage below thresholds - see coverage report" -ForegroundColor Gray
            Write-Host "  3. Missing test files for new code" -ForegroundColor Gray
        }
    }

    # Generate summary
    Write-Host ""
    Write-Host "=== COVERAGE SUMMARY ===" -ForegroundColor Cyan
    
    if (Test-Path "coverage/lcov.info") {
        $lcovSize = (Get-Item "coverage/lcov.info").Length
        Write-Host "LCOV report: coverage/lcov.info ($lcovSize bytes)" -ForegroundColor Gray
    }
    
    if (Test-Path "coverage/coverage-summary.json") {
        try {
            $summary = Get-Content "coverage/coverage-summary.json" | ConvertFrom-Json
            if ($summary.total) {
                $total = $summary.total
                Write-Host "Lines: $($total.lines.pct)% ($($total.lines.covered)/$($total.lines.total))" -ForegroundColor Gray 
                Write-Host "Statements: $($total.statements.pct)% ($($total.statements.covered)/$($total.statements.total))" -ForegroundColor Gray
                Write-Host "Functions: $($total.functions.pct)% ($($total.functions.covered)/$($total.functions.total))" -ForegroundColor Gray
                Write-Host "Branches: $($total.branches.pct)% ($($total.branches.covered)/$($total.branches.total))" -ForegroundColor Gray
            }
        } catch {
            Write-Host "Could not parse coverage summary" -ForegroundColor Gray
        }
    }

    if ($CI -and $testExitCode -ne 0) {
        Write-Host ""
        Write-Host "CI Mode: Failing build due to coverage issues" -ForegroundColor Red
        exit 1
    }
    
    exit $testExitCode

} finally {
    Pop-Location
}