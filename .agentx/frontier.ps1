#!/usr/bin/env pwsh
# Frontier CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\frontier.ps1 ready
$global:LASTEXITCODE = 0
$launcherWorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcherParentDir = Split-Path -Parent $launcherWorkspaceRoot
$isBundledLauncher = ((Split-Path -Leaf $launcherWorkspaceRoot) -eq 'frontier') -and $launcherParentDir -and ((Split-Path -Leaf $launcherParentDir) -eq '.github')
$workspaceRootOverride = if ($env:FRONTIER_WORKSPACE_ROOT) {
    $env:FRONTIER_WORKSPACE_ROOT
} elseif ($env:HVE_WORKSPACE_ROOT) {
    $env:HVE_WORKSPACE_ROOT
} else {
    $env:AGENTX_WORKSPACE_ROOT
}
if ($isBundledLauncher) {
    if (-not $workspaceRootOverride -or -not (Test-Path -LiteralPath $workspaceRootOverride -PathType Container)) {
        $workspaceRootOverride = $launcherWorkspaceRoot
    }
} else {
    $workspaceRootOverride = $launcherWorkspaceRoot
}
$env:FRONTIER_WORKSPACE_ROOT = $workspaceRootOverride
$env:AGENTX_WORKSPACE_ROOT = $workspaceRootOverride
Push-Location -LiteralPath $workspaceRootOverride
$succeeded = $true
try {
    if ($PSVersionTable.PSEdition -eq 'Core' -and $PSVersionTable.PSVersion.Major -ge 7) {
        & "$PSScriptRoot/agentx-cli.ps1" @args
    } else {
        $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $pwshCommand) {
            Write-Error 'Frontier requires PowerShell 7 (pwsh). Install pwsh or run this command from a PowerShell 7 terminal.'
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