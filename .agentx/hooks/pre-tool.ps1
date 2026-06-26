#!/usr/bin/env pwsh
[CmdletBinding()]
param([string]$Path = $env:AGENTX_CHANGED_PATH)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$traceDir = Join-Path $root '.agentx/state'
$traceFile = Join-Path $traceDir 'hook-trace.jsonl'

function Write-HookTrace {
    param([string]$Status, [string]$Detail)
    if (-not (Test-Path $traceDir)) { New-Item -ItemType Directory -Path $traceDir -Force | Out-Null }
    [pscustomobject]@{
        timestamp = [DateTime]::UtcNow.ToString('o')
        hook = 'pre-tool'
        status = $Status
        detail = $Detail
    } | ConvertTo-Json -Compress | Add-Content -Path $traceFile -Encoding utf8
}

if ([string]::IsNullOrWhiteSpace($Path)) {
    Write-HookTrace -Status 'skipped' -Detail 'AGENTX_CHANGED_PATH was not provided.'
    exit 0
}

$scrub = Join-Path $root 'scripts/scrub.ps1'
if (Test-Path $scrub) {
    & pwsh -NoProfile -File $scrub -Path $Path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-HookTrace -Status 'invoked' -Detail "Scrub passed for $Path."
    exit 0
}

# Zero-copy runtime: the workspace has no scripts/ tree. Delegate to the agentx
# CLI launcher, which resolves the bundled scrub.ps1 from the installed extension.
$cli = Join-Path $root '.agentx/agentx.ps1'
if (Test-Path $cli) {
    & pwsh -NoProfile -File $cli scrub -Path $Path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-HookTrace -Status 'invoked' -Detail "Scrub passed for $Path (via agentx CLI)."
    exit 0
}

Write-HookTrace -Status 'skipped' -Detail 'scrub.ps1 not found (no workspace copy or agentx CLI launcher).'
exit 0