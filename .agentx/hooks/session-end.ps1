#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [string]$Summary = $(if ($env:FRONTIER_FINAL_SUMMARY) { $env:FRONTIER_FINAL_SUMMARY } elseif ($env:HVE_FINAL_SUMMARY) { $env:HVE_FINAL_SUMMARY } else { $env:AGENTX_FINAL_SUMMARY }),
    [string]$Evidence = $(if ($env:FRONTIER_EVIDENCE) { $env:FRONTIER_EVIDENCE } elseif ($env:HVE_EVIDENCE) { $env:HVE_EVIDENCE } else { $env:AGENTX_EVIDENCE }),
    [string]$Passing = $(if ($env:FRONTIER_PASSING_TESTS) { $env:FRONTIER_PASSING_TESTS } elseif ($env:HVE_PASSING_TESTS) { $env:HVE_PASSING_TESTS } else { $env:AGENTX_PASSING_TESTS })
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
        hook = 'session-end'
        status = $Status
        detail = $Detail
    } | ConvertTo-Json -Compress | Add-Content -Path $traceFile -Encoding utf8
}

if ([string]::IsNullOrWhiteSpace($Summary) -or [string]::IsNullOrWhiteSpace($Evidence)) {
    Write-HookTrace -Status 'skipped' -Detail 'Final summary or evidence was not provided.'
    exit 0
}

$cli = Join-Path $root '.agentx/frontier.ps1'
if (-not (Test-Path $cli)) {
    Write-HookTrace -Status 'skipped' -Detail 'Frontier CLI wrapper not found.'
    exit 0
}

$args = @('loop', 'complete', '-s', $Summary, '-e', $Evidence)
if (-not [string]::IsNullOrWhiteSpace($Passing)) { $args += @('--passing', $Passing) }
& $cli @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-HookTrace -Status 'invoked' -Detail 'Completed loop.'