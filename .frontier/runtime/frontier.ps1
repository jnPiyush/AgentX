#!/usr/bin/env pwsh
# Frontier CLI launcher - delegates to frontier-cli.ps1 (PowerShell 7)
# Usage: .\.frontier\runtime\frontier.ps1 ready
$global:LASTEXITCODE = 0
$launcherWorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$launcherParentDir = Split-Path -Parent $launcherWorkspaceRoot
$isBundledLauncher = ((Split-Path -Leaf $launcherWorkspaceRoot) -eq 'frontier') -and $launcherParentDir -and ((Split-Path -Leaf $launcherParentDir) -eq '.github')
$workspaceRootOverride = $env:FRONTIER_WORKSPACE_ROOT
if ($isBundledLauncher) {
    if (-not $workspaceRootOverride -or -not (Test-Path -LiteralPath $workspaceRootOverride -PathType Container)) {
        $workspaceRootOverride = $launcherWorkspaceRoot
    }
} else {
    $workspaceRootOverride = $launcherWorkspaceRoot
}
$env:FRONTIER_WORKSPACE_ROOT = $workspaceRootOverride
if ($args.Count -ge 3 -and $args[0] -ceq 'cursor' -and $args[1] -ceq 'hook') {
    # Cursor runs this hook for every tool call; dispatching directly avoids loading the full CLI.
    if ($IsWindows) {
        $extensions = @($env:PATHEXT -split ';' | Where-Object { $_ })
        $missing = @('.EXE', '.CMD' | Where-Object { $extensions -notcontains $_ })
        if ($missing.Count -gt 0) { $env:PATHEXT = (@($extensions) + @($missing)) -join ';' }
    }
    $nodeCommand = Get-Command $(if ($IsWindows) { 'node.exe' } else { 'node' }) -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($nodeCommand) {
        & $nodeCommand.Source (Join-Path $PSScriptRoot 'cursor.js') --workspace $workspaceRootOverride @($args | Select-Object -Skip 1)
        exit $LASTEXITCODE
    }
}
Push-Location -LiteralPath $workspaceRootOverride
$succeeded = $true
try {
    if ($PSVersionTable.PSEdition -eq 'Core' -and $PSVersionTable.PSVersion.Major -ge 7) {
        & "$PSScriptRoot/frontier-cli.ps1" @args
    } else {
        $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $pwshCommand) {
            Write-Error 'Frontier requires PowerShell 7 (pwsh). Install pwsh or run this command from a PowerShell 7 terminal.'
            $global:LASTEXITCODE = 1
            $succeeded = $false
        } else {
            & $pwshCommand.Source -NoProfile -File "$PSScriptRoot/frontier-cli.ps1" @args
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