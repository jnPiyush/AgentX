#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX v5.1.0 — Download, copy, configure.

.PARAMETER Mode
    github   — Full features: GitHub Actions, PRs, Projects
    local    — Filesystem-based issue tracking, no GitHub required
    (omit to choose interactively)

.PARAMETER Force
    Overwrite existing files (default: merge, keeping existing)

.PARAMETER NoSetup
    Skip interactive setup (git init, hooks, username)

.EXAMPLE
    .\install.ps1                          # Interactive — asks for mode
    .\install.ps1 -Mode github             # Non-interactive, GitHub mode
    .\install.ps1 -Mode local              # Non-interactive, Local mode
    .\install.ps1 -Force                   # Full reinstall (overwrite)

    # One-liner install (interactive)
    irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex

    # One-liner with overrides (non-interactive)
    $env:AGENTX_MODE="local"; irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param(
    [ValidateSet("github","local")]
    [string]$Mode,
    [switch]$Force,
    [switch]$NoSetup
)

# Environment variable overrides (for irm | iex one-liner usage)
if (-not $Mode -and $env:AGENTX_MODE) { $Mode = $env:AGENTX_MODE }
# Legacy: support AGENTX_LOCAL=true → Mode=local
if (-not $Mode -and $env:AGENTX_LOCAL -eq "true") { $Mode = "local" }
if (-not $PSBoundParameters.ContainsKey('NoSetup') -and $env:AGENTX_NOSETUP -eq "true") { $NoSetup = [switch]$true }

$ErrorActionPreference = "Stop"
$BRANCH  = "master"
$TMP     = ".agentx-install-tmp"
$TMPRAW  = ".agentx-install-raw"
$ZIPFILE = ".agentx-install.zip"
$ARCHIVE = "https://github.com/jnPiyush/AgentX/archive/refs/heads/$BRANCH.zip"

function Write-OK($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Skip($m)  { Write-Host "[--] $m" -ForegroundColor DarkGray }

# ── Banner ──────────────────────────────────────────────
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AgentX v5.1.0 — AI Agent Orchestration          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Interactive selection ───────────────────────────────
if (-not $Mode) {
    Write-Host "  Select a mode:" -ForegroundColor Cyan
    Write-Host "  [1] GitHub — Full features: GitHub Actions, PRs, Projects" -ForegroundColor White
    Write-Host "  [2] Local  — Filesystem-based issue tracking, no GitHub required" -ForegroundColor White
    $modeChoice = Read-Host "  Choose [1-2, default=1]"
    $Mode = switch ($modeChoice) {
        "2" { "local" }
        default { "github" }
    }
}

$Local = $Mode -eq "local"
$displayMode = if ($Local) { "Local" } else { "GitHub" }
Write-Host ""
Write-Host "  Mode: $displayMode" -ForegroundColor Green
Write-Host ""

# ── Prerequisites ───────────────────────────────────────
# Git is optional — only needed for git init and hooks in Step 5

# ── Step 1: Download ────────────────────────────────────
Write-Host "① Downloading AgentX..." -ForegroundColor Cyan
if (Test-Path $TMP)     { Remove-Item $TMP -Recurse -Force }
if (Test-Path $TMPRAW)  { Remove-Item $TMPRAW -Recurse -Force }
if (Test-Path $ZIPFILE) { Remove-Item $ZIPFILE -Force }

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
$neededDirs  = @(".agentx", ".github", ".vscode", "scripts")
$neededFiles = @("AGENTS.md", "Skills.md", ".gitignore")
foreach ($d in $neededDirs) {
    $src = Join-Path $root $d
    if (Test-Path $src) { Copy-Item $src (Join-Path $TMP $d) -Recurse -Force }
}
foreach ($f in $neededFiles) {
    $src = Join-Path $root $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $TMP $f) -Force }
}

Remove-Item $TMPRAW -Recurse -Force
Remove-Item $ZIPFILE -Force
if (-not (Test-Path "$TMP/AGENTS.md")) { Write-Error "Download failed. Check network connection." }
Write-OK "AgentX downloaded (essential files only)"

# ── Step 2: Copy files ──────────────────────────────────
Write-Host "② Installing files..." -ForegroundColor Cyan

$tmpFull = (Resolve-Path $TMP).Path.TrimEnd('\', '/')
$copied = 0; $skipped = 0

Get-ChildItem $TMP -Recurse -File -Force | ForEach-Object {
    $rel  = $_.FullName.Substring($tmpFull.Length + 1)
    $dest = Join-Path "." $rel
    $dir  = Split-Path $dest -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if ($Force -or -not (Test-Path $dest)) {
        Copy-Item $_.FullName $dest -Force
        $copied++
    } else { $skipped++ }
}
Write-OK "$copied files installed ($skipped existing skipped)"

# ── Step 3: Generate runtime files ──────────────────────
Write-Host "③ Configuring runtime..." -ForegroundColor Cyan

@(".agentx/state",".agentx/digests","docs/prd","docs/adr","docs/specs","docs/ux","docs/reviews","docs/progress") | ForEach-Object {
    if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

# Version tracking
$versionFile = ".agentx/version.json"
@{
    version = "5.1.0"
    mode = $Mode
    installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    updatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content $versionFile
Write-OK "Version 5.1.0 recorded"

# Agent status
$statusFile = ".agentx/state/agent-status.json"
if (-not (Test-Path $statusFile) -or $Force) {
    [ordered]@{
        "product-manager" = @{ status="idle"; issue=$null; lastActivity=$null }
        "ux-designer"     = @{ status="idle"; issue=$null; lastActivity=$null }
        "architect"       = @{ status="idle"; issue=$null; lastActivity=$null }
        "engineer"        = @{ status="idle"; issue=$null; lastActivity=$null }
        "reviewer"        = @{ status="idle"; issue=$null; lastActivity=$null }
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
        @{ mode="github"; created=(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") } |
            ConvertTo-Json | Set-Content $configFile
        Write-OK "GitHub Mode configured"
    }
}

# ── Step 4: Interactive setup ─────────────────────────
if (-not $NoSetup) {
    Write-Host "④ Setup..." -ForegroundColor Cyan

    # Git init + hooks
    if (Get-Command git -ErrorAction SilentlyContinue) {
        if (-not (Test-Path ".git")) {
            Write-Host "  Not a Git repository." -ForegroundColor Yellow
            Write-Host "  [1] Initialize Git  [2] Skip" -ForegroundColor Cyan
            $r = Read-Host "  Choose"
            if ($r -eq "1") { git init --quiet; Write-OK "Git initialized" }
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
        Write-Skip "Git not found — skipping git init and hooks"
    }

    # Username
    $username = $null
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        try { $username = gh api user --jq '.login' 2>$null } catch {}
    }
    if (-not $username -and (Get-Command git -ErrorAction SilentlyContinue)) {
        try { $username = git config user.name 2>$null } catch {}
    }
    if (-not $username) {
        $username = Read-Host "  GitHub username (for CODEOWNERS)"
    }
    if ($username) {
        foreach ($f in @(".github/CODEOWNERS",".github/agentx-security.yml")) {
            if (Test-Path $f) {
                (Get-Content $f -Raw) -replace '<YOUR_GITHUB_USERNAME>', $username | Set-Content $f -NoNewline
            }
        }
        Write-OK "Username: $username"
    }
} else {
    Write-Skip "Setup skipped (-NoSetup)"
}

# ── Cleanup ─────────────────────────────────────────────
Remove-Item $TMP -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $TMPRAW -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $ZIPFILE -Force -ErrorAction SilentlyContinue

# ── Done ────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  AgentX v5.1.0 installed!  [$displayMode]" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  CLI:   .\.agentx\agentx.ps1 help" -ForegroundColor White
Write-Host "  Docs:  AGENTS.md | Skills.md | docs/SETUP.md" -ForegroundColor White
if ($Local) {
    Write-Host "  Issue: .\.agentx\local-issue-manager.ps1 -Action create -Title '[Story] Task' -Labels 'type:story'" -ForegroundColor DarkGray
}
Write-Host ""

