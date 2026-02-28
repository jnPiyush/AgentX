#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Install AgentX v6.8.0 - Download, copy, configure.

.PARAMETER Mode
 github - Full features: GitHub Actions, PRs, Projects (asks for repo/project info)
 local - Filesystem-based issue tracking, no GitHub required (DEFAULT)
 Defaults to 'local' for zero-prompt install. Use -Mode github to enable GitHub setup.

.PARAMETER Path
 Install into a subdirectory (e.g. -Path myproject/backend). The VS Code
 extension auto-detects AgentX up to 2 levels deep, or you can set
 'agentx.rootPath' in workspace settings.

.PARAMETER Force
 Overwrite existing files (default: merge, keeping existing)

.PARAMETER NoSetup
 Skip interactive setup (git init, hooks, username)

.EXAMPLE
 .\install.ps1 # Local mode - no prompts
 .\install.ps1 -Mode github # GitHub mode - asks for repo/project
 .\install.ps1 -Path myproject # Install into a subfolder
 .\install.ps1 -Force # Full reinstall (overwrite)

 # One-liner install (local mode, no prompts - auto-detects piped execution)
 irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex

 # One-liner for GitHub mode
 $env:AGENTX_MODE="github"; irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param(
 [string]$Mode,
 [string]$Path,
 [switch]$Force,
 [switch]$NoSetup,
 [switch]$Local
)

# Environment variable overrides (for irm | iex one-liner usage)
if (-not $Mode -and $env:AGENTX_MODE) { $Mode = $env:AGENTX_MODE }
if (-not $Path -and $env:AGENTX_PATH) { $Path = $env:AGENTX_PATH }
# Legacy: support AGENTX_LOCAL=true -> Mode=local
if (-not $Mode -and $env:AGENTX_LOCAL -eq "true") { $Mode = "local" }
if (-not $PSBoundParameters.ContainsKey('NoSetup') -and $env:AGENTX_NOSETUP -eq "true") { $NoSetup = [switch]$true }
# -Local switch -> Mode=local shorthand
if ($Local -and -not $Mode) { $Mode = "local" }

# -Path: install into a subdirectory
if ($Path) {
 $Path = $Path.TrimEnd('\', '/')
 if (-not (Test-Path $Path)) {
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
 }
 Push-Location $Path
 Write-Host " Target: $Path" -ForegroundColor DarkGray
}

# Manual validation (replaces [ValidateSet] for irm | iex compatibility)
if ($Mode -and $Mode -notin @("github", "local")) {
 Write-Error "Invalid Mode '$Mode'. Valid values: github, local"
 return
}

# -- PowerShell version check --
# Minimum: PowerShell 5.1 (Windows built-in). Recommended: PowerShell 7+.
if ($PSVersionTable.PSVersion.Major -lt 5) {
 Write-Host "[X] PowerShell 5.1+ is required. Current version: $($PSVersionTable.PSVersion)" -ForegroundColor Red
 Write-Host " Install PowerShell 7+: https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell" -ForegroundColor Yellow
 return
}
if ($PSVersionTable.PSVersion.Major -eq 5) {
 Write-Host "[--] Windows PowerShell $($PSVersionTable.PSVersion) detected. PowerShell 7+ recommended." -ForegroundColor Yellow
 Write-Host "  Install: winget install Microsoft.PowerShell" -ForegroundColor DarkGray
}

# Auto-detect piped execution (irm | iex) - used to skip interactive prompts
$isPiped = -not $MyInvocation.MyCommand.Path

$ErrorActionPreference = "Stop"
$BRANCH = "master"
$TMP = ".agentx-install-tmp"
$TMPRAW = ".agentx-install-raw"
$ZIPFILE = ".agentx-install.zip"
$ARCHIVE = "https://github.com/jnPiyush/AgentX/archive/refs/heads/$BRANCH.zip"

function Write-OK($m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Skip($m) { Write-Host "[--] $m" -ForegroundColor DarkGray }

# -- Cleanup helper (guaranteed on exit, error, or Ctrl+C) --
function Invoke-InstallCleanup {
 foreach ($p in @($TMP, $TMPRAW)) {
 if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
 }
 if (Test-Path $ZIPFILE) { Remove-Item $ZIPFILE -Force -ErrorAction SilentlyContinue }
}

try {

# -- Banner ----------------------------------------------
Write-Host ""
Write-Host "+===================================================+" -ForegroundColor Cyan
Write-Host "| AgentX v6.8.0 - AI Agent Orchestration |" -ForegroundColor Cyan
Write-Host "+===================================================+" -ForegroundColor Cyan
Write-Host ""

# -- Mode selection (defaults to local - no prompt) ------
if (-not $Mode) {
 $Mode = "local"
}

$Local = $Mode -eq "local"
$displayMode = if ($Local) { "Local" } else { "GitHub" }
Write-Host ""
Write-Host " Mode: $displayMode" -ForegroundColor Green
Write-Host ""

# -- Prerequisites ---------------------------------------
# Git is optional - only needed for git init and hooks in Step 5

# -- Step 1: Download ------------------------------------
Write-Host "[1] Downloading AgentX..." -ForegroundColor Cyan
# Robust pre-cleanup - handle locked files from previous failed runs
foreach ($p in @($TMP, $TMPRAW)) {
 if (Test-Path $p) {
 Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
 if (Test-Path $p) {
 Start-Sleep -Milliseconds 500
 Remove-Item $p -Recurse -Force -ErrorAction Stop
 }
 }
}
if (Test-Path $ZIPFILE) { Remove-Item $ZIPFILE -Force -ErrorAction SilentlyContinue }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
 Invoke-WebRequest -Uri $ARCHIVE -OutFile $ZIPFILE -UseBasicParsing
} catch {
 Write-Error "Download failed. Check network connection."
}

Expand-Archive -Path $ZIPFILE -DestinationPath $TMPRAW -Force
$root = (Get-ChildItem $TMPRAW -Directory | Select-Object -First 1).FullName

# Copy only essential paths (skip vscode-extension, tests, CHANGELOG, CONTRIBUTING, etc.)
New-Item -ItemType Directory -Path $TMP -Force | Out-Null
$neededDirs = @(".agentx", ".github", ".vscode", "scripts")
$neededFiles = @("AGENTS.md", "Skills.md", ".gitignore")
foreach ($d in $neededDirs) {
 $src = Join-Path $root $d
 if (Test-Path $src) { Copy-Item $src (Join-Path $TMP $d) -Recurse -Force }
}
foreach ($f in $neededFiles) {
 $src = Join-Path $root $f
 if (Test-Path $src) { Copy-Item $src (Join-Path $TMP $f) -Force }
}

Remove-Item $TMPRAW -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $ZIPFILE -Force -ErrorAction SilentlyContinue
if (-not (Test-Path "$TMP/AGENTS.md")) { Write-Error "Download failed. Check network connection." }
Write-OK "AgentX downloaded (essential files only)"

# -- Step 2: Copy files ----------------------------------
Write-Host "[2] Installing files..." -ForegroundColor Cyan

$tmpFull = (Resolve-Path $TMP).Path.TrimEnd('\', '/')
$copied = 0; $skipped = 0

Get-ChildItem $TMP -Recurse -File -Force | ForEach-Object {
 $rel = $_.FullName.Substring($tmpFull.Length + 1)
 $dest = Join-Path "." $rel
 $dir = Split-Path $dest -Parent
 if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
 if ($Force -or -not (Test-Path $dest)) {
 Copy-Item $_.FullName $dest -Force
 $copied++
 } else { $skipped++ }
}
Write-OK "$copied files installed ($skipped existing skipped)"

# -- Step 3: Generate runtime files ----------------------
Write-Host "[3] Configuring runtime..." -ForegroundColor Cyan

@(".agentx/state",".agentx/digests","docs/prd","docs/adr","docs/specs","docs/ux","docs/reviews","docs/progress") | ForEach-Object {
 if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

# Version tracking
$versionFile = ".agentx/version.json"
@{
 version = "6.8.0"
 mode = $Mode
 installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
 updatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content $versionFile
Write-OK "Version 6.8.0 recorded"

# Agent status
$statusFile = ".agentx/state/agent-status.json"
if (-not (Test-Path $statusFile) -or $Force) {
 [ordered]@{
 "product-manager" = @{ status="idle"; issue=$null; lastActivity=$null }
 "ux-designer" = @{ status="idle"; issue=$null; lastActivity=$null }
 "architect" = @{ status="idle"; issue=$null; lastActivity=$null }
 "engineer" = @{ status="idle"; issue=$null; lastActivity=$null }
 "reviewer" = @{ status="idle"; issue=$null; lastActivity=$null }
 "devops-engineer" = @{ status="idle"; issue=$null; lastActivity=$null }
 } | ConvertTo-Json -Depth 10 | Set-Content $statusFile
 Write-OK "Agent status initialized"
}

# Mode config
$configFile = ".agentx/config.json"
if (-not (Test-Path $configFile) -or $Force) {
 if ($Local) {
 New-Item -ItemType Directory -Path ".agentx/issues" -Force | Out-Null
 @{ mode="local"; nextIssueNumber=1; created=(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") } |
 ConvertTo-Json | Set-Content $configFile
 Write-OK "Local Mode configured"
 } else {
 @{ mode="github"; repo=$null; project=$null; created=(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") } |
 ConvertTo-Json | Set-Content $configFile
 Write-OK "GitHub Mode configured"
 }
}

# -- Step 4: Setup -------------------------------------
if (-not $NoSetup) {
 Write-Host "[4] Setup..." -ForegroundColor Cyan

 # Git init + hooks - always auto-init (non-destructive, both modes)
 if (Get-Command git -ErrorAction SilentlyContinue) {
 if (-not (Test-Path ".git")) {
 git init --quiet
 Write-OK "Git initialized"
 }

 if (Test-Path ".git") {
 $hooksDir = ".git/hooks"
 foreach ($h in @("pre-commit","commit-msg")) {
 $src = ".github/hooks/$h"
 if (Test-Path $src) { Copy-Item $src "$hooksDir/$h" -Force }
 }
 if (Test-Path ".github/hooks/pre-commit.ps1") {
 Copy-Item ".github/hooks/pre-commit.ps1" "$hooksDir/pre-commit.ps1" -Force
 }
 Write-OK "Git hooks installed"
 }
 } else {
 Write-Skip "Git not found - skipping git init and hooks"
 }

 # GitHub setup (username, repo, project) - skipped in local mode or when piped
 if (-not $Local -and -not $isPiped) {
 # Username for CODEOWNERS
 $username = $null
 if (Get-Command gh -ErrorAction SilentlyContinue) {
 try { $username = gh api user --jq '.login' 2>$null } catch {}
 }
 if (-not $username -and (Get-Command git -ErrorAction SilentlyContinue)) {
 try { $username = git config user.name 2>$null } catch {}
 }
 if (-not $username) {
 $username = Read-Host " GitHub username (for CODEOWNERS)"
 }
 if ($username) {
 foreach ($f in @(".github/CODEOWNERS",".github/agentx-security.yml")) {
 if (Test-Path $f) {
 (Get-Content $f -Raw) -replace '<YOUR_GITHUB_USERNAME>', $username | Set-Content $f -NoNewline
 }
 }
 Write-OK "Username: $username"
 }
 Write-Host ""
 Write-Host " GitHub Repository & Project" -ForegroundColor Cyan

 # Auto-detect repo from git remote
 $repoSlug = $null
 if (Get-Command git -ErrorAction SilentlyContinue) {
 try {
 $remoteUrl = git remote get-url origin 2>$null
 if ($remoteUrl -match 'github\.com[:/]([^/]+/[^/.]+)') {
 $repoSlug = $Matches[1] -replace '\.git$', ''
 }
 } catch {}
 }
 if (-not $repoSlug -and (Get-Command gh -ErrorAction SilentlyContinue)) {
 try { $repoSlug = gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>$null } catch {}
 }

 if ($repoSlug) {
 Write-Host " Detected repo: $repoSlug" -ForegroundColor DarkGray
 $confirmRepo = Read-Host " Use this repo? [Y/n]"
 if ($confirmRepo -eq 'n' -or $confirmRepo -eq 'N') {
 $repoSlug = Read-Host " Enter GitHub repo (owner/repo)"
 }
 } else {
 $repoSlug = Read-Host " Enter GitHub repo (owner/repo, e.g. myorg/myproject)"
 }

 # Auto-detect project number
 $projectNum = $null
 if ($repoSlug -and (Get-Command gh -ErrorAction SilentlyContinue)) {
 try {
 $owner = ($repoSlug -split '/')[0]
 $projects = gh project list --owner $owner --format json --limit 10 2>$null
 if ($LASTEXITCODE -eq 0 -and $projects) {
 $projectList = $projects | ConvertFrom-Json
 if ($projectList.projects.Count -eq 1) {
 $projectNum = $projectList.projects[0].number
 Write-Host " Detected project: #$projectNum ($($projectList.projects[0].title))" -ForegroundColor DarkGray
 $confirmProj = Read-Host " Use this project? [Y/n]"
 if ($confirmProj -eq 'n' -or $confirmProj -eq 'N') { $projectNum = $null }
 } elseif ($projectList.projects.Count -gt 1) {
 Write-Host " Available projects:" -ForegroundColor DarkGray
 for ($i = 0; $i -lt $projectList.projects.Count; $i++) {
 Write-Host " [$($i+1)] #$($projectList.projects[$i].number) - $($projectList.projects[$i].title)" -ForegroundColor White
 }
 $projChoice = Read-Host " Choose [1-$($projectList.projects.Count), or Enter to skip]"
 if ($projChoice -match '^\d+$' -and [int]$projChoice -ge 1 -and [int]$projChoice -le $projectList.projects.Count) {
 $projectNum = $projectList.projects[[int]$projChoice - 1].number
 }
 }
 }
 } catch {}
 }
 if (-not $projectNum) {
 $projectNumInput = Read-Host " GitHub Project number (Enter to skip)"
 if ($projectNumInput) { $projectNum = [int]$projectNumInput }
 }

 # Update config.json with repo and project
 if (Test-Path $configFile) {
 $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
 if ($repoSlug) { $cfg.repo = $repoSlug }
 if ($projectNum) { $cfg.project = $projectNum }
 $cfg | ConvertTo-Json | Set-Content $configFile
 }
 if ($repoSlug) { Write-OK "Repo: $repoSlug" }
 if ($projectNum) { Write-OK "Project: #$projectNum" }
 } elseif (-not $Local -and $isPiped) {
 Write-Skip "GitHub interactive setup skipped (piped execution)"
 Write-Host " Run .\install.ps1 -Mode github to configure repo & project" -ForegroundColor DarkGray
 }
} else {
 Write-Skip "Setup skipped (-NoSetup)"
}

# -- Done --------------------------------------------
Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host " AgentX v6.8.0 installed! [$displayMode]" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host " CLI: .\.agentx\agentx.ps1 help" -ForegroundColor White
Write-Host " Docs: AGENTS.md | Skills.md | docs/GUIDE.md" -ForegroundColor White
if ($Local) {
 Write-Host " Issue: .\.agentx\local-issue-manager.ps1 -Action create -Title '[Story] Task' -Labels 'type:story'" -ForegroundColor DarkGray
}
if ($Path) {
 Write-Host "" -ForegroundColor White
 Write-Host " [TIP] VS Code nested folder:" -ForegroundColor Yellow
 Write-Host "  Set 'agentx.rootPath' in .vscode/settings.json to '$((Resolve-Path .).Path)'" -ForegroundColor DarkGray
 Write-Host "  or the extension will auto-detect up to 2 levels deep." -ForegroundColor DarkGray
}

Write-Host ""

} catch {
 Write-Host "[X] Installation failed: $($_.Exception.Message)" -ForegroundColor Red
 Write-Host " Temp files will be cleaned up automatically." -ForegroundColor DarkGray
 throw
} finally {
 # Guaranteed cleanup - runs on success, error, or Ctrl+C
 Invoke-InstallCleanup
 # Pop back to original directory if -Path was used
 if ($Path) { Pop-Location }
}

