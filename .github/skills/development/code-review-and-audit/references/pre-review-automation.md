# Pre-Review Automated Check Scripts

## Pre-Review Automated Checks

Run these before requesting human review or deploying.

### Quick Check Script

```bash
# Run all automated checks
./scripts/pre-review-check.sh

# Or manually:
dotnet format --verify-no-changes
dotnet build --no-incremental
dotnet test --collect:"XPlat Code Coverage"
dotnet list package --vulnerable --include-transitive
```

### PowerShell Pre-Review Script

```powershell
# scripts/Pre-Review-Check.ps1
Write-Host "=== Pre-Review Automated Checks ===" -ForegroundColor Cyan

# 1. Format Check
Write-Host "`n[1/6] Checking code formatting..." -ForegroundColor Yellow
dotnet format --verify-no-changes
if ($LASTEXITCODE -ne 0) {
 Write-Host "[FAIL] Format issues found. Run 'dotnet format'" -ForegroundColor Red
 exit 1
}

# 2. Build
Write-Host "`n[2/6] Building solution..." -ForegroundColor Yellow
dotnet build --no-incremental
if ($LASTEXITCODE -ne 0) {
 Write-Host "[FAIL] Build failed" -ForegroundColor Red
 exit 1
}

# 3. Tests
Write-Host "`n[3/6] Running tests..." -ForegroundColor Yellow
dotnet test --no-build --verbosity minimal --collect:"XPlat Code Coverage"
if ($LASTEXITCODE -ne 0) {
 Write-Host "[FAIL] Tests failed" -ForegroundColor Red
 exit 1
}

# 4. Coverage Check (requires ReportGenerator)
Write-Host "`n[4/6] Checking code coverage..." -ForegroundColor Yellow
$coverageFile = Get-ChildItem -Path "TestResults" -Filter "coverage.cobertura.xml" -Recurse | Select-Object -First 1
if ($coverageFile) {
 $xml = [xml](Get-Content $coverageFile.FullName)
 $coverage = [math]::Round([decimal]$xml.coverage.'line-rate' * 100, 2)
 Write-Host "Coverage: $coverage%" -ForegroundColor Cyan
 if ($coverage -lt 80) {
 Write-Host "[WARN] Coverage below 80% threshold" -ForegroundColor Yellow
 }
}

# 5. Security Vulnerabilities
Write-Host "`n[5/6] Checking for vulnerable packages..." -ForegroundColor Yellow
dotnet list package --vulnerable --include-transitive
if ($LASTEXITCODE -ne 0) {
 Write-Host "[FAIL] Vulnerable packages found" -ForegroundColor Red
 exit 1
}

# 6. Static Analysis (if SonarScanner installed)
if (Get-Command "dotnet-sonarscanner" -ErrorAction SilentlyContinue) {
 Write-Host "`n[6/6] Running SonarQube analysis..." -ForegroundColor Yellow
 dotnet sonarscanner begin /k:"project-key"
 dotnet build
 dotnet sonarscanner end
}

Write-Host "`n[PASS] All automated checks passed!" -ForegroundColor Green
```

---
