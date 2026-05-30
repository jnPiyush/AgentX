#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Install AgentX into the per-user GitHub Copilot CLI customization directory.

.DESCRIPTION
  Path 2 installer. Copies AgentX agents, skills, instructions, and prompts into
  ~/.copilot/ (Windows: $env:USERPROFILE\.copilot) so they are discovered by
  GitHub Copilot CLI across every workspace -- not just the current repo.

  This is the global counterpart to install.ps1 (which seeds .github/ inside one
  workspace). Use this when you want AgentX available everywhere you launch
  'copilot' or 'gh copilot'.

  Layout written:
    ~/.copilot/agents/        <- .github/agents/
    ~/.copilot/skills/        <- .github/skills/
    ~/.copilot/instructions/  <- .github/instructions/
    ~/.copilot/prompts/       <- .github/prompts/
    ~/.copilot/templates/     <- .github/templates/        (optional)
    ~/.copilot/AGENTS.md      <- AGENTS.md                  (router)

  Also optionally registers the AgentX MCP server in ~/.copilot/mcp-config.json
  when -RegisterMcp is supplied (Path 3 hookup).

.PARAMETER Source
  AgentX repo root. Auto-detected from script location.

.PARAMETER UserHome
  Override the user home directory. Defaults to $HOME / $env:USERPROFILE.

.PARAMETER Force
  Overwrite existing files in ~/.copilot/.

.PARAMETER IncludeTemplates
  Also copy .github/templates/ into ~/.copilot/templates/.

.PARAMETER RegisterMcp
  Add the AgentX MCP server entry to ~/.copilot/mcp-config.json.

.PARAMETER WhatIf
  Preview without writing.

.EXAMPLE
  pwsh packs/agentx-copilot-cli/install-user.ps1

.EXAMPLE
  pwsh packs/agentx-copilot-cli/install-user.ps1 -RegisterMcp -IncludeTemplates -Force
#>
[CmdletBinding(SupportsShouldProcess)]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
param(
  [string]$Source = '',
  [string]$UserHome = '',
  [switch]$Force,
  [switch]$IncludeTemplates,
  [switch]$RegisterMcp
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-OK   { param([string]$m) Write-Host "[OK] $m"   -ForegroundColor Green }
function Write-Skip { param([string]$m) Write-Host "[SKIP] $m" -ForegroundColor DarkGray }
function Write-Info { param([string]$m) Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Err  { param([string]$m) Write-Host "[FAIL] $m" -ForegroundColor Red }

function Get-UserHome {
  param([string]$Override)
  if ($Override) {
    if (Test-Path $Override) { return (Resolve-Path $Override).Path }
    return [System.IO.Path]::GetFullPath($Override)
  }
  if ($env:USERPROFILE) { return $env:USERPROFILE }
  if ($HOME) { return $HOME }
  throw 'Cannot determine user home directory. Pass -UserHome explicitly.'
}

function Resolve-SourceRoot {
  param([string]$Hint)
  if ($Hint) { return (Resolve-Path $Hint).Path }
  $candidate = $PSScriptRoot
  for ($i = 0; $i -lt 5; $i++) {
    if (Test-Path (Join-Path $candidate '.github' 'agents')) { return (Resolve-Path $candidate).Path }
    $candidate = Split-Path $candidate -Parent
    if (-not $candidate) { break }
  }
  throw 'Cannot auto-detect AgentX source. Use -Source.'
}

function Copy-Tree {
  [CmdletBinding(SupportsShouldProcess)]
  param([string]$SrcDir, [string]$DestDir, [switch]$Overwrite)
  $copied = 0; $skipped = 0
  if (-not (Test-Path $SrcDir)) { Write-Err "Source not found: $SrcDir"; return @{Copied=0;Skipped=0} }
  foreach ($f in Get-ChildItem -Path $SrcDir -Recurse -File) {
    $rel = $f.FullName.Substring($SrcDir.Length).TrimStart('\','/')
    $dest = Join-Path $DestDir $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {
      if ($PSCmdlet.ShouldProcess($destDir, 'Create directory')) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      }
    }
    if ((Test-Path $dest) -and -not $Overwrite) { $skipped++; continue }
    if ($PSCmdlet.ShouldProcess($dest, 'Copy file')) {
      Copy-Item -Path $f.FullName -Destination $dest -Force
      $copied++
    }
  }
  return @{Copied=$copied; Skipped=$skipped}
}

function Copy-OneFile {
  [CmdletBinding(SupportsShouldProcess)]
  param([string]$Src, [string]$Dest, [switch]$Overwrite)
  if (-not (Test-Path $Src)) { return @{Copied=0;Skipped=0} }
  $destDir = Split-Path $Dest -Parent
  if (-not (Test-Path $destDir)) {
    if ($PSCmdlet.ShouldProcess($destDir, 'Create directory')) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
  }
  if ((Test-Path $Dest) -and -not $Overwrite) { return @{Copied=0;Skipped=1} }
  if ($PSCmdlet.ShouldProcess($Dest, 'Copy file')) {
    Copy-Item -Path $Src -Destination $Dest -Force
  }
  return @{Copied=1;Skipped=0}
}

function Register-AgentxMcpServer {
  [CmdletBinding(SupportsShouldProcess)]
  param([string]$McpConfigPath, [string]$SourceRoot)

  $entry = [ordered]@{
    command = 'node'
    args    = @((Join-Path $SourceRoot '.agentx' 'mcp-server' 'index.js'))
    env     = [ordered]@{
      AGENTX_REPO_ROOT = $SourceRoot
    }
  }

  if (Test-Path $McpConfigPath) {
    try {
      $existing = Get-Content $McpConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
    } catch {
      Write-Err "Existing $McpConfigPath is not valid JSON. Aborting MCP registration."
      return
    }
    if (-not $existing.PSObject.Properties['mcpServers']) {
      $existing | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{})
    }
    $existing.mcpServers | Add-Member -NotePropertyName 'agentx' -NotePropertyValue ([pscustomobject]$entry) -Force
    $json = $existing | ConvertTo-Json -Depth 8
  } else {
    $json = ([ordered]@{ mcpServers = [ordered]@{ agentx = $entry } } | ConvertTo-Json -Depth 8)
  }

  if ($PSCmdlet.ShouldProcess($McpConfigPath, 'Write MCP config')) {
    $dir = Split-Path $McpConfigPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -Path $McpConfigPath -Value $json -Encoding utf8
  }
  Write-OK "Registered AgentX MCP server in $McpConfigPath"
}

# -- Main -------------------------------------------------------------------

$Source    = Resolve-SourceRoot -Hint $Source
$home2     = Get-UserHome -Override $UserHome
$copilotDir = Join-Path $home2 '.copilot'

Write-Host ''
Write-Host '=============================================' -ForegroundColor Cyan
Write-Host '| AgentX -> Copilot CLI (user-level install)|' -ForegroundColor Cyan
Write-Host '=============================================' -ForegroundColor Cyan
Write-Info "Source     : $Source"
Write-Info "User home  : $home2"
Write-Info "Copilot dir: $copilotDir"
Write-Info "Force      : $Force"
Write-Info "Templates  : $IncludeTemplates"
Write-Info "Register MCP: $RegisterMcp"
Write-Host ''

$mappings = @(
  @{ Label='Agents';       Src='.github/agents';       Dest='agents' }
  @{ Label='Skills';       Src='.github/skills';       Dest='skills' }
  @{ Label='Instructions'; Src='.github/instructions'; Dest='instructions' }
  @{ Label='Prompts';      Src='.github/prompts';      Dest='prompts' }
)
if ($IncludeTemplates) {
  $mappings += @{ Label='Templates'; Src='.github/templates'; Dest='templates' }
}

$totalCopied = 0; $totalSkipped = 0
foreach ($m in $mappings) {
  Write-Info "Installing $($m.Label.ToLower())..."
  $r = Copy-Tree -SrcDir (Join-Path $Source $m.Src) -DestDir (Join-Path $copilotDir $m.Dest) -Overwrite:$Force
  $totalCopied += $r.Copied; $totalSkipped += $r.Skipped
  Write-OK "$($m.Label): $($r.Copied) copied, $($r.Skipped) skipped"
}

# Router files Copilot CLI auto-discovers
foreach ($routerFile in @('AGENTS.md', 'CLAUDE.md', 'Skills.md')) {
  $r = Copy-OneFile -Src (Join-Path $Source $routerFile) -Dest (Join-Path $copilotDir $routerFile) -Overwrite:$Force
  $totalCopied += $r.Copied; $totalSkipped += $r.Skipped
}

# Version stamp
$stamp = [ordered]@{
  plugin      = 'agentx-copilot-cli-user'
  version     = '8.4.60'
  installedAt = (Get-Date).ToUniversalTime().ToString('o')
  source      = $Source
  mcpRegistered = [bool]$RegisterMcp
}
if ($PSCmdlet.ShouldProcess((Join-Path $copilotDir '.agentx-version.json'), 'Write version stamp')) {
  $stamp | ConvertTo-Json | Set-Content -Path (Join-Path $copilotDir '.agentx-version.json') -Encoding utf8
  Write-OK 'Wrote ~/.copilot/.agentx-version.json'
}

if ($RegisterMcp) {
  Register-AgentxMcpServer -McpConfigPath (Join-Path $copilotDir 'mcp-config.json') -SourceRoot $Source
}

Write-Host ''
Write-Host '=============================================' -ForegroundColor Green
Write-Host " Installed: $totalCopied files, skipped $totalSkipped" -ForegroundColor Green
Write-Host '=============================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  1. Start a new Copilot CLI session: copilot   (or: gh copilot)'
Write-Host '  2. AgentX agents/skills/instructions are now discovered globally.'
if (-not $RegisterMcp) {
  Write-Host '  3. To also expose AgentX CLI as MCP tools, rerun with -RegisterMcp.'
}
Write-Host ''
