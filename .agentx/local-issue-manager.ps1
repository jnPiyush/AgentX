#!/usr/bin/env pwsh
# AgentX Local Issue Manager - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\local-issue-manager.ps1 -Action create -Title "Title" -Labels "type:story"
param(
  [ValidateSet('create','update','close','list','get','comment')]
  [string]$Action = 'list',
  [int]$IssueNumber,
  [string]$Title,
  [string]$Body,
  [string[]]$Labels,
  [string]$Status,
  [string]$Comment
)

$env:AGENTX_WORKSPACE_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $env:AGENTX_WORKSPACE_ROOT

$n = @('issue', $Action)
if ($Title)       { $n += @('-t', $Title) }
if ($IssueNumber) { $n += @('-n', "$IssueNumber") }
if ($Body)        { $n += @('-b', $Body) }
if ($Labels)      { $n += @('-l', ($Labels -join ',')) }
if ($Status)      { $n += @('-s', $Status) }
if ($Comment)     { $n += @('-c', $Comment) }

try {
  if ($PSVersionTable.PSEdition -eq 'Core' -and $PSVersionTable.PSVersion.Major -ge 7) {
    & "$PSScriptRoot/agentx-cli.ps1" @n
  } else {
    $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $pwshCommand) {
      Write-Error 'AgentX requires PowerShell 7 (pwsh). Install pwsh or run this command from a PowerShell 7 terminal.'
      exit 1
    }

    & $pwshCommand.Source -NoProfile -File "$PSScriptRoot/agentx-cli.ps1" @n
  }
} finally {
  Pop-Location
}
