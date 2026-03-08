#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Install AgentX Copilot CLI Plugin v8.1.4 into a workspace.

.DESCRIPTION
 Copies AgentX agents, skills, instructions, and prompts into a target workspace
 so GitHub Copilot CLI can discover and use them. This is a STANDALONE plugin --
 it does NOT require the AgentX VS Code extension or the core install.ps1.

 The plugin copies files into the workspace .github/ directory. Copilot CLI reads
 agent definitions from .github/agents/, skills from .github/skills/, instructions
 from .github/instructions/, and prompts from .github/prompts/.

.PARAMETER Target
 Path to the workspace root where files will be installed. Defaults to current directory.

.PARAMETER Source
 Path to the AgentX repository root (where .github/agents/ lives).
 Defaults to the parent of the packs/ directory (auto-detected from script location).

.PARAMETER IncludeCli
 Also copy .agentx/ CLI utilities (agentx.ps1, local-issue-manager.ps1, etc.)

.PARAMETER Force
 Overwrite existing files (default: skip files that already exist)

.PARAMETER WhatIf
 Show what would be copied without making changes.

.EXAMPLE
 # Install into current workspace
 pwsh packs/agentx-copilot-cli/install.ps1

 # Install into a specific workspace
 pwsh packs/agentx-copilot-cli/install.ps1 -Target /path/to/my-project

 # Include CLI utilities
 pwsh packs/agentx-copilot-cli/install.ps1 -IncludeCli

 # Preview what would be installed
 pwsh packs/agentx-copilot-cli/install.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param(
 [string]$Target = (Get-Location).Path,
 [string]$Source = "",
 [switch]$IncludeCli,
 [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -- Helpers ---------------------------------------------------------------

function Write-OK  { param([string]$msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Skip { param([string]$msg) Write-Host "[SKIP] $msg" -ForegroundColor DarkGray }
function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Err { param([string]$msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Copy-Tree {
 param(
  [string]$SrcDir,
  [string]$DestDir,
  [switch]$Overwrite
 )
 $copied = 0
 $skipped = 0
 if (-not (Test-Path $SrcDir)) {
  Write-Err "Source not found: $SrcDir"
  return @{ Copied = 0; Skipped = 0 }
 }
 $files = Get-ChildItem -Path $SrcDir -Recurse -File
 foreach ($f in $files) {
  $relPath = $f.FullName.Substring($SrcDir.Length).TrimStart('\', '/')
  $destPath = Join-Path $DestDir $relPath
  $destDir = Split-Path $destPath -Parent
  if (-not (Test-Path $destDir)) {
   if ($PSCmdlet.ShouldProcess($destDir, "Create directory")) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
   }
  }
  if ((Test-Path $destPath) -and -not $Overwrite) {
   $skipped++
  } else {
   if ($PSCmdlet.ShouldProcess($destPath, "Copy file")) {
    Copy-Item -Path $f.FullName -Destination $destPath -Force
    $copied++
   }
  }
 }
 return @{ Copied = $copied; Skipped = $skipped }
}

# -- Auto-detect source ----------------------------------------------------

if (-not $Source) {
 $scriptDir = $PSScriptRoot
 if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
 # Walk up to find the repo root (parent of packs/)
 $candidate = $scriptDir
 for ($i = 0; $i -lt 5; $i++) {
  if (Test-Path (Join-Path $candidate ".github" "agents")) {
   $Source = $candidate
   break
  }
  $candidate = Split-Path $candidate -Parent
  if (-not $candidate) { break }
 }
 if (-not $Source) {
  Write-Err "Cannot auto-detect AgentX source. Use -Source to specify the AgentX repo root."
  exit 1
 }
}

# -- Validate ---------------------------------------------------------------

if (-not (Test-Path (Join-Path $Source ".github" "agents"))) {
 Write-Err "Source does not contain .github/agents/: $Source"
 exit 1
}

$Target = (Resolve-Path $Target -ErrorAction SilentlyContinue)?.Path
if (-not $Target) {
 $Target = (Get-Location).Path
}

# -- Banner -----------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "| AgentX Copilot CLI Plugin v8.1.4        |" -ForegroundColor Cyan
Write-Host "| Standalone plugin for GitHub Copilot CLI |" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Info "Source : $Source"
Write-Info "Target : $Target"
Write-Info "Force  : $Force"
Write-Info "CLI    : $IncludeCli"
Write-Host ""

# -- Copy artifacts ---------------------------------------------------------

$totalCopied = 0
$totalSkipped = 0

# Agents
Write-Info "Installing agents..."
$r = Copy-Tree -SrcDir (Join-Path $Source ".github" "agents") -DestDir (Join-Path $Target ".github" "agents") -Overwrite:$Force
$totalCopied += $r.Copied; $totalSkipped += $r.Skipped
Write-OK "Agents: $($r.Copied) copied, $($r.Skipped) skipped"

# Skills
Write-Info "Installing skills..."
$r = Copy-Tree -SrcDir (Join-Path $Source ".github" "skills") -DestDir (Join-Path $Target ".github" "skills") -Overwrite:$Force
$totalCopied += $r.Copied; $totalSkipped += $r.Skipped
Write-OK "Skills: $($r.Copied) copied, $($r.Skipped) skipped"

# Instructions
Write-Info "Installing instructions..."
$r = Copy-Tree -SrcDir (Join-Path $Source ".github" "instructions") -DestDir (Join-Path $Target ".github" "instructions") -Overwrite:$Force
$totalCopied += $r.Copied; $totalSkipped += $r.Skipped
Write-OK "Instructions: $($r.Copied) copied, $($r.Skipped) skipped"

# Prompts
Write-Info "Installing prompts..."
$r = Copy-Tree -SrcDir (Join-Path $Source ".github" "prompts") -DestDir (Join-Path $Target ".github" "prompts") -Overwrite:$Force
$totalCopied += $r.Copied; $totalSkipped += $r.Skipped
Write-OK "Prompts: $($r.Copied) copied, $($r.Skipped) skipped"

# Templates
Write-Info "Installing templates..."
$r = Copy-Tree -SrcDir (Join-Path $Source ".github" "templates") -DestDir (Join-Path $Target ".github" "templates") -Overwrite:$Force
$totalCopied += $r.Copied; $totalSkipped += $r.Skipped
Write-OK "Templates: $($r.Copied) copied, $($r.Skipped) skipped"

# Schemas
Write-Info "Installing schemas..."
$r = Copy-Tree -SrcDir (Join-Path $Source ".github" "schemas") -DestDir (Join-Path $Target ".github" "schemas") -Overwrite:$Force
$totalCopied += $r.Copied; $totalSkipped += $r.Skipped
Write-OK "Schemas: $($r.Copied) copied, $($r.Skipped) skipped"

# Supporting docs (AGENTS.md, Skills.md, docs/WORKFLOW.md)
Write-Info "Installing reference docs..."
$supportDocs = @(
 @{ Src = "AGENTS.md"; Dest = "AGENTS.md" },
 @{ Src = "Skills.md"; Dest = "Skills.md" },
 @{ Src = "docs/WORKFLOW.md"; Dest = "docs/WORKFLOW.md" },
 @{ Src = ".github/agent-delegation.md"; Dest = ".github/agent-delegation.md" }
)
$docsCopied = 0
$docsSkipped = 0
foreach ($doc in $supportDocs) {
 $srcPath = Join-Path $Source $doc.Src
 $destPath = Join-Path $Target $doc.Dest
 if (-not (Test-Path $srcPath)) { continue }
 $destDir = Split-Path $destPath -Parent
 if (-not (Test-Path $destDir)) {
  if ($PSCmdlet.ShouldProcess($destDir, "Create directory")) {
   New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }
 }
 if ((Test-Path $destPath) -and -not $Force) {
  $docsSkipped++
 } else {
  if ($PSCmdlet.ShouldProcess($destPath, "Copy file")) {
   Copy-Item -Path $srcPath -Destination $destPath -Force
   $docsCopied++
  }
 }
}
$totalCopied += $docsCopied; $totalSkipped += $docsSkipped
Write-OK "Docs: $docsCopied copied, $docsSkipped skipped"

# CLI utilities (optional)
if ($IncludeCli) {
 Write-Info "Installing CLI utilities..."
 $cliFiles = @(
  @{ Src = ".agentx/agentx.ps1"; Dest = ".agentx/agentx.ps1" },
  @{ Src = ".agentx/agentx.sh"; Dest = ".agentx/agentx.sh" },
  @{ Src = ".agentx/local-issue-manager.ps1"; Dest = ".agentx/local-issue-manager.ps1" },
  @{ Src = ".agentx/local-issue-manager.sh"; Dest = ".agentx/local-issue-manager.sh" }
 )
 $cliCopied = 0
 $cliSkipped = 0
 foreach ($cli in $cliFiles) {
  $srcPath = Join-Path $Source $cli.Src
  $destPath = Join-Path $Target $cli.Dest
  if (-not (Test-Path $srcPath)) { continue }
  $destDir = Split-Path $destPath -Parent
  if (-not (Test-Path $destDir)) {
   if ($PSCmdlet.ShouldProcess($destDir, "Create directory")) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
   }
  }
  if ((Test-Path $destPath) -and -not $Force) {
   $cliSkipped++
  } else {
   if ($PSCmdlet.ShouldProcess($destPath, "Copy file")) {
    Copy-Item -Path $srcPath -Destination $destPath -Force
    $cliCopied++
   }
  }
 }
 $totalCopied += $cliCopied; $totalSkipped += $cliSkipped
 Write-OK "CLI: $cliCopied copied, $cliSkipped skipped"
}

# -- Write version stamp ----------------------------------------------------

$versionFile = Join-Path $Target ".github" ".agentx-cli-plugin.json"
$versionDir = Split-Path $versionFile -Parent
if (-not (Test-Path $versionDir)) {
 New-Item -ItemType Directory -Path $versionDir -Force | Out-Null
}
if ($PSCmdlet.ShouldProcess($versionFile, "Write version stamp")) {
 @{
  plugin = "agentx-copilot-cli"
  version = "8.1.4"
  installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
  source = $Source
  includeCli = [bool]$IncludeCli
 } | ConvertTo-Json | Set-Content $versionFile
 Write-OK "Version stamp written to .github/.agentx-cli-plugin.json"
}

# -- Summary ----------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " AgentX Copilot CLI Plugin v8.1.4 installed" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host " Files copied  : $totalCopied" -ForegroundColor White
Write-Host " Files skipped : $totalSkipped (already exist, use -Force to overwrite)" -ForegroundColor DarkGray
Write-Host ""
Write-Host " Agents        : 20 (13 external + 7 internal)" -ForegroundColor White
Write-Host " Skills        : 64 across 10 categories" -ForegroundColor White
Write-Host " Instructions  : 7 (auto-applied by file pattern)" -ForegroundColor White
Write-Host " Prompts       : 12 reusable templates" -ForegroundColor White
if ($IncludeCli) {
 Write-Host " CLI utilities : 4 scripts (.agentx/)" -ForegroundColor White
}
Write-Host ""
Write-Host " Limitations (Copilot CLI vs VS Code):" -ForegroundColor Yellow
Write-Host "  - No runSubagent: agents run standalone, no agent chaining" -ForegroundColor DarkGray
Write-Host "  - No Mode 1 hub: Agent X cannot orchestrate sub-agents" -ForegroundColor DarkGray
Write-Host "  - Quality loop: Layer 2 (body instructions) + Layer 3 (CLI gate)" -ForegroundColor DarkGray
Write-Host ""
