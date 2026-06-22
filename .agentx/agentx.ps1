#!/usr/bin/env pwsh
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\agentx.ps1 ready
$global:LASTEXITCODE = 0
# Respect an AGENTX_WORKSPACE_ROOT supplied by the caller (the workspace wrapper
# seeded by "Initialize Local Runtime", or the extension host, both point it at
# the user's workspace). Only fall back to this launcher's parent when it is
# unset, so repo/dev invocations still resolve to the repo root. Without this
# guard the launcher would clobber the workspace root and script commands like
# 'scrub' would scan the extension bundle instead of the user's workspace.
if (-not $env:AGENTX_WORKSPACE_ROOT -or -not (Test-Path -LiteralPath $env:AGENTX_WORKSPACE_ROOT -PathType Container)) {
    $env:AGENTX_WORKSPACE_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
Push-Location -LiteralPath $env:AGENTX_WORKSPACE_ROOT
$succeeded = $true
try {
    if ($PSVersionTable.PSEdition -eq 'Core' -and $PSVersionTable.PSVersion.Major -ge 7) {
        & "$PSScriptRoot/agentx-cli.ps1" @args
    } else {
        $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $pwshCommand) {
            Write-Error 'AgentX requires PowerShell 7 (pwsh). Install pwsh or run this command from a PowerShell 7 terminal.'
            $global:LASTEXITCODE = 1
            $succeeded = $false
        } else {
            & $pwshCommand.Source -NoProfile -File "$PSScriptRoot/agentx-cli.ps1" @args
        }
    }
    $succeeded = $?
} finally {
    Pop-Location
}
$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
if (-not $succeeded -and $exitCode -eq 0) {
 $exitCode = 1
}
exit $exitCode
