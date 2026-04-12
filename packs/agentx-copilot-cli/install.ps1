#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Install AgentX Copilot CLI Plugin v8.4.32 into a workspace.

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
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseSingularNouns', '')]
param(
 [string]$Target = (Get-Location).Path,
 [string]$Source = "",
 [switch]$IncludeCli,
 [switch]$Force
)

$MinimumPowerShellVersion = [Version]'7.4.0'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion -lt $MinimumPowerShellVersion) {
 Write-Host "[FAIL] AgentX Copilot CLI Plugin requires PowerShell 7.4+. Current version: $($PSVersionTable.PSVersion)" -ForegroundColor Red
 Write-Host "Install PowerShell 7.4+ from https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell" -ForegroundColor Yellow
 if ($IsWindows -or $env:OS -eq 'Windows_NT') {
  Write-Host "Install command: winget install Microsoft.PowerShell" -ForegroundColor DarkGray
  Write-Host "Then rerun with: pwsh packs/agentx-copilot-cli/install.ps1" -ForegroundColor DarkGray
 } else {
  Write-Host "Then rerun with: pwsh packs/agentx-copilot-cli/install.ps1" -ForegroundColor DarkGray
 }
 exit 1
}

# -- Helpers ---------------------------------------------------------------

function Write-OK  { param([string]$msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Skip { param([string]$msg) Write-Host "[SKIP] $msg" -ForegroundColor DarkGray }
function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Err { param([string]$msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }

$RuntimeBundleRoot = Join-Path '.github' 'agentx' '.agentx'
$PackManifestPath = Join-Path $PSScriptRoot 'manifest.json'
$RuntimeBundleFiles = @(
 'agentx.ps1',
 'agentx.sh',
 'agentx-cli.ps1',
 'agentic-runner.ps1',
 'local-issue-manager.ps1',
 'local-issue-manager.sh'
)
$RuntimeStateDirs = @(
 '.agentx/state',
 '.agentx/digests',
 '.agentx/sessions',
 'docs/artifacts/prd',
 'docs/artifacts/adr',
 'docs/artifacts/specs',
 'docs/artifacts/reviews',
 'docs/artifacts/reviews/findings',
 'docs/artifacts/learnings',
 'docs/ux',
 'docs/execution/plans',
 'docs/execution/progress',
 'memories',
 'memories/session'
)
$StarterAgentStatus = @{
 'product-manager' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'ux-designer' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'architect' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'engineer' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'reviewer' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'devops-engineer' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'auto-fix-reviewer' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'data-scientist' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'tester' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'consulting-research' = @{ status = 'idle'; issue = $null; lastActivity = $null }
 'powerbi-analyst' = @{ status = 'idle'; issue = $null; lastActivity = $null }
}

function Copy-Tree {
 [CmdletBinding(SupportsShouldProcess)]
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

function Read-JsonFile {
 param([string]$Path)
 if (-not (Test-Path $Path)) {
  return $null
 }

 try {
  return Get-Content $Path -Raw -Encoding utf8 | ConvertFrom-Json
 } catch {
  return $null
 }
}

function Get-ManifestArray {
 param(
  [object]$Object,
  [string]$PropertyName
 )

 if ($null -eq $Object) {
  return @()
 }

 $property = $Object.PSObject.Properties[$PropertyName]
 if (-not $property -or $null -eq $property.Value) {
  return @()
 }

 return @($property.Value | ForEach-Object { [string]$_ })
}

function Get-PackInstallPlan {
 param([string]$ManifestPath)

 $manifest = Read-JsonFile $ManifestPath
 if ($null -eq $manifest) {
  throw "Pack manifest not found or invalid: $ManifestPath"
 }

 $artifactGroups = @(
  @{ Key = 'agents'; Label = 'Agents'; RelativePath = '.github/agents' },
  @{ Key = 'skills'; Label = 'Skills'; RelativePath = '.github/skills' },
  @{ Key = 'instructions'; Label = 'Instructions'; RelativePath = '.github/instructions' },
  @{ Key = 'prompts'; Label = 'Prompts'; RelativePath = '.github/prompts' },
  @{ Key = 'templates'; Label = 'Templates'; RelativePath = '.github/templates' },
  @{ Key = 'schemas'; Label = 'Schemas'; RelativePath = '.github/schemas' },
  @{ Key = 'scripts'; Label = 'Scripts'; RelativePath = 'scripts' }
 )

 $entries = @()
 foreach ($group in $artifactGroups) {
  $paths = Get-ManifestArray -Object $manifest.artifacts -PropertyName $group.Key
  if (@($paths).Count -gt 0) {
   $entries += [pscustomobject]@{
    Label = $group.Label
    Type = 'tree'
    RelativePath = ($group.RelativePath -replace '\\', '/')
   }
  }
 }

 foreach ($filePath in (Get-ManifestArray -Object $manifest.artifacts -PropertyName 'supporting')) {
  $entries += [pscustomobject]@{
    Label = 'Docs'
    Type = 'file'
    RelativePath = ($filePath -replace '\\', '/')
  }
 }

 return [pscustomobject]@{
  Manifest = $manifest
  Entries = @($entries)
 }
}

function Copy-FileIfNeeded {
 [CmdletBinding(SupportsShouldProcess)]
 param(
  [string]$SrcPath,
  [string]$DestPath,
  [switch]$Overwrite
 )

 if (-not (Test-Path $SrcPath)) {
  Write-Err "Source not found: $SrcPath"
  return @{ Copied = 0; Skipped = 0 }
 }

 $destDir = Split-Path $DestPath -Parent
 if (-not (Test-Path $destDir)) {
  if ($PSCmdlet.ShouldProcess($destDir, 'Create directory')) {
   New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }
 }

 if ((Test-Path $DestPath) -and -not $Overwrite) {
  return @{ Copied = 0; Skipped = 1 }
 }

 if ($PSCmdlet.ShouldProcess($DestPath, 'Copy file')) {
  Copy-Item -Path $SrcPath -Destination $DestPath -Force
 }

 return @{ Copied = 1; Skipped = 0 }
}

function Write-FileIfNeeded {
 [CmdletBinding(SupportsShouldProcess)]
 param(
  [string]$Path,
  [string]$Content,
  [switch]$Overwrite
 )

 $parentDir = Split-Path $Path -Parent
 if (-not (Test-Path $parentDir)) {
  if ($PSCmdlet.ShouldProcess($parentDir, 'Create directory')) {
   New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
  }
 }

 if ((Test-Path $Path) -and -not $Overwrite) {
  return @{ Copied = 0; Skipped = 1 }
 }

 if ($PSCmdlet.ShouldProcess($Path, 'Write file')) {
  Set-Content -Path $Path -Value $Content -Encoding utf8
 }

 return @{ Copied = 1; Skipped = 0 }
}

function Get-PowerShellWrapperContent {
 param([string]$EntryFile)

 $runtimeRelative = ".github\\agentx\\.agentx\\$EntryFile"
 return @(
  '#!/usr/bin/env pwsh',
  "`$ErrorActionPreference = 'Stop'",
  "`$workspaceRoot = (Resolve-Path (Join-Path `$PSScriptRoot '..')).Path",
  "`$env:AGENTX_WORKSPACE_ROOT = `$workspaceRoot",
  "& (Join-Path `$workspaceRoot '$runtimeRelative') @args",
  "`$succeeded = `$?",
  "`$exitCode = if (Test-Path variable:LASTEXITCODE) { `$LASTEXITCODE } else { 0 }",
  'if ($succeeded) {',
  ' $exitCode = 0',
  '} elseif ($exitCode -eq 0) {',
  ' $exitCode = 1',
  '}',
  'exit $exitCode',
  ''
 ) -join "`n"
}

function Get-BashWrapperContent {
 param([string]$EntryFile)

 return @(
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  '',
  'workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"',
  'export AGENTX_WORKSPACE_ROOT="$workspace_root"',
  ('exec "$workspace_root/.github/agentx/.agentx/' + $EntryFile + '" "$@"'),
  ''
 ) -join "`n"
}

function Install-CliRuntimeBundle {
 param([string]$SourceRoot, [string]$TargetRoot)

 $copied = 0
 $skipped = 0
 foreach ($fileName in $RuntimeBundleFiles) {
  $result = Copy-FileIfNeeded -SrcPath (Join-Path $SourceRoot '.agentx' $fileName) -DestPath (Join-Path $TargetRoot $RuntimeBundleRoot $fileName) -Overwrite:$Force
  $copied += $result.Copied
  $skipped += $result.Skipped
 }

 return @{ Copied = $copied; Skipped = $skipped }
}

function Install-StarterMemories {
 param([string]$SourceRoot, [string]$TargetRoot)

 return Copy-Tree -SrcDir (Join-Path $SourceRoot '.agentx' 'templates' 'memories') -DestDir (Join-Path $TargetRoot 'memories')
}

function Initialize-WorkspaceCliState {
 [CmdletBinding(SupportsShouldProcess)]
 param([string]$TargetRoot)

 foreach ($dir in $RuntimeStateDirs) {
  $fullPath = Join-Path $TargetRoot $dir
  if (-not (Test-Path $fullPath)) {
   if ($PSCmdlet.ShouldProcess($fullPath, 'Create directory')) {
    New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
   }
  }
 }

 $existingConfig = Read-JsonFile (Join-Path $TargetRoot '.agentx' 'config.json')
 $existingVersion = Read-JsonFile (Join-Path $TargetRoot '.agentx' 'version.json')
 $statusPath = Join-Path $TargetRoot '.agentx' 'state' 'agent-status.json'

 if (-not (Test-Path $statusPath)) {
  if ($PSCmdlet.ShouldProcess($statusPath, 'Write agent status')) {
   $StarterAgentStatus | ConvertTo-Json -Depth 4 | Set-Content -Path $statusPath -Encoding utf8
  }
 }

 $config = [ordered]@{
  provider = 'local'
  integration = 'local'
  mode = 'local'
  enforceIssues = $false
  nextIssueNumber = if ($existingConfig -and $existingConfig.nextIssueNumber) { [int]$existingConfig.nextIssueNumber } else { 1 }
  created = if ($existingConfig -and $existingConfig.created) { $existingConfig.created } else { (Get-Date).ToUniversalTime().ToString('o') }
  updatedAt = (Get-Date).ToUniversalTime().ToString('o')
 }
 if ($PSCmdlet.ShouldProcess((Join-Path $TargetRoot '.agentx' 'config.json'), 'Write config')) {
  $config | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $TargetRoot '.agentx' 'config.json') -Encoding utf8
 }

 $version = [ordered]@{
  version = '8.4.25'
  provider = 'local'
  mode = 'local'
  integration = 'local'
  installedAt = if ($existingVersion -and $existingVersion.installedAt) { $existingVersion.installedAt } else { (Get-Date).ToUniversalTime().ToString('o') }
  updatedAt = (Get-Date).ToUniversalTime().ToString('o')
 }
 if ($PSCmdlet.ShouldProcess((Join-Path $TargetRoot '.agentx' 'version.json'), 'Write version')) {
  $version | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $TargetRoot '.agentx' 'version.json') -Encoding utf8
 }
}

function Install-WorkspaceCliWrappers {
 param([string]$TargetRoot)

 $copied = 0
 $skipped = 0
 $wrappers = @(
  @{ Path = Join-Path $TargetRoot '.agentx' 'agentx.ps1'; Content = Get-PowerShellWrapperContent -EntryFile 'agentx.ps1' },
  @{ Path = Join-Path $TargetRoot '.agentx' 'local-issue-manager.ps1'; Content = Get-PowerShellWrapperContent -EntryFile 'local-issue-manager.ps1' },
  @{ Path = Join-Path $TargetRoot '.agentx' 'agentx.sh'; Content = Get-BashWrapperContent -EntryFile 'agentx.sh' },
  @{ Path = Join-Path $TargetRoot '.agentx' 'local-issue-manager.sh'; Content = Get-BashWrapperContent -EntryFile 'local-issue-manager.sh' }
 )

 foreach ($wrapper in $wrappers) {
  $result = Write-FileIfNeeded -Path $wrapper.Path -Content $wrapper.Content -Overwrite:$Force
  $copied += $result.Copied
  $skipped += $result.Skipped
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

$Source = (Resolve-Path $Source).Path

$Target = [System.IO.Path]::GetFullPath($Target)

# -- Banner -----------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "| AgentX Copilot CLI Plugin v8.4.32        |" -ForegroundColor Cyan
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

$installPlan = Get-PackInstallPlan -ManifestPath $PackManifestPath
Write-Info "Loaded install plan from manifest.json ($(@($installPlan.Entries).Count) entries)"

foreach ($group in @($installPlan.Entries | Group-Object Label)) {
 Write-Info "Installing $($group.Name.ToLower())..."
 $groupCopied = 0
 $groupSkipped = 0

 foreach ($entry in $group.Group) {
  $srcPath = Join-Path $Source $entry.RelativePath
  $destPath = Join-Path $Target $entry.RelativePath

  if ($entry.Type -eq 'tree') {
   $result = Copy-Tree -SrcDir $srcPath -DestDir $destPath -Overwrite:$Force
  } else {
   $result = Copy-FileIfNeeded -SrcPath $srcPath -DestPath $destPath -Overwrite:$Force
  }

  $groupCopied += $result.Copied
  $groupSkipped += $result.Skipped
 }

 $totalCopied += $groupCopied
 $totalSkipped += $groupSkipped
 Write-OK "$($group.Name): $groupCopied copied, $groupSkipped skipped"
}

# CLI utilities (optional)
if ($IncludeCli) {
 Write-Info "Installing CLI runtime bundle..."
 $runtimeResult = Install-CliRuntimeBundle -SourceRoot $Source -TargetRoot $Target
 $totalCopied += $runtimeResult.Copied; $totalSkipped += $runtimeResult.Skipped
 Write-OK "CLI runtime: $($runtimeResult.Copied) copied, $($runtimeResult.Skipped) skipped"

 Write-Info "Seeding CLI workspace state..."
 Initialize-WorkspaceCliState -TargetRoot $Target
 $memoryResult = Install-StarterMemories -SourceRoot $Source -TargetRoot $Target
 $totalCopied += $memoryResult.Copied; $totalSkipped += $memoryResult.Skipped
 Write-OK "Starter memories: $($memoryResult.Copied) copied, $($memoryResult.Skipped) skipped"

 Write-Info "Writing workspace CLI wrappers..."
 $wrapperResult = Install-WorkspaceCliWrappers -TargetRoot $Target
 $totalCopied += $wrapperResult.Copied; $totalSkipped += $wrapperResult.Skipped
 Write-OK "CLI wrappers: $($wrapperResult.Copied) copied, $($wrapperResult.Skipped) skipped"
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
    version = "8.4.32"
  installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
  source = $Source
  includeCli = [bool]$IncludeCli
 } | ConvertTo-Json | Set-Content $versionFile
 Write-OK "Version stamp written to .github/.agentx-cli-plugin.json"
}

# -- Summary ----------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " AgentX Copilot CLI Plugin v8.4.32 installed" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host " Files copied  : $totalCopied" -ForegroundColor White
Write-Host " Files skipped : $totalSkipped (already exist, use -Force to overwrite)" -ForegroundColor DarkGray
Write-Host ""
 Write-Host " Agents        : 21 (13 external + 8 internal)" -ForegroundColor White
 Write-Host " Skills        : 69 across 10 categories" -ForegroundColor White
 Write-Host " Instructions  : 7 (auto-applied by file pattern)" -ForegroundColor White
 Write-Host " Prompts       : 20 reusable templates" -ForegroundColor White
if ($IncludeCli) {
 Write-Host " CLI utilities : 4 wrappers (.agentx/) + bundled runtime (.github/agentx/.agentx)" -ForegroundColor White
}
Write-Host ""
Write-Host " Limitations (Copilot CLI vs VS Code):" -ForegroundColor Yellow
Write-Host "  - No runSubagent: agents run standalone, no agent chaining" -ForegroundColor DarkGray
Write-Host "  - No Mode 1 hub: Agent X cannot orchestrate sub-agents" -ForegroundColor DarkGray
Write-Host "  - Quality loop: Layer 2 (body instructions) + Layer 3 (CLI gate)" -ForegroundColor DarkGray
Write-Host ""
