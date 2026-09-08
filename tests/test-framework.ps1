#!/usr/bin/env pwsh
# AgentX Framework Self-Tests
# Verifies CLI, templates, workflows, and project structure
# Usage: pwsh tests/test-framework.ps1

$ErrorActionPreference = "Continue"
$script:pass = 0
$script:fail = 0
$script:root = Split-Path $PSScriptRoot -Parent
$script:pwshPath = (Get-Command pwsh -ErrorAction Stop).Source

function Assert-True($condition, $message) {
 if ($condition) {
 Write-Host " [PASS] $message" -ForegroundColor Green
 $script:pass++
 } else {
 Write-Host " [FAIL] $message" -ForegroundColor Red
 $script:fail++
 }
}

function Assert-FileExists($path, $label) {
 $fullPath = Join-Path $script:root $path
 Assert-True (Test-Path $fullPath) "$label exists ($path)"
}

function Assert-FileContains($path, $pattern, $label) {
 $fullPath = Join-Path $script:root $path
 if (Test-Path $fullPath) {
 $content = Get-Content $fullPath -Raw
 Assert-True ($content -match $pattern) "$label"
 } else {
 Assert-True $false "$label (file not found: $path)"
 }
}

function Assert-FileNotContains($path, $pattern, $label) {
 $fullPath = Join-Path $script:root $path
 if (Test-Path $fullPath) {
 $content = Get-Content $fullPath -Raw
 Assert-True ($content -notmatch $pattern) "$label"
 } else {
 Assert-True $false "$label (file not found: $path)"
 }
}

<#
.SYNOPSIS
  Start a process with individually-quoted arguments, drain stdout/stderr
  concurrently, and bound both the exit wait and the stream drain so this
  low-level runner cannot itself hang.

.DESCRIPTION
  ArgumentList.Add() quotes each argument independently; Start-Process
  -ArgumentList instead joins the array with a bare space, so one argument
  containing a space (e.g. this repo's own root under
  "C:\Piyush - Personal\...") silently splits into two.

  Draining stdout/stderr as async tasks before WaitForExit avoids the
  sequential-read deadlock (one stream can fill its OS pipe buffer while
  the other is still being read to completion).

  WaitForExit returning true only proves the tracked process itself
  exited: a descendant that inherited the redirected handles (common when
  a child spawns its own child without redirecting it) can keep the pipe
  open, so ReadToEndAsync would still block past this point. The drain
  below is therefore bounded by what remains of the same deadline instead
  of assumed to finish instantly.

  Kill($true) tears down the tracked process's descendant tree while it is
  still alive. After it exits, report a drain timeout without discovering
  or killing processes by a potentially reused parent PID.
#>
function Invoke-BoundedChildProcess {
 param(
 [Parameter(Mandatory)][string]$FilePath,
 [string[]]$ArgumentList = @(),
 [string]$WorkingDirectory = $script:root,
 [int]$TimeoutSeconds = 300
 )

 $psi = [System.Diagnostics.ProcessStartInfo]::new()
 $psi.FileName = $FilePath
 $psi.WorkingDirectory = $WorkingDirectory
 $psi.RedirectStandardOutput = $true
 $psi.RedirectStandardError = $true
 $psi.UseShellExecute = $false
 $psi.CreateNoWindow = $true
 foreach ($argument in $ArgumentList) { $psi.ArgumentList.Add($argument) }

 $deadline = [System.Diagnostics.Stopwatch]::StartNew()
 $process = [System.Diagnostics.Process]::Start($psi)
 try {
 # Kick off both drains as async tasks before any blocking wait so a full
 # pipe on either stream can never stall the child.
 $stdoutTask = $process.StandardOutput.ReadToEndAsync()
 $stderrTask = $process.StandardError.ReadToEndAsync()
 $exited = $process.WaitForExit($TimeoutSeconds * 1000)
 if (-not $exited) {
 $trackedProcessId = $process.Id
 try { $process.Kill($true) } catch { Write-Warning "Failed to stop timed-out process tree (PID ${trackedProcessId}): $_" }
 return [pscustomobject]@{
 TimedOut  = $true
 ProcessId = $trackedProcessId
 ExitCode  = $null
 StdOut    = if ($stdoutTask.IsCompleted) { $stdoutTask.Result } else { '<stdout still draining>' }
 StdErr    = if ($stderrTask.IsCompleted) { $stderrTask.Result } else { '<stderr still draining>' }
 }
 }

 # Bound the drain by whatever remains of the original deadline: a
 # descendant holding the inherited handle open must not be able to
 # block this call past the timeout it was given.
 $trackedProcessId = $process.Id
 $remainingMs = [Math]::Max(0, ($TimeoutSeconds * 1000) - $deadline.ElapsedMilliseconds)
 $drained = [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask), $remainingMs)
 if (-not $drained) {
 return [pscustomobject]@{
 TimedOut  = $true
 ProcessId = $trackedProcessId
 ExitCode  = $process.ExitCode
 StdOut    = if ($stdoutTask.IsCompleted) { $stdoutTask.Result } else { '<stdout still draining: a descendant likely holds the inherited handle open>' }
 StdErr    = if ($stderrTask.IsCompleted) { $stderrTask.Result } else { '<stderr still draining: a descendant likely holds the inherited handle open>' }
 }
 }
 return [pscustomobject]@{
 TimedOut  = $false
 ProcessId = $trackedProcessId
 ExitCode  = $process.ExitCode
 StdOut    = $stdoutTask.Result
 StdErr    = $stderrTask.Result
 }
 } finally {
 $process.Dispose()
 }
}

<#
.SYNOPSIS
  Run a sub-test *-behavior.ps1 script with a wall-clock bound so one hung
  sub-test cannot stall the whole framework run.

.DESCRIPTION
  This framework chains 20+ independent sub-test scripts; a single latent
  hang (pre-commit-gate-behavior.ps1's stdout/stderr deadlock once did this)
  blocked the whole suite with no diagnostic. Announces the sub-test before
  starting it, runs it via Invoke-BoundedChildProcess, and records a
  PASS/FAIL/TIMEOUT result.
#>
function Invoke-BoundedSubTest {
 param(
 [Parameter(Mandatory)][string]$RelativeScriptPath,
 [string]$Label,
 [string[]]$HostArguments = @(),
 [string[]]$ExtraArguments = @(),
 [int]$TimeoutSeconds = 300
 )

 $scriptPath = Join-Path $script:root $RelativeScriptPath
 Write-Host " [RUNNING] $Label..." -ForegroundColor DarkGray
 $result = Invoke-BoundedChildProcess -FilePath $script:pwshPath `
 -ArgumentList (@('-NoProfile') + $HostArguments + @('-File', $scriptPath) + $ExtraArguments) `
 -TimeoutSeconds $TimeoutSeconds

 if ($result.TimedOut) {
 Write-Host ($result.StdOut + $result.StdErr)
 Write-Host " [TIMEOUT] $Label did not finish its process and output capture within ${TimeoutSeconds}s (PID $($result.ProcessId))" -ForegroundColor Red
 Assert-True $false $Label
 return
 }
 if ($result.ExitCode -ne 0) { Write-Host ($result.StdOut + $result.StdErr) }
 Assert-True ($result.ExitCode -eq 0) $Label
}

<#
.SYNOPSIS
  Regression coverage for the argument-splitting bug that used to break every
  bounded sub-test invocation whenever the repository itself was checked out
  under a path containing a space.

.DESCRIPTION
  Start-Process -ArgumentList joins its array with a bare space, so a single
  argument containing a space silently splits into two; this repo's own
  root here ("C:\Piyush - Personal\...") already contains one, so the
  previous implementation failed every sub-test invocation with pwsh exit
  code 64. This manufactures its own spaced script path (so the regression
  is caught regardless of the checkout path) and also passes an argument
  that itself contains a space, asserting the exact value received back to
  prove ArgumentList.Add() -- not just path quoting -- keeps it intact.
#>
function Test-BoundedChildProcessHandlesSpacedPath {
 $fixtureDir = Join-Path ([IO.Path]::GetTempPath()) ("agentx bounded subtest fixture {0}" -f [guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
 try {
 $fixtureScript = Join-Path $fixtureDir "spaced script.ps1"
 Set-Content -LiteralPath $fixtureScript -Value 'param([string]$Marker) Write-Output "received:$Marker"; exit 0' -Encoding utf8
 $spacedArgument = 'value with spaces'
 $result = Invoke-BoundedChildProcess -FilePath $script:pwshPath `
 -ArgumentList @('-NoProfile', '-File', $fixtureScript, $spacedArgument) `
 -TimeoutSeconds 30
 Assert-True (-not $result.TimedOut) "bounded child process does not time out on a path containing a space"
 Assert-True ($result.ExitCode -eq 0) "bounded child process exits zero for a script whose own path contains a space"
 Assert-True ($result.StdOut.Trim() -eq "received:$spacedArgument") "bounded child process receives a space-containing argument intact and unsplit (expected 'received:$spacedArgument', got '$($result.StdOut.Trim())')"
 Set-Content -LiteralPath $fixtureScript -Value @'
param([string]$Marker)
if ($Marker -ne 'value with spaces' -or $args.Count -ne 0) {
    throw 'Host options leaked into script arguments or script arguments were split.'
}
$promptRejected = $false
try {
    Read-Host 'This prompt must be rejected by the noninteractive host' -ErrorAction Stop | Out-Null
} catch [System.Management.Automation.PSInvalidOperationException] {
    if ($_.FullyQualifiedErrorId -ne 'InvalidOperation,Microsoft.PowerShell.Commands.ReadHostCommand') { throw }
    $promptRejected = $true
}
if (-not $promptRejected) { throw 'The PowerShell host was interactive.' }
'@ -Encoding utf8
 Invoke-BoundedSubTest -RelativeScriptPath ([IO.Path]::GetRelativePath($script:root, $fixtureScript)) `
 -Label "bounded sub-test applies host options before the script and preserves script arguments" `
 -HostArguments @('-NonInteractive') -ExtraArguments @($spacedArgument) -TimeoutSeconds 30
 } finally {
 Remove-Item -LiteralPath $fixtureDir -Recurse -Force -ErrorAction SilentlyContinue
 }
}

<#
.SYNOPSIS
  Regression coverage for the stdout/stderr deadlock a sequential
  "read stdout to end, then read stderr" implementation would hit.

.DESCRIPTION
  Spawns a real child that writes far more to BOTH stdout and stderr than a
  single OS pipe buffer can hold. A sequential drain would deadlock as soon
  as the stream read second fills its buffer while the child blocks on that
  write and the parent is still blocked on the other stream.
  Invoke-BoundedChildProcess must complete well within its bound and return
  both streams in full, proving the concurrent drain -- not merely a
  generous timeout -- is what prevents the hang.
#>
function Test-BoundedChildProcessDrainsLargeOutputConcurrently {
 # ~1 MB on each stream, comfortably larger than any OS pipe buffer.
 $command = '$line = "x" * 500; for ($i = 0; $i -lt 2000; $i++) { Write-Output $line; [Console]::Error.WriteLine($line) }'
 $sw = [System.Diagnostics.Stopwatch]::StartNew()
 try {
 $result = Invoke-BoundedChildProcess -FilePath $script:pwshPath `
 -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', $command) `
 -TimeoutSeconds 30
 $sw.Stop()
 Assert-True ($sw.Elapsed.TotalSeconds -lt 30) "bounded child process with large stdout+stderr completes without hitting the bounded timeout"
 Assert-True (-not $result.TimedOut -and $result.ExitCode -eq 0) "bounded child process with large stdout+stderr exits zero"
 Assert-True ($result.StdOut.Length -ge 1000000) "bounded child process stdout is fully drained, not truncated (captured $($result.StdOut.Length) bytes)"
 Assert-True ($result.StdErr.Length -ge 1000000) "bounded child process stderr is fully drained, not truncated (captured $($result.StdErr.Length) bytes)"
 } catch {
 $sw.Stop()
 Assert-True $false "bounded child process with large stdout+stderr must not hang or be killed by the bounded timeout: $_"
 }
}

<#
.SYNOPSIS
  Regression coverage proving the child's real exit code is surfaced, not
  masked by an argument-parsing failure or a fixed sentinel value.
#>
function Test-BoundedChildProcessSurfacesNonZeroExit {
 $result = Invoke-BoundedChildProcess -FilePath $script:pwshPath `
 -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', 'exit 7') `
 -TimeoutSeconds 30
 Assert-True (-not $result.TimedOut) "bounded child process does not time out on a fast nonzero-exit script"
 Assert-True ($result.ExitCode -eq 7) "bounded child process surfaces the child's real nonzero exit code (got $($result.ExitCode))"
}

<#
.SYNOPSIS
  Regression coverage for the orphaned-descendant bug a parent-PID-only kill
  (Stop-Process -Id) would leave behind.

.DESCRIPTION
  Starts a spawner script that launches its own long-sleeping grandchild
  process and then hangs itself, so the bounded call times out on the
  spawner. Kill($true) must tear down the whole tree: after the timeout,
  the grandchild process -- whose pid the spawner records to a file before
  the spawner hangs -- must no longer exist. A kill that only stops the
  tracked top-level pid would leave that grandchild running indefinitely.
#>
function Test-BoundedChildProcessKillsDescendantTreeOnTimeout {
 $fixtureDir = Join-Path ([IO.Path]::GetTempPath()) ("agentx bounded subtest tree {0}" -f [guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
 try {
 $pidFile = Join-Path $fixtureDir 'grandchild.pid'
 $grandchildScript = Join-Path $fixtureDir 'grandchild.ps1'
 $spawnerScript = Join-Path $fixtureDir 'spawner.ps1'
 Set-Content -LiteralPath $grandchildScript -Value @'
param([string]$PidFile)
Set-Content -LiteralPath $PidFile -Value $PID
Start-Sleep -Seconds 120
'@ -Encoding utf8
 Set-Content -LiteralPath $spawnerScript -Value @'
param([string]$PidFile, [string]$GrandchildScript)
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = (Get-Process -Id $PID).Path
$psi.ArgumentList.Add('-NoProfile')
$psi.ArgumentList.Add('-File')
$psi.ArgumentList.Add($GrandchildScript)
$psi.ArgumentList.Add($PidFile)
$psi.UseShellExecute = $false
[void][System.Diagnostics.Process]::Start($psi)
Start-Sleep -Seconds 120
'@ -Encoding utf8

 $result = Invoke-BoundedChildProcess -FilePath $script:pwshPath `
 -ArgumentList @('-NoProfile', '-File', $spawnerScript, $pidFile, $grandchildScript) `
 -TimeoutSeconds 5

 Assert-True $result.TimedOut "bounded child process reports timeout for a deliberately hung spawner"

 $grandchildPid = $null
 $deadline = (Get-Date).AddSeconds(10)
 while (-not $grandchildPid -and (Get-Date) -lt $deadline) {
 if (Test-Path -LiteralPath $pidFile) { $grandchildPid = (Get-Content -LiteralPath $pidFile -Raw).Trim() }
 else { Start-Sleep -Milliseconds 200 }
 }
 Assert-True ([bool]$grandchildPid) "spawner's grandchild recorded its pid before the spawner was killed"
 if ($grandchildPid) {
 $stillRunning = $null
 $stillRunning = Get-Process -Id ([int]$grandchildPid) -ErrorAction SilentlyContinue
 Assert-True (-not $stillRunning) "bounded timeout kill tears down the spawner's descendant tree, not only the tracked top-level pid (grandchild PID $grandchildPid)"
 }
 } finally {
 # Belt-and-suspenders: if Kill($true) somehow failed the assertion above,
 # do not leave a 120s sleeper running regardless.
 if ($grandchildPid) { Stop-Process -Id ([int]$grandchildPid) -Force -ErrorAction SilentlyContinue }
 Remove-Item -LiteralPath $fixtureDir -Recurse -Force -ErrorAction SilentlyContinue
 }
}

<#
.SYNOPSIS
 Regression coverage proving a descendant that inherits the redirected
 stdout/stderr handles cannot make this call hang past its own timeout.

.DESCRIPTION
 A spawner starts a grandchild without redirecting the grandchild's own
 streams, so the grandchild inherits the spawner's (i.e. the tracked
 process's) stdout/stderr handles, then the spawner exits immediately.
 WaitForExit therefore returns true almost instantly, but the pipes stay
 open -- and ReadToEndAsync would still block -- until the sleeping
 grandchild also exits and releases its inherited copy. This proves the
 call still reports TimedOut and returns near its own bound instead of
 blocking for the grandchild's full sleep.
#>
function Test-BoundedChildProcessDetectsInheritedHandleHang {
 $fixtureDir = Join-Path ([IO.Path]::GetTempPath()) ("agentx bounded subtest handle {0}" -f [guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
 $grandchildPidFile = Join-Path $fixtureDir 'grandchild.pid'
 $grandchildPid = $null
 try {
 $spawnerScript = Join-Path $fixtureDir 'spawner.ps1'
 # No redirection on the grandchild's own ProcessStartInfo: it inherits
 # the spawner's (tracked process's) stdout/stderr handles. The spawner
 # exits right after starting it -- no sleep of its own.
 Set-Content -LiteralPath $spawnerScript -Value @'
param([string]$PidFile)
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = (Get-Process -Id $PID).Path
$psi.ArgumentList.Add('-NoProfile')
$psi.ArgumentList.Add('-Command')
$psi.ArgumentList.Add("Set-Content -LiteralPath '$PidFile' -Value `$PID; Start-Sleep -Seconds 60")
$psi.UseShellExecute = $false
[void][System.Diagnostics.Process]::Start($psi)
'@ -Encoding utf8

 $sw = [System.Diagnostics.Stopwatch]::StartNew()
 $result = Invoke-BoundedChildProcess -FilePath $script:pwshPath `
 -ArgumentList @('-NoProfile', '-File', $spawnerScript, $grandchildPidFile) `
 -TimeoutSeconds 8
 $sw.Stop()

 $deadline = (Get-Date).AddSeconds(10)
 while (-not $grandchildPid -and (Get-Date) -lt $deadline) {
 if (Test-Path -LiteralPath $grandchildPidFile) { $grandchildPid = (Get-Content -LiteralPath $grandchildPidFile -Raw).Trim() }
 else { Start-Sleep -Milliseconds 200 }
 }

 Assert-True ($sw.Elapsed.TotalSeconds -lt 20) "bounded child process does not block past its own timeout when a descendant inherits its stdout/stderr handles (elapsed $([Math]::Round($sw.Elapsed.TotalSeconds, 1))s, bound 8s)"
 Assert-True $result.TimedOut "bounded child process reports TimedOut instead of hanging when a live descendant still holds the inherited stream handles open"
 } finally {
 if ($grandchildPid -and (Get-Process -Id ([int]$grandchildPid) -ErrorAction SilentlyContinue)) {
 Stop-Process -Id ([int]$grandchildPid) -Force -ErrorAction SilentlyContinue
 }
 Remove-Item -LiteralPath $fixtureDir -Recurse -Force -ErrorAction SilentlyContinue
 }
}

Write-Host ""
Write-Host " AgentX Framework Self-Tests" -ForegroundColor Cyan
Write-Host " ================================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Core Files ----------------------------------------------------------------------
Write-Host " 1. Core Files" -ForegroundColor White

Assert-FileExists "AGENTS.md" "AGENTS.md"
Assert-FileExists "Skills.md" "Skills.md"
Assert-FileExists "README.md" "README.md"
Assert-FileExists "install.ps1" "install.ps1"
Assert-FileExists "install.sh" "install.sh"
Assert-FileExists "LICENSE" "LICENSE"
Assert-FileContains "install.ps1" '"LICENSE"' "PowerShell installer extracts the AgentX license"
Assert-FileContains "install.ps1" '"NOTICE"' "PowerShell installer extracts repository notices"
Assert-FileContains "install.sh" '\$PREFIX/LICENSE' "Bash installer extracts the AgentX license"
Assert-FileContains "install.sh" '\$PREFIX/NOTICE' "Bash installer extracts repository notices"
Assert-FileContains ".agentx/mcp-server/package.json" '"license": "Apache-2\.0"' "MCP package declares the AgentX Apache license"
Assert-FileContains ".github/workflows/auto-release.yml" 'cp LICENSE NOTICE release-staging/mcp/' "Auto release stages MCP legal files"
Assert-FileContains ".github/workflows/recover-release.yml" 'cp LICENSE NOTICE release-staging/mcp/' "Recovery release stages MCP legal files"
Assert-FileContains "install.ps1" "docs/WORKFLOW\.md" "install.ps1 bundles WORKFLOW reference doc"
Assert-FileContains "install.ps1" "docs/GUIDE\.md" "install.ps1 bundles GUIDE reference doc"
Assert-FileContains "install.sh" "docs/WORKFLOW\.md" "install.sh bundles WORKFLOW reference doc"
Assert-FileContains "install.sh" "docs/GUIDE\.md" "install.sh bundles GUIDE reference doc"
Assert-FileContains "install.ps1" "runtimeStatePatterns" "install.ps1 excludes repo runtime state from fresh installs"
Assert-FileContains "install.sh" "\.agentx/config\.json|\.agentx/issues/\*|\.agentx/state/\*" "install.sh excludes repo runtime state from fresh installs"
Assert-FileContains "install.ps1" "templates/memories" "install.ps1 seeds starter memory templates"
Assert-FileContains "install.sh" "templates/memories" "install.sh seeds starter memory templates"
Assert-FileContains "packs/agentx-copilot-cli/install.ps1" "Get-PackInstallPlan" "Copilot CLI installer builds an install plan from the pack manifest"
Assert-FileContains "packs/agentx-copilot-cli/install.ps1" "Loaded install plan from manifest\.json" "Copilot CLI installer reports manifest-driven planning"
Assert-FileContains "packs/agentx-copilot-cli/manifest.json" '"schemas"' "Copilot CLI manifest declares schema artifacts"
Assert-FileContains "packs/agentx-core/manifest.json" "scripts/score-code-quality.ps1" "Core pack declares code-quality evaluator"
Assert-FileContains "packs/agentx-core/manifest.json" "evaluation/rubrics/code-quality.md" "Core pack declares code-quality rubric"
Assert-FileContains ".agentx/mcp-server/package.json" "412e40abd4eb8beabfb952d80abf949a2baf27a3" "MCP runtime pins the patched fast-uri commit"
Assert-FileContains ".agentx/mcp-server/package-lock.json" '"version": "3\.1\.7"' "MCP lock resolves the patched fast-uri version"
Assert-FileNotContains ".agentx/mcp-server/package-lock.json" "pkgs\.visualstudio\.com|ms-feed-" "MCP lock contains no private registry URLs"
Assert-FileContains ".agentx/mcp-server/index.js" "risk-based 1/2/3/5 iteration minimum" "MCP completion metadata describes risk-based iteration floors"
Assert-FileContains "scripts/stamp-version.js" "docs/GUIDE\.md" "version stamper updates published installation guide"
Assert-FileContains "scripts/stamp-version.js" "preflightLiteralFile\('docs/GUIDE\.md', guideInstallerUrlEdits\)" "version stamper preflights guide installer URLs"
Assert-FileContains "scripts/stamp-version.js" "preflightLiteralFile\('install\.ps1', powershellInstallerUrlEdits\)" "version stamper preflights PowerShell installer URLs"
Assert-FileContains "scripts/stamp-version.js" "preflightLiteralFile\('install\.sh', bashInstallerUrlEdits\)" "version stamper preflights bash installer URLs"
Assert-FileContains "scripts/stamp-version.js" "updateLiteralFile\('docs/GUIDE\.md', guideInstallerUrlEdits\)" "version stamper rewrites guide installer URLs as exact literals"
Assert-FileContains "scripts/stamp-version.js" "updateLiteralFile\('install\.ps1', powershellInstallerUrlEdits\)" "version stamper rewrites PowerShell installer URLs as exact literals"
Assert-FileContains "scripts/stamp-version.js" "updateLiteralFile\('install\.sh', bashInstallerUrlEdits\)" "version stamper rewrites bash installer URLs as exact literals"
Assert-FileNotContains "scripts/stamp-version.js" "pattern:\s*/raw\\\.githubusercontent" "version stamper has no unanchored installer URL regex"
Assert-FileContains "scripts/stamp-version.js" "stampMcpPackage\(targetVersion\)" "version stamper updates MCP package and server metadata"
Assert-FileContains "scripts/stamp-version.js" "landing page release version" "version stamper updates the public landing page"
Assert-FileContains "scripts/stamp-version.js" "install-user\.ps1" "version stamper updates user-level PowerShell installer"
Assert-FileContains "scripts/stamp-version.js" "install-user\.sh" "version stamper updates user-level bash installer"
$stampVersionOutput = & node (Join-Path $script:root "tests/stamp-version-behavior.js") 2>&1
Assert-True ($LASTEXITCODE -eq 0) "version stamper supports LF and CRLF package locks"
if ($LASTEXITCODE -ne 0) {
 $stampVersionOutput | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
}
Assert-FileContains "scripts/stamp-package-version.js" "serverPattern" "MCP version stamper updates reported server identity"
Assert-FileContains "scripts/stamp-package-version.js" "' },\)" "MCP version stamper matches the server declaration comma"
Assert-FileContains ".github/workflows/auto-release.yml" "diff-tree --root --no-commit-id --name-only -r -m" "auto-release detects stamped versions in merge commits"
Assert-FileContains ".github/workflows/auto-release.yml" "release-preflight:" "auto-release defines a pre-release validation job"
Assert-FileContains ".github/workflows/auto-release.yml" "create-release:\r?\n\s+needs: \[detect-version-bump, release-preflight\]" "auto-release gates release creation on preflight"
Assert-FileContains ".github/workflows/auto-release.yml" "needs\.detect-version-bump\.result == 'success'" "auto-release fails closed when version detection fails"
Assert-FileContains ".github/workflows/auto-release.yml" "Validate extension before release creation" "auto-release validates extension before tagging"
Assert-FileContains ".github/workflows/auto-release.yml" "npm run test:coverage" "auto-release preflight enforces extension coverage"
Assert-FileContains ".github/workflows/auto-release.yml" "Validate MCP before release creation" "auto-release validates MCP before tagging"
Assert-FileContains ".github/workflows/auto-release.yml" "npm run audit:runtime" "auto-release preflight enforces the MCP audit"
Assert-FileContains ".github/workflows/publish-marketplace.yml" "VSIX identity mismatch" "Marketplace publish validates VSIX manifest identity"
Assert-FileContains ".github/workflows/publish-marketplace.yml" 'VSIX_FILE="agentx-\$\{EXPECTED_VERSION\}\.vsix"' "Marketplace publish selects the exact versioned VSIX"
Assert-FileContains ".github/workflows/quality-gates.yml" "node tests/stamp-version-behavior.js" "PR quality gates run version stamper regression coverage"
Assert-FileContains ".github/workflows/quality-gates.yml" "Documentation Drift Gate" "PR quality gates run the consolidated documentation drift gate"
Assert-FileContains ".github/workflows/quality-gates.yml" "pwsh -NoProfile -NonInteractive -File \./scripts/check-doc-drift\.ps1" "PR quality gates launch the documentation drift checker in a native child PowerShell process"
Assert-FileContains ".github/workflows/quality-gates.yml" "PolicyPath \.github/documentation-facts\.json" "PR quality gates require the explicit documentation facts policy"
Assert-FileContains ".github/workflows/quality-gates.yml" "tests/doc-drift-behavior\.ps1" "PR quality gates run documentation drift regression coverage"
Assert-FileNotContains ".github/workflows/quality-gates.yml" "(?m)^\s*-\s+name:\s+(Check Documentation|Reference Link Validation|Doc Count Validation)\s*$" "PR quality gates removed legacy duplicated documentation steps"
Assert-FileContains ".github/workflows/weekly-status.yml" "steps\.tokens\.outcome" "weekly status reports canonical token-check outcome"
Assert-FileContains ".github/workflows/weekly-status.yml" "continue-on-error: true" "weekly status continues after token violations to generate the report"
Assert-FileContains "packs/agentx-power-platform-builder/templates/SOLUTION-MANIFEST-TEMPLATE.md" '```xml' "Power Platform solution manifest uses a fenced XML block"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "validate-skill.ps1" "extension bundles canonical skill validator"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "validate-changed-skills.ps1" "extension bundles changed-skill no-regression validator"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "skill-quality.md" "extension bundles skill-quality rubric"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "score-code-quality.ps1" "extension bundles code-quality evaluator"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "code-quality.md" "extension bundles code-quality rubric"
Assert-FileContains "vscode-extension/scripts/copy-assets.js" "scripts/node_modules/yaml" "extension bundles skill rubric YAML runtime"
Assert-FileExists "vscode-extension/.github/agentx/.github/hooks/pre-commit" "extension bundles pre-commit hook source"
Assert-FileExists "vscode-extension/.github/agentx/.github/hooks/commit-msg" "extension bundles commit-msg hook source"
Assert-FileExists "vscode-extension/.github/agentx/.github/hooks/post-commit" "extension bundles post-commit hook source"
Assert-FileExists "vscode-extension/.github/agentx/AGENT-PROTOCOL.md" "extension bundles the canonical protocol referenced by bundled agents"
Assert-FileContains "vscode-extension/src/runtime/index.ts" "DEFAULT_HIGH_RISK_MIN_ITERATIONS" "runtime barrel exports every task-class minimum constant"
Assert-FileContains "scripts/stocktake.ps1" "-Json" "stocktake consumes canonical rubric JSON"
Assert-FileContains "scripts/stocktake.ps1" "/100" "stocktake reports 100-point skill scores"
Assert-FileExists ".agentx/templates/memories/conventions.md" "Starter memory: conventions"
Assert-FileExists ".agentx/templates/memories/pitfalls.md" "Starter memory: pitfalls"
Assert-FileExists ".agentx/templates/memories/decisions.md" "Starter memory: decisions"

# --- 2. Agent Definitions ---------------------------------------------------------------
Write-Host ""
Write-Host " 2. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "ux-designer", "devops", "reviewer-auto", "data-scientist", "tester", "fabric-engineer", "power-platform-builder", "consulting-research", "powerbi-analyst")
foreach ($agent in $agents) {
 Assert-FileExists ".github/agents/$agent.agent.md" "Agent: $agent"
}

# --- 3. Templates -----------------------------------------------------------------------
Write-Host ""
Write-Host " 3. Templates" -ForegroundColor White

$templates = @("PRD-TEMPLATE.md", "ADR-TEMPLATE.md", "SPEC-TEMPLATE.md", "UX-TEMPLATE.md", "REVIEW-TEMPLATE.md", "PROGRESS-TEMPLATE.md", "SECURITY-PLAN-TEMPLATE.md")
foreach ($tpl in $templates) {
 Assert-FileExists ".github/templates/$tpl" "Template: $tpl"
}

# AI-First template sections
Assert-FileContains ".github/templates/PRD-TEMPLATE.md" "AI/ML Requirements" "PRD has AI/ML Requirements section"
Assert-FileContains ".github/templates/ADR-TEMPLATE.md" "AI/ML Architecture" "ADR has AI/ML Architecture section"
Assert-FileContains ".github/templates/SPEC-TEMPLATE.md" "AI/ML Specification" "SPEC has AI/ML Specification section"

# --- 4. Agent Definitions ----------------------------------------------------------------
Write-Host ""
Write-Host " 4. Agent Definitions" -ForegroundColor White

$agents = @("agent-x", "product-manager", "architect", "engineer", "reviewer", "reviewer-auto", "ux-designer", "devops", "data-scientist", "tester", "fabric-engineer", "power-platform-builder", "powerbi-analyst", "consulting-research")
foreach ($ag in $agents) {
 Assert-FileExists ".github/agents/$ag.agent.md" "Agent: $ag"
}

# Verify agent frontmatter structure
Assert-FileContains ".github/agents/engineer.agent.md" "description:" "engineer.agent.md has description"
Assert-FileContains ".github/agents/engineer.agent.md" "model:" "engineer.agent.md has model"
Assert-FileContains ".github/agents/fabric-engineer.agent.md" "type:fabric" "Fabric Engineer declares type:fabric trigger"
Assert-FileContains ".github/agents/fabric-engineer.agent.md" "AgentX Power BI Analyst" "Fabric Engineer preserves Power BI handoff"
Assert-FileContains ".github/agents/power-platform-builder.agent.md" "type:lowcode" "Power Platform Builder declares type:lowcode trigger"
Assert-FileContains ".github/agents/power-platform-builder.agent.md" "MUST NOT call pac auth" "Power Platform Builder forbids tenant authentication"

# --- 5. CLI -----------------------------------------------------------------------------
Write-Host ""
Write-Host " 5. CLI" -ForegroundColor White

# Prove the bounded sub-test process runner itself is trustworthy before
# relying on its PASS/FAIL verdicts for the 25+ real sub-tests below.
Test-BoundedChildProcessHandlesSpacedPath
Test-BoundedChildProcessDrainsLargeOutputConcurrently
Test-BoundedChildProcessSurfacesNonZeroExit
Test-BoundedChildProcessKillsDescendantTreeOnTimeout
Test-BoundedChildProcessDetectsInheritedHandleHang

Assert-FileExists ".agentx/agentx.ps1" "CLI launcher exists"
Assert-FileExists ".agentx/agentx-cli.ps1" "CLI implementation exists"
Assert-FileExists ".agentx/agentx.sh" "Bash CLI launcher exists"
Assert-FileExists ".agentx/agentic-runner.ps1" "CLI agentic loop runner exists"

# Test CLI commands exist in the implementation file
$cliCommands = @("ready", "state", "deps", "digest", "workflow", "hook", "policy-hook", "version", "run", "loop", "validate", "config", "issue", "bundle", "parallel", "backlog-sync", "hire", "watch")
foreach ($cmd in $cliCommands) {
 Assert-FileContains ".agentx/agentx-cli.ps1" "'$cmd'" "CLI supports: $cmd"
}

# Agentic runner has tool definitions
Assert-FileContains ".agentx/agentic-runner.ps1" "Invoke-AgenticLoop" "Agentic runner has main loop function"
Assert-FileContains ".agentx/agentic-runner.ps1" "file_read" "Agentic runner has file_read tool"
Assert-FileContains ".agentx/agentic-runner.ps1" "Autonomous terminal execution is disabled" "Agentic runner blocks autonomous terminal execution"
Assert-FileContains ".agentx/agentx-cli.ps1" "SetUnixFileMode" "Hook installer sets POSIX executable permissions"
Assert-FileContains ".agentx/agentx-cli.ps1" "GroupExecute" "Hook installer verifies group executable permission"
Assert-FileContains ".agentx/agentx-cli.ps1" "OtherExecute" "Hook installer verifies other executable permission"
Assert-FileContains ".agentx/agentic-runner.ps1" "Copilot" "Agentic runner supports Copilot API"
Assert-FileExists "tests/provider-behavior.ps1" "Provider behavior test script"
Assert-FileExists "tests/task-bundle-behavior.ps1" "Task bundle behavior test script"
Assert-FileExists "tests/bounded-parallel-behavior.ps1" "Bounded parallel behavior test script"
Assert-FileExists "tests/harness-audit-behavior.ps1" "Harness audit behavior test script"
Assert-FileExists "tests/agentic-runner-behavior.ps1" "Agentic runner behavior test script"
Assert-FileExists "tests/sprint-discover-behavior.ps1" "Sprint/discover behavior test script"
Assert-FileExists "tests/loop-parity-behavior.ps1" "Loop parity behavior test script"
Assert-FileExists "tests/pre-commit-gate-behavior.ps1" "Pre-commit gate behavior test script"
Assert-FileExists "tests/skill-rubric-behavior.ps1" "Skill rubric behavior test script"
Assert-FileExists "tests/registry-generation-behavior.ps1" "Registry generation behavior test script"
Assert-FileExists "tests/prompt-contract-behavior.ps1" "Reusable prompt contract test script"
Assert-FileExists "tests/council-brief-behavior.ps1" "Council brief contract test script"
Assert-FileExists "tests/code-quality-rubric-behavior.ps1" "Code-quality rubric behavior test script"
Assert-FileExists "tests/ai-agent-scaffold-behavior.ps1" "AI agent scaffold behavior test script"
Assert-FileExists "tests/customization-modernization-behavior.ps1" "Customization modernization behavior test script"
Assert-FileExists "tests/policy-hook-behavior.ps1" "Policy hook behavior test script"
Assert-FileExists "tests/token-budget-behavior.ps1" "Token budget behavior test script"
Assert-FileExists "tests/token-budget-ci-behavior.ps1" "Token budget CI execution test script"
Assert-FileExists "tests/model-route-behavior.ps1" "Model route behavior test script"
Assert-FileExists "tests/budget-behavior.ps1" "Budget behavior test script"
Assert-FileExists "tests/copilot-host-compatibility-behavior.ps1" "Copilot host compatibility behavior test script"
Assert-FileExists "tests/harness-distribution-behavior.ps1" "Harness distribution behavior test script"
Assert-FileExists "tests/installer-license-behavior.ps1" "Installer license behavior test script"
Assert-FileExists "tests/doc-drift-behavior.ps1" "Documentation drift behavior test script"
Assert-FileExists "tests/doc-drift-ci-behavior.ps1" "Documentation drift CI execution test script"
Assert-FileExists "tests/template-content-behavior.ps1" "Template content behavior test script"

Invoke-BoundedSubTest -RelativeScriptPath "tests/provider-behavior.ps1" -Label "Provider CLI behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/task-bundle-behavior.ps1" -Label "Task bundle CLI behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/bounded-parallel-behavior.ps1" -Label "Bounded parallel CLI behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/harness-audit-behavior.ps1" -Label "Harness audit CLI behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/agentic-runner-behavior.ps1" -Label "Agentic runner behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/sprint-discover-behavior.ps1" -Label "Sprint/discover CLI behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/loop-parity-behavior.ps1" -Label "Loop parity behavior tests pass"

# This sub-test drives the real CLI through several sequential invocations
# and spawns bash + git per fixture; it is the heaviest sub-test in the
# framework, so it gets a wider bound than the shared default.
# The successful standalone run spanned 903s; allow headroom without unbounding the suite.
Invoke-BoundedSubTest -RelativeScriptPath "tests/pre-commit-gate-behavior.ps1" -Label "Pre-commit gate behavior tests pass" -TimeoutSeconds 1200

Invoke-BoundedSubTest -RelativeScriptPath "tests/token-budget-behavior.ps1" -Label "Token budget behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/token-budget-ci-behavior.ps1" -Label "Token budget CI execution tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/model-route-behavior.ps1" -Label "Model route behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/budget-behavior.ps1" -Label "Budget behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/skill-rubric-behavior.ps1" -Label "Skill rubric behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/registry-generation-behavior.ps1" -Label "Registry generation behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/prompt-contract-behavior.ps1" -Label "Reusable prompt contract tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/council-brief-behavior.ps1" -Label "Council brief contract tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/code-quality-rubric-behavior.ps1" -Label "Code-quality rubric behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/doc-drift-behavior.ps1" -Label "Documentation drift behavior tests pass" -HostArguments @('-NonInteractive')

Invoke-BoundedSubTest -RelativeScriptPath "tests/doc-drift-ci-behavior.ps1" -Label "Documentation drift CI execution tests pass" -HostArguments @('-NonInteractive')

Invoke-BoundedSubTest -RelativeScriptPath "tests/no-ai-slop-skill-behavior.ps1" -Label "No AI Slop skill behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/ai-agent-scaffold-behavior.ps1" -Label "AI agent scaffold behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/customization-modernization-behavior.ps1" -Label "Customization modernization behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/policy-hook-behavior.ps1" -Label "Policy hook behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/copilot-host-compatibility-behavior.ps1" -Label "Copilot host compatibility behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/harness-distribution-behavior.ps1" -Label "Harness distribution behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/installer-license-behavior.ps1" -Label "Installer license behavior tests pass"

Invoke-BoundedSubTest -RelativeScriptPath "tests/template-content-behavior.ps1" -Label "Template content behavior tests pass"

# --- 6. Skills --------------------------------------------------------------------------
Write-Host ""
Write-Host " 6. Skills" -ForegroundColor White

$skillCount = (Get-ChildItem -Path (Join-Path $script:root ".github/skills") -Recurse -Filter "SKILL.md").Count
Assert-True ($skillCount -ge 35) "At least 35 skills exist (found: $skillCount)"

# Verify AI skill exists
Assert-FileExists ".github/skills/ai-systems/ai-agent-development/SKILL.md" "AI Agent Development skill"

# Verify Skills.md count matches
Assert-FileContains "Skills.md" "$skillCount skills across" "Skills.md skill count matches actual ($skillCount)"

# Verify Impeccable integration contract
Assert-FileExists ".github/skills/design/impeccable-integration/SKILL.md" "Impeccable integration skill"
Assert-FileContains ".github/skills/design/impeccable-integration/SKILL.md" 'name: "impeccable-integration"' "Impeccable bridge does not collide with upstream skill name"
Assert-FileContains ".github/skills/design/impeccable-integration/SKILL.md" "agentx design-language check -Path src -Json" "Impeccable detector uses the verified target-local native gate"
Assert-FileNotContains ".github/skills/design/impeccable-integration/SKILL.md" '(?m)^\s*(?:\$\s*)?npx\s+impeccable' "Impeccable integration has no executable bare npx command"
Assert-FileContains ".github/agents/ux-designer.agent.md" "Read PRD -> Design Language -> Design Research" "UX Designer runs design language before design research"
Assert-FileContains ".github/skills/design/prototype-audit/SKILL.md" "Pass 0: Design-language conformance" "Prototype audit runs deterministic design-language pass first"
Assert-FileContains ".github/skills/design/prototype-audit/SKILL.md" 'references/report-template\.md' "Prototype audit routes to its output contract"
Assert-FileContains ".github/skills/design/prototype-audit/references/report-template.md" '- Status: PASS \| FIXED \| BLOCKED \| DEGRADED' "Prototype audit output supports the DEGRADED state"
Assert-FileContains ".github/skills/design/prototype-audit/SKILL.md" 'Each pass gets at most three fix cycles' "Prototype audit retains its bounded repair loop"
Assert-FileNotContains ".github/skills/design/prototype-audit/SKILL.md" "See the impeccable skill" "Prototype audit references the renamed integration explicitly"
Assert-FileContains ".github/skills/design/anti-slop/SKILL.md" "T2, T3, T8, T10" "Anti-slop retains AgentX-only fabrication and emoji tells"
Assert-FileContains "NOTICE" "\.github/skills/design/impeccable-integration/SKILL\.md" "NOTICE points to the Impeccable integration skill"
Assert-FileNotContains "NOTICE" "\.github/skills/design/impeccable/SKILL\.md" "NOTICE has no stale Impeccable skill path"
Assert-FileContains "Skills.md" "Prototype Build\|impeccable-integration->" "Prototype workflow uses the non-colliding Impeccable integration id"
Assert-FileContains "vscode-extension/.github/Skills.md" "Prototype Build\|impeccable-integration->" "Bundled prototype workflow uses the non-colliding integration id"
Assert-FileContains ".github/templates/UX-TEMPLATE.md" "## 0\. Design Language" "UX template records design language before design work"
Assert-FileContains ".github/templates/UX-TEMPLATE.md" "Detector Status.*PASS \| BLOCKED \| DEGRADED" "UX template records detector or fallback status"
Assert-FileContains ".github/templates/UX-TEMPLATE.md" '(?s)Required fallback checks \| T1-T10 \+ Honest Placeholders \+ axe \+ Pass 9 critique.*?Actually run.*?Not run' "UX template separates required DEGRADED checks from execution evidence"
Assert-FileContains ".github/skills/design/impeccable-integration/SKILL.md" '(?s)If `DEGRADED`, require T1-T10 \+ Honest Placeholders \+ axe \+ Pass 9 critique.*?actually ran.*?did not' "Impeccable root requires complete fallback checks and honest execution evidence"
Assert-FileContains ".github/skills/design/impeccable-integration/references/details-detector-governance.md" '(?s)Required fallback checks: T1-T10 \+ Honest Placeholders \+ axe \+ Pass 9 critique.*?Actually run:.*?Not run:' "Impeccable output contract records required, executed and unavailable checks"
Assert-FileContains ".github/agents/ux-designer.agent.md" "PRODUCT.md and DESIGN.md are cited" "UX exit gate requires design-language evidence"
Assert-FileExists "vscode-extension/.github/agentx/skills/design/impeccable-integration/SKILL.md" "Bundled Impeccable integration skill"
Assert-FileContains "vscode-extension/package.json" "\.github/agentx/skills/design/impeccable-integration/SKILL\.md" "VS Code contributes the Impeccable integration skill"
$prototypeAuditScoreJson = & pwsh -NoProfile -File (Join-Path $script:root "scripts/score-skill.ps1") -SkillPath (Join-Path $script:root ".github/skills/design/prototype-audit/SKILL.md") -Json 2>$null | Out-String
$prototypeAuditScore = $prototypeAuditScoreJson | ConvertFrom-Json -Depth 20
Assert-True ($LASTEXITCODE -eq 0 -and @($prototypeAuditScore.skills)[0].blockers.Count -eq 0) "Prototype audit frontmatter passes the real YAML-backed skill scorer"

# Verify new skills and instructions
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/SKILL.md" "Cognitive Architecture skill"
Assert-FileExists ".github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py" "Cognitive scaffold script"
Assert-FileExists ".github/instructions/typescript.instructions.md" "TypeScript instruction file"
Assert-FileExists ".github/skills/infrastructure/terraform/SKILL.md" "Terraform skill"
Assert-FileExists ".github/skills/infrastructure/bicep/SKILL.md" "Bicep skill"

# Verify enterprise validation
Assert-FileExists "scripts/validate-frontmatter.ps1" "Frontmatter validation script"
Assert-FileExists ".github/schemas/instruction-frontmatter.schema.json" "Instruction schema"
Assert-FileExists ".github/schemas/agent-frontmatter.schema.json" "Agent schema"
Assert-FileExists ".github/schemas/skill-frontmatter.schema.json" "Skill schema"
Assert-FileExists ".github/workflows/scorecard.yml" "OpenSSF Scorecard workflow"
Assert-FileContains "scripts/score-output.ps1" "\*\.ps1" "score-output includes PowerShell files in engineer scoring checks"
Assert-FileContains "scripts/score-output.ps1" "\*\.test\.ts','\*\.spec\.ts','\*\.ps1" "score-output includes PowerShell tests in engineer coverage proxy"

# --- 7. AI-First Intent Preservation ----------------------------------------------------
Write-Host ""
Write-Host " 7. AI-First Intent Preservation" -ForegroundColor White

# Agent X has domain classification
Assert-FileContains ".github/agents/agent-x.agent.md" "## Domain Detection" "Agent X has domain classification"
Assert-FileContains ".github/agents/agent-x.agent.md" "needs:ai" "Agent X detects AI domain"
Assert-FileContains ".github/agents/agent-x.agent.md" "## PRD Intent Validation" "Agent X validates PRD intent"

# PM has AI domain classification step
Assert-FileContains ".github/agents/product-manager.agent.md" "Classify Domain Intent" "PM has domain classification step"
Assert-FileContains ".github/agents/product-manager.agent.md" "ai-agent-development/SKILL.md" "PM references AI skill"

# Architect has AI-aware research
Assert-FileContains ".github/agents/architect.agent.md" "AI-first assessment" "Architect has AI-aware research step"
Assert-FileContains ".github/agents/architect.agent.md" "aitk_get_ai_model_guidance" "Architect uses AITK tools"

# Engineer has AI implementation setup
Assert-FileContains ".github/agents/engineer.agent.md" "For GenAI features" "Engineer has AI implementation step"
Assert-FileContains ".github/agents/engineer.agent.md" "Store all system prompts as separate files" "Engineer uses current GenAI implementation guidance"

# Reviewer has intent preservation check
Assert-FileContains ".github/agents/reviewer.agent.md" "Intent Preservation" "Reviewer has intent preservation check"
Assert-FileContains ".github/agents/reviewer.agent.md" "Reject path" "Reviewer rejects intent violations"

# --- 8. GitHub Actions ------------------------------------------------------------------
Write-Host ""
Write-Host " 8. GitHub Actions" -ForegroundColor White

Assert-FileExists ".github/workflows/agent-x.yml" "agent-x.yml workflow"
Assert-FileExists ".github/workflows/quality-gates.yml" "quality-gates.yml workflow"
Assert-FileExists "azure-pipelines.yml" "azure-pipelines.yml pipeline"

# --- 9. Hooks & Scripts -----------------------------------------------------------------
Write-Host ""
Write-Host " 9. Hooks & Scripts" -ForegroundColor White

Assert-FileExists ".github/hooks/pre-commit" "pre-commit hook"
Assert-FileExists ".github/hooks/commit-msg" "commit-msg hook"
Assert-FileExists ".github/hooks/post-commit" "post-commit hook"

# --- 10. Documentation Consistency ------------------------------------------------------
Write-Host ""
Write-Host " 10. Documentation Consistency" -ForegroundColor White

Assert-FileContains "AGENTS.md" "single source of truth|system of record|Map to all AgentX resources" "AGENTS.md declares single source"
Assert-FileContains "README.md" "$skillCount production skills" "README skill count heading matches ($skillCount)"
Assert-FileContains "README.md" "$skillCount skills" "README framework totals matches ($skillCount)"
Assert-FileExists "docs/GUIDE.md" "Consolidated Guide (quickstart + setup)"
Assert-FileContains "AGENTS.md" "GUIDE" "AGENTS.md links to Guide"
Assert-FileContains ".github/copilot-instructions.md" "RFC 2119" "Router has RFC 2119 directive language"
Assert-FileContains "README.md" "OpenSSF" "README has OpenSSF Scorecard badge"
Assert-FileContains "vscode-extension/package.json" '"vscode:prepublish": "npm run sync:version && npm run prepare:chat && npm run clean && tsc -p ./"' "VS Code extension prepublish stamps bundled assets once before packaging"

# --- Results ----------------------------------------------------------------------------
Write-Host ""
Write-Host " ================================================" -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Yellow" })
if ($script:fail -gt 0) {
 Write-Host " Failures: $($script:fail)" -ForegroundColor Red
}
Write-Host ""

exit $script:fail
