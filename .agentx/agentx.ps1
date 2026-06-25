#!/usr/bin/env pwsh
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\agentx.ps1 ready
$global:LASTEXITCODE = 0
$launcherWorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Detect the bundled launcher that ships inside the extension at
# <ext>/.github/agentx/.agentx/agentx.ps1 (its parent dir is '.github/agentx').
# Only in that case do we honor an AGENTX_WORKSPACE_ROOT supplied by the thin
# workspace wrapper; otherwise the launcher's own parent is the workspace root.
$launcherParentDir = Split-Path -Parent $launcherWorkspaceRoot
$isBundledLauncher = ((Split-Path -Leaf $launcherWorkspaceRoot) -eq 'agentx') -and $launcherParentDir -and ((Split-Path -Leaf $launcherParentDir) -eq '.github')
if ($isBundledLauncher) {
    if (-not $env:AGENTX_WORKSPACE_ROOT -or -not (Test-Path -LiteralPath $env:AGENTX_WORKSPACE_ROOT -PathType Container)) {
        $env:AGENTX_WORKSPACE_ROOT = $launcherWorkspaceRoot
    }
} else {
    $env:AGENTX_WORKSPACE_ROOT = $launcherWorkspaceRoot
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
