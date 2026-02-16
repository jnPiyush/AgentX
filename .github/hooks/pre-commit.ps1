# Pre-commit hook: Security and quality checks ONLY
# Workflow validation is handled by pre-handoff validation (.github/scripts/validate-handoff.sh)
# Issue reference validation is handled by commit-msg hook
# PowerShell version for Windows

Write-Host "[INFO] Running pre-commit checks..." -ForegroundColor Cyan
Write-Host ""

$script:Failed = $false

Write-Host "-------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Security & Quality Checks" -ForegroundColor Cyan
Write-Host "-------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Check 1: No secrets in staged files (exclude .md docs - they contain example patterns)
Write-Host "Checking for secrets... " -NoNewline
$stagedFiles = git diff --cached --name-only
$secretPatterns = @(
 'password\s*=\s*["\x27][^"\x27]+["\x27]',
 'api[_-]?key\s*=\s*["\x27][^"\x27]+["\x27]',
 'secret\s*=\s*["\x27][^"\x27]+["\x27]',
 'token\s*=\s*["\x27][^"\x27]+["\x27]',
 'private[_-]?key\s*=\s*["\x27][^"\x27]+["\x27]'
)

$foundSecrets = $false
foreach ($file in $stagedFiles) {
 if ($file -match '\.md$') { continue }
 if (Test-Path $file) {
 $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
 foreach ($pattern in $secretPatterns) {
 if ($content -match $pattern) {
 $foundSecrets = $true
 break
 }
 }
 }
}

if ($foundSecrets) {
 Write-Host "[FAILED]" -ForegroundColor Red
 Write-Host " Found potential secrets in staged files!" -ForegroundColor Red
 Write-Host " Use environment variables instead."
 $script:Failed = $true
} else {
 Write-Host "[PASSED]" -ForegroundColor Green
}

# Check 2: No large files (>1MB)
Write-Host "Checking file sizes... " -NoNewline
$largeFiles = @()
foreach ($file in $stagedFiles) {
 if (Test-Path $file) {
 $size = (Get-Item $file).Length
 if ($size -gt 1MB) {
 $largeFiles += $file
 }
 }
}

if ($largeFiles.Count -gt 0) {
 Write-Host "[WARNING]" -ForegroundColor Yellow
 Write-Host " Large files detected (>1MB):"
 $largeFiles | ForEach-Object { Write-Host " $_" }
} else {
 Write-Host "[PASSED]" -ForegroundColor Green
}

# Check 3: Warn on direct master/main commits
$branch = git symbolic-ref --short HEAD 2>$null
if ($branch -eq "main" -or $branch -eq "master") {
 Write-Host "[WARNING] Committing directly to $branch" -ForegroundColor Yellow
}

# Check 4: C# formatting (if dotnet available)
if (Get-Command dotnet -ErrorAction SilentlyContinue) {
 $csFiles = $stagedFiles | Where-Object { $_ -match '\.cs$' }
 if ($csFiles) {
 Write-Host "Checking C# formatting... " -NoNewline
 dotnet format --verify-no-changes --include ($csFiles -join ' ') 2>&1 | Out-Null
 if ($LASTEXITCODE -eq 0) {
 Write-Host "[PASS] PASSED" -ForegroundColor Green
 } else {
 Write-Host "[WARN] Auto-formatting" -ForegroundColor Yellow
 dotnet format --include ($csFiles -join ' ')
 $csFiles | ForEach-Object { git add $_ }
 }
 }
}

# Check 5: Python formatting (if black available)
if (Get-Command black -ErrorAction SilentlyContinue) {
 $pyFiles = $stagedFiles | Where-Object { $_ -match '\.py$' }
 if ($pyFiles) {
 Write-Host "Checking Python formatting... " -NoNewline
 $checkResult = & black --check ($pyFiles -join ' ') 2>&1
 if ($LASTEXITCODE -eq 0) {
 Write-Host "[PASSED]" -ForegroundColor Green
 } else {
 Write-Host "[AUTO-FIX] Auto-formatting" -ForegroundColor Yellow
 & black ($pyFiles -join ' ')
 $pyFiles | ForEach-Object { git add $_ }
 }
 }
}

# Check 6: SQL injection patterns
Write-Host "Checking for SQL injection risks... " -NoNewline
$sqlRisk = git diff --cached | Select-String -Pattern '\+.*\b(ExecuteRaw|FromSqlRaw|SqlQuery)' |
 Where-Object { $_ -notmatch 'parameterized|@' }
if ($sqlRisk) {
 Write-Host "[WARNING] Potential SQL injection" -ForegroundColor Yellow
} else {
 Write-Host "[PASSED]" -ForegroundColor Green
}

# Check 7: Blocked commands validation (only check newly created code files)
Write-Host "Checking for blocked commands... " -NoNewline
$blockedCommands = @(
 "rm -rf",
 "git reset --hard",
 "git push --force",
 "DROP DATABASE",
 "DROP TABLE",
 "TRUNCATE",
 "format c:",
 "del /s /q",
 "rmdir /s /q",
 "Remove-Item -Recurse -Force"
)

$newCodeFiles = git diff --cached --name-only --diff-filter=A | Where-Object { $_ -notmatch '\.md$' }
$blockedFound = $false

foreach ($file in $newCodeFiles) {
 if (Test-Path $file) {
  $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
  foreach ($cmd in $blockedCommands) {
   if ($content -match [regex]::Escape($cmd)) {
    Write-Host "[BLOCKED] BLOCKED COMMAND: $cmd in $file" -ForegroundColor Red
    $blockedFound = $true
   }
  }
 }
}

if ($blockedFound) {
 Write-Host "[FAILED] Blocked destructive command found" -ForegroundColor Red
 Write-Host " Review .github/security/allowed-commands.json for allowed operations"
 $script:Failed = $true
} else {
 Write-Host "[PASSED]" -ForegroundColor Green
}

# Summary
Write-Host ""
if ($script:Failed) {
 Write-Host "[FAILED] Pre-commit checks FAILED" -ForegroundColor Red
 exit 1
} else {
 Write-Host "[PASSED] Security checks passed" -ForegroundColor Green
 exit 0
}
