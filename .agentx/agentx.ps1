#!/usr/bin/env pwsh
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\agentx.ps1 ready
$global:LASTEXITCODE = 0
if ([string]::IsNullOrWhiteSpace($env:AGENTX_WORKSPACE_ROOT) -or -not (Test-Path -LiteralPath $env:AGENTX_WORKSPACE_ROOT)) {
    $env:AGENTX_WORKSPACE_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
Push-Location -LiteralPath $env:AGENTX_WORKSPACE_ROOT
$succeeded = $true
try {
    & "$PSScriptRoot/agentx-cli.ps1" @args
    $succeeded = $?
} finally {
    Pop-Location
}
$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
if (-not $succeeded -and $exitCode -eq 0) {
 $exitCode = 1
}
exit $exitCode
