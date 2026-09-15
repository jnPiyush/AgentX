#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [string]$Issue = $(if ($env:FRONTIER_ISSUE) { $env:FRONTIER_ISSUE } elseif ($env:HVE_ISSUE) { $env:HVE_ISSUE } else { $env:AGENTX_ISSUE }),
    [string]$Prompt = $(if ($env:FRONTIER_TASK) { $env:FRONTIER_TASK } elseif ($env:HVE_TASK) { $env:HVE_TASK } else { $env:AGENTX_TASK })
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$traceDir = Join-Path $root '.frontier/state'
$traceFile = Join-Path $traceDir 'hook-trace.jsonl'

function Write-HookTrace {
    param([string]$Status, [string]$Detail)
    if (-not (Test-Path $traceDir)) { New-Item -ItemType Directory -Path $traceDir -Force | Out-Null }
    [pscustomobject]@{
        timestamp = [DateTime]::UtcNow.ToString('o')
        hook = 'session-start'
        status = $Status
        detail = $Detail
    } | ConvertTo-Json -Compress | Add-Content -Path $traceFile -Encoding utf8
}

$cli = Join-Path $root '.agentx/frontier.ps1'
if (-not (Test-Path $cli)) {
    Write-HookTrace -Status 'skipped' -Detail 'Frontier CLI wrapper not found.'
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Issue) -or [string]::IsNullOrWhiteSpace($Prompt)) {
    Write-HookTrace -Status 'skipped' -Detail 'FRONTIER_ISSUE or FRONTIER_TASK was not provided.'
    exit 0
}

& $cli loop start -p $Prompt -i $Issue
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-HookTrace -Status 'invoked' -Detail "Started loop for issue $Issue."