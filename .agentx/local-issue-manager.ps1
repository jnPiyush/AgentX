#!/usr/bin/env pwsh
# AgentX Local Issue Manager - delegates to Node.js CLI
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

$n = @('issue', $Action)
if ($Title)       { $n += @('-t', $Title) }
if ($IssueNumber) { $n += @('-n', "$IssueNumber") }
if ($Body)        { $n += @('-b', $Body) }
if ($Labels)      { $n += @('-l', ($Labels -join ',')) }
if ($Status)      { $n += @('-s', $Status) }
if ($Comment)     { $n += @('-c', $Comment) }

node "$PSScriptRoot/cli.mjs" @n
