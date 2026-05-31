#!/usr/bin/env pwsh
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\agentx.ps1 ready
$global:LASTEXITCODE = 0
$env:AGENTX_WORKSPACE_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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
