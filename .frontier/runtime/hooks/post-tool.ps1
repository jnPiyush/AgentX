#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [string]$Summary = $env:FRONTIER_ITERATION_SUMMARY,
    [string]$Evidence = $env:FRONTIER_EVIDENCE,
    [string]$Passing = $env:FRONTIER_PASSING_TESTS
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..' '..')).Path
$traceDir = Join-Path $root '.frontier/state'
$traceFile = Join-Path $traceDir 'hook-trace.jsonl'

function Write-HookTrace {
    param([string]$Status, [string]$Detail)
    if (-not (Test-Path $traceDir)) { New-Item -ItemType Directory -Path $traceDir -Force | Out-Null }
    [pscustomobject]@{
        timestamp = [DateTime]::UtcNow.ToString('o')
        hook = 'post-tool'
        status = $Status
        detail = $Detail
    } | ConvertTo-Json -Compress | Add-Content -Path $traceFile -Encoding utf8
}

if ([string]::IsNullOrWhiteSpace($Summary) -or [string]::IsNullOrWhiteSpace($Evidence)) {
    Write-HookTrace -Status 'skipped' -Detail 'Iteration summary or evidence was not provided.'
    exit 0
}

$cli = Join-Path $root '.frontier/runtime/frontier.ps1'
if (-not (Test-Path $cli)) {
    Write-HookTrace -Status 'skipped' -Detail 'Frontier CLI wrapper not found.'
    exit 0
}

$args = @('loop', 'iterate', '-s', $Summary, '-e', $Evidence)
if (-not [string]::IsNullOrWhiteSpace($Passing)) { $args += @('--passing', $Passing) }
& $cli @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-HookTrace -Status 'invoked' -Detail 'Recorded loop iteration.'