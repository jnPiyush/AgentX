#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [string]$Issue = $env:AGENTX_ISSUE,
    [string]$Prompt = $env:AGENTX_TASK
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$traceDir = Join-Path $root '.agentx/state'
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

$cli = Join-Path $root '.agentx/agentx.ps1'
if (-not (Test-Path $cli)) {
    Write-HookTrace -Status 'skipped' -Detail 'AgentX CLI wrapper not found.'
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Issue) -or [string]::IsNullOrWhiteSpace($Prompt)) {
    Write-HookTrace -Status 'skipped' -Detail 'AGENTX_ISSUE or AGENTX_TASK was not provided.'
    exit 0
}

& $cli loop start -p $Prompt -i $Issue
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-HookTrace -Status 'invoked' -Detail "Started loop for issue $Issue."