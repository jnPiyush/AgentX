#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install AgentX v5.1.0 — Clone, prune by profile, copy, configure.

.PARAMETER Profile
    full     — Everything (default)
    minimal  — Core orchestration only (agents, templates, CLI)
    python   — Core + Python/data skills & instructions
    dotnet   — Core + C#/.NET/Blazor skills & instructions
    react    — Core + React/TypeScript/UI skills & instructions

.PARAMETER Force
    Overwrite existing files (default: merge, keeping existing)

.PARAMETER Local
    Use Local Mode (filesystem-based issue tracking, no GitHub required)

.PARAMETER NoSetup
    Skip interactive setup (git init, hooks, username)

.EXAMPLE
    .\install.ps1                          # Full install, GitHub mode
    .\install.ps1 -Profile python          # Python profile
    .\install.ps1 -Profile minimal -Local  # Minimal, local mode
    .\install.ps1 -Force                   # Full reinstall (overwrite)

    # One-liner install
    irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex

    # One-liner with profile (set env vars first)
    $env:AGENTX_PROFILE="python"; irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
#>

param(
    [ValidateSet("full","minimal","python","dotnet","react")]
    [string]$Profile = "full",
    [switch]$Force,
    [switch]$Local,
    [switch]$NoSetup
)

# Environment variable overrides (for irm | iex one-liner usage)
if (-not $PSBoundParameters.ContainsKey('Profile') -and $env:AGENTX_PROFILE) { $Profile = $env:AGENTX_PROFILE }
if (-not $PSBoundParameters.ContainsKey('Local')   -and $env:AGENTX_LOCAL -eq "true") { $Local = [switch]$true }
if (-not $PSBoundParameters.ContainsKey('NoSetup') -and $env:AGENTX_NOSETUP -eq "true") { $NoSetup = [switch]$true }

$ErrorActionPreference = "Stop"
$REPO = "https://github.com/jnPiyush/AgentX.git"
$TMP  = ".agentx-install-tmp"

function Write-OK($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Skip($m)  { Write-Host "[--] $m" -ForegroundColor DarkGray }

# ── Banner ──────────────────────────────────────────────
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AgentX v5.1.0 — AI Agent Orchestration          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
$mode = if ($Local) { "Local" } else { "GitHub" }
Write-Host "  Profile: $Profile | Mode: $mode" -ForegroundColor Green
Write-Host ""

# ── Prerequisites ───────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is required. Install from https://git-scm.com"
}

# ── Step 1: Clone ───────────────────────────────────────
Write-Host "① Cloning repository..." -ForegroundColor Cyan
if (Test-Path $TMP) { Remove-Item $TMP -Recurse -Force }
git clone --depth 1 --quiet $REPO $TMP 2>&1 | Out-Null
if (-not (Test-Path "$TMP/AGENTS.md")) { Write-Error "Clone failed. Check network connection." }
Remove-Item "$TMP/.git" -Recurse -Force
Remove-Item "$TMP/install.ps1", "$TMP/install.sh" -Force -ErrorAction SilentlyContinue
Write-OK "Repository cloned"

# ── Step 2: Prune by profile ───────────────────────────
Write-Host "② Applying profile: $Profile" -ForegroundColor Cyan

$prune = @{
    full    = @()
    minimal = @(
        ".github/skills", ".github/instructions", ".github/prompts",
        ".github/workflows", ".github/hooks", ".vscode", "scripts"
    )
    python  = @(
        ".github/skills/cloud", ".github/skills/design",
        ".github/skills/development/csharp", ".github/skills/development/blazor",
        ".github/skills/development/react", ".github/skills/development/frontend-ui",
        ".github/skills/development/go", ".github/skills/development/rust",
        ".github/skills/development/mcp-server-development",
        ".github/instructions/csharp.instructions.md",
        ".github/instructions/blazor.instructions.md",
        ".github/instructions/react.instructions.md"
    )
    dotnet  = @(
        ".github/skills/design",
        ".github/skills/development/python", ".github/skills/development/react",
        ".github/skills/development/frontend-ui", ".github/skills/development/go",
        ".github/skills/development/rust", ".github/skills/development/data-analysis",
        ".github/skills/development/mcp-server-development",
        ".github/skills/cloud/fabric-analytics", ".github/skills/cloud/fabric-data-agent",
        ".github/skills/cloud/fabric-forecasting",
        ".github/instructions/python.instructions.md",
        ".github/instructions/react.instructions.md"
    )
    react   = @(
        ".github/skills/cloud",
        ".github/skills/development/csharp", ".github/skills/development/blazor",
        ".github/skills/development/python", ".github/skills/development/go",
        ".github/skills/development/rust", ".github/skills/development/postgresql",
        ".github/skills/development/sql-server", ".github/skills/development/data-analysis",
        ".github/skills/development/mcp-server-development",
        ".github/instructions/csharp.instructions.md",
        ".github/instructions/blazor.instructions.md",
        ".github/instructions/python.instructions.md",
        ".github/instructions/sql.instructions.md"
    )
}

foreach ($p in $prune[$Profile]) {
    $target = Join-Path $TMP $p
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
}
Write-OK "Profile applied"

# ── Step 3: Copy files ──────────────────────────────────
Write-Host "③ Installing files..." -ForegroundColor Cyan

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

# ── Step 4: Generate runtime files ──────────────────────
Write-Host "④ Configuring runtime..." -ForegroundColor Cyan

@(".agentx/state",".agentx/digests","docs/prd","docs/adr","docs/specs","docs/ux","docs/reviews","docs/progress") | ForEach-Object {
    if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

# Version tracking
$versionFile = ".agentx/version.json"
@{
    version = "5.1.0"
    profile = $Profile
    mode = $(if ($Local) { "local" } else { "github" })
    installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    updatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content $versionFile
Write-OK "Version 5.1.0 recorded"

# Agent status
$statusFile = ".agentx/state/agent-status.json"
if (-not (Test-Path $statusFile) -or $Force) {
    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
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

# ── Step 5: Interactive setup ───────────────────────────
if (-not $NoSetup) {
    Write-Host "⑤ Setup..." -ForegroundColor Cyan

    # Git init
    if (-not (Test-Path ".git")) {
        Write-Host "  Not a Git repository." -ForegroundColor Yellow
        Write-Host "  [1] Initialize Git  [2] Skip" -ForegroundColor Cyan
        $r = Read-Host "  Choose"
        if ($r -eq "1") { git init --quiet; Write-OK "Git initialized" }
    }

    # Git hooks
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

# ── Done ────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  AgentX v5.1.0 installed!  [$Profile | $mode]" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  CLI:   .\.agentx\agentx.ps1 help" -ForegroundColor White
Write-Host "  Docs:  AGENTS.md | Skills.md | docs/SETUP.md" -ForegroundColor White
if ($Local) {
    Write-Host "  Issue: .\.agentx\local-issue-manager.ps1 -Action create -Title '[Story] Task' -Labels 'type:story'" -ForegroundColor DarkGray
}
Write-Host ""

