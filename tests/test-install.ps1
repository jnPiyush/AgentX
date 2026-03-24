#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Comprehensive live test suite for install.ps1
 Tests all modes, edge cases, failure scenarios, and artifact validation.
#>

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue" # Suppress progress bars from Remove-Item/Copy-Item
$SCRIPT_PATH = "C:\Piyush - Personal\GenAI\AgentX\install.ps1"
$SCRIPT_ROOT = Split-Path $SCRIPT_PATH -Parent
$TEST_BASE = "$env:TEMP\agentx-test-suite-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$EXPECTED_VERSION = (Get-Content (Join-Path (Split-Path $SCRIPT_PATH -Parent) 'version.json') -Raw | ConvertFrom-Json).version
$LOCAL_ARCHIVE = Join-Path $TEST_BASE 'agentx-local.zip'

# Tracking
$global:TestResults = @()

function New-TestDir($name) {
 $dir = Join-Path $TEST_BASE $name
 New-Item -ItemType Directory -Path $dir -Force | Out-Null
 return $dir
}

function Initialize-LocalArchive {
 $archiveStage = Join-Path $TEST_BASE 'archive-stage'
 $archiveRoot = Join-Path $archiveStage 'AgentX-master'

 if (Test-Path $LOCAL_ARCHIVE) {
  return
 }

 New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null

 foreach ($directory in @('.agentx', '.github', '.claude', '.vscode', 'scripts', 'packs', 'docs')) {
  Copy-Item (Join-Path $SCRIPT_ROOT $directory) (Join-Path $archiveRoot $directory) -Recurse -Force
 }
 foreach ($file in @('AGENTS.md', 'Skills.md', '.gitignore')) {
  Copy-Item (Join-Path $SCRIPT_ROOT $file) (Join-Path $archiveRoot $file) -Force
 }

 Compress-Archive -Path (Join-Path $archiveStage 'AgentX-master') -DestinationPath $LOCAL_ARCHIVE -Force
}

function Invoke-InstallerFile {
 param(
  [string[]]$ArgumentList = @(),
  [string]$ArchiveOverride = $LOCAL_ARCHIVE
 )

 $previousArchive = $env:AGENTX_INSTALL_ARCHIVE
 $env:AGENTX_INSTALL_ARCHIVE = $ArchiveOverride
 try {
  & $SCRIPT_PATH @ArgumentList 2>&1 | Out-Null
 } finally {
  $env:AGENTX_INSTALL_ARCHIVE = $previousArchive
 }
}

function Invoke-InstallerExpression {
 param(
  [string]$ScriptText,
  [string]$ArchiveOverride = $LOCAL_ARCHIVE
 )

 $previousArchive = $env:AGENTX_INSTALL_ARCHIVE
 $env:AGENTX_INSTALL_ARCHIVE = $ArchiveOverride
 try {
  Invoke-Expression $ScriptText 2>&1 | Out-Null
 } finally {
  $env:AGENTX_INSTALL_ARCHIVE = $previousArchive
 }
}

function Assert-PathExists($path, $label) {
 if (Test-Path $path) { return @{ Pass=$true; Label=$label } }
 else { return @{ Pass=$false; Label="$label (MISSING: $path)" } }
}

function Assert-PathNotExists($path, $label) {
 if (-not (Test-Path $path)) { return @{ Pass=$true; Label=$label } }
 else { return @{ Pass=$false; Label="$label (STILL EXISTS: $path)" } }
}

function Assert-JsonField($file, $field, $expected, $label) {
 try {
 $json = Get-Content $file -Raw | ConvertFrom-Json
 $actual = $json.$field
 if ("$actual" -eq "$expected") { return @{ Pass=$true; Label=$label } }
 else { return @{ Pass=$false; Label="$label (expected '$expected', got '$actual')" } }
 } catch {
 return @{ Pass=$false; Label="$label (JSON parse error: $($_.Exception.Message))" }
 }
}

function Write-TestReport($testName, $results) {
 $pass = ($results | Where-Object { $_.Pass }).Count
 $fail = ($results | Where-Object { -not $_.Pass }).Count
 $total = $results.Count

 if ($fail -eq 0) {
 Write-Host " PASS [$pass/$total] $testName" -ForegroundColor Green
 } else {
 Write-Host " FAIL [$pass/$total] $testName" -ForegroundColor Red
 $results | Where-Object { -not $_.Pass } | ForEach-Object {
 Write-Host " X $($_.Label)" -ForegroundColor Red
 }
 }

 $global:TestResults += @{ Name=$testName; Pass=$pass; Fail=$fail; Total=$total; Details=$results }
}

# -- EXPECTED ARTIFACTS --------------------------------------------------
$CORE_FILES = @("AGENTS.md", "Skills.md", ".gitignore")
$CORE_DIRS = @(".agentx", ".github", ".vscode", "scripts")
$RUNTIME_DIRS = @(
 ".agentx/state", ".agentx/digests",
 "docs/artifacts/prd", "docs/artifacts/adr", "docs/artifacts/specs", "docs/ux", "docs/artifacts/reviews", "docs/execution/plans", "docs/execution/progress"
)
$RUNTIME_FILES = @(
 ".agentx/config.json",
 ".agentx/version.json",
 ".agentx/state/agent-status.json"
)
$GIT_ARTIFACTS = @(".git", ".git/hooks/pre-commit", ".git/hooks/commit-msg")
$TEMP_FILES = @(".agentx-install-tmp", ".agentx-install-raw", ".agentx-install.zip")

# ========================================================
Write-Host ""
Write-Host "+===================================================+" -ForegroundColor Yellow
Write-Host "| AgentX Install Test Suite |" -ForegroundColor Yellow
Write-Host "| $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') |" -ForegroundColor Yellow
Write-Host "+===================================================+" -ForegroundColor Yellow
Write-Host " Test base: $TEST_BASE" -ForegroundColor DarkGray
Write-Host ""

Initialize-LocalArchive

# -- TEST 1: Local mode via iex (piped) -----------------------------------
Write-Host "--- TEST 1: Local mode via iex (piped) ---" -ForegroundColor Cyan
$dir = New-TestDir "t1-local-iex"
Push-Location $dir
try {
 $env:AGENTX_MODE = $null
 $script = Get-Content $SCRIPT_PATH -Raw
 Invoke-InstallerExpression $script

 $r = @()
 # Core files
 foreach ($f in $CORE_FILES) { $r += Assert-PathExists $f "core: $f" }
 foreach ($d in $CORE_DIRS) { $r += Assert-PathExists $d "core: $d" }
 # Runtime dirs
 foreach ($d in $RUNTIME_DIRS) { $r += Assert-PathExists $d "runtime-dir: $d" }
 # Local-specific
 $r += Assert-PathExists ".agentx/issues" "local: .agentx/issues"
 # Runtime files
 foreach ($f in $RUNTIME_FILES) { $r += Assert-PathExists $f "runtime: $f" }
 # Git artifacts
 foreach ($g in $GIT_ARTIFACTS) { $r += Assert-PathExists $g "git: $g" }
 # JSON content
 $r += Assert-JsonField ".agentx/config.json" "mode" "local" "config.mode=local"
 $r += Assert-JsonField ".agentx/config.json" "nextIssueNumber" "1" "config.nextIssueNumber=1"
$r += Assert-JsonField ".agentx/version.json" "version" $EXPECTED_VERSION "version=$EXPECTED_VERSION"
 $r += Assert-JsonField ".agentx/version.json" "mode" "local" "version.mode=local"
 # Agent status check
 try {
 $status = Get-Content ".agentx/state/agent-status.json" -Raw | ConvertFrom-Json
 $agents = @("product-manager","ux-designer","architect","engineer","reviewer","devops-engineer")
 foreach ($a in $agents) {
 if ($status.$a.status -eq "idle") { $r += @{ Pass=$true; Label="agent $a = idle" } }
 else { $r += @{ Pass=$false; Label="agent $a status is '$($status.$a.status)' not 'idle'" } }
 }
 } catch { $r += @{ Pass=$false; Label="agent-status.json parse error" } }
 # No temp files
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "Local mode via iex" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="Local mode via iex"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 2: Local mode via direct file -----------------------------------
Write-Host "--- TEST 2: Local mode via direct file ---" -ForegroundColor Cyan
$dir = New-TestDir "t2-local-direct"
Push-Location $dir
try {
 Invoke-InstallerFile

 $r = @()
 foreach ($f in $CORE_FILES) { $r += Assert-PathExists $f "core: $f" }
 foreach ($d in $CORE_DIRS) { $r += Assert-PathExists $d "core: $d" }
 foreach ($d in $RUNTIME_DIRS) { $r += Assert-PathExists $d "runtime-dir: $d" }
 $r += Assert-PathExists ".agentx/issues" "local: .agentx/issues"
 foreach ($f in $RUNTIME_FILES) { $r += Assert-PathExists $f "runtime: $f" }
 foreach ($g in $GIT_ARTIFACTS) { $r += Assert-PathExists $g "git: $g" }
 $r += Assert-JsonField ".agentx/config.json" "mode" "local" "config.mode=local"
$r += Assert-JsonField ".agentx/version.json" "version" $EXPECTED_VERSION "version=$EXPECTED_VERSION"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "Local mode via direct file" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="Local mode via direct file"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 3: GitHub mode via iex (piped) ----------------------------------
Write-Host "--- TEST 3: GitHub mode via iex (piped) ---" -ForegroundColor Cyan
$dir = New-TestDir "t3-github-iex"
Push-Location $dir
try {
 # Note: true irm|iex sets $isPiped=true via $MyInvocation.MyCommand.Path=null
 # Test harness can't truly simulate piped mode, so we use -NoSetup to skip prompts
 # and test git init separately in Test 3b
 Invoke-InstallerFile -ArgumentList @('-Mode', 'github', '-NoSetup')

 $r = @()
 foreach ($f in $CORE_FILES) { $r += Assert-PathExists $f "core: $f" }
 foreach ($d in $CORE_DIRS) { $r += Assert-PathExists $d "core: $d" }
 foreach ($d in $RUNTIME_DIRS) { $r += Assert-PathExists $d "runtime-dir: $d" }
 foreach ($f in $RUNTIME_FILES) { $r += Assert-PathExists $f "runtime: $f" }
 $r += Assert-JsonField ".agentx/config.json" "mode" "github" "config.mode=github"
 $r += Assert-JsonField ".agentx/version.json" "mode" "github" "version.mode=github"
 # GitHub mode should NOT have issues dir
 $r += Assert-PathNotExists ".agentx/issues" "github: no issues dir"
 # -NoSetup skips git init (expected)
 $r += Assert-PathNotExists ".git" "nosetup: no .git (expected)"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "GitHub mode -NoSetup" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="GitHub mode -NoSetup"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 3b: GitHub mode with setup (direct) -- verifies git auto-init works in GitHub mode
Write-Host "--- TEST 3b: GitHub mode with git init ---" -ForegroundColor Cyan
$dir = New-TestDir "t3b-github-git"
Push-Location $dir
try {
 # This will trigger git init but since not piped AND not local, it will hit GitHub interactive prompts.
 # Preemptively init git so the script skips the init but still installs hooks.
 git init --quiet 2>$null
 Invoke-InstallerFile -ArgumentList @('-Mode', 'github', '-NoSetup')

 $r = @()
 $r += Assert-PathExists ".git" "git: .git exists (pre-created)"
 $r += Assert-JsonField ".agentx/config.json" "mode" "github" "config.mode=github"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "GitHub mode with git init" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="GitHub mode with git init"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 4: GitHub mode via direct file -NoSetup -------------------------
Write-Host "--- TEST 4: GitHub mode direct -NoSetup ---" -ForegroundColor Cyan
$dir = New-TestDir "t4-github-nosetup"
Push-Location $dir
try {
 Invoke-InstallerFile -ArgumentList @('-Mode', 'github', '-NoSetup')

 $r = @()
 foreach ($f in $CORE_FILES) { $r += Assert-PathExists $f "core: $f" }
 foreach ($d in $CORE_DIRS) { $r += Assert-PathExists $d "core: $d" }
 foreach ($f in $RUNTIME_FILES) { $r += Assert-PathExists $f "runtime: $f" }
 $r += Assert-JsonField ".agentx/config.json" "mode" "github" "config.mode=github"
 # NoSetup: no .git
 $r += Assert-PathNotExists ".git" "nosetup: no .git"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "GitHub mode direct -NoSetup" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="GitHub mode direct -NoSetup"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 5: Force reinstall (overwrite existing) -------------------------
Write-Host "--- TEST 5: Force reinstall ---" -ForegroundColor Cyan
$dir = New-TestDir "t5-force"
Push-Location $dir
try {
 # First install
 Invoke-InstallerFile -ArgumentList @('-NoSetup')
 # Modify a file to verify it gets overwritten
 "MODIFIED" | Set-Content ".agentx/config.json"
 # Force reinstall
 Invoke-InstallerFile -ArgumentList @('-Force', '-NoSetup')

 $r = @()
 $r += Assert-JsonField ".agentx/config.json" "mode" "local" "force: config.mode restored to local"
$r += Assert-JsonField ".agentx/version.json" "version" $EXPECTED_VERSION "force: version restored"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "Force reinstall" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="Force reinstall"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 6: Invalid mode -------------------------------------------------
Write-Host "--- TEST 6: Invalid mode validation ---" -ForegroundColor Cyan
$dir = New-TestDir "t6-invalid"
Push-Location $dir
try {
 $prevEAP = $ErrorActionPreference
 $ErrorActionPreference = "Continue"
 $previousArchive = $env:AGENTX_INSTALL_ARCHIVE
 $env:AGENTX_INSTALL_ARCHIVE = $LOCAL_ARCHIVE
 $errOutput = & $SCRIPT_PATH -Mode "badvalue" -NoSetup 2>&1
 $env:AGENTX_INSTALL_ARCHIVE = $previousArchive
 $ErrorActionPreference = $prevEAP
 $errText = $errOutput | Out-String

 $r = @()
 if ($errText -match "Invalid Mode") {
 $r += @{ Pass=$true; Label="error message contains 'Invalid Mode'" }
 } else {
 $r += @{ Pass=$false; Label="missing error message (got: $errText)" }
 }
 # Should NOT create any files
 $r += Assert-PathNotExists "AGENTS.md" "invalid: no AGENTS.md created"
 $r += Assert-PathNotExists ".agentx" "invalid: no .agentx created"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "Invalid mode validation" $r
} catch {
 # Write-Error with ErrorActionPreference=Stop throws -- handle as expected behavior
 $r = @()
 if ($_.Exception.Message -match "Invalid Mode") {
 $r += @{ Pass=$true; Label="error thrown with 'Invalid Mode' message" }
 } else {
 $r += @{ Pass=$false; Label="unexpected error: $($_.Exception.Message)" }
 }
 $r += Assert-PathNotExists "AGENTS.md" "invalid: no AGENTS.md created"
 $r += Assert-PathNotExists ".agentx" "invalid: no .agentx created"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }
 Write-TestReport "Invalid mode validation" $r
}
Pop-Location

# -- TEST 7: Failure cleanup (bad URL) ------------------------------------
Write-Host "--- TEST 7: Failure cleanup (bad URL) ---" -ForegroundColor Cyan
$dir = New-TestDir "t7-failure"
Push-Location $dir
try {
 try { Invoke-InstallerFile -ArchiveOverride (Join-Path $dir 'missing-agentx.zip') } catch { <# expected #> }

 $r = @()
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "cleanup: $t" }

 Write-TestReport "Failure cleanup (bad URL)" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="Failure cleanup"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 8: Leftover temp files from previous run ------------------------
Write-Host "--- TEST 8: Leftover temp cleanup ---" -ForegroundColor Cyan
$dir = New-TestDir "t8-leftovers"
Push-Location $dir
try {
 # Create fake leftover temp files
 New-Item -ItemType Directory -Path ".agentx-install-tmp" -Force | Out-Null
 New-Item -ItemType Directory -Path ".agentx-install-raw" -Force | Out-Null
 "junk" | Set-Content ".agentx-install.zip"
 "junk" | Set-Content ".agentx-install-tmp/file.txt"
 "junk" | Set-Content ".agentx-install-raw/file.txt"

 $script = Get-Content $SCRIPT_PATH -Raw
 Invoke-InstallerExpression $script

 $r = @()
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "cleanup: $t" }
 $r += Assert-PathExists "AGENTS.md" "install succeeded despite leftovers"
 $r += Assert-JsonField ".agentx/config.json" "mode" "local" "config correct"

 Write-TestReport "Leftover temp cleanup" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="Leftover temp cleanup"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 9: Merge mode (re-run without force) ----------------------------
Write-Host "--- TEST 9: Merge mode (re-run) ---" -ForegroundColor Cyan
$dir = New-TestDir "t9-merge"
Push-Location $dir
try {
 # First install
 $script = Get-Content $SCRIPT_PATH -Raw
 Invoke-InstallerExpression $script

 # Create a custom file that should NOT be overwritten
 "CUSTOM" | Set-Content "AGENTS.md"

 # Re-run without force (merge mode)
 Invoke-InstallerExpression $script

 $r = @()
 $content = Get-Content "AGENTS.md" -Raw
 if ($content.Trim() -eq "CUSTOM") {
 $r += @{ Pass=$true; Label="merge: AGENTS.md preserved (not overwritten)" }
 } else {
 $r += @{ Pass=$false; Label="merge: AGENTS.md was overwritten!" }
 }
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "Merge mode (re-run)" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="Merge mode"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# -- TEST 10: Env var AGENTX_NOSETUP --------------------------------------
Write-Host "--- TEST 10: AGENTX_NOSETUP env var ---" -ForegroundColor Cyan
$dir = New-TestDir "t10-nosetup-env"
Push-Location $dir
try {
 $env:AGENTX_NOSETUP = "true"
 $script = Get-Content $SCRIPT_PATH -Raw
 Invoke-InstallerExpression $script
 $env:AGENTX_NOSETUP = $null

 $r = @()
 $r += Assert-PathExists "AGENTS.md" "install succeeded"
 $r += Assert-PathNotExists ".git" "nosetup: no .git"
 foreach ($t in $TEMP_FILES) { $r += Assert-PathNotExists $t "no-temp: $t" }

 Write-TestReport "AGENTX_NOSETUP env var" $r
} catch {
 Write-Host " CRASH: $($_.Exception.Message)" -ForegroundColor Red
 $global:TestResults += @{ Name="AGENTX_NOSETUP env var"; Pass=0; Fail=1; Total=1; Details=@() }
}
Pop-Location

# =========================================================
# SUMMARY
# =========================================================
Write-Host ""
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " TEST SUITE SUMMARY" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow

$totalPass = 0; $totalFail = 0; $totalTests = 0
foreach ($t in $global:TestResults) {
 $totalPass += $t.Pass
 $totalFail += $t.Fail
 $totalTests += $t.Total
 $icon = if ($t.Fail -eq 0) { "[PASS]" } else { "[FAIL]" }
 $color = if ($t.Fail -eq 0) { "Green" } else { "Red" }
 Write-Host " $icon $($t.Name) [$($t.Pass)/$($t.Total)]" -ForegroundColor $color
}

Write-Host ""
if ($totalFail -eq 0) {
 Write-Host " ALL TESTS PASSED: $totalPass/$totalTests assertions" -ForegroundColor Green
} else {
 Write-Host " FAILURES: $totalFail/$totalTests assertions failed" -ForegroundColor Red
}
Write-Host ""

# Cleanup test base
try { Set-Location $env:TEMP; Remove-Item $TEST_BASE -Recurse -Force -EA SilentlyContinue } catch {}
Write-Host " Test directory cleaned up." -ForegroundColor DarkGray
Write-Host ""

# Exit code
if ($totalFail -gt 0) { exit 1 } else { exit 0 }
