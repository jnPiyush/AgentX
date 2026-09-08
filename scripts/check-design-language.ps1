#!/usr/bin/env pwsh
#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('check')][string]$Action = 'check',
    [string]$WorkspaceRoot = '',
    [string]$Path = 'src',
    [ValidateRange(1, 300)][int]$TimeoutSeconds = 60,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$root = if ($WorkspaceRoot) { $WorkspaceRoot } elseif ($env:AGENTX_WORKSPACE_ROOT) { $env:AGENTX_WORKSPACE_ROOT } else { (Get-Location).Path }
if (-not (Get-Command node -CommandType Application -ErrorAction SilentlyContinue)) {
    $result = @{ schemaVersion = 1; status = 'DEGRADED'; reason = 'Node 22.18 or newer is required; node is unavailable.' }
    if ($Json) { $result | ConvertTo-Json -Compress } else { Write-Output "[DEGRADED] $($result.reason)" }
    exit 1
}
& node (Join-Path $PSScriptRoot 'check-design-language.js') $root $Path $TimeoutSeconds $(if ($Json) { 'json' } else { 'text' })
exit $LASTEXITCODE
